import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PurchasedTicketDocument = HydratedDocument<PurchasedTicket>;

export enum PurchasedTicketStatus {
  ISSUED = 'issued',
  USED = 'used',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Schema({ timestamps: true, collection: 'purchased_tickets' })
export class PurchasedTicket {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true, unique: true, index: true })
  qrPayload!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TicketProduct', required: true })
  ticketId!: Types.ObjectId;

  @Prop({ required: true })
  ticketName!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, default: 'MMK', uppercase: true })
  currency!: string;

  @Prop({
    enum: PurchasedTicketStatus,
    default: PurchasedTicketStatus.ISSUED,
    index: true,
  })
  status!: PurchasedTicketStatus;

  @Prop({ required: true })
  issuedAt!: Date;

  @Prop()
  usedAt?: Date;

  @Prop()
  cancelledAt?: Date;
}

export const PurchasedTicketSchema = SchemaFactory.createForClass(PurchasedTicket);

// ─── Indexes ───
PurchasedTicketSchema.index({ userId: 1, status: 1, createdAt: -1 });
PurchasedTicketSchema.index({ orderId: 1 });
PurchasedTicketSchema.index({ ticketId: 1 });
