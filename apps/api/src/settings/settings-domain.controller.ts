import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { NoModuleEntitlement } from '../auth/decorators/no-module-entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { UpdateSchoolSettingsDomainDto } from './dto/update-school-settings-domain.dto';
import { SettingsDomainMutationService } from './settings-domain-mutation.service';

@Controller('settings/domains')
@UseGuards(
  JwtAuthGuard,
  TenantActiveGuard,
  RolesPermissionsGuard,
  EntitlementGuard,
)
@NoModuleEntitlement(
  'Institutional settings span core domains; exact per-domain write authority is enforced for every setting key',
)
export class SettingsDomainController {
  constructor(
    private readonly domainMutationService: SettingsDomainMutationService,
  ) {}

  @Patch(':domain')
  @Permissions('settings:read')
  updateDomain(
    @Param('domain') domain: string,
    @Body() dto: UpdateSchoolSettingsDomainDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.domainMutationService.updateDomain(domain, dto, auth);
  }
}
