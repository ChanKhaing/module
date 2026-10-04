import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32, { message: 'token is invalid' })
  @MaxLength(128, { message: 'token is invalid' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(64)
  newPassword!: string;
}


