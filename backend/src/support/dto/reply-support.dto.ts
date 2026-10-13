import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReplySupportDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ type: [String], description: 'Attachment ObjectIds' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsMongoId({ each: true })
  attachmentIds?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isInternal?: boolean;
}
