import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { RequestOtpDto, VerifyOtpDto } from './dto';
import { Public } from '../../common';

/**
 * OTP endpoints – request and verify.
 * Marked @Public() so JWT guard is skipped.
 */
@Public()
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  request(@Body() dto: RequestOtpDto) {
    return this.otp.requestOtp(dto.email);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyOtpDto) {
    return this.otp.verifyOtp(dto.email, dto.code);
  }
}
