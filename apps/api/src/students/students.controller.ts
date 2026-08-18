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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { ArchiveStudentDto } from './dto/archive-student.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateStudentGuardianDto } from './dto/create-student-guardian.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { InviteGuardianDto } from './dto/invite-guardian.dto';
import { ListDuplicateStudentCandidatesDto } from './dto/list-duplicate-student-candidates.dto';
import { MarkDuplicateStudentPairNotDuplicateDto } from './dto/mark-duplicate-student-pair-not-duplicate.dto';
import { MergeDuplicateStudentDto } from './dto/merge-duplicate-student.dto';
import { MergeDuplicateStudentPreviewDto } from './dto/merge-duplicate-student-preview.dto';
import { ReopenDuplicateStudentReviewDto } from './dto/reopen-duplicate-student-review.dto';
import {
  DuplicateStudentReviewMutationResponseDto,
  ListDuplicateStudentCandidatesResponseDto,
} from './dto/duplicate-student-review-response.dto';
import { CreateGuardianIdentityVerificationDto } from './dto/create-guardian-identity-verification.dto';
import { UpsertDocumentExpiryTemplateDto } from './dto/document-expiry-template.dto';
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';
import { ReviewGuardianIdentityVerificationDto } from './dto/review-guardian-identity-verification.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import { AttendanceHistoryQueryDto } from './dto/attendance-history.dto';
import { GeneratedStudentDocumentArtifactResponseDto } from './dto/generated-student-document-artifact.dto';
import {
  GuardianRecoveryActionDto,
  ProvisionGuardianAccountDto,
  RevokeGuardianSessionDto,
} from './dto/guardian-access-administration.dto';
import { StudentIemisReadinessResponseDto } from './dto/student-iemis-readiness.dto';
import { sanitizeStudentProfileResponse } from './student-profile-sanitizer';
import { StudentDuplicateReviewService } from './student-duplicate-review.service';
import { StudentsService } from './students.service';

const GUARDIAN_ADMIN_RATE_LIMIT = 10;
const GUARDIAN_ADMIN_RATE_TTL_MS = 60_000;

@Controller('students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly duplicateReviewService: StudentDuplicateReviewService,
  ) {}

  @Get()
  @Permissions('students:read')
  listStudents(
    @Query() query: ListStudentsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.listStudents(query, auth);
  }

  @Get('summary')
  @Permissions('students:read')
  getStudentModuleSummary(
    @Query() query: ListStudentsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getStudentModuleSummary(query, auth);
  }

  @Get('duplicates/candidates')
  @Permissions('students:manage_lifecycle')
  @ApiOkResponse({ type: ListDuplicateStudentCandidatesResponseDto })
  listDuplicateStudentCandidates(
    @Query() query: ListDuplicateStudentCandidatesDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.duplicateReviewService.listCandidates(query, auth);
  }

  @Post('duplicates/reviews')
  @Permissions('students:manage_lifecycle')
  @ApiCreatedResponse({ type: DuplicateStudentReviewMutationResponseDto })
  markDuplicateStudentPairNotDuplicate(
    @Body() dto: MarkDuplicateStudentPairNotDuplicateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.duplicateReviewService.markNotDuplicate(dto, auth);
  }

  @Post('duplicates/reviews/:reviewId/reopen')
  @Permissions('students:manage_lifecycle')
  @ApiCreatedResponse({ type: DuplicateStudentReviewMutationResponseDto })
  reopenDuplicateStudentReview(
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: ReopenDuplicateStudentReviewDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.duplicateReviewService.reopenReview(reviewId, dto, auth);
  }

  @Get(':id')
  @Permissions('students:read')
  async getStudentProfile(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const profile = await this.studentsService.getStudentProfile(
      studentId,
      auth,
    );
    return sanitizeStudentProfileResponse(profile);
  }

  @Post()
  @Permissions('students:create')
  createStudent(
    @Body() dto: CreateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.createStudent(dto, auth);
  }

  @Patch(':id')
  @Permissions('students:update')
  updateStudent(
    @Param('id') studentId: string,
    @Body() dto: UpdateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.updateStudent(studentId, dto, auth);
  }

  @Patch(':id/guardians/:guardianId')
  @Permissions('guardians:update')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  updateStudentGuardian(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: UpdateStudentGuardianDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.updateStudentGuardian(
      studentId,
      guardianId,
      dto,
      auth,
    );
  }

  @Post(':id/guardians')
  @Permissions('guardians:create')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  addStudentGuardian(
    @Param('id') studentId: string,
    @Body() dto: CreateStudentGuardianDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.addStudentGuardian(studentId, dto, auth);
  }

  @Get(':id/guardians/:guardianId/access-administration')
  @Permissions('guardians:read')
  getGuardianAccessAdministration(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getGuardianAccessAdministration(
      studentId,
      guardianId,
      auth,
    );
  }

  @Post(':id/guardians/:guardianId/access-actions')
  @Permissions('guardians:update', 'guardians:verify', 'users:reset_password')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  performGuardianRecoveryAction(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: GuardianRecoveryActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.performGuardianRecoveryAction(
      studentId,
      guardianId,
      dto,
      auth,
    );
  }

  @Post(':id/guardians/:guardianId/account')
  @Permissions('guardians:update', 'guardians:verify', 'users:create')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  provisionGuardianAccount(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: ProvisionGuardianAccountDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.provisionGuardianAccount(
      studentId,
      guardianId,
      dto,
      auth,
    );
  }

  @Post(':id/guardians/:guardianId/sessions/:sessionId/revoke')
  @Permissions('guardians:update', 'guardians:verify', 'users:reset_password')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  revokeGuardianSession(
    @Param('id') studentId: string,
    @Param('guardianId') guardianId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: RevokeGuardianSessionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.revokeGuardianSession(
      studentId,
      guardianId,
      sessionId,
      dto,
      auth,
    );
  }

  @Get('iemis/validation')
  @Permissions('students:manage_lifecycle')
  getIemisValidationList(
    @Query('classId') classId: string | undefined,
    @Query('sectionId') sectionId: string | undefined,
    @Query('status') status: 'all' | 'ready' | 'has_issues' | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getIemisValidationList(
      { classId, sectionId, status },
      auth,
    );
  }

  @Get('iemis/export')
  @Permissions('students:manage_lifecycle', 'reports:export')
  exportIemis(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.exportIemis(auth);
  }

  @Get('roster/export')
  @Permissions('students:manage_lifecycle', 'reports:export')
  exportRoster(
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('classId') classId: string | undefined,
    @Query('sectionId') sectionId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.exportRoster(
      { academicYearId, classId, sectionId },
      auth,
    );
  }

  @Get('document-expiry/templates')
  @Permissions('students:read')
  listDocumentExpiryTemplates(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.listDocumentExpiryTemplates(auth);
  }

  @Post('document-expiry/templates')
  @Permissions('students:update')
  upsertDocumentExpiryTemplate(
    @Body() dto: UpsertDocumentExpiryTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.upsertDocumentExpiryTemplate(dto, auth);
  }

  @Post('duplicates/merge')
  @Permissions('students:manage_lifecycle')
  mergeDuplicateStudent(
    @Body() dto: MergeDuplicateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.mergeDuplicateStudent(dto, auth);
  }

  @Post('duplicates/merge/preview')
  @Permissions('students:manage_lifecycle')
  previewMergeDuplicateStudent(
    @Body() dto: MergeDuplicateStudentPreviewDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.previewMergeDuplicateStudent(dto, auth);
  }

  @Get(':id/fee-clearance')
  @Permissions('students:read')
  getFeeClearance(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getFeeClearance(studentId, auth);
  }

  @Post(':id/transfer')
  @Permissions('students:manage_lifecycle')
  requestTransfer(
    @Param('id') studentId: string,
    @Body() dto: RequestStudentTransferDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.requestTransfer(studentId, dto, auth);
  }

  @Post(':id/archive')
  @Permissions('students:manage_lifecycle')
  archiveStudent(
    @Param('id') studentId: string,
    @Body() dto: ArchiveStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.archiveStudent(studentId, dto, auth);
  }

  @Post(':id/archive-alumni')
  @Permissions('students:manage_lifecycle')
  archiveAlumni(
    @Param('id') studentId: string,
    @Body() dto: ArchiveStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.archiveAlumni(studentId, dto, auth);
  }

  @Post(':id/delete')
  @Permissions('students:delete')
  deleteStudent(
    @Param('id') studentId: string,
    @Body() dto: DeleteStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.deleteStudent(studentId, dto, auth);
  }

  @Post(':id/guardian-invitations')
  @Permissions('guardians:create')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  inviteGuardians(
    @Param('id') studentId: string,
    @Body() dto: InviteGuardianDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.inviteGuardians(studentId, dto, auth);
  }

  @Get('guardians/:guardianId/identity-verifications')
  @Permissions('guardians:read')
  listGuardianIdentityVerifications(
    @Param('guardianId') guardianId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.listGuardianIdentityVerifications(
      guardianId,
      auth,
    );
  }

  @Post('guardians/:guardianId/identity-verifications')
  @Permissions('guardians:verify')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  createGuardianIdentityVerification(
    @Param('guardianId') guardianId: string,
    @Body() dto: CreateGuardianIdentityVerificationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.createGuardianIdentityVerification(
      guardianId,
      dto,
      auth,
    );
  }

  @Post('guardians/:guardianId/identity-verifications/:verificationId/review')
  @Permissions('guardians:verify')
  @Throttle({
    default: {
      limit: GUARDIAN_ADMIN_RATE_LIMIT,
      ttl: GUARDIAN_ADMIN_RATE_TTL_MS,
    },
  })
  reviewGuardianIdentityVerification(
    @Param('guardianId') guardianId: string,
    @Param('verificationId') verificationId: string,
    @Body() dto: ReviewGuardianIdentityVerificationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.reviewGuardianIdentityVerification(
      guardianId,
      verificationId,
      dto,
      auth,
    );
  }

  @Get(':id/documents/:kind.pdf')
  @Permissions('student_documents:manage')
  @ApiOperation({
    summary: 'Generate a protected student document artifact',
  })
  @ApiOkResponse({ type: GeneratedStudentDocumentArtifactResponseDto })
  async getGeneratedDocument(
    @Param('id') studentId: string,
    @Param('kind') kind: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.generateStudentDocumentPdf(
      studentId,
      kind,
      auth,
    );
  }

  @Post(':id/generated-documents/:documentId/revoke')
  @Permissions('student_documents:manage')
  revokeGeneratedDocument(
    @Param('id') studentId: string,
    @Param('documentId') documentId: string,
    @Body() dto: RevokeGeneratedStudentDocumentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.revokeGeneratedStudentDocument(
      studentId,
      documentId,
      dto,
      auth,
    );
  }

  @Get(':id/attendance-history')
  @Permissions('students:read', 'attendance:read')
  getAttendanceHistory(
    @Param('id') studentId: string,
    @Query() query: AttendanceHistoryQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getAttendanceHistory(studentId, query, auth);
  }

  @Get(':id/iemis-readiness')
  @Permissions('students:read')
  @ApiOperation({
    summary: 'Get backend-owned iEMIS readiness for one tenant student',
  })
  @ApiOkResponse({ type: StudentIemisReadinessResponseDto })
  getIemisReadiness(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getIemisReadiness(studentId, auth);
  }

  @Get(':id/lifecycle-timeline')
  @Permissions('students:read')
  getStudentLifecycleTimeline(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getStudentLifecycleTimeline(studentId, auth);
  }

  @Get(':id/identity')
  @Permissions('students:read')
  getStudentIdentity(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getStudentIdentity(studentId, auth);
  }

  @Post(':id/identity')
  @Permissions('students:update')
  generateStudentIdentity(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.generateStudentIdentity(studentId, auth);
  }

  @Post(':id/identity/revoke')
  @Permissions('students:update')
  revokeStudentIdentity(
    @Param('id') studentId: string,
    @Body('identityCode') identityCode: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.revokeStudentIdentity(
      studentId,
      identityCode,
      auth,
    );
  }
}
