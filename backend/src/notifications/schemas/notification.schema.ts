import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  TICKET_ISSUED = 'ticket_issued',
  ORDER_CANCELLED = 'order_cancelled',
  SUPPORT_REPLY = 'support_reply',
  SUPPORT_RESOLVED = 'support_resolved',
  SUPPORT_ASSIGNED = 'support_assigned',
  SYSTEM = 'system',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ enum: NotificationType, required: true, index: true })
  type!: NotificationType;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  body?: string;

  @Prop({ type: Object })
  payload?: Record<string, any>;

  @Prop({ default: false, index: true })
  isRead!: boolean;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
