import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TimetableService } from '../timetable/timetable.service';
import { MobileTeacherTimetableQueryDto } from './dto/mobile-teacher-timetable.dto';

@Controller('mobile/teacher/timetable')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.timetable')
@Roles('teacher')
export class MobileTeacherTimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Permissions('timetable:read')
  getTimetable(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobileTeacherTimetableQueryDto,
  ) {
    return this.timetableService.getTeacherMobileTimetable(auth, query);
  }
}
