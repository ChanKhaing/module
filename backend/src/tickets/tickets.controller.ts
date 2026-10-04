import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { TicketsService } from './tickets.service';
import { CreateTicketDto, QueryTicketDto } from './dto';
import { CurrentUser, Public, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // ─── 5.2 PUBLIC ───
  @Public()
  @Get()
  findAll(@Query() query: QueryTicketDto) {
    return this.tickets.findAll(query);
  }

  @Public()
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tickets.findById(id);
  }

  // ─── 5.1 ADMIN — Create ───
  @RequirePermissions('ticket:create')
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.tickets.create(dto, user.sub);
  }
}
