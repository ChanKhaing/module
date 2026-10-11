import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common';
import {
  SupportPriority,
  SupportStatus,
} from '../schemas/support-ticket.schema';

export class QuerySupportDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SupportStatus)
  status?: SupportStatus;

  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;

  @IsOptional()
  @IsMongoId()
  agentId?: string;

  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
