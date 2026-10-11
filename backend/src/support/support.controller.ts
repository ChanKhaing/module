import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { SupportService } from './support.service';
import {
  CreateSupportTicketDto,
  QuerySupportDto,
  AssignAgentDto,
  UpdateSupportStatusDto,
  UpdateSupportPriorityDto,
} from './dto';
import {
  CurrentUser,
  RequirePermissions,
} from '../common';
import type { JwtPayload } from '../auth/interfaces';

@Controller('support-tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // ─── Customer ───
  @RequirePermissions('support:create')
  @Post()
  create(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.support.create(dto, user.sub);
  }

  @RequirePermissions('support:read')
  @Get('me')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: QuerySupportDto,
  ) {
    return this.support.findMine(user.sub, query);
  }

  // ─── Agent / Admin ───
  @RequirePermissions('support:read')
  @Get()
  findAll(@Query() query: QuerySupportDto) {
    return this.support.findAll(query);
  }

  // ─── Detail (any authenticated) ───
  @RequirePermissions('support:read')
  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const isStaff = user.role === 'admin' || user.role === 'agent';
    return this.support.findById(id, user.sub, isStaff);
  }

  // ─── Update (owner only) ───
  @RequirePermissions('support:create')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() patch: { subject?: string; description?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.support.update(id, user.sub, patch);
  }

  // ─── Agent / Admin — assign ───
  @RequirePermissions('support:resolve')
  @Patch(':id/assign')
  assignAgent(
    @Param('id') id: string,
    @Body() dto: AssignAgentDto,
  ) {
    return this.support.assignAgent(id, dto.agentId);
  }

  // ─── Agent / Admin — status ───
  @RequirePermissions('support:resolve')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportStatusDto,
  ) {
    return this.support.updateStatus(id, dto.status, dto.resolutionNote);
  }

  // ─── Agent / Admin — priority ───
  @RequirePermissions('support:resolve')
  @Patch(':id/priority')
  updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdateSupportPriorityDto,
  ) {
    return this.support.updatePriority(id, dto.priority);
  }

  // ─── Agent / Admin — resolve ───
  @RequirePermissions('support:resolve')
  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: { resolutionNote?: string },
  ) {
    return this.support.resolve(id, body?.resolutionNote);
  }

  // ─── Agent / Admin — close ───
  @RequirePermissions('support:resolve')
  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() body: { resolutionNote?: string },
  ) {
    return this.support.close(id, body?.resolutionNote);
  }

  // ─── Agent / Admin — reopen ───
  @RequirePermissions('support:resolve')
  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.support.reopen(id);
  }
}
