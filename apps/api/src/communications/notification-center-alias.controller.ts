import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { NotificationCenterService } from './notification-center.service';

@Controller('notification-center')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notifications')
export class NotificationCenterAliasController {
  constructor(
    private readonly notificationCenterService: NotificationCenterService,
  ) {}

  @Get()
  @Permissions('notices:read')
  getCenter(@CurrentAuth() auth: AuthContext) {
    return this.notificationCenterService.getCenter(auth);
  }

  @Get('unread-count')
  @Permissions('notices:read')
  getUnreadCount(@CurrentAuth() auth: AuthContext) {
    return this.notificationCenterService.getUnreadCount(auth);
  }

  @Post(':id/read')
  @Permissions('notices:read')
  markRead(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.notificationCenterService.markRead(id, auth);
  }

  @Post('read-all')
  @Permissions('notices:read')
  markAllRead(@CurrentAuth() auth: AuthContext) {
    return this.notificationCenterService.markAllRead(auth);
  }
}
