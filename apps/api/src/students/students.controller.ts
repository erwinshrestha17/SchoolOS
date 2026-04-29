import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { ArchiveStudentDto } from './dto/archive-student.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { InviteGuardianDto } from './dto/invite-guardian.dto';
import { MergeDuplicateStudentDto } from './dto/merge-duplicate-student.dto';
import { CreateGuardianIdentityVerificationDto } from './dto/create-guardian-identity-verification.dto';
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';
import { ReviewGuardianIdentityVerificationDto } from './dto/review-guardian-identity-verification.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('students:read')
  listStudents(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.listStudents(auth);
  }

  @Get(':id')
  @Permissions('students:read')
  getStudentProfile(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.getStudentProfile(studentId, auth);
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

  @Get('iemis/export')
  @Permissions('students:read')
  exportIemis(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.exportIemis(auth);
  }

  @Post('duplicates/merge')
  @Permissions('students:manage_lifecycle')
  mergeDuplicateStudent(
    @Body() dto: MergeDuplicateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.mergeDuplicateStudent(dto, auth);
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
    @CurrentAuth() auth: AuthContext,
  ) {
    const pdf = await this.studentsService.generateStudentDocumentPdf(
      studentId,
      kind,
      auth,
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
}

function safePdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
