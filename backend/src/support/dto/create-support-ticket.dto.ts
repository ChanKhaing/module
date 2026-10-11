import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SupportCategory,
  SupportPriority,
} from '../schemas/support-ticket.schema';

export class CreateSupportTicketDto {
  @ApiProperty({ example: 'Payment not received' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: 'I paid but my order still pending' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({ enum: SupportCategory })
  @IsOptional()
  @IsEnum(SupportCategory)
  category?: SupportCategory;

  @ApiPropertyOptional({ enum: SupportPriority })
  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  purchasedTicketId?: string;
}
