import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';

import {
  SupportTicket,
  SupportTicketDocument,
  SupportStatus,
  SupportPriority,
} from './schemas/support-ticket.schema';
import {
  SupportMessage,
  SupportMessageDocument,
  SenderRole,
} from './schemas/support-message.schema';
import {
  Attachment,
  AttachmentDocument,
} from '../attachments/schemas/attachment.schema';
import {
  Order,
  OrderDocument,
} from '../orders/schemas/order.schema';
import {
  PurchasedTicket,
  PurchasedTicketDocument,
} from '../purchased-tickets/schemas/purchased-ticket.schema';
import {
  LoggerService,
  PaginationService,
} from '../common';
import {
  CreateSupportTicketDto,
  QuerySupportDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ClickHouseService } from '../infra/clickhouse';
import { NotificationType } from '../notifications/schemas/notification.schema';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicketDocument>,
    @InjectModel(SupportMessage.name)
    private readonly messageModel: Model<SupportMessageDocument>,
    @InjectModel(Attachment.name)
    private readonly attachmentModel: Model<AttachmentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PurchasedTicket.name)
    private readonly purchasedModel: Model<PurchasedTicketDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
    private readonly notifications: NotificationsService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  // ─────────────────────────────────────────
  // CREATE (customer)
  // ─────────────────────────────────────────
  async create(dto: CreateSupportTicketDto, userId: string) {
    // Link to order — ownership verify
    if (dto.orderId) {
      if (!Types.ObjectId.isValid(dto.orderId)) {
        throw new BadRequestException({
          code: 'INVALID_ORDER_ID',
          message: 'Invalid order id',
        });
      }
      const order = await this.orderModel.findById(dto.orderId).lean().exec();
      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        });
      }
      if (order.userId.toString() !== userId) {
        throw new ForbiddenException({
          code: 'ORDER_ACCESS_DENIED',
          message: 'Order does not belong to you',
        });
      }
    }

    // Link to purchased ticket — ownership verify
    if (dto.purchasedTicketId) {
      if (!Types.ObjectId.isValid(dto.purchasedTicketId)) {
        throw new BadRequestException({
          code: 'INVALID_TICKET_ID',
          message: 'Invalid purchased ticket id',
        });
      }
      const pt = await this.purchasedModel
        .findById(dto.purchasedTicketId)
        .lean()
        .exec();
      if (!pt) {
        throw new NotFoundException({
          code: 'PURCHASED_TICKET_NOT_FOUND',
          message: 'Purchased ticket not found',
        });
      }
      if (pt.userId.toString() !== userId) {
        throw new ForbiddenException({
          code: 'TICKET_ACCESS_DENIED',
          message: 'Ticket does not belong to you',
        });
      }
    }

    const ticketCode = await this.generateTicketCode();

    const ticket = await this.ticketModel.create({
      ticketCode,
      subject: dto.subject,
      description: dto.description,
      category: dto.category,
      priority: dto.priority ?? SupportPriority.MEDIUM,
      status: SupportStatus.OPEN,
      customerId: new Types.ObjectId(userId),
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : null,
      purchasedTicketId: dto.purchasedTicketId
        ? new Types.ObjectId(dto.purchasedTicketId)
        : null,
      messageCount: 0,
    });

    this.logger.log(
      `Support ticket created: ${ticketCode}`,
      SupportService.name,
    );

    this.clickhouse
      .insertActivityLog({
        userId,
        eventType: 'support.ticket_created',
        entity: 'support_ticket',
        entityId: ticket._id.toString(),
        payload: {
          ticketCode,
          category: ticket.category,
          priority: ticket.priority,
        },
      })
      .catch(() => undefined);

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // LIST — customer (own)
  // ─────────────────────────────────────────
  async findMine(userId: string, query: QuerySupportDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = {
      customerId: new Types.ObjectId(userId),
    };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;

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
  // LIST — agent/admin (all)
  // ─────────────────────────────────────────
  async findAll(query: QuerySupportDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.agentId) filter.agentId = new Types.ObjectId(query.agentId);
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.q) filter.$text = { $search: query.q };

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .populate('customerId', 'email fullName')
        .populate('agentId', 'email fullName')
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
  // DETAIL — owner or agent/admin
  // ─────────────────────────────────────────
  async findById(id: string, userId: string, isStaff: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel
      .findById(id)
      .populate('customerId', 'email fullName')
      .populate('agentId', 'email fullName')
      .lean()
      .exec();

    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (!isStaff && ticket.customerId._id.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not have access to this ticket',
      });
    }

    return ticket;
  }

  // ─────────────────────────────────────────
  // UPDATE — subject/description (owner only, only if OPEN)
  // ─────────────────────────────────────────
  async update(
    id: string,
    userId: string,
    patch: { subject?: string; description?: string },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (ticket.customerId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not own this ticket',
      });
    }

    if (ticket.status !== SupportStatus.OPEN) {
      throw new BadRequestException({
        code: 'TICKET_NOT_EDITABLE',
        message: 'Only OPEN tickets can be edited',
      });
    }

    if (patch.subject !== undefined) ticket.subject = patch.subject;
    if (patch.description !== undefined) ticket.description = patch.description;
    await ticket.save();

    this.logger.log(
      `Support ticket updated: ${ticket.ticketCode}`,
      SupportService.name,
    );

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // ASSIGN AGENT (admin/agent)
  // ─────────────────────────────────────────
  async assignAgent(id: string, agentId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException({
        code: 'INVALID_AGENT_ID',
        message: 'Invalid agent id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    ticket.agentId = new Types.ObjectId(agentId);
    if (ticket.status === SupportStatus.OPEN) {
      ticket.status = SupportStatus.IN_PROGRESS;
    }
    await ticket.save();

    this.logger.log(
      `Ticket assigned: ${ticket.ticketCode} → agent ${agentId}`,
      SupportService.name,
    );

    this.clickhouse
      .insertActivityLog({
        userId: agentId,
        eventType: 'support.assigned',
        entity: 'support_ticket',
        entityId: ticket._id.toString(),
        payload: { ticketCode: ticket.ticketCode, agentId },
      })
      .catch(() => undefined);

    // ─── Notify agent ───
    if (agentId !== ticket.customerId.toString()) {
      await this.notifications
        .create({
          userId: agentId,
          type: NotificationType.SUPPORT_ASSIGNED,
          title: 'New ticket assigned to you',
          body: `${ticket.ticketCode}: ${ticket.subject}`,
          payload: {
            ticketId: ticket._id.toString(),
            ticketCode: ticket.ticketCode,
          },
        })
        .catch((err) => {
          this.logger.warn(
            `Notify assign failed: ${(err as Error).message}`,
            SupportService.name,
          );
        });
    }

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // UPDATE STATUS (agent/admin)
  // ─────────────────────────────────────────
  async updateStatus(
    id: string,
    status: SupportStatus,
    note?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (ticket.status === SupportStatus.CLOSED) {
      throw new BadRequestException({
        code: 'TICKET_CLOSED',
        message: 'Cannot update a closed ticket',
      });
    }

    ticket.status = status;

    if (status === SupportStatus.RESOLVED) {
      ticket.resolvedAt = new Date();
      if (note) ticket.resolutionNote = note;
    }
    if (status === SupportStatus.CLOSED) {
      ticket.closedAt = new Date();
      if (note) ticket.resolutionNote = note;
    }

    await ticket.save();

    this.logger.log(
      `Ticket status: ${ticket.ticketCode} → ${status}`,
      SupportService.name,
    );

    this.clickhouse
      .insertActivityLog({
        userId: ticket.agentId?.toString() ?? ticket.customerId.toString(),
        eventType: 'support.status_changed',
        entity: 'support_ticket',
        entityId: ticket._id.toString(),
        payload: {
          ticketCode: ticket.ticketCode,
          from: 'previous',
          to: status,
          note,
        },
      })
      .catch(() => undefined);

    // ─── Notify customer on resolve/close ───
    if (
      status === SupportStatus.RESOLVED ||
      status === SupportStatus.CLOSED
    ) {
      await this.notifications
        .create({
          userId: ticket.customerId.toString(),
          type: NotificationType.SUPPORT_RESOLVED,
          title:
            status === SupportStatus.RESOLVED
              ? 'Your ticket has been resolved'
              : 'Your ticket has been closed',
          body: note ?? `Ticket ${ticket.ticketCode}`,
          payload: {
            ticketId: ticket._id.toString(),
            ticketCode: ticket.ticketCode,
            status,
          },
        })
        .catch((err) => {
          this.logger.warn(
            `Notify resolved failed: ${(err as Error).message}`,
            SupportService.name,
          );
        });
    }

    return ticket.toObject();
  }

  // ─────────────────────────────────────────
  // UPDATE PRIORITY (agent/admin)
  // ─────────────────────────────────────────
  async updatePriority(id: string, priority: SupportPriority) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        { $set: { priority } },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    this.logger.log(
      `Ticket priority: ${ticket.ticketCode} → ${priority}`,
      SupportService.name,
    );

    return ticket;
  }

  // ─────────────────────────────────────────
  // RESOLVE (agent/admin)
  // ─────────────────────────────────────────
  async resolve(id: string, note?: string) {
    return this.updateStatus(id, SupportStatus.RESOLVED, note);
  }

  // ─────────────────────────────────────────
  // CLOSE (agent/admin)
  // ─────────────────────────────────────────
  async close(id: string, note?: string) {
    return this.updateStatus(id, SupportStatus.CLOSED, note);
  }

  // ─────────────────────────────────────────
  // REOPEN (agent/admin)
  // ─────────────────────────────────────────
  async reopen(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    if (
      ticket.status !== SupportStatus.RESOLVED &&
      ticket.status !== SupportStatus.CLOSED
    ) {
      throw new BadRequestException({
        code: 'TICKET_NOT_RESOLVED',
        message: 'Only resolved or closed tickets can be reopened',
      });
    }

    ticket.status = SupportStatus.OPEN;
    ticket.resolvedAt = undefined;
    ticket.closedAt = undefined;
    ticket.resolutionNote = undefined;
    await ticket.save();

    this.logger.log(
      `Ticket reopened: ${ticket.ticketCode}`,
      SupportService.name,
    );

    return ticket.toObject();
  }


  // ─────────────────────────────────────────
  // REPLY (customer or agent/admin)
  // ─────────────────────────────────────────
  async addMessage(
    ticketId: string,
    userId: string,
    userRole: string,
    body: string,
    attachmentIds: string[] = [],
    isInternal = false,
  ) {
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    // Customer only on own ticket
    const isStaff = userRole === 'admin' || userRole === 'agent';
    if (!isStaff && ticket.customerId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not have access to this ticket',
      });
    }

    if (ticket.status === SupportStatus.CLOSED) {
      throw new BadRequestException({
        code: 'TICKET_CLOSED',
        message: 'Cannot reply to a closed ticket',
      });
    }

    // Internal notes only by staff
    if (isInternal && !isStaff) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Internal notes are staff-only',
      });
    }

    // Determine senderRole
    let senderRole: SenderRole;
    if (userRole === 'admin') senderRole = SenderRole.ADMIN;
    else if (userRole === 'agent') senderRole = SenderRole.AGENT;
    else senderRole = SenderRole.CUSTOMER;

    // Verify + link attachments
    const validAttachmentIds: Types.ObjectId[] = [];
    const attachmentUrls: string[] = [];

    if (attachmentIds.length > 0) {
      const docs = await this.attachmentModel.find({
        _id: { $in: attachmentIds.map((id) => new Types.ObjectId(id)) },
        deleted: false,
      }).exec();

      if (docs.length !== attachmentIds.length) {
        throw new BadRequestException({
          code: 'ATTACHMENT_NOT_FOUND',
          message: 'One or more attachments do not exist',
        });
      }

      for (const a of docs) {
        if (a.uploadedBy.toString() !== userId && !isStaff) {
          throw new ForbiddenException({
            code: 'ATTACHMENT_ACCESS_DENIED',
            message: 'You do not own one of the attachments',
          });
        }
        validAttachmentIds.push(a._id as Types.ObjectId);
        attachmentUrls.push(a.url);
      }
    }

    const message = await this.messageModel.create({
      supportTicketId: new Types.ObjectId(ticketId),
      senderId: new Types.ObjectId(userId),
      senderRole,
      body,
      attachments: attachmentUrls,
      attachmentIds: validAttachmentIds,
      isInternal,
    });

    // Link attachments → this message
    if (validAttachmentIds.length > 0) {
      await this.attachmentModel.updateMany(
        { _id: { $in: validAttachmentIds } },
        {
          $set: {
            refType: 'support_message',
            refId: message._id as Types.ObjectId,
          },
        },
      );
    }

    // Bump ticket counters
    ticket.messageCount += 1;
    ticket.lastMessageAt = new Date();
    // Auto: OPEN → IN_PROGRESS when staff replies
    if (isStaff && ticket.status === SupportStatus.OPEN) {
      ticket.status = SupportStatus.IN_PROGRESS;
    }
    await ticket.save();

    this.logger.log(
      `Message on ${ticket.ticketCode} by ${senderRole}`,
      SupportService.name,
    );

    this.clickhouse
      .insertActivityLog({
        userId,
        eventType: 'support.message_sent',
        entity: 'support_message',
        entityId: (message._id as any).toString(),
        payload: {
          ticketId,
          ticketCode: ticket.ticketCode,
          role: senderRole,
          isInternal,
          attachmentCount: attachmentIds.length,
        },
      })
      .catch(() => undefined);

    // ─── Notify customer when staff replies (non-internal) ───
    if (
      isStaff &&
      !isInternal &&
      ticket.customerId.toString() !== userId
    ) {
      await this.notifications
        .create({
          userId: ticket.customerId.toString(),
          type: NotificationType.SUPPORT_REPLY,
          title: 'Support agent replied',
          body: `New reply on ticket ${ticket.ticketCode}`,
          payload: {
            ticketId: ticket._id.toString(),
            ticketCode: ticket.ticketCode,
            messageId: (message._id as any).toString(),
          },
        })
        .catch((err) => {
          this.logger.warn(
            `Notify customer failed: ${(err as Error).message}`,
            SupportService.name,
          );
        });
    }

    return message.toObject();
  }

  // ─────────────────────────────────────────
  // LIST MESSAGES (thread)
  // ─────────────────────────────────────────
  async listMessages(
    ticketId: string,
    userId: string,
    userRole: string,
    query: { page?: number; limit?: number },
  ) {
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(ticketId).lean().exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    const isStaff = userRole === 'admin' || userRole === 'agent';
    if (!isStaff && ticket.customerId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not have access to this ticket',
      });
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    // Customers never see internal messages
    const filter: Record<string, any> = {
      supportTicketId: new Types.ObjectId(ticketId),
    };
    if (!isStaff) filter.isInternal = false;

    const [data, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .populate('senderId', 'email fullName')
        .populate('attachmentIds', 'url mime size originalName key bucket')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────
  // MARK MESSAGES READ
  // ─────────────────────────────────────────
  async markMessagesRead(
    ticketId: string,
    userId: string,
    userRole: string,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid ticket id',
      });
    }

    const ticket = await this.ticketModel.findById(ticketId).lean().exec();
    if (!ticket) {
      throw new NotFoundException({
        code: 'SUPPORT_TICKET_NOT_FOUND',
        message: 'Support ticket not found',
      });
    }

    const isStaff = userRole === 'admin' || userRole === 'agent';
    if (!isStaff && ticket.customerId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'TICKET_ACCESS_DENIED',
        message: 'You do not have access to this ticket',
      });
    }

    const res = await this.messageModel.updateMany(
      {
        supportTicketId: new Types.ObjectId(ticketId),
        senderId: { $ne: new Types.ObjectId(userId) },
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    );

    return res.modifiedCount ?? 0;
  }

  private async generateTicketCode(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const code = `TKT-${ymd}-${nanoid(6).toUpperCase()}`;
      const exists = await this.ticketModel.exists({ ticketCode: code });
      if (!exists) return code;
    }
    throw new Error('Failed to generate unique ticket code');
  }
}
