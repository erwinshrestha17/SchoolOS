import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
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
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';
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

  @Post()
  @Permissions('students:create')
  createStudent(
    @Body() dto: CreateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.createStudent(dto, auth);
  }

  @Get('iemis/export')
  @Permissions('students:read')
  exportIemis(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.exportIemis(auth);
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

  @Get(':id/documents/:kind.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('student_documents:manage')
  getGeneratedDocument(
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
}
