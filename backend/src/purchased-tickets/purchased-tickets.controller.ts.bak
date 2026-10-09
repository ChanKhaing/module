import {
  Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';

import { PurchasedTicketsService } from './purchased-tickets.service';
import {
  QueryPurchasedTicketDto,
  ValidateQrDto,
  RedeemTicketDto,
  CancelPurchasedTicketDto,
} from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('purchased-tickets')
export class PurchasedTicketsController {
  constructor(private readonly tickets: PurchasedTicketsService) {}

  // ─── Admin list ───
  @RequirePermissions('ticket:manage')
  @Get()
  findAllAdmin(
    @Query() query: QueryPurchasedTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tickets.findAllAdmin(query, [user.role]);
  }

  // ─── Feature 8.1 — My tickets ───
  @RequirePermissions('ticket:view-my')
  @Get('me')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryPurchasedTicketDto,
  ) {
    return this.tickets.findMine(user.sub, query);
  }

  // ─── Feature 8.2 — Validate + Redeem ───
  @RequirePermissions('ticket:redeem')
  @Post('validate')
  validateQr(@Body() dto: ValidateQrDto) {
    return this.tickets.validateQr(dto);
  }

  @RequirePermissions('ticket:redeem')
  @Post('redeem')
  redeem(
    @Body() dto: ValidateQrDto,
    @Body() redeemDto: RedeemTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tickets.redeem(dto, redeemDto, user.sub);
  }

  // ─── Feature 8.3 — Cancel ───
  @RequirePermissions('ticket:view-my')
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelPurchasedTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tickets.cancel(id, user.sub, dto);
  }

  // ─── Detail ───
  @RequirePermissions('ticket:view-my')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tickets.findById(id, user.sub, [user.role]);
  }
}
