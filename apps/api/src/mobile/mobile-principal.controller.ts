import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FEATURE_KEYS } from '@schoolos/core';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { MobilePrincipalService } from './mobile-principal.service';

@Controller('mobile/principal')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
@Roles('principal', 'admin', 'platform_super_admin')
export class MobilePrincipalController {
  constructor(private readonly service: MobilePrincipalService) {}

  @Get('dashboard')
  @Permissions('students:read', 'attendance:read', 'notices:read')
  dashboard(@CurrentAuth() auth: AuthContext) {
    return this.service.getDashboard(auth);
  }

  @Get('attention')
  @Permissions('attendance:read', 'notices:read')
  attention(
    @CurrentAuth() auth: AuthContext,
    @Query('filter') filter?: string,
  ) {
    return this.service.getAttention(auth, filter);
  }

  @Get('approvals')
  @Permissions('advanced:approvals:read', 'hr:leave:approve')
  approvals(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
  ) {
    return this.service.getApprovals(auth, status);
  }

  @Get('attendance-summary')
  @Permissions('attendance:read')
  attendanceSummary(
    @CurrentAuth() auth: AuthContext,
    @Query('date') date?: string,
  ) {
    return this.service.getAttendanceSummary(auth, date);
  }

  @Get('staff-absence')
  @Permissions('staff:read', 'hr:leave:approve')
  staffAbsence(@CurrentAuth() auth: AuthContext, @Query('date') date?: string) {
    return this.service.getStaffAbsence(auth, date);
  }

  @Get('fees-summary')
  @Permissions('fees:manage', 'payments:close')
  feesSummary(@CurrentAuth() auth: AuthContext) {
    return this.service.getFeesSummary(auth);
  }

  @Get('academics-readiness')
  @Permissions('academics:read', 'marks:read')
  academicsReadiness(@CurrentAuth() auth: AuthContext) {
    return this.service.getAcademicsReadiness(auth);
  }

  @Get('transport-alerts')
  @Permissions('transport:reports:read', 'transport:trips:read')
  transportAlerts(@CurrentAuth() auth: AuthContext) {
    return this.service.getTransportAlerts(auth);
  }

  @Get('escalations')
  @Permissions('notices:read')
  escalations(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
  ) {
    return this.service.getEscalations(auth, status);
  }

  @Get('student-search')
  @Permissions('students:read')
  studentSearch(
    @CurrentAuth() auth: AuthContext,
    @Query('q') query?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.service.searchStudents(auth, { query, classId, sectionId });
  }

  @Get('reports-snapshot')
  @Permissions('reports:read')
  reportsSnapshot(@CurrentAuth() auth: AuthContext) {
    return this.service.getReportsSnapshot(auth);
  }

  @Get('tasks')
  @Permissions('advanced:approvals:read')
  tasks(@CurrentAuth() auth: AuthContext, @Query('tab') tab?: string) {
    return this.service.getTasks(auth, tab);
  }

  @Get('classroom-walkthroughs')
  @Permissions('academics:read')
  classroomWalkthroughs(@CurrentAuth() auth: AuthContext) {
    return this.service.getClassroomWalkthroughs(auth);
  }

  @Get('emergency-notice')
  @Permissions('notices:read')
  emergencyNotice(@CurrentAuth() auth: AuthContext) {
    return this.service.getEmergencyNotice(auth);
  }
}
