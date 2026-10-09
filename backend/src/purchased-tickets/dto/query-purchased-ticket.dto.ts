import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common';
import { PurchasedTicketStatus } from '../schemas/purchased-ticket.schema';

export class QueryPurchasedTicketDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PurchasedTicketStatus)
  status?: PurchasedTicketStatus;

  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @IsOptional()
  @IsMongoId()
  ticketId?: string;
}
