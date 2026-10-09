import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @MinLength(1, { message: 'currentPassword is required' })
  currentPassword!: string;
  @ApiProperty({ description: 'New password (min 8)' })

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(64)
  newPassword!: string;
}
