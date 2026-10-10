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

import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto';
import { PaginationQueryDto, RequirePermissions } from '../common';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @RequirePermissions('role:create')
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @RequirePermissions('role:read')
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.roles.findAll(query);
  }

  @RequirePermissions('role:read')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.roles.findById(id);
  }

  @RequirePermissions('role:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @RequirePermissions('role:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roles.remove(id);
  }

  @RequirePermissions('role:update')
  @Post(':id/permissions')
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionsDto) {
    return this.roles.assignPermissions(id, dto);
  }
}
