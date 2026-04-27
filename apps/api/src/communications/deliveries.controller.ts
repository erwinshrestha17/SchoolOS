import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';

@Controller('communications/deliveries')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class DeliveriesController {
  constructor(private readonly communicationsService: CommunicationsService) {}

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
}
