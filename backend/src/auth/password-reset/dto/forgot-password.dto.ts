import { IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
}