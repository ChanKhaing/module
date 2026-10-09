import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RedeemTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  qrPayload!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
