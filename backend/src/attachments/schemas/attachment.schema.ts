import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AttachmentDocument = HydratedDocument<Attachment>;

export enum AttachmentRefType {
  SUPPORT_MESSAGE = 'support_message',
  SUPPORT_TICKET = 'support_ticket',
  AVATAR = 'avatar',
  PAYMENT_SCREENSHOT = 'payment_screenshot',
  DOCUMENT = 'document',
}

@Schema({ timestamps: true, collection: 'attachments' })
export class Attachment {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  uploadedBy!: Types.ObjectId;

  @Prop({
    enum: AttachmentRefType,
    required: true,
    index: true,
  })
  refType!: AttachmentRefType;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  refId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  bucket!: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true, trim: true })
  url!: string;

  @Prop({ required: true, trim: true })
  originalName!: string;

  @Prop({ required: true, trim: true })
  mime!: string;

  @Prop({ required: true, min: 0 })
  size!: number;

  @Prop({ default: false })
  deleted!: boolean;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

AttachmentSchema.index({ refType: 1, refId: 1, createdAt: -1 });
AttachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
