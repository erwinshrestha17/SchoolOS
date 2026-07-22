import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AdmissionCasesService } from './admission-cases.service';
import { AdmissionDocumentReminderService } from './admission-document-reminder.service';
import {
  CreateAdmissionCaseDto,
  DirectAdmitAdmissionCaseDto,
  FinalizeAdmissionCaseDto,
  ListAdmissionAssessmentCandidatesDto,
  ListAdmissionAssessmentSessionsDto,
  ListDocumentRequestsDto,
  RecordAdmissionAssessmentResultDto,
  RequestAdmissionDocumentRemindersDto,
  ReviewAdmissionCaseDto,
  ScheduleAdmissionAssessmentDto,
  UpdateAdmissionCaseDto,
  WaiveCaseDocumentDto,
} from './dto/admission-case.dto';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class AdmissionCasesController {
  constructor(
    private readonly admissionCasesService: AdmissionCasesService,
    private readonly admissionDocumentReminderService: AdmissionDocumentReminderService,
  ) {}

  @Get('document-requests')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listDocumentRequests(
    @Query() query: ListDocumentRequestsDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.listDocumentRequests(query, actor);
  }

  @Post('document-requests/reminders')
  @Permissions('students:manage_lifecycle', 'guardians:read')
  @ApiOkResponse({
    description: 'Bounded tenant-scoped reminder queue outcome.',
    schema: {
      type: 'object',
      required: ['requested', 'queued', 'alreadyQueued', 'skipped', 'results'],
      properties: {
        requested: { type: 'integer', minimum: 1, maximum: 25 },
        queued: { type: 'integer', minimum: 0 },
        alreadyQueued: { type: 'integer', minimum: 0 },
        skipped: { type: 'integer', minimum: 0 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            required: ['admissionCaseId', 'state', 'reason'],
            properties: {
              admissionCaseId: { type: 'string', format: 'uuid' },
              state: {
                type: 'string',
                enum: ['QUEUED', 'ALREADY_QUEUED', 'SKIPPED'],
              },
              reason: {
                type: 'string',
                nullable: true,
                enum: [
                  'CASE_UNAVAILABLE',
                  'CASE_CLOSED',
                  'NO_GUARDIAN_PHONE',
                  'NO_LONGER_MISSING',
                  'DELIVERY_UNAVAILABLE',
                ],
              },
            },
          },
        },
      },
    },
  })
  requestDocumentReminders(
    @Body() dto: RequestAdmissionDocumentRemindersDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionDocumentReminderService.requestReminders(dto, actor);
  }

  @Get('assessment-sessions')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listAssessmentSessions(
    @Query() query: ListAdmissionAssessmentSessionsDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.listAssessmentSessions(query, actor);
  }

  @Get('assessment-candidates')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listAssessmentCandidates(
    @Query() query: ListAdmissionAssessmentCandidatesDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.listAssessmentCandidates(query, actor);
  }

  @Post('assessment-sessions/:assessmentSessionId/result')
  @Permissions('students:manage_lifecycle')
  recordAssessmentResult(
    @Param('assessmentSessionId') assessmentSessionId: string,
    @Body() dto: RecordAdmissionAssessmentResultDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.recordAssessmentResult(
      assessmentSessionId,
      dto,
      actor,
    );
  }

  @Post('cases')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  createCase(
    @Body() dto: CreateAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.createCase(dto, actor);
  }

  @Get('cases/:admissionCaseId')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  getCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.getCase(admissionCaseId, actor);
  }

  @Get('cases/:admissionCaseId/eligibility')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  evaluateCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.evaluateCase(admissionCaseId, actor);
  }

  @Patch('cases/:admissionCaseId')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  updateCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: UpdateAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.updateCase(admissionCaseId, dto, actor);
  }

  @Post('cases/:admissionCaseId/assessment-session')
  @Permissions('students:manage_lifecycle')
  scheduleAssessmentSession(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: ScheduleAdmissionAssessmentDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.scheduleAssessmentSession(
      admissionCaseId,
      dto,
      actor,
    );
  }

  @Post('cases/:admissionCaseId/documents/waive')
  @Permissions('students:manage_lifecycle')
  waiveCaseDocument(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: WaiveCaseDocumentDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.waiveCaseDocument(
      admissionCaseId,
      dto,
      actor,
    );
  }

  @Post('cases/:admissionCaseId/documents/unwaive')
  @Permissions('students:manage_lifecycle')
  removeCaseDocumentWaiver(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: WaiveCaseDocumentDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.removeCaseDocumentWaiver(
      admissionCaseId,
      dto,
      actor,
    );
  }

  @Post('cases/:admissionCaseId/review')
  @Permissions('students:manage_lifecycle')
  reviewCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: ReviewAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.reviewCase(admissionCaseId, dto, actor);
  }

  @Post('cases/:admissionCaseId/direct-admit')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  directAdmit(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: DirectAdmitAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.directAdmit(admissionCaseId, dto, actor);
  }

  @Post('cases/:admissionCaseId/finalize')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  finalizeApprovedCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: FinalizeAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.finalizeApprovedCase(
      admissionCaseId,
      dto,
      actor,
    );
  }
}
