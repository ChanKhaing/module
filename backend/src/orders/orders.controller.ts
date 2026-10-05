import {
  Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { CreateOrderDto, QueryOrderDto, CancelOrderDto } from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RequirePermissions('order:create')
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.orders.create(dto, user.sub);
  }

  @RequirePermissions('order:read')
  @Get('me')
  findMine(@CurrentUser() user: JwtPayload, @Query() query: QueryOrderDto) {
    return this.orders.findMine(user.sub, query);
  }

  @RequirePermissions('order:cancel')
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orders.cancel(id, user.sub, dto);
  }

  @RequirePermissions('order:read')
  @Get()
  findAllAdmin(@Query() query: QueryOrderDto, @CurrentUser() user: JwtPayload) {
    return this.orders.findAllAdmin(query, [user.role]);
  }

  @RequirePermissions('order:read')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.findById(id, user.sub, [user.role]);
  }
}
