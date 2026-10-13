import { IsEnum, IsOptional, IsBooleanString } from 'class-validator';
import { PaginationQueryDto } from '../../common';
import { NotificationType } from '../schemas/notification.schema';

export class QueryNotificationDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsBooleanString()
  isRead?: string;
}
