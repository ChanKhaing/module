import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from './dto';
import { JwtAuthGuard, Public } from '../common';
import { CurrentUser } from '../common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto);
  }

@Post('logout-all')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard)   // ← access token လို
logoutAll(@CurrentUser() user: JwtPayload ) {
  return this.auth.logoutAll(user.sub);
}
}