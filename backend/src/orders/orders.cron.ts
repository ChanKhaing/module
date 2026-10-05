import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import {
  TicketProduct, TicketProductDocument,
} from '../tickets/schemas/ticket-product.schema';
import { LoggerService } from '../common';
import { RedisService, RedisKeys } from '../infra/redis';

@Injectable()
export class OrdersCron {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(TicketProduct.name)
    private readonly ticketModel: Model<TicketProductDocument>,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireOrders() {
    const expired = await this.orderModel
      .find({
        status: OrderStatus.PENDING,
        expiresAt: { $lte: new Date() },
      })
      .lean()
      .exec();

    if (expired.length === 0) return;

    for (const order of expired) {
      for (const item of order.items) {
        await this.ticketModel
          .updateOne({ _id: item.ticketId }, { $inc: { sold: -item.qty } })
          .exec();
      }
      await this.orderModel
        .updateOne(
          { _id: order._id },
          { $set: { status: OrderStatus.EXPIRED } },
        )
        .exec();
      await this.redis.del(RedisKeys.bookingTemp(order._id.toString()));
    }

    this.logger.log(`Expired ${expired.length} pending orders`, OrdersCron.name);
  }
}
