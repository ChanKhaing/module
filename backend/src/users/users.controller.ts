import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() body: { email: string; password: string; name: string }) {
    return this.usersService.create(body);
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }
}
