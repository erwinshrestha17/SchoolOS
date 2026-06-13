import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AttendanceService } from './attendance.service';
import { CreateMyStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { StaffTimeClockDto } from './dto/staff-time-clock.dto';
import { StaffSelfServiceService } from './staff-self-service.service';
import { StaffTimeClockService } from './staff-time-clock.service';

@Controller('hr/me')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class StaffSelfServiceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly selfService: StaffSelfServiceService,
    private readonly timeClockService: StaffTimeClockService,
  ) {}

  @Get('attendance')
  @Permissions('staff:read')
  listMyAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listMyAttendance(auth);
  }

  @Get('leave-requests')
  @Permissions('staff:read')
  listMyLeaveRequests(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listMyLeaveRequests(auth);
  }

  @Get('leave-balances')
  @Permissions('staff:read')
  listMyLeaveBalances(@CurrentAuth() auth: AuthContext) {
    return this.selfService.listMyLeaveBalances(auth);
  }

  @Post('leave-requests')
  @Permissions('hr:leave:request')
  createMyLeaveRequest(
    @Body() dto: CreateMyStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.selfService.createMyLeaveRequest(dto, auth);
  }

  @Get('time-clock')
  @Permissions('staff:read')
  getMyTimeClockStatus(
    @CurrentAuth() auth: AuthContext,
    @Query('date') date?: string,
  ) {
    return this.timeClockService.getMyTimeClockStatus(auth, date);
  }

  @Post('time-clock/check-in')
  @Permissions('staff:read')
  checkIn(@Body() dto: StaffTimeClockDto, @CurrentAuth() auth: AuthContext) {
    return this.timeClockService.checkIn(dto, auth);
  }

  @Post('time-clock/check-out')
  @Permissions('staff:read')
  checkOut(@Body() dto: StaffTimeClockDto, @CurrentAuth() auth: AuthContext) {
    return this.timeClockService.checkOut(dto, auth);
  }
}
