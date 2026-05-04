import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AcademicsService } from './academics.service';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class SubjectsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get()
  @Permissions('academics:read')
  listSubjects(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId?: string,
  ) {
    if (classId) {
      return this.academicsService.listSubjectsByClass(auth, classId);
    }

    return this.academicsService.listSubjects(auth);
  }

  @Post()
  @Permissions('academics:manage')
  createSubject(
    @Body() dto: CreateSubjectDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createSubject(dto, auth);
  }
}

@Controller('teacher-assignments')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class TeacherAssignmentsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get()
  @Permissions('academics:read')
  listTeacherAssignments(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listTeacherAssignments(auth);
  }

  @Post()
  @Permissions('academics:manage')
  assignTeacher(
    @Body() dto: AssignTeacherDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.assignTeacher(dto, auth);
  }
}
