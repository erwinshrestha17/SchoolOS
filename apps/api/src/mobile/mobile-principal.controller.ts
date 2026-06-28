import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FEATURE_KEYS } from '@schoolos/core';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RequiredFeature } from '../auth/decorators/required-feature.decorator';
import { RequiredModule } from '../auth/decorators/required-module.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  MobilePrincipalApprovalDecisionDto,
  MobilePrincipalApprovalQueryDto,
} from './dto/mobile-principal-approval.dto';
import {
  MobilePrincipalEmergencyNoticePreviewDto,
  MobilePrincipalEmergencyNoticeSubmitDto,
} from './dto/mobile-principal-emergency-notice.dto';
import {
  MobilePrincipalEscalationAssignmentDto,
  MobilePrincipalEscalationNoteDto,
  MobilePrincipalEscalationQueryDto,
  MobilePrincipalEscalationReopenDto,
  MobilePrincipalEscalationResolutionDto,
} from './dto/mobile-principal-escalation.dto';
import { MobilePrincipalService } from './mobile-principal.service';

@ApiTags('mobile-principal')
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
    @Query() query: MobilePrincipalApprovalQueryDto,
  ) {
    return this.service.getApprovals(auth, query.status);
  }

  @Get('approvals/:approvalRequestId')
  @Permissions('advanced:approvals:read')
  approvalDetail(
    @CurrentAuth() auth: AuthContext,
    @Param('approvalRequestId', new ParseUUIDPipe())
    approvalRequestId: string,
  ) {
    return this.service.getApprovalDetail(auth, approvalRequestId);
  }

  @Post('approvals/:approvalRequestId/decisions')
  @Permissions('advanced:approvals:decide')
  decideApproval(
    @CurrentAuth() auth: AuthContext,
    @Param('approvalRequestId', new ParseUUIDPipe())
    approvalRequestId: string,
    @Body() dto: MobilePrincipalApprovalDecisionDto,
  ) {
    return this.service.decideApproval(auth, approvalRequestId, dto);
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
  @Permissions('messaging:manage')
  escalations(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobilePrincipalEscalationQueryDto,
  ) {
    return this.service.getEscalations(auth, query.status);
  }

  @Get('escalations/:escalationId')
  @Permissions('messaging:manage')
  escalationDetail(
    @CurrentAuth() auth: AuthContext,
    @Param('escalationId', new ParseUUIDPipe()) escalationId: string,
  ) {
    return this.service.getEscalationDetail(auth, escalationId);
  }

  @Post('escalations/:escalationId/assign-self')
  @Permissions('messaging:manage')
  assignEscalationToSelf(
    @CurrentAuth() auth: AuthContext,
    @Param('escalationId', new ParseUUIDPipe()) escalationId: string,
  ) {
    return this.service.assignEscalationToSelf(auth, escalationId);
  }

  @Post('escalations/:escalationId/assign')
  @Permissions('messaging:manage')
  assignEscalation(
    @CurrentAuth() auth: AuthContext,
    @Param('escalationId', new ParseUUIDPipe()) escalationId: string,
    @Body() dto: MobilePrincipalEscalationAssignmentDto,
  ) {
    return this.service.assignEscalation(auth, escalationId, dto);
  }

  @Post('escalations/:escalationId/notes')
  @Permissions('messaging:manage')
  addEscalationNote(
    @CurrentAuth() auth: AuthContext,
    @Param('escalationId', new ParseUUIDPipe()) escalationId: string,
    @Body() dto: MobilePrincipalEscalationNoteDto,
  ) {
    return this.service.addEscalationNote(auth, escalationId, dto);
  }

  @Post('escalations/:escalationId/resolve')
  @Permissions('messaging:manage')
  resolveEscalation(
    @CurrentAuth() auth: AuthContext,
    @Param('escalationId', new ParseUUIDPipe()) escalationId: string,
    @Body() dto: MobilePrincipalEscalationResolutionDto,
  ) {
    return this.service.resolveEscalation(auth, escalationId, dto);
  }

  @Post('escalations/:escalationId/reopen')
  @Permissions('messaging:manage')
  reopenEscalation(
    @CurrentAuth() auth: AuthContext,
    @Param('escalationId', new ParseUUIDPipe()) escalationId: string,
    @Body() dto: MobilePrincipalEscalationReopenDto,
  ) {
    return this.service.reopenEscalation(auth, escalationId, dto);
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
  @RequiredModule('notices')
  @RequiredFeature(FEATURE_KEYS.NOTICES_FULL)
  emergencyNotice(@CurrentAuth() auth: AuthContext) {
    return this.service.getEmergencyNotice(auth);
  }

  @Post('emergency-notices/recipient-preview')
  @Permissions('notices:create', 'advanced:approvals:manage')
  @RequiredModule('notices')
  @RequiredFeature(FEATURE_KEYS.NOTICES_FULL)
  previewEmergencyNoticeRecipients(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MobilePrincipalEmergencyNoticePreviewDto,
  ) {
    return this.service.previewEmergencyNoticeRecipients(auth, dto);
  }

  @Post('emergency-notices')
  @Permissions('notices:create', 'advanced:approvals:manage')
  @RequiredModule('notices')
  @RequiredFeature(FEATURE_KEYS.NOTICES_FULL)
  submitEmergencyNotice(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MobilePrincipalEmergencyNoticeSubmitDto,
  ) {
    return this.service.submitEmergencyNotice(auth, dto);
  }

  @Get('emergency-notices/:noticeId')
  @Permissions('notices:read')
  @RequiredModule('notices')
  @RequiredFeature(FEATURE_KEYS.NOTICES_FULL)
  emergencyNoticeStatus(
    @CurrentAuth() auth: AuthContext,
    @Param('noticeId', new ParseUUIDPipe()) noticeId: string,
  ) {
    return this.service.getEmergencyNoticeStatus(auth, noticeId);
  }
}
