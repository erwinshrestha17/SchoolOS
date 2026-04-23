import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post('register')
  register(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesPermissionsGuard)
  @Permissions('tenants:read')
  getCurrentTenant(@CurrentAuth() auth: AuthContext) {
    return this.tenantsService.getCurrentTenant(auth);
  }
}
