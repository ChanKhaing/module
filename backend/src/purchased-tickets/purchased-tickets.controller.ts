import {
  Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';

import { PurchasedTicketsService } from './purchased-tickets.service';
import { QueryPurchasedTicketDto, ValidateQrDto, RedeemTicketDto } from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('purchased-tickets')
export class PurchasedTicketsController {
  constructor(private readonly tickets: PurchasedTicketsService) {}

  // ─── Feature 8.1 — My tickets ───
  @RequirePermissions('ticket:view-my')
  @Get('me')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryPurchasedTicketDto,
  ) {
    return this.tickets.findMine(user.sub, query);
  }

  // ─── Feature 8.2 — Validate QR (agent/admin) ───
  @RequirePermissions('ticket:redeem')
  @Post('validate')
  validateQr(@Body() dto: ValidateQrDto) {
    return this.tickets.validateQr(dto);
  }

  // ─── Feature 8.2 — Redeem (agent/admin) ───
  @RequirePermissions('ticket:redeem')
  @Post('redeem')
  redeem(
    @Body() dto: ValidateQrDto,
    @Body() redeemDto: RedeemTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tickets.redeem(dto, redeemDto, user.sub);
  }

  // ─── Detail ───
  @RequirePermissions('ticket:view-my')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tickets.findById(id, user.sub, [user.role]);
  }
}
