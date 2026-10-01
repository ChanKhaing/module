
import { Body, Controller, Get, Post,Query, Patch } from '@nestjs/common';
import { CreateUserDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';
import { PaginationQueryDto, CurrentUser, Public } from '../common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface'; // သို့မဟုတ် သက်ဆိုင်ရာ path


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
    // ─── Profile: current user ───
  // @Get('me')
  // me(@CurrentUser() user: JwtPayload) {
  //   return this.usersService.findById(user.sub);
  // }

  @Get('me')
  me(@CurrentUser() user: any) {
  console.log('--- /users/me Debug ---');
  console.log('Incoming user object:', user);
  console.log('Sub value:', user?.sub);
  console.log('------------------------');

  // sub မပါလာပါက id ကို အစားထိုးယူနိုင်ရန်
  const userId = user?.sub || user?.id;
  return this.usersService.findById(userId);
}

  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

//   @Get('paginated')
// findPaginated() {
//   return { data: [{ id: 1 }, { id: 2 }], total: 100, page: 1, limit: 20 };
// }
}
