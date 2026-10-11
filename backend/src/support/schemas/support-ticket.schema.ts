import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

export enum SupportStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum SupportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum SupportCategory {
  PAYMENT = 'payment',
  TICKET = 'ticket',
  ACCOUNT = 'account',
  OTHER = 'other',
}

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicket {
  @Prop({ required: true, unique: true, index: true })
  ticketCode!: string;

  @Prop({ required: true, trim: true })
  subject!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({
    enum: SupportCategory,
    default: SupportCategory.OTHER,
    index: true,
  })
  category!: SupportCategory;

  @Prop({
    enum: SupportStatus,
    default: SupportStatus.OPEN,
    index: true,
  })
  status!: SupportStatus;

  @Prop({
    enum: SupportPriority,
    default: SupportPriority.MEDIUM,
    index: true,
  })
  priority!: SupportPriority;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  agentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  orderId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'PurchasedTicket', default: null })
  purchasedTicketId?: Types.ObjectId | null;

  @Prop({ default: 0, min: 0 })
  messageCount!: number;

  @Prop()
  lastMessageAt?: Date;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  closedAt?: Date;

  @Prop({ trim: true })
  resolutionNote?: string;
}

export const SupportTicketSchema =
  SchemaFactory.createForClass(SupportTicket);

// ─── Indexes ───
SupportTicketSchema.index({ customerId: 1, status: 1, createdAt: -1 });
SupportTicketSchema.index({ agentId: 1, status: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
