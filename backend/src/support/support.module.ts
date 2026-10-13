import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  SupportTicket,
  SupportTicketSchema,
} from './schemas/support-ticket.schema';
import {
  SupportMessage,
  SupportMessageSchema,
} from './schemas/support-message.schema';
import {
  Order,
  OrderSchema,
} from '../orders/schemas/order.schema';
import {
  PurchasedTicket,
  PurchasedTicketSchema,
} from '../purchased-tickets/schemas/purchased-ticket.schema';

import { SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';
import { SupportService } from './support.service';
import { Attachment, AttachmentSchema } from '../attachments/schemas/attachment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: SupportMessage.name, schema: SupportMessageSchema },
      { name: Order.name, schema: OrderSchema },
      { name: PurchasedTicket.name, schema: PurchasedTicketSchema },
      { name: Attachment.name, schema: AttachmentSchema },
    ]),
  ],
  controllers: [SupportController],
  providers: [SupportService, SupportGateway],
  exports: [SupportService, MongooseModule],
})
export class SupportModule {}
