import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto';
import { Public } from '../../common';

@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}   // ← ပြောင်း

  @Public()
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestReset(dto.email);                  // ← ပြောင်း
  }

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto.token, dto.newPassword); // ← ပြောင်း
  }
}