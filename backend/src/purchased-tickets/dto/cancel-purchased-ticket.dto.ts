import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelPurchasedTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
