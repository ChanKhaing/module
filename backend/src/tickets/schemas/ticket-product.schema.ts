import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketProductDocument = HydratedDocument<TicketProduct>;

export enum TicketStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  SOLD_OUT = 'sold_out',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'ticket_products' })
export class TicketProduct {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, default: 'MMK', uppercase: true, trim: true })
  currency!: string;

  @Prop({ required: true, index: true })
  eventDate!: Date;

  @Prop({ required: true, min: 0 })
  quantity!: number;

  @Prop({ required: true, default: 0, min: 0 })
  sold!: number;

  @Prop({ enum: TicketStatus, default: TicketStatus.DRAFT, index: true })
  status!: TicketStatus;

  @Prop({ trim: true })
  category?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const TicketProductSchema = SchemaFactory.createForClass(TicketProduct);

// ─── Indexes ───
TicketProductSchema.index({ status: 1, eventDate: -1 });
TicketProductSchema.index({ category: 1, price: 1 });
TicketProductSchema.index({ name: 'text', description: 'text' });
