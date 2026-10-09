import {
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ConfirmOutcome } from './confirm-payment.dto';

export class MockWebhookDto {
  @IsMongoId({ message: 'paymentId must be a valid ObjectId' })
  paymentId!: string;

  @IsEnum(ConfirmOutcome, { message: 'outcome must be success or fail' })
  outcome!: ConfirmOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  failureReason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
