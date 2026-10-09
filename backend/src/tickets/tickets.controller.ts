import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  QueryTicketDto,
  UpdatePriceDto,
} from './dto';
import { CurrentUser, Public, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // ─── 5.2 PUBLIC — Browse ───
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

  @Public()
  @Get(':id/availability')
  checkAvailability(@Param('id') id: string, @Query('qty') qty: string) {
    return this.tickets.checkAvailability(id, Number(qty) || 1);
  }

  // ─── 5.1 ADMIN — Create ───
  @RequirePermissions('ticket:create')
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: JwtPayload) {
    return this.tickets.create(dto, user.sub);
  }

  // ─── 5.3 ADMIN — Update / Price / Delete / Publish ───
  @RequirePermissions('ticket:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.tickets.update(id, dto);
  }

  @RequirePermissions('ticket:update')
  @Patch(':id/price')
  updatePrice(@Param('id') id: string, @Body() dto: UpdatePriceDto) {
    return this.tickets.updatePrice(id, dto.price);
  }

  @RequirePermissions('ticket:update')
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.tickets.publish(id);
  }

  @RequirePermissions('ticket:update')
  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.tickets.unpublish(id);
  }

  @RequirePermissions('ticket:update')
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.tickets.cancel(id);
  }

  @RequirePermissions('ticket:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tickets.remove(id);
  }
}
