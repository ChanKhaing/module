import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common';
import { AttachmentRefType } from '../schemas/attachment.schema';

export class QueryAttachmentDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AttachmentRefType)
  refType?: AttachmentRefType;

  @IsOptional()
  @IsMongoId()
  refId?: string;
}
