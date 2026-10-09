import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RedeemTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
