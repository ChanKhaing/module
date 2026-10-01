import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from './dto';
// import { Public } from '../common';   // ← Feature 2.5 မှာ ရေးမယ်၊ ယာယီ comment

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  // @Public()   ← Feature 2.5 မှာ ဖွင့်
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  // @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto);
  }
}
// @Post('logout-all')
// @HttpCode(HttpStatus.OK)
// @UseGuards(JwtAuthGuard)   // ← access token လို
// logoutAll(@CurrentUser() user: JwtPayload) {
//   return this.auth.logoutAll(user.sub);
// }