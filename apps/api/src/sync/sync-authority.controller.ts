import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { NoModuleEntitlement } from '../auth/decorators/no-module-entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { getOrCreateTenantAuthorityFence } from './authority-fence';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard, TenantActiveGuard, EntitlementGuard)
@NoModuleEntitlement(
  'Tenant authority fence discovery is session-scoped for School Edge fencing, not a feature module',
)
export class SyncAuthorityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('authority')
  @ApiOperation({
    summary: 'Discover the active school authority fence for this tenant',
  })
  @ApiOkResponse({
    description: 'Current authorityNodeId and authorityEpoch',
  })
  getAuthority(@CurrentAuth() auth: AuthContext) {
    if (!auth.tenantId || auth.tenantId === 'platform') {
      throw new ForbiddenException(
        'School authority discovery is tenant-scoped',
      );
    }
    return getOrCreateTenantAuthorityFence(this.prisma, auth.tenantId);
  }
}
