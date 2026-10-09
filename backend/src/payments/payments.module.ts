import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PurchasedTicketsModule } from '../purchased-tickets/purchased-tickets.module';

@Module({
  imports: [
    PurchasedTicketsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, MongooseModule],
})
export class PaymentsModule {}
