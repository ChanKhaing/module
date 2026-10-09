import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  PurchasedTicket,
  PurchasedTicketSchema,
} from './schemas/purchased-ticket.schema';
import { PurchasedTicketsService } from './purchased-tickets.service';
import { PurchasedTicketsController } from './purchased-tickets.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchasedTicket.name, schema: PurchasedTicketSchema },
    ]),
  ],
  controllers: [PurchasedTicketsController],
  providers: [PurchasedTicketsService],
  exports: [PurchasedTicketsService, MongooseModule],
})
export class PurchasedTicketsModule {}
