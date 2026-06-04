import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { DeliveryRetryService } from './delivery-retry.service';

@Controller('communications/deliveries')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class DeliveriesController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly deliveryRetryService: DeliveryRetryService,
  ) {}

  @Get()
  @Permissions('communications:read_deliveries')
  listDeliveries(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.listDeliveries(auth);
  }

  @Get('analytics')
  @Permissions('communications:read_deliveries')
  analytics(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.getDeliveryAnalytics(auth);
  }

  @Get('failures')
  @Permissions('communications:read_deliveries')
  failures(@CurrentAuth() auth: AuthContext) {
    return this.deliveryRetryService.listFailureDashboard(auth);
  }

  @Post(':deliveryId/retry')
  @Permissions('communications:retry_deliveries')
  retryDelivery(
    @Param('deliveryId') deliveryId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.deliveryRetryService.retryDelivery(deliveryId, auth);
  }

  @Post('retry-failed')
  @Permissions('communications:retry_deliveries')
  retryFailedDeliveries(@CurrentAuth() auth: AuthContext) {
    return this.deliveryRetryService.retryFailedDeliveries(auth);
  }
}
