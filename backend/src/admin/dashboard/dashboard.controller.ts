import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../../common';

@ApiTags('admin')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions('admin:read')
  @Get('stats')
  getStats() {
    return this.dashboard.getStats();
  }

  @RequirePermissions('admin:read')
  @Get('recent-activity')
  getRecentActivity(@Query('limit') limit?: string) {
    return this.dashboard.getRecentActivity(Number(limit) || 10);
  }
}
