import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  PurchasedTicket,
  PurchasedTicketSchema,
} from './schemas/purchased-ticket.schema';
import { PurchasedTicketsService } from './purchased-tickets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchasedTicket.name, schema: PurchasedTicketSchema },
    ]),
  ],
  providers: [PurchasedTicketsService],
  exports: [PurchasedTicketsService, MongooseModule],
})
export class PurchasedTicketsModule {}
