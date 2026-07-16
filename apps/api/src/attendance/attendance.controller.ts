import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from './attendance.service';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { ListAttendanceSummaryDto } from './dto/list-attendance-summary.dto';
import { ListStaffAttendanceSummaryDto } from './dto/list-staff-attendance-summary.dto';
import { OverrideAttendanceSessionDto } from './dto/override-attendance-session.dto';
import { ReviewAttendanceConflictDto } from './dto/review-attendance-conflict.dto';
import { ReviewStaffLeaveRequestDto } from './dto/review-staff-leave-request.dto';
import { SubmitStaffAttendanceDto } from './dto/submit-staff-attendance.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { UpsertCalendarDayDto } from './dto/upsert-calendar-day.dto';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';
import { ListAttendanceCorrectionRequestsDto } from './dto/list-attendance-correction-requests.dto';
import { GetMonthlyRegisterDto } from './dto/get-monthly-register.dto';
import { GetStudentHistoryDto } from './dto/get-student-history.dto';
import { UpsertAttendanceDraftDto } from './dto/upsert-attendance-draft.dto';
import { GetParentSummaryDto } from './dto/get-parent-summary.dto';
import {
  StudentAttendanceMonthQueryDto,
  StudentAttendanceMonthlyRegisterResponseDto,
} from './dto/student-attendance-register.dto';
import { AttendanceSyncResultDto } from './dto/attendance-sync-result.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @Permissions('attendance:read')
  listAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listAttendance(auth);
  }

  @Get('rosters')
  @Permissions('attendance:read')
  getRoster(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId: string,
    // Optional: teachers without academic_years:read cannot list years, so
    // the service falls back to the tenant's current academic year.
    @Query('academicYearId') academicYearId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('attendanceDate') attendanceDate?: string,
  ) {
    return this.attendanceService.getRoster(
      auth,
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
    );
  }

  @Get('analytics')
  @Permissions('attendance:read')
  getAnalytics(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.getAnalytics(auth);
  }

  @Get('anomalies')
  @Permissions('attendance:read')
  getAnomalies(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.getAttendanceAnomalies(auth);
  }

  @Get('follow-ups')
  @Permissions('attendance:read')
  getFollowUpQueue(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.getFollowUpQueue(auth);
  }

  @Get('summary')
  @Permissions('attendance:read')
  getSummary(
    @Query() query: ListAttendanceSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getSummary(query, auth);
  }

  @Get('register')
  @Permissions('attendance:read')
  getMonthlyRegister(
    @Query() query: GetMonthlyRegisterDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getMonthlyRegister(query, auth);
  }

  @Get('register/export')
  @Permissions('attendance:read')
  async exportMonthlyRegister(
    @Query() query: GetMonthlyRegisterDto,
    @Query('format') format: 'csv' | 'pdf' = 'csv',
    @CurrentAuth() auth: AuthContext,
  ) {
    const result = await this.attendanceService.exportMonthlyRegister(
      query,
      format,
      auth,
    );

    if (format === 'pdf') {
      return result; // Service will return Buffer
    }

    return result; // Service will return string
  }

  @Get('register/exports')
  @Permissions('attendance:read')
  listMonthlyRegisterExports(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendanceService.listMonthlyRegisterExports(auth, {
      page,
      limit,
    });
  }

  @Get('conflicts')
  @Permissions('attendance:read')
  listConflicts(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listConflicts(auth);
  }

  @Get('calendar')
  @Permissions('attendance:read')
  listCalendarDays(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listCalendarDays(auth);
  }

  @Post('calendar')
  @Permissions('attendance:mark')
  upsertCalendarDay(
    @Body() dto: UpsertCalendarDayDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.upsertCalendarDay(dto, auth);
  }

  @Get('staff')
  @Permissions('attendance:read')
  listStaffAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listStaffAttendance(auth);
  }

  @Get('staff/summary')
  @Permissions('attendance:read', 'payroll:read')
  listStaffAttendanceSummary(
    @Query() query: ListStaffAttendanceSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.listStaffAttendanceSummary(query, auth);
  }

  @Get('me/attendance')
  @Permissions('staff:read')
  listMyAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listMyAttendance(auth);
  }

  @Get('me/leave-requests')
  @Permissions('staff:read')
  listMyLeaveRequests(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listMyLeaveRequests(auth);
  }

  @Post('staff')
  @Permissions('attendance:mark')
  submitStaffAttendance(
    @Body() dto: SubmitStaffAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.submitStaffAttendance(dto, auth);
  }

  @Get('staff/leave-balances')
  @Permissions('hr:read')
  listLeaveBalances(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listLeaveBalances(auth);
  }

  @Get('staff/leave-requests')
  @Permissions('hr:read')
  listLeaveRequests(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listLeaveRequests(auth);
  }

  @Post('staff/leave-requests')
  @Permissions('hr:manage')
  createLeaveRequest(
    @Body() dto: CreateStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.createLeaveRequest(dto, auth);
  }

  @Post('staff/leave/:id/cancel')
  @Permissions('attendance:staff:update')
  cancelLeaveRequest(
    @Param('id') leaveRequestId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.cancelLeaveRequest(leaveRequestId, auth);
  }

  @Patch('staff/leave-requests/:id/review')
  @Permissions('hr:manage')
  reviewLeaveRequest(
    @Param('id') leaveRequestId: string,
    @Body() dto: ReviewStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.reviewLeaveRequest(leaveRequestId, dto, auth);
  }

  @Post('sessions')
  @Permissions('attendance:mark')
  submitAttendance(
    @Body() dto: SubmitAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.submitAttendance(dto, auth);
  }

  @Post('sync')
  @Permissions('attendance:mark')
  @ApiCreatedResponse({ type: AttendanceSyncResultDto })
  syncAttendance(
    @Body() dto: SyncAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.syncAttendance(dto, auth);
  }

  @Post('drafts')
  @Permissions('attendance:mark')
  upsertDraft(
    @Body() dto: UpsertAttendanceDraftDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.upsertDraft(dto, auth);
  }

  @Get('drafts')
  @Permissions('attendance:mark')
  listDrafts(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listDrafts(auth);
  }

  @Post('drafts/cleanup')
  @Permissions('attendance:manage_all')
  cleanupDrafts(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.cleanupOldDrafts(auth.tenantId);
  }

  @Post('drafts/:id/submit')
  @Permissions('attendance:mark')
  submitDraft(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.attendanceService.submitDraft(id, auth);
  }

  @Patch('sessions/:id/override')
  @Permissions('attendance:review_conflicts')
  overrideLockedSession(
    @Param('id') sessionId: string,
    @Body() dto: OverrideAttendanceSessionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.overrideLockedSession(sessionId, dto, auth);
  }

  @Patch('conflicts/:id/review')
  @Permissions('attendance:review_conflicts')
  reviewConflict(
    @Param('id') conflictId: string,
    @Body() dto: ReviewAttendanceConflictDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.reviewConflict(conflictId, dto, auth);
  }

  @Post('corrections')
  @Permissions('attendance:mark')
  createCorrectionRequest(
    @Body() dto: CreateAttendanceCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.createCorrectionRequest(dto, auth);
  }

  @Get('corrections')
  @Permissions('attendance:read')
  listCorrectionRequests(
    @Query() query: ListAttendanceCorrectionRequestsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.listCorrectionRequests(auth, query);
  }

  @Get('corrections/:id')
  @Permissions('attendance:read')
  getCorrectionRequest(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getCorrectionRequest(id, auth);
  }

  @Patch('corrections/:id/approve')
  @Permissions('attendance:review_conflicts')
  approveCorrectionRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.approveCorrectionRequest(
      id,
      Object.assign({}, dto, { status: 'APPROVED' as const }),
      auth,
    );
  }

  @Patch('corrections/:id/reject')
  @Permissions('attendance:review_conflicts')
  rejectCorrectionRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.approveCorrectionRequest(
      id,
      Object.assign({}, dto, { status: 'REJECTED' as const }),
      auth,
    );
  }

  @Patch('corrections/:id/review')
  @Permissions('attendance:review_conflicts')
  reviewCorrectionRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.approveCorrectionRequest(id, dto, auth);
  }

  @Get('students/:id/history')
  @Permissions('attendance:read')
  getStudentHistory(
    @Param('id') studentId: string,
    @Query() query: GetStudentHistoryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getStudentHistory(studentId, query, auth);
  }

  @Get('students/:studentId/monthly-register')
  @Permissions('attendance:read')
  @ApiOperation({
    summary:
      'Get one student monthly attendance calendar, summary, and register',
  })
  @ApiOkResponse({ type: StudentAttendanceMonthlyRegisterResponseDto })
  getStudentMonthlyRegister(
    @Param('studentId') studentId: string,
    @Query() query: StudentAttendanceMonthQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getStudentMonthlyRegister(
      studentId,
      query,
      auth,
    );
  }

  @Get('students/:id/summary')
  @Permissions('attendance:read')
  getParentSummary(
    @Param('id') studentId: string,
    @Query() query: GetParentSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getParentSummary(studentId, auth, query);
  }
}
