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
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  AddRemedialGroupMembersDto,
  AddStudentInterventionEntryDto,
  CreateCurriculumProgressDto,
  CreateFormativeAssessmentDto,
  CreateLearningOutcomeDto,
  CreateParentLearningGuidanceDto,
  CreateRemedialGroupDto,
  CreateStudentInterventionDto,
  EarlyWarningQueryDto,
  LearningScopeQueryDto,
  ListCurriculumProgressDto,
  ListFormativeAssessmentsDto,
  ListLearningOutcomesDto,
  ListParentLearningGuidanceDto,
  ListRemedialGroupsDto,
  ListStudentInterventionsDto,
  SetLearningOutcomeStateDto,
  UpdateCurriculumProgressDto,
  UpdateParentLearningGuidanceStatusDto,
  UpdateRemedialGroupStatusDto,
  UpdateStudentInterventionDto,
} from './dto/learning-improvement.dto';
import { LearningImprovementService } from './learning-improvement.service';

@ApiTags('learning-improvement')
@Controller('learning-improvement')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
// P2-14 is outside the controlled-pilot boundary. Reuse the already
// disabled-by-default Learning entitlement so preserved routes fail closed
// unless the owner explicitly re-approves that deferred surface.
@RequiredModule('learning')
@Roles(
  'admin',
  'principal',
  'teacher',
  'subject_teacher',
  'platform_super_admin',
)
export class LearningImprovementController {
  constructor(private readonly service: LearningImprovementService) {}

  @Get('early-warning')
  @Permissions('academics:read')
  earlyWarning(
    @CurrentAuth() auth: AuthContext,
    @Query() query: EarlyWarningQueryDto,
  ) {
    return this.service.getEarlyWarnings(auth, query);
  }

  @Get('outcomes')
  @Permissions('academics:read')
  outcomes(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListLearningOutcomesDto,
  ) {
    return this.service.listOutcomes(auth, query);
  }

  @Post('outcomes')
  @Permissions('academics:enter_marks')
  createOutcome(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateLearningOutcomeDto,
  ) {
    return this.service.createOutcome(auth, dto);
  }

  @Patch('outcomes/:outcomeId/state')
  @Permissions('academics:manage')
  setOutcomeState(
    @CurrentAuth() auth: AuthContext,
    @Param('outcomeId', new ParseUUIDPipe()) outcomeId: string,
    @Body() dto: SetLearningOutcomeStateDto,
  ) {
    return this.service.setOutcomeState(auth, outcomeId, dto);
  }

  @Get('formative-assessments')
  @Permissions('academics:read')
  formativeAssessments(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListFormativeAssessmentsDto,
  ) {
    return this.service.listFormativeAssessments(auth, query);
  }

  @Post('formative-assessments')
  @Permissions('academics:enter_marks')
  createFormativeAssessment(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateFormativeAssessmentDto,
  ) {
    return this.service.createFormativeAssessment(auth, dto);
  }

  @Get('students/:studentId/outcome-progress')
  @Permissions('academics:read')
  studentOutcomeProgress(
    @CurrentAuth() auth: AuthContext,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Query() query: LearningScopeQueryDto,
  ) {
    return this.service.getStudentOutcomeProgress(auth, studentId, query);
  }

  @Get('interventions')
  @Permissions('academics:read')
  interventions(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListStudentInterventionsDto,
  ) {
    return this.service.listInterventions(auth, query);
  }

  @Get('interventions/:caseId')
  @Permissions('academics:read')
  intervention(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ) {
    return this.service.getIntervention(auth, caseId);
  }

  @Post('interventions')
  @Permissions('academics:enter_marks')
  createIntervention(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateStudentInterventionDto,
  ) {
    return this.service.createIntervention(auth, dto);
  }

  @Post('interventions/:caseId/entries')
  @Permissions('academics:enter_marks')
  addInterventionEntry(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() dto: AddStudentInterventionEntryDto,
  ) {
    return this.service.addInterventionEntry(auth, caseId, dto);
  }

  @Patch('interventions/:caseId')
  @Permissions('academics:enter_marks')
  updateIntervention(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() dto: UpdateStudentInterventionDto,
  ) {
    return this.service.updateIntervention(auth, caseId, dto);
  }

  @Get('remedial-groups')
  @Permissions('academics:read')
  remedialGroups(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListRemedialGroupsDto,
  ) {
    return this.service.listRemedialGroups(auth, query);
  }

  @Post('remedial-groups')
  @Permissions('academics:enter_marks')
  createRemedialGroup(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateRemedialGroupDto,
  ) {
    return this.service.createRemedialGroup(auth, dto);
  }

  @Post('remedial-groups/:groupId/members')
  @Permissions('academics:enter_marks')
  addRemedialMembers(
    @CurrentAuth() auth: AuthContext,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() dto: AddRemedialGroupMembersDto,
  ) {
    return this.service.addRemedialMembers(auth, groupId, dto);
  }

  @Patch('remedial-groups/:groupId/status')
  @Permissions('academics:enter_marks')
  updateRemedialStatus(
    @CurrentAuth() auth: AuthContext,
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() dto: UpdateRemedialGroupStatusDto,
  ) {
    return this.service.updateRemedialStatus(auth, groupId, dto);
  }

  @Get('curriculum-progress')
  @Permissions('academics:read')
  curriculumProgress(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListCurriculumProgressDto,
  ) {
    return this.service.listCurriculumProgress(auth, query);
  }

  @Post('curriculum-progress')
  @Permissions('academics:enter_marks')
  createCurriculumProgress(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateCurriculumProgressDto,
  ) {
    return this.service.createCurriculumProgress(auth, dto);
  }

  @Patch('curriculum-progress/:itemId')
  @Permissions('academics:enter_marks')
  updateCurriculumProgress(
    @CurrentAuth() auth: AuthContext,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateCurriculumProgressDto,
  ) {
    return this.service.updateCurriculumProgress(auth, itemId, dto);
  }

  @Get('parent-guidance')
  @Permissions('academics:read')
  parentGuidance(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListParentLearningGuidanceDto,
  ) {
    return this.service.listGuidance(auth, query);
  }

  @Post('parent-guidance')
  @Permissions('academics:enter_marks')
  createParentGuidance(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateParentLearningGuidanceDto,
  ) {
    return this.service.createGuidance(auth, dto);
  }

  @Patch('parent-guidance/:guidanceId/status')
  @Permissions('academics:enter_marks')
  updateParentGuidanceStatus(
    @CurrentAuth() auth: AuthContext,
    @Param('guidanceId', new ParseUUIDPipe()) guidanceId: string,
    @Body() dto: UpdateParentLearningGuidanceStatusDto,
  ) {
    return this.service.updateGuidanceStatus(auth, guidanceId, dto);
  }
}
