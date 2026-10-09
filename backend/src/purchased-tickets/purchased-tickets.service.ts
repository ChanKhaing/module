import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';

import {
  PurchasedTicket,
  PurchasedTicketDocument,
  PurchasedTicketStatus,
} from './schemas/purchased-ticket.schema';
import { OrderDocument } from '../orders/schemas/order.schema';
import { LoggerService } from '../common';

@Injectable()
export class PurchasedTicketsService {
  constructor(
    @InjectModel(PurchasedTicket.name)
    private readonly ticketModel: Model<PurchasedTicketDocument>,
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────
  // ISSUE — for each item, create qty tickets
  // ─────────────────────────────────────────
  async issueFromOrder(order: OrderDocument) {
    // Idempotent guard: if order already has tickets → skip
    const existing = await this.ticketModel.countDocuments({
      orderId: order._id,
    });
    if (existing > 0) {
      this.logger.warn(
        `Tickets already issued for order ${order.orderCode} (${existing})`,
        PurchasedTicketsService.name,
      );
      return { issued: 0, skipped: existing };
    }

    const now = new Date();
    const docs: Partial<PurchasedTicket>[] = [];

    for (const item of order.items) {
      for (let i = 0; i < item.qty; i++) {
        docs.push({
          code: this.generateTicketCode(),
          qrPayload: nanoid(32),
          userId: order.userId,
          orderId: order._id,
          ticketId: item.ticketId,
          ticketName: item.name,
          price: item.price,
          currency: order.currency,
          status: PurchasedTicketStatus.ISSUED,
          issuedAt: now,
        });
      }
    }

    const created = await this.ticketModel.insertMany(docs, { ordered: true });

    this.logger.log(
      `Issued ${created.length} ticket(s) for order ${order.orderCode}`,
      PurchasedTicketsService.name,
    );

    return { issued: created.length };
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ═══════════════════════════════════════════════════════════
  private generateTicketCode(): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `TKT-${ymd}-${nanoid(10).toUpperCase()}`;
  }
}
