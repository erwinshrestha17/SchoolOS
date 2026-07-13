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
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { AdjustLeaveBalanceDto } from './dto/adjust-leave-balance.dto';
import { CorrectStaffAttendanceDto } from './dto/correct-staff-attendance.dto';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { ListStaffAttendanceSummaryDto } from './dto/list-staff-attendance-summary.dto';
import { ReviewStaffLeaveDecisionDto } from './dto/review-staff-leave-decision.dto';
import { ReviewStaffLeaveRequestDto } from './dto/review-staff-leave-request.dto';
import { SubmitStaffAttendanceDto } from './dto/submit-staff-attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller('hr')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('staff-attendance')
  @Permissions('hr:attendance:read')
  listStaffAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listStaffAttendance(auth);
  }

  @Post('staff-attendance')
  @Permissions('hr:attendance:write')
  submitStaffAttendance(
    @Body() dto: SubmitStaffAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.submitStaffAttendance(dto, auth);
  }

  @Post('staff-attendance/mark')
  @Permissions('hr:attendance:write')
  markStaffAttendance(
    @Body() dto: SubmitStaffAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.submitStaffAttendance(dto, auth);
  }

  @Patch('staff-attendance/:id')
  @Permissions('hr:attendance:correct')
  updateStaffAttendance(
    @Param('id') id: string,
    @Body() dto: CorrectStaffAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.correctStaffAttendance(id, dto, auth);
  }

  @Patch('staff-attendance/:id/correct')
  @Permissions('hr:attendance:correct')
  correctStaffAttendance(
    @Param('id') id: string,
    @Body() dto: CorrectStaffAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.correctStaffAttendance(id, dto, auth);
  }

  @Get('staff/:staffId/attendance')
  @Permissions('hr:attendance:read')
  staffAttendance(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getStaffAttendanceHistory(staffId, auth);
  }

  @Get('staff/:staffId/attendance-history')
  @Permissions('hr:attendance:read')
  staffAttendanceHistory(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getStaffAttendanceHistory(staffId, auth);
  }

  @Get('staff-attendance/summary')
  @Permissions('hr:attendance:read')
  listStaffAttendanceSummary(
    @Query() query: ListStaffAttendanceSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.listStaffAttendanceSummary(query, auth);
  }

  @Post('leaves')
  @Permissions('hr:leave:request')
  createLeave(
    @Body() dto: CreateStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.createLeaveRequest(dto, auth);
  }

  @Post('leave-requests')
  @Permissions('hr:leave:request')
  createLeaveRequest(
    @Body() dto: CreateStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.createLeaveRequest(dto, auth);
  }

  @Get('leaves')
  @Permissions('hr:leave:read')
  listLeaves(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listLeaveRequests(auth);
  }

  @Get('leave-requests')
  @Permissions('hr:leave:read')
  listLeaveRequests(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listLeaveRequests(auth);
  }

  @Get('leaves/:id')
  @Permissions('hr:leave:read')
  getLeave(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.attendanceService.getLeaveRequest(id, auth);
  }

  @Get('leave-requests/:id')
  @Permissions('hr:leave:read')
  getLeaveRequest(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.attendanceService.getLeaveRequest(id, auth);
  }

  @Post('leaves/:id/approve')
  @Permissions('hr:leave:approve')
  approveLeave(
    @Param('id') id: string,
    @Body() dto: ReviewStaffLeaveDecisionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.reviewLeaveRequest(
      id,
      { reviewNote: dto.reviewNote, status: 'APPROVED' },
      auth,
    );
  }

  @Post('leaves/:id/reject')
  @Permissions('hr:leave:approve')
  rejectLeave(
    @Param('id') id: string,
    @Body() dto: ReviewStaffLeaveDecisionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.reviewLeaveRequest(
      id,
      { reviewNote: dto.reviewNote, status: 'REJECTED' },
      auth,
    );
  }

  @Patch('leave-requests/:id/review')
  @Permissions('hr:leave:approve')
  reviewLeaveRequest(
    @Param('id') id: string,
    @Body() dto: ReviewStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.reviewLeaveRequest(id, dto, auth);
  }

  @Get('staff/:staffId/leave-balances')
  @Permissions('hr:leave:read')
  getLeaveBalances(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getStaffLeaveBalances(staffId, auth);
  }

  @Post('leave-balances/adjust')
  @Permissions('hr:leave:adjust')
  adjustLeaveBalance(
    @Body() dto: AdjustLeaveBalanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.adjustLeaveBalance(dto, auth);
  }
}
