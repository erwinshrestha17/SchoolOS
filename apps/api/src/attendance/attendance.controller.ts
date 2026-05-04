import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
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

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
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
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
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
    @Query() query: ListAttendanceSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getMonthlyRegister(query, auth);
  }

  @Get('register/export')
  @Permissions('attendance:read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendance-register.csv"')
  exportMonthlyRegister(
    @Query() query: ListAttendanceSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.exportMonthlyRegister(query, auth);
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
  syncAttendance(
    @Body() dto: SyncAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.syncAttendance(dto, auth);
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
}
