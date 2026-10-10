import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto';
import { PaginationQueryDto, RequirePermissions } from '../common';

@ApiTags('permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @RequirePermissions('permission:create')
  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissions.create(dto);
  }

  @RequirePermissions('permission:read')
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.permissions.findAll(query);
  }

  @RequirePermissions('permission:read')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.permissions.findById(id);
  }
}
