import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  CreateStatutoryMembershipDto,
  EndStatutoryMembershipDto,
} from '../payroll/dto/statutory-membership.dto';
import { StatutoryMembershipService } from '../payroll/statutory-membership.service';

@ApiTags('HR statutory memberships')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('hr')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrStatutoryMembershipController {
  constructor(private readonly memberships: StatutoryMembershipService) {}

  @Get('staff/:staffId/statutory-memberships')
  @Permissions('hr:tax:read')
  @ApiOperation({
    summary: 'List a staff member’s SSF/PF membership history',
  })
  list(@Param('staffId') staffId: string, @CurrentAuth() auth: AuthContext) {
    return this.memberships.list(staffId, auth);
  }

  @Post('staff/:staffId/statutory-memberships')
  @Permissions('hr:tax:write')
  @ApiOperation({
    summary: 'Record an effective-dated SSF/PF membership',
  })
  create(
    @Param('staffId') staffId: string,
    @Body() dto: CreateStatutoryMembershipDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.memberships.create(staffId, dto, auth);
  }

  @Post('statutory-memberships/:id/end')
  @Permissions('hr:tax:write')
  @ApiOperation({
    summary: 'End an open membership with an audited reason',
  })
  end(
    @Param('id') id: string,
    @Body() dto: EndStatutoryMembershipDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.memberships.end(id, dto, auth);
  }
}
