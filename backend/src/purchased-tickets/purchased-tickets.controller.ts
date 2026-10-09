import { Controller, Get, Param, Query } from '@nestjs/common';

import { PurchasedTicketsService } from './purchased-tickets.service';
import { QueryPurchasedTicketDto } from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('purchased-tickets')
export class PurchasedTicketsController {
  constructor(private readonly tickets: PurchasedTicketsService) {}

  @RequirePermissions('ticket:view-my')
  @Get('me')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryPurchasedTicketDto,
  ) {
    return this.tickets.findMine(user.sub, query);
  }

  @RequirePermissions('ticket:view-my')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tickets.findById(id, user.sub, [user.role]);
  }
}
