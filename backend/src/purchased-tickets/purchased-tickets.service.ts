import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';

import {
  PurchasedTicket,
  PurchasedTicketDocument,
  PurchasedTicketStatus,
} from './schemas/purchased-ticket.schema';
import { OrderDocument } from '../orders/schemas/order.schema';
import { LoggerService, PaginationService } from '../common';
import { QueryPurchasedTicketDto, RedeemTicketDto, ValidateQrDto } from './dto';

@Injectable()
export class PurchasedTicketsService {
  constructor(
    @InjectModel(PurchasedTicket.name)
    private readonly ticketModel: Model<PurchasedTicketDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
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

  // ─────────────────────────────────────────
  // MY TICKETS (list)
  // ─────────────────────────────────────────
  async findMine(userId: string, query: QueryPurchasedTicketDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = {
      userId: new Types.ObjectId(userId),
    };
    if (query.status) filter.status = query.status;
    if (query.orderId) filter.orderId = new Types.ObjectId(query.orderId);
    if (query.ticketId) filter.ticketId = new Types.ObjectId(query.ticketId);

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  // ─────────────────────────────────────────
  // DETAIL (self or admin)
  // ─────────────────────────────────────────
  async findById(id: string, userId: string, roles: string[]) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel
      .findById(id)
      .populate('orderId', 'orderCode totalAmount status')
      .populate('ticketId', 'name eventDate category')
      .lean()
      .exec();

    if (!ticket) {
      throw new NotFoundException({
        code: 'PURCHASED_TICKET_NOT_FOUND',
        message: 'Purchased ticket not found',
      });
    }

    const isOwner = (ticket.userId as any)?.toString() === userId;
    const isAdmin = roles.includes('admin');
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not have access to this ticket',
      });
    }

    return ticket;
  }

  // ─────────────────────────────────────────
  // VALIDATE QR (agent) — check without using
  // ─────────────────────────────────────────
  async validateQr(dto: ValidateQrDto) {
    const ticket = await this.ticketModel
      .findOne({ qrPayload: dto.qrPayload })
      .populate('orderId', 'orderCode')
      .populate('ticketId', 'name eventDate')
      .lean()
      .exec();

    if (!ticket) {
      return {
        valid: false,
        reason: 'NOT_FOUND',
        message: 'QR code not recognized',
      };
    }

    if (ticket.status === PurchasedTicketStatus.USED) {
      return {
        valid: false,
        reason: 'ALREADY_USED',
        usedAt: ticket.usedAt,
        code: ticket.code,
      };
    }

    if (ticket.status === PurchasedTicketStatus.CANCELLED) {
      return {
        valid: false,
        reason: 'CANCELLED',
        code: ticket.code,
      };
    }

    if (ticket.status === PurchasedTicketStatus.REFUNDED) {
      return {
        valid: false,
        reason: 'REFUNDED',
        code: ticket.code,
      };
    }

    return {
      valid: true,
      code: ticket.code,
      ticketName: ticket.ticketName,
      status: ticket.status,
      order: (ticket.orderId as any)?.orderCode,
      event: (ticket.ticketId as any)?.name,
      eventDate: (ticket.ticketId as any)?.eventDate,
    };
  }

  // ─────────────────────────────────────────
  // REDEEM (agent) — mark as used
  // ─────────────────────────────────────────
  async redeem(dto: ValidateQrDto, _dto: RedeemTicketDto | null, agentId: string) {
    const check = await this.validateQr(dto);
    if (!check.valid) {
      throw new BadRequestException({
        code: `TICKET_${check.reason}`,
        message: check.message ?? `Cannot redeem: ${check.reason}`,
      });
    }

    const now = new Date();
    // Atomic guard: only if still 'issued'
    const updated = await this.ticketModel.findOneAndUpdate(
      { qrPayload: dto.qrPayload, status: PurchasedTicketStatus.ISSUED },
      { $set: { status: PurchasedTicketStatus.USED, usedAt: now } },
      { new: true },
    ).exec();

    if (!updated) {
      throw new BadRequestException({
        code: 'TICKET_REDEEM_RACE',
        message: 'Ticket was redeemed concurrently',
      });
    }

    this.logger.log(
      `Ticket redeemed: ${updated.code} by agent=${agentId}`,
      PurchasedTicketsService.name,
    );

    return {
      message: 'Ticket redeemed successfully',
      code: updated.code,
      usedAt: updated.usedAt,
    };
  }
}
