import { IsEmail } from 'class-validator';

export class RequestOtpDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
}
