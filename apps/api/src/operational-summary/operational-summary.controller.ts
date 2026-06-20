import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FEATURE_KEYS } from '@schoolos/core';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import {
  OPERATIONAL_SUMMARY_MODULES,
  type OperationalSummaryModule,
} from './operational-summary.types';
import { OperationalSummaryService } from './operational-summary.service';

@ApiTags('dashboard-summary')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
@Roles(
  'principal',
  'admin',
  'school_admin',
  'accountant',
  'cashier',
  'admission_officer',
  'teacher',
  'subject_teacher',
  'hr',
  'librarian',
  'transport_manager',
  'canteen_staff',
)
export class OperationalDashboardSummaryController {
  constructor(private readonly service: OperationalSummaryService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get the safe, lightweight school operations summary' })
  @ApiOkResponse({ description: 'A bounded, permission-filtered dashboard summary.' })
  getDashboardSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getDashboardSummary(auth);
  }

  @Get(':module/summary')
  @ApiOperation({ summary: 'Get an operational summary for one school module' })
  @ApiParam({
    name: 'module',
    enum: OPERATIONAL_SUMMARY_MODULES,
    description: 'SchoolOS operational summary module key.',
  })
  @ApiOkResponse({ description: 'A bounded module summary, locked state, or permission-denied state.' })
  getModuleSummary(
    @Param('module') module: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    if (!isOperationalSummaryModule(module)) {
      throw new BadRequestException('Unknown SchoolOS summary module.');
    }
    return this.service.getModuleSummary(module, auth);
  }
}

@ApiTags('mobile-summary')
@Controller('mobile')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard, EntitlementGuard)
export class OperationalMobileSummaryController {
  constructor(private readonly service: OperationalSummaryService) {}

  @Get('parent/summary')
  @Roles('parent', 'guardian')
  @Entitlement(FEATURE_KEYS.MOBILE_PARENT_BASIC)
  @ApiOperation({ summary: 'Get a linked-child-only parent mobile summary' })
  parentSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getMobileSummary('parent', auth);
  }

  @Get('teacher/summary')
  @Roles('teacher', 'subject_teacher')
  @Permissions('attendance:read')
  @Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
  @ApiOperation({ summary: 'Get an assigned-scope teacher mobile summary' })
  teacherSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getMobileSummary('teacher', auth);
  }

  @Get('principal/summary')
  @Roles('principal', 'admin')
  @Permissions('students:read', 'attendance:read')
  @Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
  @ApiOperation({ summary: 'Get a principal attention-first mobile summary' })
  principalSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getMobileSummary('principal', auth);
  }

  @Get('driver/summary')
  @Roles('driver', 'conductor')
  @Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
  @ApiOperation({ summary: 'Get an assigned-trip-only driver mobile summary' })
  driverSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getMobileSummary('driver', auth);
  }

  @Get('staff/summary')
  @Roles('staff', 'teacher', 'subject_teacher')
  @Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
  @ApiOperation({ summary: 'Get an own-staff-only self-service mobile summary' })
  staffSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getMobileSummary('staff', auth);
  }

  @Get('student/summary')
  @Roles('student')
  @Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
  @ApiOperation({ summary: 'Get a self-only student mobile summary' })
  studentSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getMobileSummary('student', auth);
  }
}

function isOperationalSummaryModule(value: string): value is OperationalSummaryModule {
  return (OPERATIONAL_SUMMARY_MODULES as readonly string[]).includes(value);
}
