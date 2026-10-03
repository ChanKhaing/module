import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto';
import { Public } from '../../common';
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Public()
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.requestReset(dto.email);
  }

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(dto.token, dto.newPassword);
  }
}