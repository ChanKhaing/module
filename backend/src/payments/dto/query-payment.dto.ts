import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common';
import { PaymentStatus } from '../schemas/payment.schema';

export class QueryPaymentDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsMongoId()
  orderId?: string;
}
