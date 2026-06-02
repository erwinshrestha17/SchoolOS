import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import { SubmitAttendanceDto } from '../attendance/dto/submit-attendance.dto';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';

@Controller('mobile/teacher/attendance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.attendance')
export class MobileTeacherAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('classes')
  @Permissions('attendance:read')
  listClasses(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listTeacherMobileClassSections(auth);
  }

  @Get('roster')
  @Permissions('attendance:read')
  async getRoster(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('sectionId') sectionId?: string,
    @Query('attendanceDate') attendanceDate?: string,
  ) {
    const roster = await this.attendanceService.getRoster(
      auth,
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
    );

    return {
      academicYearId: roster.academicYear.id,
      academicYearName: roster.academicYear.name,
      classId: roster.class.id,
      className: roster.class.name,
      sectionId: roster.section?.id ?? null,
      sectionName: roster.section?.name ?? null,
      attendanceDate: roster.attendanceDate,
      existingSession: roster.existingSession,
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

  @Post('submit')
  @Permissions('attendance:mark')
  submit(@Body() dto: SubmitAttendanceDto, @CurrentAuth() auth: AuthContext) {
    return this.attendanceService.submitAttendance(dto, auth);
  }
}
