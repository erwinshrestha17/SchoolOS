import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { NoModuleEntitlement } from '../auth/decorators/no-module-entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { PrincipalApprovalQueueService } from './principal-approval-queue.service';

@ApiTags('approvals')
@Controller('advanced/approvals/principal')
@UseGuards(
  JwtAuthGuard,
  TenantActiveGuard,
  RolesPermissionsGuard,
  EntitlementGuard,
)
@NoModuleEntitlement(
  'Cross-module Principal approval queue; request eligibility and advanced approval RBAC are enforced by the service and guards',
)
@Roles('principal')
@Permissions('advanced:approvals:read')
export class PrincipalApprovalQueueController {
  constructor(private readonly service: PrincipalApprovalQueueService) {}

  @Get('queue')
  @ApiOperation({
    summary: 'List approval requests currently reviewable by the Principal',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 25 })
  @ApiOkResponse({
    description:
      'Tenant-scoped, purpose-limited, cursor-paginated Principal approval queue.',
  })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query('cursor') cursor?: string,
    @Query('limit') rawLimit?: string,
  ) {
    const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    const trimmedCursor = cursor?.trim();
    return this.service.list(auth, {
      cursor: trimmedCursor?.length ? trimmedCursor : undefined,
      limit:
        parsedLimit !== undefined && Number.isFinite(parsedLimit)
          ? parsedLimit
          : undefined,
    });
  }
}
