import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { AdmissionsService } from './admissions.service';
import { BulkAdmissionImportDto } from './dto/bulk-admission-import.dto';
import { CheckAdmissionDuplicateDto } from './dto/check-admission-duplicate.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { TransferStudentDto } from './dto/transfer-student.dto';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listAdmissions(@CurrentAuth() auth: AuthContext) {
    return this.admissionsService.listAdmissions(auth);
  }

  @Post()
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  createAdmission(
    @Body() dto: CreateAdmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.createAdmission(dto, auth);
  }

  @Post('duplicates')
  @Permissions('students:read')
  checkDuplicates(
    @Body() dto: CheckAdmissionDuplicateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.checkDuplicateAdmissions(dto, auth);
  }

  @Post('bulk-import')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  bulkImport(
    @Body() dto: BulkAdmissionImportDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.bulkImport(dto, auth);
  }

  @Post('students/:id/transfer')
  @Permissions('enrollments:create')
  transferStudent(
    @Param('id') studentId: string,
    @Body() dto: TransferStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.transferStudent(studentId, dto, auth);
  }

  @Delete('students/:id')
  @Permissions('students:delete')
  deleteStudent(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.deleteStudent(studentId, auth);
  }

  @Post('students/:id/archive-alumni')
  @Permissions('enrollments:create')
  archiveAlumni(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.archiveAlumni(studentId, auth);
  }

  @Post('guardians/:id/invite')
  @Permissions('guardians:create')
  inviteGuardian(
    @Param('id') guardianId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.inviteGuardian(guardianId, auth);
  }

  @Get('iemis-export')
  @Permissions('students:read')
  exportIemis(@CurrentAuth() auth: AuthContext) {
    return this.admissionsService.exportIemis(auth);
  }
}
