import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { PrincipalOperationsSummaryService } from './principal-operations-summary.service';

@ApiTags('principal-summary')
@Controller('dashboard/principal')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
@Roles('principal')
@Permissions('reports:read')
export class PrincipalOperationsSummaryController {
  constructor(private readonly service: PrincipalOperationsSummaryService) {}

  @Get('operations-summary')
  @ApiOperation({
    summary: 'Get a purpose-limited Principal summary for enabled school operations',
  })
  @ApiOkResponse({
    description:
      'Tenant-scoped Library, Transport, and Canteen leadership metrics. Disabled modules are returned as locked and no operator records are exposed.',
  })
  getSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getSummary(auth);
  }
}
