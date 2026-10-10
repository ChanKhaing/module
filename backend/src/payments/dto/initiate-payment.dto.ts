import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Order ObjectId' })
  @IsMongoId({ message: 'orderId must be a valid ObjectId' })
  orderId!: string;
  @ApiPropertyOptional({ description: 'Optional idempotency key' })

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
