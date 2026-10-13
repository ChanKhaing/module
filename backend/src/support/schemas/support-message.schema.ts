import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SupportMessageDocument = HydratedDocument<SupportMessage>;

export enum SenderRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

@Schema({ timestamps: true, collection: 'support_messages' })
export class SupportMessage {
  @Prop({
    type: Types.ObjectId,
    ref: 'SupportTicket',
    required: true,
    index: true,
  })
  supportTicketId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ enum: SenderRole, required: true })
  senderRole!: SenderRole;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ type: [String], default: [] })
  attachments!: string[];                     // denormalized URLs (fast display)

  @Prop({ type: [Types.ObjectId], ref: 'Attachment', default: [] })
  attachmentIds!: Types.ObjectId[];           // linked Attachment docs

  @Prop({ default: false })
  isInternal!: boolean;

  @Prop({ default: null })
  readAt?: Date;
}

export const SupportMessageSchema =
  SchemaFactory.createForClass(SupportMessage);

SupportMessageSchema.index({ supportTicketId: 1, createdAt: 1 });
