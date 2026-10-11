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
  SupportTicket,
  SupportTicketDocument,
  SupportStatus,
  SupportPriority,
} from './schemas/support-ticket.schema';
import {
  Order,
  OrderDocument,
} from '../orders/schemas/order.schema';
import {
  PurchasedTicket,
  PurchasedTicketDocument,
} from '../purchased-tickets/schemas/purchased-ticket.schema';
import {
  LoggerService,
  PaginationService,
} from '../common';
import {
  CreateSupportTicketDto,
  QuerySupportDto,
} from './dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicketDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PurchasedTicket.name)
    private readonly purchasedModel: Model<PurchasedTicketDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
  ) {}

  // ─────────────────────────────────────────
  // CREATE (customer)
  // ─────────────────────────────────────────
  async create(dto: CreateSupportTicketDto, userId: string) {
    // Link to order — ownership verify
    if (dto.orderId) {
      if (!Types.ObjectId.isValid(dto.orderId)) {
        throw new BadRequestException({
          code: 'INVALID_ORDER_ID',
          message: 'Invalid order id',
        });
      }
      const order = await this.orderModel.findById(dto.orderId).lean().exec();
      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        });
      }
      if (order.userId.toString() !== userId) {
        throw new ForbiddenException({
          code: 'ORDER_ACCESS_DENIED',
          message: 'Order does not belong to you',
        });
      }
    }

    // Link to purchased ticket — ownership verify
    if (dto.purchasedTicketId) {
      if (!Types.ObjectId.isValid(dto.purchasedTicketId)) {
        throw new BadRequestException({
          code: 'INVALID_TICKET_ID',
          message: 'Invalid purchased ticket id',
        });
      }
      const pt = await this.purchasedModel
        .findById(dto.purchasedTicketId)
        .lean()
        .exec();
      if (!pt) {
        throw new NotFoundException({
          code: 'PURCHASED_TICKET_NOT_FOUND',
          message: 'Purchased ticket not found',
        });
      }
      if (pt.userId.toString() !== userId) {
        throw new ForbiddenException({
          code: 'TICKET_ACCESS_DENIED',
          message: 'Ticket does not belong to you',
        });
      }
    }

    const ticketCode = await this.generateTicketCode();

    const ticket = await this.ticketModel.create({
      ticketCode,
      subject: dto.subject,
      description: dto.description,
      category: dto.category,
      priority: dto.priority ?? SupportPriority.MEDIUM,
      status: SupportStatus.OPEN,
      customerId: new Types.ObjectId(userId),
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : null,
      purchasedTicketId: dto.purchasedTicketId
        ? new Types.ObjectId(dto.purchasedTicketId)
        : null,
      messageCount: 0,
    });

    this.logger.log(
      `Support ticket created: ${ticketCode}`,
      SupportService.name,
    );

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // LIST — customer (own)
  // ─────────────────────────────────────────
  async findMine(userId: string, query: QuerySupportDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = {
      customerId: new Types.ObjectId(userId),
    };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  // ─────────────────────────────────────────
  // LIST — agent/admin (all)
  // ─────────────────────────────────────────
  async findAll(query: QuerySupportDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.agentId) filter.agentId = new Types.ObjectId(query.agentId);
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.q) filter.$text = { $search: query.q };

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .populate('customerId', 'email fullName')
        .populate('agentId', 'email fullName')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  // ─────────────────────────────────────────
  // DETAIL — owner or agent/admin
  // ─────────────────────────────────────────
  async findById(id: string, userId: string, isStaff: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel
      .findById(id)
      .populate('customerId', 'email fullName')
      .populate('agentId', 'email fullName')
      .lean()
      .exec();

    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (!isStaff && ticket.customerId._id.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not have access to this ticket',
      });
    }

    return ticket;
  }

  // ─────────────────────────────────────────
  // UPDATE — subject/description (owner only, only if OPEN)
  // ─────────────────────────────────────────
  async update(
    id: string,
    userId: string,
    patch: { subject?: string; description?: string },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (ticket.customerId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not own this ticket',
      });
    }

    if (ticket.status !== SupportStatus.OPEN) {
      throw new BadRequestException({
        code: 'TICKET_NOT_EDITABLE',
        message: 'Only OPEN tickets can be edited',
      });
    }

    if (patch.subject !== undefined) ticket.subject = patch.subject;
    if (patch.description !== undefined) ticket.description = patch.description;
    await ticket.save();

    this.logger.log(
      `Support ticket updated: ${ticket.ticketCode}`,
      SupportService.name,
    );

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // ASSIGN AGENT (admin/agent)
  // ─────────────────────────────────────────
  async assignAgent(id: string, agentId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException({
        code: 'INVALID_AGENT_ID',
        message: 'Invalid agent id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    ticket.agentId = new Types.ObjectId(agentId);
    if (ticket.status === SupportStatus.OPEN) {
      ticket.status = SupportStatus.IN_PROGRESS;
    }
    await ticket.save();

    this.logger.log(
      `Ticket assigned: ${ticket.ticketCode} → agent ${agentId}`,
      SupportService.name,
    );

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // UPDATE STATUS (agent/admin)
  // ─────────────────────────────────────────
  async updateStatus(
    id: string,
    status: SupportStatus,
    note?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (ticket.status === SupportStatus.CLOSED) {
      throw new BadRequestException({
        code: 'TICKET_CLOSED',
        message: 'Cannot update a closed ticket',
      });
    }

    ticket.status = status;

    if (status === SupportStatus.RESOLVED) {
      ticket.resolvedAt = new Date();
      if (note) ticket.resolutionNote = note;
    }
    if (status === SupportStatus.CLOSED) {
      ticket.closedAt = new Date();
      if (note) ticket.resolutionNote = note;
    }

    await ticket.save();

    this.logger.log(
      `Ticket status: ${ticket.ticketCode} → ${status}`,
      SupportService.name,
    );

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // UPDATE PRIORITY (agent/admin)
  // ─────────────────────────────────────────
  async updatePriority(id: string, priority: SupportPriority) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        { $set: { priority } },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    this.logger.log(
      `Ticket priority: ${ticket.ticketCode} → ${priority}`,
      SupportService.name,
    );

    return ticket;
  }

  // ─────────────────────────────────────────
  // RESOLVE (agent/admin)
  // ─────────────────────────────────────────
  async resolve(id: string, note?: string) {
    return this.updateStatus(id, SupportStatus.RESOLVED, note);
  }

  // ─────────────────────────────────────────
  // CLOSE (agent/admin)
  // ─────────────────────────────────────────
  async close(id: string, note?: string) {
    return this.updateStatus(id, SupportStatus.CLOSED, note);
  }

  // ─────────────────────────────────────────
  // REOPEN (agent/admin)
  // ─────────────────────────────────────────
  async reopen(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (
      ticket.status !== SupportStatus.RESOLVED &&
      ticket.status !== SupportStatus.CLOSED
    ) {
      throw new BadRequestException({
        code: 'TICKET_NOT_RESOLVED',
        message: 'Only resolved or closed tickets can be reopened',
      });
    }

    ticket.status = SupportStatus.OPEN;
    ticket.resolvedAt = undefined;
    ticket.closedAt = undefined;
    ticket.resolutionNote = undefined;
    await ticket.save();

    this.logger.log(
      `Ticket reopened: ${ticket.ticketCode}`,
      SupportService.name,
    );

    return ticket.toObject();
  }

  private async generateTicketCode(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const code = `TKT-${ymd}-${nanoid(6).toUpperCase()}`;
      const exists = await this.ticketModel.exists({ ticketCode: code });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique ticket code');
  }
}
