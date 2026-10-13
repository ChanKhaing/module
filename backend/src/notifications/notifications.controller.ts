import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @RequirePermissions('notification:read')
  @Get('me')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notifications.findMine(user.sub, query);
  }

  @RequirePermissions('notification:read')
  @Get('me/unread-count')
  unread(@CurrentUser() user: JwtPayload) {
    return this.notifications.unreadCount(user.sub);
  }

  @RequirePermissions('notification:read')
  @Patch('me/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notifications.markRead(id, user.sub);
  }

  @RequirePermissions('notification:read')
  @Patch('me/read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @RequirePermissions('notification:read')
  @Delete('me/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notifications.remove(id, user.sub);
  }
}
