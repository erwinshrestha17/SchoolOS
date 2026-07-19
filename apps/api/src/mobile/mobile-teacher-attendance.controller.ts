import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { AttendanceService } from '../attendance/attendance.service';
import { SyncAttendanceDto } from '../attendance/dto/sync-attendance.dto';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  MobileTeacherAttendanceRosterQueryDto,
  MobileTeacherTodayQueryDto,
} from './dto/mobile-teacher-attendance-query.dto';
import { MobileTeacherAttendanceSyncReceiptDto } from './dto/mobile-teacher-attendance-sync-receipt.dto';

@Controller('mobile/teacher/attendance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.attendance')
@Roles('teacher')
export class MobileTeacherAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('classes')
  @Permissions('attendance:read')
  listClasses(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listTeacherMobileClassSections(auth);
  }

  @Get('today')
  @Permissions('attendance:read')
  getToday(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobileTeacherTodayQueryDto,
  ) {
    return this.attendanceService.getTeacherMobileToday(auth, query.date);
  }

  @Get('roster')
  @Permissions('attendance:read')
  async getRoster(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobileTeacherAttendanceRosterQueryDto,
  ) {
    const roster = await this.attendanceService.getRoster(
      auth,
      query.academicYearId,
      query.classId,
      query.sectionId,
      query.attendanceDate,
    );

    return {
      academicYearId: roster.academicYear.id,
      academicYearName: roster.academicYear.name,
      classId: roster.class.id,
      className: roster.class.name,
      sectionId: roster.section?.id ?? null,
      sectionName: roster.section?.name ?? null,
      attendanceDate: roster.attendanceDate,
      attendanceState: roster.attendanceState,
      calendarDay: roster.calendarDay,
      students: roster.students.map((student) => ({
        studentId: student.id,
        studentName: student.fullNameEn,
        rollNumber: student.rollNumber,
        status: student.status,
        remark: student.remark,
      })),
    };
  }

  @Post('sync')
  @Permissions('attendance:mark')
  @ApiCreatedResponse({ type: MobileTeacherAttendanceSyncReceiptDto })
  async sync(@Body() dto: SyncAttendanceDto, @CurrentAuth() auth: AuthContext) {
    const result = await this.attendanceService.syncAttendance(dto, auth);
    return {
      clientSubmissionId: result.clientSubmissionId,
      attendanceSessionId: result.attendanceSessionId,
      conflictId: result.conflictId,
      syncStatus: result.syncStatus,
      replayed: result.replayed,
      serverReceivedAt: result.serverReceivedAt,
    };
  }
}
