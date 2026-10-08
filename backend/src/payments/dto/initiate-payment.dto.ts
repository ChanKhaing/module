import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class InitiatePaymentDto {
  @IsMongoId({ message: 'orderId must be a valid ObjectId' })
  orderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
