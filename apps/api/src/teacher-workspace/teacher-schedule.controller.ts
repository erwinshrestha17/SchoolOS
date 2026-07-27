import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { TimetableService } from '../timetable/timetable.service';
import { TeacherScheduleQueryDto } from './dto/teacher-schedule-query.dto';

/**
 * Teacher "My Schedule" for the web plane (Teacher Persona spec 12.2, P0.5).
 *
 * Additive and purpose-limited: it reuses the already self-scoped
 * `TimetableService.getTeacherMobileTimetable`, which resolves the caller's
 * own Staff row and returns only published/locked slots taught by that staff
 * member plus substitutions where they are the absent or covering teacher.
 * There is deliberately no `teacherId`, `classId` or `roomId` parameter — a
 * teacher cannot request anyone else's schedule through this route.
 *
 * The administrative timetable APIs (versions, builder, validation,
 * school-wide substitution lists) are unchanged and still require
 * `timetable:manage`.
 */
@Controller('teacher-workspace')
@UseGuards(
  JwtAuthGuard,
  TenantActiveGuard,
  RolesPermissionsGuard,
  EntitlementGuard,
)
@Entitlement('module.timetable')
@Roles('teacher', 'subject_teacher')
export class TeacherScheduleController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get('schedule')
  @Permissions('timetable:read')
  getSchedule(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TeacherScheduleQueryDto,
  ) {
    return this.timetableService.getTeacherMobileTimetable(auth, query);
  }
}
