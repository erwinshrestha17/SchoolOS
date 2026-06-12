import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Entitlement } from '../../auth/decorators/entitlement.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../../auth/guards/roles-permissions.guard';
import { LEARNING_MODULE_ENTITLEMENT } from '../learning.constants';
import { LEARNING_PERMISSIONS } from '../learning.permissions';
import { ParentLearningSummaryQueryDto } from './dto/parent-learning-summary-query.dto';
import { ParentLearningSummaryService } from './parent-learning-summary.service';

@Controller('parent/learning')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(LEARNING_MODULE_ENTITLEMENT)
export class ParentLearningSummaryController {
  constructor(
    private readonly parentLearningSummaryService: ParentLearningSummaryService,
  ) {}

  @Get('summary')
  @Permissions(LEARNING_PERMISSIONS.PROGRESS)
  getSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ParentLearningSummaryQueryDto,
  ) {
    return this.parentLearningSummaryService.getSummary(auth, query.studentId);
  }
}
