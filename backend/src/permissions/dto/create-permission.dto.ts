import { IsString, Matches, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ description: 'e.g. ticket:create' })
  @IsString()
  @Matches(/^[a-z]+:[a-z-]+$/, { message: 'code must be like "ticket:create"' })
  @MaxLength(64)
  code!: string;
  @ApiProperty({ description: 'Resource name' })

  @IsString()
  @MaxLength(32)
  resource!: string;
  @ApiProperty({ description: 'Action name' })

  @IsString()
  @MaxLength(32)
  action!: string;
  @ApiPropertyOptional({ description: 'Description' })

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
