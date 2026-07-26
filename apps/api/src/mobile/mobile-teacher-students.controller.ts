import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FEATURE_KEYS } from '@schoolos/core';
import { AttendanceService } from '../attendance/attendance.service';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RequiredModule } from '../auth/decorators/required-module.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  LearningScopeQueryDto,
} from '../learning-improvement/dto/learning-improvement.dto';
import { LearningImprovementService } from '../learning-improvement/learning-improvement.service';
import {
  MobileTeacherFormativeAssessmentDto,
  MobileTeacherInterventionDto,
} from './dto/mobile-learning-improvement.dto';

@Controller('mobile/teacher/students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(FEATURE_KEYS.MOBILE_TEACHER_PARENT)
@Roles('teacher', 'subject_teacher')
export class MobileTeacherStudentsController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly learningImprovementService: LearningImprovementService,
  ) {}

  @Get(':studentId/summary')
  @Permissions('students:read')
  @RequiredModule('students')
  getStudentSummary(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.getTeacherMobileStudentSummary(auth, {
      studentId,
      academicYearId,
      classId,
      sectionId: sectionId?.trim() ? sectionId : null,
    });
  }

  @Get(':studentId/learning-support')
  @Permissions('academics:read')
  @RequiredModule('academics')
  getStudentLearningSupport(
    @Param('studentId') studentId: string,
    @Query() query: LearningScopeQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningImprovementService.getTeacherStudentLearningHub(
      auth,
      studentId,
      query,
    );
  }

  @Post(':studentId/formative-assessments')
  @Permissions('academics:enter_marks')
  @RequiredModule('academics')
  createFormativeAssessment(
    @Param('studentId') studentId: string,
    @Body() dto: MobileTeacherFormativeAssessmentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningImprovementService.createFormativeAssessment(auth, {
      ...dto,
      studentId,
    });
  }

  @Post(':studentId/interventions')
  @Permissions('academics:enter_marks')
  @RequiredModule('academics')
  createIntervention(
    @Param('studentId') studentId: string,
    @Body() dto: MobileTeacherInterventionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningImprovementService.createIntervention(auth, {
      ...dto,
      studentId,
    });
  }
}
