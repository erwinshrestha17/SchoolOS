import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { DeliveryRetryService } from './delivery-retry.service';
import { RetryDeliveryDto } from './dto/m10-hardening.dto';
import { ListNotificationDeliveriesQueryDto } from './dto/communication-list-query.dto';

@Controller('notifications/deliveries')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notifications')
export class NotificationDeliveriesAliasController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly deliveryRetryService: DeliveryRetryService,
  ) {}

  @Get()
  @Permissions('notifications:view_delivery_diagnostics')
  listDeliveries(
    @Query() query: ListNotificationDeliveriesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.listDeliveries(auth, query);
  }

  @Get('analytics')
  @Permissions('notifications:view_delivery_diagnostics')
  analytics(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.getDeliveryAnalytics(auth);
  }

  @Get('operations')
  @Permissions('notifications:view_delivery_diagnostics')
  operations(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListNotificationDeliveriesQueryDto,
  ) {
    return this.communicationsService.listDeliveryOperations(auth, query);
  }

  @Get('failures')
  @Permissions('notifications:view_delivery_diagnostics')
  failures(
    @Query() query: ListNotificationDeliveriesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.deliveryRetryService.listFailureDashboard(auth, query);
  }

  @Post(':deliveryId/retry')
  @Permissions('notifications:retry_deliveries')
  retryDelivery(
    @Param('deliveryId') deliveryId: string,
    @Body() dto: RetryDeliveryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.deliveryRetryService.retryDelivery(deliveryId, auth, {
      reason: dto?.reason ?? null,
    });
  }

  @Post('retry-failed')
  @Permissions('notifications:retry_deliveries')
  retryFailedDeliveries(
    @Body() dto: RetryDeliveryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.deliveryRetryService.retryFailedDeliveries(auth, {
      reason: dto?.reason ?? null,
    });
  }
}
