import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';

import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from './schemas/payment.schema';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../orders/schemas/order.schema';
import { LoggerService } from '../common';
import { RedisService, RedisKeys } from '../infra/redis';
import { InitiatePaymentDto } from './dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────
  // INITIATE (Feature 7.1)
  // ─────────────────────────────────────────
  async initiate(dto: InitiatePaymentDto, userId: string) {
    if (!Types.ObjectId.isValid(dto.orderId)) {
      throw new BadRequestException({
        code: 'INVALID_ORDER_ID',
        message: 'Invalid order id',
      });
    }

    const order = await this.orderModel.findById(dto.orderId).exec();
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    if (order.userId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'ORDER_ACCESS_DENIED',
        message: 'You can only pay for your own orders',
      });
    }

    if (order.status === OrderStatus.PAID) {
      throw new ConflictException({
        code: 'ORDER_ALREADY_PAID',
        message: 'This order is already paid',
      });
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException({
        code: 'ORDER_NOT_PAYABLE',
        message: `Cannot pay order with status "${order.status}"`,
      });
    }

    if (order.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'ORDER_EXPIRED',
        message: 'This order has expired',
      });
    }

    // Existing pending payment for same order → return it
    const existing = await this.paymentModel.findOne({
      orderId: order._id,
      userId: new Types.ObjectId(userId),
      status: PaymentStatus.PENDING,
    }).exec();

    if (existing) {
      this.logger.log(
        `Reusing pending payment: ${existing.paymentCode} (order=${order.orderCode})`,
        PaymentsService.name,
      );
      return existing.toObject();
    }

    const paymentCode = await this.generatePaymentCode();

    const payment = await this.paymentModel.create({
      paymentCode,
      orderId: order._id,
      userId: new Types.ObjectId(userId),
      amount: order.totalAmount,
      currency: order.currency,
      status: PaymentStatus.PENDING,
      idempotencyKey: dto.idempotencyKey,
      attempt: 1,
      retryCount: 0,
    });

    this.logger.log(
      `Payment initiated: ${paymentCode} (order=${order.orderCode}, amount=${order.totalAmount} ${order.currency})`,
      PaymentsService.name,
    );

    return payment.toObject();
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────
  private async generatePaymentCode(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const code = `PAY-${ymd}-${nanoid(8).toUpperCase()}`;
      const exists = await this.paymentModel.exists({ paymentCode: code });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique payment code');
  }
}
