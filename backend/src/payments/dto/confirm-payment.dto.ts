import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConfirmOutcome {
  SUCCESS = 'success',
  FAIL = 'fail',
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'success or fail' })
  @IsEnum(ConfirmOutcome, { message: 'outcome must be success or fail' })
  outcome!: ConfirmOutcome;
  @ApiPropertyOptional({ description: 'Failure reason' })

  @IsOptional()
  @IsString()
  @MaxLength(200)
  failureReason?: string;
}
