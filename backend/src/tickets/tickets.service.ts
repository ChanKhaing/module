import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  TicketProduct,
  TicketProductDocument,
  TicketStatus,
} from './schemas/ticket-product.schema';
import { LoggerService, PaginationService } from '../common';
import { CreateTicketDto, QueryTicketDto } from './dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(TicketProduct.name)
    private readonly ticketModel: Model<TicketProductDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
  ) {}

  // ─────────────────────────────────────────
  // 5.1 — CREATE (admin)
  // ─────────────────────────────────────────
  async create(dto: CreateTicketDto, userId: string) {
    const ticket = await this.ticketModel.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      currency: dto.currency ?? 'MMK',
      eventDate: new Date(dto.eventDate),
      quantity: dto.quantity,
      sold: 0,
      status: TicketStatus.DRAFT,
      category: dto.category,
      tags: dto.tags ?? [],
      images: dto.images ?? [],
      createdBy: new Types.ObjectId(userId),
    });

    this.logger.log(`Ticket created: ${ticket.name}`, TicketsService.name);
    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // 5.2 — LIST (public, only published by default)
  // ─────────────────────────────────────────
  async findAll(query: QueryTicketDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = {
      status: TicketStatus.PUBLISHED,
    };

    if (query.q) {
      filter.$text = { $search: query.q };
    }

    if (query.category) {
      filter.category = query.category;
    }

    // ⚠️ status query param ကို public list မှာ ignore (admin အတွက် နောက်မှ)
    if (query.status) {
      filter.status = query.status;
    }

    if (query.dateFrom || query.dateTo) {
      filter.eventDate = {};
      if (query.dateFrom) filter.eventDate.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.eventDate.$lte = new Date(query.dateTo);
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {};
      if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
    }

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

    return {
      data,
      ...this.pagination.buildMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // 5.2 — DETAIL (public)
  // ─────────────────────────────────────────
  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).lean().exec();

    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found',
      });
    }

    // Public: draft/cancelled မပြ
    if (
      ticket.status === TicketStatus.DRAFT ||
      ticket.status === TicketStatus.CANCELLED
    ) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found',
      });
    }

    return ticket;
  }
}
