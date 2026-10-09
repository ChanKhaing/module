import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'User email' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
  @ApiProperty({ description: 'Password' })

  @IsString()
  @MinLength(1, { message: 'password is required' })
  password!: string;
}