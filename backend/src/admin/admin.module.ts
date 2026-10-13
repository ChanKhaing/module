import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../users/schemas/user.schema';
import {
  TicketProduct,
  TicketProductSchema,
} from '../tickets/schemas/ticket-product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import {
  PurchasedTicket,
  PurchasedTicketSchema,
} from '../purchased-tickets/schemas/purchased-ticket.schema';
import {
  SupportTicket,
  SupportTicketSchema,
} from '../support/schemas/support-ticket.schema';

import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TicketProduct.name, schema: TicketProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: PurchasedTicket.name, schema: PurchasedTicketSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class AdminModule {}
