import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TeacherTodayService } from './teacher-today.service';
import { TeacherTodayQueryDto } from './dto/teacher-today-query.dto';

@Controller('teacher-workspace')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
@Roles('teacher', 'subject_teacher')
export class TeacherTodayController {
  constructor(private readonly teacherTodayService: TeacherTodayService) {}

  @Get('today')
  @Permissions('attendance:read')
  getToday(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TeacherTodayQueryDto,
  ) {
    return this.teacherTodayService.getToday(auth, query.date);
  }
}
