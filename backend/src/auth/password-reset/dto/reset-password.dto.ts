import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token' })
  @IsString()
  @MinLength(32, { message: 'token is invalid' })
  @MaxLength(128, { message: 'token is invalid' })
  token!: string;
  @ApiProperty({ description: 'New password (min 8)' })

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(64)
  newPassword!: string;
}


