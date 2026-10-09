import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Cancel reason' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
