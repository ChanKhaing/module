import {
  Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { InitiatePaymentDto, ConfirmPaymentDto, QueryPaymentDto } from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // ─── Feature 7.1 ───
  @RequirePermissions('payment:create')
  @Post()
  initiate(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.initiate(dto, user.sub);
  }

  // ─── Feature 7.2 ───
  @RequirePermissions('payment:create')
  @Patch(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.confirm(id, dto, user.sub);
  }

  @RequirePermissions('payment:read')
  @Get('me')
  findMine(@CurrentUser() user: JwtPayload, @Query() query: QueryPaymentDto) {
    return this.payments.findMine(user.sub, query);
  }

  @RequirePermissions('payment:read')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payments.findById(id, user.sub, [user.role]);
  }
}
