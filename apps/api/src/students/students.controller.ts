import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { ArchiveStudentDto } from './dto/archive-student.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { InviteGuardianDto } from './dto/invite-guardian.dto';
import { ListDuplicateStudentCandidatesDto } from './dto/list-duplicate-student-candidates.dto';
import { MergeDuplicateStudentDto } from './dto/merge-duplicate-student.dto';
import { MergeDuplicateStudentPreviewDto } from './dto/merge-duplicate-student-preview.dto';
import { CreateGuardianIdentityVerificationDto } from './dto/create-guardian-identity-verification.dto';
import { UpsertDocumentExpiryTemplateDto } from './dto/document-expiry-template.dto';
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';
import { ReviewGuardianIdentityVerificationDto } from './dto/review-guardian-identity-verification.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import { AttendanceHistoryQueryDto } from './dto/attendance-history.dto';
import { sanitizeStudentProfileResponse } from './student-profile-sanitizer';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('students:read')
  listStudents(
    @Query() query: ListStudentsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.listStudents(query, auth);
  }

  @Get('duplicates/candidates')
  @Permissions('students:manage_lifecycle')
  listDuplicateStudentCandidates(
    @Query() query: ListDuplicateStudentCandidatesDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.listDuplicateStudentCandidates(query, auth);
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

  @Get('iemis/validation')
  @Permissions('students:read')
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
  @Permissions('students:read')
  exportIemis(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.exportIemis(auth);
  }

  @Get('roster/export')
  @Permissions('students:read')
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
  async getGeneratedDocument(
    @Param('id') studentId: string,
    @Param('kind') kind: string,
    @Query('token') token: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    const documentAuth: AuthContext & { qrToken?: string } = auth;
    if (token) {
      documentAuth.qrToken = token;
    }
    const pdf = await this.studentsService.generateStudentDocumentPdf(
      studentId,
      kind,
      documentAuth,
    );

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="${safePdfFileName(`${studentId}-${kind}.pdf`)}"`,
    });
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

function safePdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
