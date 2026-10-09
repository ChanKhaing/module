import {
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfirmOutcome } from './confirm-payment.dto';

export class MockWebhookDto {
  @ApiProperty({ description: 'Payment ObjectId' })
  @IsMongoId({ message: 'paymentId must be a valid ObjectId' })
  paymentId!: string;
  @ApiProperty({ description: 'success or fail' })

  @IsEnum(ConfirmOutcome, { message: 'outcome must be success or fail' })
  outcome!: ConfirmOutcome;
  @ApiPropertyOptional({ description: 'Failure reason' })

  @IsOptional()
  @IsString()
  @MaxLength(200)
  failureReason?: string;
  @ApiPropertyOptional({ description: 'Extra metadata' })

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
