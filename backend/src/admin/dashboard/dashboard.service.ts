import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  TicketProduct,
  TicketProductDocument,
  TicketStatus,
} from '../../tickets/schemas/ticket-product.schema';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from '../../payments/schemas/payment.schema';
import {
  PurchasedTicket,
  PurchasedTicketDocument,
} from '../../purchased-tickets/schemas/purchased-ticket.schema';
import {
  SupportTicket,
  SupportTicketDocument,
  SupportStatus,
} from '../../support/schemas/support-ticket.schema';
import { ClickHouseService } from '../../infra/clickhouse';
import { LoggerService } from '../../common';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(TicketProduct.name)
    private readonly ticketModel: Model<TicketProductDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(PurchasedTicket.name)
    private readonly purchasedModel: Model<PurchasedTicketDocument>,
    @InjectModel(SupportTicket.name)
    private readonly supportModel: Model<SupportTicketDocument>,
    private readonly clickhouse: ClickHouseService,
    private readonly logger: LoggerService,
  ) {}

  async getStats() {
    const [
      totalUsers,
      activeUsers,
      totalTickets,
      publishedTickets,
      totalOrders,
      pendingOrders,
      paidOrders,
      totalPayments,
      successfulPayments,
      totalPurchased,
      usedPurchased,
      totalSupport,
      openSupport,
    ] = await Promise.all([
      this.userModel.countDocuments({ deletedAt: null }),
      this.userModel.countDocuments({ status: 'active', deletedAt: null }),
      this.ticketModel.countDocuments(),
      this.ticketModel.countDocuments({ status: TicketStatus.PUBLISHED }),
      this.orderModel.countDocuments(),
      this.orderModel.countDocuments({ status: 'pending' }),
      this.orderModel.countDocuments({ status: 'paid' }),
      this.paymentModel.countDocuments(),
      this.paymentModel.countDocuments({ status: PaymentStatus.SUCCESS }),
      this.purchasedModel.countDocuments(),
      this.purchasedModel.countDocuments({ status: 'used' }),
      this.supportModel.countDocuments(),
      this.supportModel.countDocuments({ status: SupportStatus.OPEN }),
    ]);

    // Revenue from successful payments
    const revenueAgg = await this.paymentModel.aggregate<{
      _id: null;
      total: number;
    }>([
      { $match: { status: PaymentStatus.SUCCESS } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total ?? 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      tickets: {
        total: totalTickets,
        published: publishedTickets,
        draft: totalTickets - publishedTickets,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
      },
      payments: {
        total: totalPayments,
        successful: successfulPayments,
        failed: totalPayments - successfulPayments,
        totalRevenue,
        currency: 'MMK',
      },
      purchasedTickets: {
        total: totalPurchased,
        used: usedPurchased,
        unused: totalPurchased - usedPurchased,
      },
      support: {
        total: totalSupport,
        open: openSupport,
        closed: totalSupport - openSupport,
      },
    };
  }

  async getRecentActivity(limit = 10) {
    // Query ClickHouse activity_logs
    const rows = await this.clickhouse.query<{
      timestamp: string;
      user_id: string;
      event_type: string;
      entity: string;
      entity_id: string;
    }>(
      `SELECT timestamp, user_id, event_type, entity, entity_id
       FROM activity_logs
       ORDER BY timestamp DESC
       LIMIT ${Math.min(50, Math.max(1, limit))}`,
    );
    return { data: rows };
  }
}
