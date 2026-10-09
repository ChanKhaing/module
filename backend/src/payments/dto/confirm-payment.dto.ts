import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ConfirmOutcome {
  SUCCESS = 'success',
  FAIL = 'fail',
}

export class ConfirmPaymentDto {
  @IsEnum(ConfirmOutcome, { message: 'outcome must be success or fail' })
  outcome!: ConfirmOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  failureReason?: string;
}
