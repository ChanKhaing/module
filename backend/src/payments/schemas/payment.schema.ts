import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  MOCK = 'mock',
  CARD = 'card',
  WALLET = 'wallet',
}

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ required: true, unique: true, index: true })
  paymentCode!: string;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 'MMK', uppercase: true })
  currency!: string;

  @Prop({ enum: PaymentMethod, default: PaymentMethod.MOCK })
  method!: PaymentMethod;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING, index: true })
  status!: PaymentStatus;

  @Prop()
  idempotencyKey?: string;

  @Prop({ default: 1, min: 1 })
  attempt!: number;

  @Prop({ default: 0, min: 0 })
  retryCount!: number;

  @Prop()
  paidAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop({ trim: true })
  failureReason?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// ─── Indexes ───
PaymentSchema.index({ orderId: 1, status: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
// Partial unique: only ONE successful payment per order
PaymentSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: 'success' } },
);
// Idempotency key unique (when present)
PaymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $exists: true } } },
);
