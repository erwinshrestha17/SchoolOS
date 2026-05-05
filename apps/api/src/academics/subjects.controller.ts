import {
  Body,
  Controller,
  Delete,
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
import { AcademicsFoundationService } from './academics-foundation.service';
import { AcademicsService } from './academics.service';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class SubjectsController {
  constructor(
    private readonly academicsService: AcademicsService,
    private readonly academicsFoundationService: AcademicsFoundationService,
  ) {}

  @Get()
  @Permissions('academics:read')
  listSubjects(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId?: string,
  ) {
    return this.academicsFoundationService.listSubjects(auth, { classId });
  }

  @Get('class/:classId')
  @Permissions('academics:read')
  listSubjectsByClass(
    @Param('classId') classId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.listSubjects(auth, { classId });
  }

  @Post()
  @Permissions('academics:create')
  createSubject(
    @Body() dto: CreateSubjectDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.createSubject(dto, auth);
  }

  @Patch(':id')
  @Permissions('academics:update')
  updateSubject(
    @Param('id') subjectId: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.updateSubject(subjectId, dto, auth);
  }

  @Delete(':id')
  @Permissions('academics:delete')
  deleteSubject(
    @Param('id') subjectId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.deleteSubject(subjectId, auth);
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
  @Permissions('academics:update')
  assignTeacher(
    @Body() dto: AssignTeacherDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.assignTeacher(dto, auth);
  }
}
