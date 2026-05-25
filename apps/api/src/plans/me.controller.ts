import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { AuthContext } from '../auth/auth.types';
import { EntitlementsService } from './entitlements.service';

@Controller('me')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class MeController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('entitlements')
  @Permissions('roles:read')
  async getMyEntitlements(@CurrentAuth() auth: AuthContext) {
    return this.entitlementsService.getEntitlements(auth.tenantId);
  }
}
