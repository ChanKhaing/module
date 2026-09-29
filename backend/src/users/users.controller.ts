import { Body, Controller, Get, Post,Query } from '@nestjs/common';
import { CreateUserDto } from './dto';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../common';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
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
