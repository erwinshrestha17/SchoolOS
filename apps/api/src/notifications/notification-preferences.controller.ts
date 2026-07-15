import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import {
  ResetNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
} from './dto/update-notification-preference.dto';
import { NotificationPreferencePolicy } from './notification-preference-policy';

@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notifications')
export class NotificationPreferencesController {
  constructor(private readonly policy: NotificationPreferencePolicy) {}

  @Get('me')
  @Permissions('notifications:view_own')
  getOwn(@CurrentAuth() actor: AuthContext) {
    return this.policy.listOwnPreferences(actor);
  }

  @Patch('me')
  @Permissions('notifications:view_own')
  updateOwn(
    @CurrentAuth() actor: AuthContext,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.policy.updateOwnPreference(actor, dto);
  }

  @Delete('me/:category/:channel')
  @Permissions('notifications:view_own')
  resetOwn(
    @CurrentAuth() actor: AuthContext,
    @Param() params: ResetNotificationPreferenceDto,
  ) {
    return this.policy.resetOwnPreference(actor, params);
  }
}
