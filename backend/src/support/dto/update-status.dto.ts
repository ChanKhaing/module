import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportStatus } from '../schemas/support-ticket.schema';

export class UpdateSupportStatusDto {
  @ApiProperty({ enum: SupportStatus })
  @IsEnum(SupportStatus)
  status!: SupportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}
