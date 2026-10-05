import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';

import {
  Order, OrderDocument, OrderStatus,
} from './schemas/order.schema';
import {
  TicketProduct, TicketProductDocument, TicketStatus,
} from '../tickets/schemas/ticket-product.schema';
import { LoggerService, PaginationService } from '../common';
import { RedisService, RedisKeys } from '../infra/redis';
import { CreateOrderDto, QueryOrderDto } from './dto';

const ORDER_TTL_SECONDS = 15 * 60;
const MAX_ORDER_ITEMS = 10;

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(TicketProduct.name)
    private readonly ticketModel: Model<TicketProductDocument>,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    if (dto.items.length > MAX_ORDER_ITEMS) {
      throw new BadRequestException({
        code: 'ORDER_TOO_MANY_ITEMS',
        message: `Maximum ${MAX_ORDER_ITEMS} items per order`,
      });
    }

    const grouped = new Map<string, number>();
    for (const item of dto.items) {
      grouped.set(item.ticketId, (grouped.get(item.ticketId) ?? 0) + item.qty);
    }

    const reserved: Array<{ ticketId: string; qty: number }> = [];
    const orderItems: Array<{
      ticketId: Types.ObjectId; name: string;
      price: number; qty: number; subtotal: number;
    }> = [];
    let totalAmount = 0;
    let currency = 'MMK';

    try {
      for (const [ticketId, qty] of grouped) {
        if (!Types.ObjectId.isValid(ticketId)) {
          throw new BadRequestException({
            code: 'INVALID_TICKET_ID',
            message: `Invalid ticket id: ${ticketId}`,
          });
        }

        const ticket = await this.ticketModel
          .findOneAndUpdate(
            {
              _id: new Types.ObjectId(ticketId),
              status: TicketStatus.PUBLISHED,
              $expr: { $gte: [{ $subtract: ['$quantity', '$sold'] }, qty] },
            },
            { $inc: { sold: qty } },
            { new: true },
          )
          .lean()
          .exec();

        if (!ticket) {
          const exists = await this.ticketModel.findById(ticketId).lean().exec();
          if (!exists) {
            throw new NotFoundException({
              code: 'TICKET_NOT_FOUND',
              message: `Ticket ${ticketId} not found`,
            });
          }
          if (exists.status !== TicketStatus.PUBLISHED) {
            throw new BadRequestException({
              code: 'TICKET_NOT_AVAILABLE',
              message: `Ticket "${exists.name}" is not available`,
            });
          }
          const available = exists.quantity - exists.sold;
          throw new BadRequestException({
            code: 'TICKET_INSUFFICIENT_STOCK',
            message: `Ticket "${exists.name}" only has ${available} left (requested ${qty})`,
          });
        }

        reserved.push({ ticketId, qty });
        orderItems.push({
          ticketId: new Types.ObjectId(ticketId),
          name: ticket.name,
          price: ticket.price,
          qty,
          subtotal: ticket.price * qty,
        });
        totalAmount += ticket.price * qty;
        currency = ticket.currency;
      }

      const orderCode = await this.generateOrderCode();
      const expiresAt = new Date(Date.now() + ORDER_TTL_SECONDS * 1000);

      const order = await this.orderModel.create({
        orderCode,
        userId: new Types.ObjectId(userId),
        items: orderItems,
        totalAmount,
        currency,
        status: OrderStatus.PENDING,
        expiresAt,
        note: dto.note,
      });

      const redisKey = RedisKeys.bookingTemp(order._id.toString());
      await this.redis.set(
        redisKey,
        JSON.stringify({ orderCode, userId, totalAmount }),
        ORDER_TTL_SECONDS,
      );

      this.logger.log(
        `Order created: ${orderCode} (${orderItems.length} items, ${totalAmount} ${currency})`,
        OrdersService.name,
      );

      return order.toObject();
    } catch (err) {
      for (const { ticketId, qty } of reserved) {
        await this.ticketModel
          .updateOne({ _id: new Types.ObjectId(ticketId) }, { $inc: { sold: -qty } })
          .exec();
      }
      if (reserved.length > 0) {
        this.logger.warn(
          `Order create failed — rolled back ${reserved.length} reservations`,
          OrdersService.name,
        );
      }
      throw err;
    }
  }

  private async generateOrderCode(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const code = `ORD-${ymd}-${nanoid(8).toUpperCase()}`;
      const exists = await this.orderModel.exists({ orderCode: code });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique order code');
  }

  async findMine(userId: string, query: QueryOrderDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);
    const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  async findAllAdmin(query: QueryOrderDto, roles: string[]) {
    if (!roles.includes('admin')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Admin access required',
      });
    }

    const { page, limit, skip, sort } = this.pagination.normalize(query);
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).sort(sort).skip(skip).limit(limit)
        .populate('userId', 'email fullName').lean().exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  async findById(id: string, userId: string, roles: string[]) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid order id' });
    }

    const order = await this.orderModel.findById(id)
      .populate('userId', 'email fullName').lean().exec();

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    const isOwner = (order.userId as any)?._id?.toString() === userId;
    const isAdmin = roles.includes('admin');
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'ORDER_ACCESS_DENIED',
        message: 'You do not have access to this order',
      });
    }
    return order;
  }
}
