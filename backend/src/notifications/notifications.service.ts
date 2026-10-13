import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { LoggerService, PaginationService } from '../common';
import { QueryNotificationDto } from './dto';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  payload?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<NotificationDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
  ) {}

  // ─── CREATE (called from other services) ───
  async create(input: CreateNotificationInput) {
    const doc = await this.model.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? {},
      isRead: false,
    });

    this.logger.log(
      `Notification created: ${doc._id} (${input.type}) → user ${input.userId}`,
      NotificationsService.name,
    );

    return doc.toObject();
  }

  // ─── LIST (own) ───
  async findMine(userId: string, query: QueryNotificationDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };
    if (query.type) filter.type = query.type;
    if (query.isRead !== undefined) filter.isRead = query.isRead === 'true';

    const [data, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  // ─── UNREAD COUNT ───
  async unreadCount(userId: string) {
    const count = await this.model.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
    return { unread: count };
  }

  // ─── MARK ONE READ ───
  async markRead(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid notification id',
      });
    }

    const doc = await this.model.findById(id).exec();
    if (!doc) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    if (doc.userId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'NOTIFICATION_ACCESS_DENIED',
        message: 'You cannot access this notification',
      });
    }

    if (!doc.isRead) {
      doc.isRead = true;
      doc.readAt = new Date();
      await doc.save();
    }

    return doc.toObject();
  }

  // ─── MARK ALL READ ───
  async markAllRead(userId: string) {
    const res = await this.model.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return { updated: res.modifiedCount ?? 0 };
  }

  // ─── DELETE (own) ───
  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid notification id',
      });
    }

    const doc = await this.model.findById(id).exec();
    if (!doc) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }
    if (doc.userId.toString() !== userId) {
      throw new ForbiddenException({
        code: 'NOTIFICATION_ACCESS_DENIED',
        message: 'You cannot delete this notification',
      });
    }

    await this.model.deleteOne({ _id: doc._id }).exec();
    return { message: 'Notification deleted' };
  }
}
