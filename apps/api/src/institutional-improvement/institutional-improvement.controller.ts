import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RequiredModule } from '../auth/decorators/required-module.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  AddSchoolImprovementReviewDto,
  BoardExamReadinessQueryDto,
  CreateSchoolImprovementPlanDto,
  CreateTeacherGoalDto,
  CreateTeacherObservationDto,
  CreateTeacherTrainingDto,
  ListSchoolImprovementPlansDto,
  ListTeacherGoalsDto,
  ListTeacherObservationsDto,
  ListTeacherTrainingDto,
  TeacherDevelopmentQueryDto,
  UpdateSchoolImprovementActionDto,
  UpdateSchoolImprovementPlanDto,
  UpdateTeacherGoalDto,
  UpdateTeacherObservationDto,
} from './dto/institutional-improvement.dto';
import { InstitutionalImprovementService } from './institutional-improvement.service';

@ApiTags('institutional-improvement')
@Controller('institutional-improvement')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
// P2-03/P2-14 are outside the controlled-pilot boundary. The Learning module
// entitlement is the existing disabled-by-default release-boundary switch.
@RequiredModule('learning')
@Roles(
  'admin',
  'principal',
  'hr_manager',
  'teacher',
  'subject_teacher',
  'platform_super_admin',
)
export class InstitutionalImprovementController {
  constructor(private readonly service: InstitutionalImprovementService) {}

  @Get('teacher-development/overview')
  @Permissions('hr:read')
  teacherDevelopmentOverview(
    @CurrentAuth() actor: AuthContext,
    @Query() query: TeacherDevelopmentQueryDto,
  ) {
    return this.service.getTeacherDevelopmentOverview(actor, query);
  }

  @Get('teacher-development/me')
  @Permissions('staff:read')
  myTeacherDevelopment(@CurrentAuth() actor: AuthContext) {
    return this.service.getMyTeacherDevelopment(actor);
  }

  @Get('teacher-development/observations')
  @Permissions('hr:read')
  observations(
    @CurrentAuth() actor: AuthContext,
    @Query() query: ListTeacherObservationsDto,
  ) {
    return this.service.listTeacherObservations(actor, query);
  }

  @Post('teacher-development/observations')
  @Permissions('hr:manage')
  createObservation(
    @CurrentAuth() actor: AuthContext,
    @Body() dto: CreateTeacherObservationDto,
  ) {
    return this.service.createTeacherObservation(actor, dto);
  }

  @Patch('teacher-development/observations/:observationId')
  @Permissions('hr:manage')
  updateObservation(
    @CurrentAuth() actor: AuthContext,
    @Param('observationId', new ParseUUIDPipe()) observationId: string,
    @Body() dto: UpdateTeacherObservationDto,
  ) {
    return this.service.updateTeacherObservation(actor, observationId, dto);
  }

  @Patch('teacher-development/observations/:observationId/acknowledge')
  @Permissions('staff:read')
  acknowledgeObservation(
    @CurrentAuth() actor: AuthContext,
    @Param('observationId', new ParseUUIDPipe()) observationId: string,
    @Body() dto: UpdateTeacherObservationDto,
  ) {
    return this.service.acknowledgeMyTeacherObservation(
      actor,
      observationId,
      dto,
    );
  }

  @Get('teacher-development/goals')
  @Permissions('hr:read')
  goals(
    @CurrentAuth() actor: AuthContext,
    @Query() query: ListTeacherGoalsDto,
  ) {
    return this.service.listTeacherGoals(actor, query);
  }

  @Post('teacher-development/goals')
  @Permissions('hr:manage')
  createGoal(
    @CurrentAuth() actor: AuthContext,
    @Body() dto: CreateTeacherGoalDto,
  ) {
    return this.service.createTeacherGoal(actor, dto);
  }

  @Patch('teacher-development/goals/:goalId')
  @Permissions('hr:manage')
  updateGoal(
    @CurrentAuth() actor: AuthContext,
    @Param('goalId', new ParseUUIDPipe()) goalId: string,
    @Body() dto: UpdateTeacherGoalDto,
  ) {
    return this.service.updateTeacherGoal(actor, goalId, dto);
  }

  @Get('teacher-development/training')
  @Permissions('hr:read')
  training(
    @CurrentAuth() actor: AuthContext,
    @Query() query: ListTeacherTrainingDto,
  ) {
    return this.service.listTeacherTraining(actor, query);
  }

  @Post('teacher-development/training')
  @Permissions('hr:manage')
  createTraining(
    @CurrentAuth() actor: AuthContext,
    @Body() dto: CreateTeacherTrainingDto,
  ) {
    return this.service.createTeacherTraining(actor, dto);
  }

  @Get('school-improvement/plans')
  @Permissions('reports:read')
  plans(
    @CurrentAuth() actor: AuthContext,
    @Query() query: ListSchoolImprovementPlansDto,
  ) {
    return this.service.listSchoolImprovementPlans(actor, query);
  }

  @Get('school-improvement/plans/:planId')
  @Permissions('reports:read')
  plan(
    @CurrentAuth() actor: AuthContext,
    @Param('planId', new ParseUUIDPipe()) planId: string,
  ) {
    return this.service.getSchoolImprovementPlan(actor, planId);
  }

  @Post('school-improvement/plans')
  @Permissions('settings:manage')
  createPlan(
    @CurrentAuth() actor: AuthContext,
    @Body() dto: CreateSchoolImprovementPlanDto,
  ) {
    return this.service.createSchoolImprovementPlan(actor, dto);
  }

  @Patch('school-improvement/plans/:planId')
  @Permissions('settings:manage')
  updatePlan(
    @CurrentAuth() actor: AuthContext,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() dto: UpdateSchoolImprovementPlanDto,
  ) {
    return this.service.updateSchoolImprovementPlan(actor, planId, dto);
  }

  @Patch('school-improvement/actions/:actionId')
  @Permissions('settings:manage')
  updateAction(
    @CurrentAuth() actor: AuthContext,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
    @Body() dto: UpdateSchoolImprovementActionDto,
  ) {
    return this.service.updateSchoolImprovementAction(actor, actionId, dto);
  }

  @Post('school-improvement/plans/:planId/reviews')
  @Permissions('settings:manage')
  addReview(
    @CurrentAuth() actor: AuthContext,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() dto: AddSchoolImprovementReviewDto,
  ) {
    return this.service.addSchoolImprovementReview(actor, planId, dto);
  }

  @Get('board-exam-readiness')
  @Permissions('academics:read')
  boardExamReadiness(
    @CurrentAuth() actor: AuthContext,
    @Query() query: BoardExamReadinessQueryDto,
  ) {
    return this.service.getBoardExamReadiness(actor, query);
  }
}
