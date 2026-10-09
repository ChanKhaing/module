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
import { LoggerService, PaginationService } from '../common';
import { RedisService, RedisKeys } from '../infra/redis';
import { InitiatePaymentDto, ConfirmPaymentDto, ConfirmOutcome, QueryPaymentDto, MockWebhookDto } from './dto';
import { PurchasedTicketsService } from '../purchased-tickets/purchased-tickets.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
    private readonly purchasedTickets: PurchasedTicketsService,
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

    // ─── Idempotency: same key → same payment ───
    if (dto.idempotencyKey) {
      const byKey = await this.paymentModel.findOne({
        idempotencyKey: dto.idempotencyKey,
      }).exec();
      if (byKey) {
        if (byKey.userId.toString() !== userId) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            message: 'Idempotency key belongs to another user',
          });
        }
        this.logger.log(
          `Idempotent hit: ${byKey.paymentCode} (key=${dto.idempotencyKey})`,
          PaymentsService.name,
        );
        return byKey.toObject();
      }
    }

    // ─── If order already has a successful payment → conflict ───
    const success = await this.paymentModel.findOne({
      orderId: order._id,
      status: PaymentStatus.SUCCESS,
    }).exec();
    if (success) {
      throw new ConflictException({
        code: 'ORDER_ALREADY_PAID',
        message: 'This order already has a successful payment',
      });
    }

    // ─── Existing pending payment for same order → return it ───
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

    const previousCount = await this.paymentModel.countDocuments({
      orderId: order._id,
      userId: new Types.ObjectId(userId),
    });
    const attempt = previousCount + 1;

    const paymentCode = await this.generatePaymentCode();

    let payment: PaymentDocument;
    try {
      payment = await this.paymentModel.create({
        paymentCode,
        orderId: order._id,
        userId: new Types.ObjectId(userId),
        amount: order.totalAmount,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
        attempt: attempt,
        retryCount: 0,
      });
    } catch (err: any) {
      // E11000 = duplicate key (idempotencyKey race OR success partial unique)
      if (err?.code === 11000) {
        // Re-check idempotency key first
        if (dto.idempotencyKey) {
          const byKey = await this.paymentModel.findOne({
            idempotencyKey: dto.idempotencyKey,
          }).exec();
          if (byKey) {
            this.logger.warn(
              `Idempotency race resolved: ${byKey.paymentCode}`,
              PaymentsService.name,
            );
            return byKey.toObject();
          }
        }
        // Success partial unique → order already has successful payment
        throw new ConflictException({
          code: 'PAYMENT_DUPLICATE',
          message: 'Payment already exists for this order',
        });
      }
      throw err;
    }

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

  // ─────────────────────────────────────────
  // CONFIRM (mock success/fail) — Feature 7.2
  // ─────────────────────────────────────────
  async confirm(id: string, dto: ConfirmPaymentDto, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid payment id' });
    }

    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }

    if (payment.userId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'PAYMENT_ACCESS_DENIED',
        message: 'You can only confirm your own payments',
      });
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_SUCCESS',
        message: 'This payment is already completed',
      });
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new ConflictException({
        code: 'PAYMENT_REFUNDED',
        message: 'This payment has been refunded',
      });
    }

    const order = await this.orderModel.findById(payment.orderId).exec();
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
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

    const now = new Date();

    // ─── FAIL path ───
    if (dto.outcome === ConfirmOutcome.FAIL) {
      payment.status = PaymentStatus.FAILED;
      payment.failedAt = now;
      payment.failureReason = dto.failureReason ?? 'Mock payment failure';
      payment.retryCount += 1;
      await payment.save();

      this.logger.warn(
        `Payment failed: ${payment.paymentCode} (order=${order.orderCode})`,
        PaymentsService.name,
      );

      return {
        message: 'Payment failed',
        paymentCode: payment.paymentCode,
        status: payment.status,
        retryCount: payment.retryCount,
      };
    }

    // ─── SUCCESS path (atomic guard) ───
    const updated = await this.paymentModel.findOneAndUpdate(
      { _id: payment._id, status: { $ne: PaymentStatus.SUCCESS } },
      {
        $set: {
          status: PaymentStatus.SUCCESS,
          paidAt: now,
          attempt: payment.attempt,
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_SUCCESS',
        message: 'Payment was completed concurrently',
      });
    }

    order.status = OrderStatus.PAID;
    order.paidAt = now;
    await order.save();

    // ─── Auto-issue purchased tickets (Feature 7.4) ───
    try {
      const result = await this.purchasedTickets.issueFromOrder(order);
      this.logger.log(
        `Tickets issued for ${order.orderCode}: ${result.issued}`,
        PaymentsService.name,
      );
    } catch (err) {
      this.logger.error(
        `Ticket issue failed for ${order.orderCode}: ${(err as Error).message}`,
        (err as Error).stack,
        PaymentsService.name,
      );
      // Don't fail the payment — admin can re-issue manually
    }

    await this.redis.del(RedisKeys.bookingTemp(order._id.toString()));

    this.logger.log(
      `Payment success: ${payment.paymentCode} (order=${order.orderCode})`,
      PaymentsService.name,
    );

    return {
      message: 'Payment successful',
      paymentCode: payment.paymentCode,
      orderCode: order.orderCode,
      status: PaymentStatus.SUCCESS,
    };
  }

  // ─────────────────────────────────────────
  // MY PAYMENTS (list)
  // ─────────────────────────────────────────
  async findMine(userId: string, query: QueryPaymentDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);
    const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;
    if (query.orderId) filter.orderId = new Types.ObjectId(query.orderId);

    const [data, total] = await Promise.all([
      this.paymentModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);
    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  // ─────────────────────────────────────────
  // DETAIL (self or admin)
  // ─────────────────────────────────────────
  async findById(id: string, userId: string, roles: string[]) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid payment id' });
    }

    const payment = await this.paymentModel.findById(id)
      .populate('orderId', 'orderCode totalAmount status')
      .lean()
      .exec();

    if (!payment) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }

    const isOwner = (payment.userId as any)?.toString() === userId;
    const isAdmin = roles.includes('admin');
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'PAYMENT_ACCESS_DENIED',
        message: 'You do not have access to this payment',
      });
    }
    return payment;
  }

  // ─────────────────────────────────────────
  // ADMIN LIST — all payments with filters
  // ─────────────────────────────────────────
  async findAllAdmin(query: QueryPaymentDto, roles: string[]) {
    if (!roles.includes('admin')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Admin access required',
      });
    }

    const { page, limit, skip, sort } = this.pagination.normalize(query);
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.orderId) filter.orderId = new Types.ObjectId(query.orderId);

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email fullName')
        .populate('orderId', 'orderCode totalAmount status')
        .lean()
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  // ─────────────────────────────────────────
  // MOCK WEBHOOK — simulate external callback
  // (B-127 webhook concept)
  // ─────────────────────────────────────────
  async mockWebhook(dto: MockWebhookDto, roles: string[]) {
    if (!roles.includes('admin')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Admin access required',
      });
    }

    if (!Types.ObjectId.isValid(dto.paymentId)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid payment id' });
    }

    const payment = await this.paymentModel.findById(dto.paymentId).exec();
    if (!payment) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }

    const order = await this.orderModel.findById(payment.orderId).exec();
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    const now = new Date();

    // Store webhook metadata
    payment.metadata = {
      ...(payment.metadata ?? {}),
      webhookSource: 'mock',
      webhookAt: now.toISOString(),
      webhookOutcome: dto.outcome,
      ...(dto.metadata ?? {}),
    };

    if (dto.outcome === ConfirmOutcome.FAIL) {
      payment.status = PaymentStatus.FAILED;
      payment.failedAt = now;
      payment.failureReason = dto.failureReason ?? 'Webhook failure';
      payment.retryCount += 1;
      await payment.save();

      this.logger.warn(
        `Mock webhook → FAILED: ${payment.paymentCode}`,
        PaymentsService.name,
      );

      return {
        message: 'Webhook processed (failed)',
        paymentCode: payment.paymentCode,
        status: payment.status,
      };
    }

    // Success — atomic guard
    const updated = await this.paymentModel.findOneAndUpdate(
      { _id: payment._id, status: { $ne: PaymentStatus.SUCCESS } },
      {
        $set: {
          status: PaymentStatus.SUCCESS,
          paidAt: now,
          metadata: payment.metadata,
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_SUCCESS',
        message: 'Payment was already successful',
      });
    }

    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.PAID;
      order.paidAt = now;
      await order.save();

      try {
        await this.purchasedTickets.issueFromOrder(order);
      } catch (err) {
        this.logger.error(
          `Ticket issue via webhook failed: ${(err as Error).message}`,
          (err as Error).stack,
          PaymentsService.name,
        );
      }

      await this.redis.del(RedisKeys.bookingTemp(order._id.toString()));
    }

    this.logger.log(
      `Mock webhook → SUCCESS: ${payment.paymentCode} (order=${order.orderCode})`,
      PaymentsService.name,
    );

    return {
      message: 'Webhook processed (success)',
      paymentCode: payment.paymentCode,
      orderCode: order.orderCode,
      status: PaymentStatus.SUCCESS,
    };
  }
}
