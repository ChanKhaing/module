import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentRefType } from '../schemas/attachment.schema';

export class UploadAttachmentDto {
  @ApiProperty({ enum: AttachmentRefType })
  @IsEnum(AttachmentRefType)
  refType!: AttachmentRefType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  refId?: string;
}
