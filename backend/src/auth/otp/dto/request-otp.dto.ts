import { IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ description: 'User email' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
}
