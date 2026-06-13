import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AdmissionsService } from './admissions.service';
import {
  CreateAdmissionApplicationDto,
  ListAdmissionApplicationsDto,
  UpdateAdmissionApplicationStatusDto,
} from './dto/admission-application.dto';
import { ListAdmissionsDto } from './dto/list-admissions.dto';
import { ListAdmissionImportBatchesDto } from './dto/list-admission-import-batches.dto';
import { BulkAdmissionImportDto } from './dto/bulk-admission-import.dto';
import { CheckAdmissionDuplicateDto } from './dto/check-admission-duplicate.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { TransferStudentDto } from './dto/transfer-student.dto';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listAdmissions(
    @Query() query: ListAdmissionsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.listAdmissions(query, auth);
  }

  @Post()
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  createAdmission(
    @Body() dto: CreateAdmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.createAdmission(dto, auth);
  }

  @Get('applications')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listApplications(
    @Query() query: ListAdmissionApplicationsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.listApplications(query, auth);
  }

  @Post('applications')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  createApplication(
    @Body() dto: CreateAdmissionApplicationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.createApplication(dto, auth);
  }

  @Post('applications/:id/status')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  updateApplicationStatus(
    @Param('id') applicationId: string,
    @Body() dto: UpdateAdmissionApplicationStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.updateApplicationStatus(
      applicationId,
      dto,
      auth,
    );
  }

  @Post('applications/:id/enroll')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  enrollApplication(
    @Param('id') applicationId: string,
    @Body() dto: CreateAdmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.enrollApplication(applicationId, dto, auth);
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

  @Get('bulk-import/batches')
  @Permissions('enrollments:read', 'students:read')
  listImportBatches(
    @Query() query: ListAdmissionImportBatchesDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.listImportBatches(query, auth);
  }

  @Get('bulk-import/batches/:id')
  @Permissions('enrollments:read', 'students:read')
  getImportBatch(
    @Param('id') batchId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.getImportBatch(batchId, auth);
  }

  @Post('students/:id/transfer')
  @Permissions('students:manage_lifecycle')
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
  @Permissions('students:manage_lifecycle')
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
