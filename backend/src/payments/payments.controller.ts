import {
  Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';
import {
  InitiatePaymentDto,
  ConfirmPaymentDto,
  QueryPaymentDto,
  MockWebhookDto,
} from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // ─── Feature 7.1 — Initiate ───
  @RequirePermissions('payment:create')
  @Post()
  initiate(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.initiate(dto, user.sub);
  }

  // ─── Feature 7.5 — Mock webhook (admin) ───
  @RequirePermissions('payment:manage')
  @Post('webhook/mock')
  mockWebhook(
    @Body() dto: MockWebhookDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.mockWebhook(dto, [user.role]);
  }

  // ─── Feature 7.2 — Confirm ───
  @RequirePermissions('payment:create')
  @Patch(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.confirm(id, dto, user.sub);
  }

  // ─── User: my payments ───
  @RequirePermissions('payment:read')
  @Get('me')
  findMine(@CurrentUser() user: JwtPayload, @Query() query: QueryPaymentDto) {
    return this.payments.findMine(user.sub, query);
  }

  // ─── Feature 7.5 — Admin list ───
  @RequirePermissions('payment:manage')
  @Get()
  findAllAdmin(@Query() query: QueryPaymentDto, @CurrentUser() user: JwtPayload) {
    return this.payments.findAllAdmin(query, [user.role]);
  }

  // ─── Detail (self or admin) ───
  @RequirePermissions('payment:read')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payments.findById(id, user.sub, [user.role]);
  }
}
