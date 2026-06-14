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
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  AutosaveAdmissionDraftDto,
  EnhancedDuplicateReviewDto,
  GenerateTransferCertificateDto,
  GraduateStudentDto,
  IemisReadinessSummaryDto,
  ImportReviewQueueDto,
  RecoverAdmissionDraftsDto,
  RemoveStudentGuardianAccessDto,
  ResolveAdmissionRelationshipsDto,
} from './dto/m1-admissions-hardening.dto';
import { M1AdmissionsHardeningService } from './m1-admissions-hardening.service';

@Controller('admissions/m1')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class M1AdmissionsHardeningController {
  constructor(private readonly service: M1AdmissionsHardeningService) {}

  @Get('students/:id/ownership-audit')
  @Permissions('students:read', 'student_documents:manage')
  getOwnershipAudit(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getOwnershipAudit(studentId, auth);
  }

  @Post('drafts/autosave')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  autosaveAdmissionDraft(
    @Body() dto: AutosaveAdmissionDraftDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.autosaveAdmissionDraft(dto, auth);
  }

  @Get('drafts/recover')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  recoverAdmissionDrafts(
    @Query() query: RecoverAdmissionDraftsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.recoverAdmissionDrafts(query, auth);
  }

  @Post('duplicates/review')
  @Permissions('students:read')
  enhancedDuplicateReview(
    @Body() dto: EnhancedDuplicateReviewDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.service.enhancedDuplicateReview(dto, auth);
  }

  @Post('relationships/resolve')
  @Permissions('students:read', 'guardians:read')
  resolveRelationships(
    @Body() dto: ResolveAdmissionRelationshipsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.resolveRelationships(dto, auth);
  }

  @Delete('students/:studentId/guardians/:guardianId')
  @Permissions('guardians:update', 'student_documents:manage')
  removeGuardianAccess(
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: RemoveStudentGuardianAccessDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.removeGuardianAccess(studentId, guardianId, dto, auth);
  }

  @Post('students/:id/id-card')
  @Permissions('student_documents:manage')
  generateIdCard(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.generateIdCard(studentId, auth);
  }

  @Post('students/:id/transfer-certificate')
  @Permissions('students:manage_lifecycle', 'student_documents:manage')
  generateTransferCertificate(
    @Param('id') studentId: string,
    @Body() dto: GenerateTransferCertificateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.generateTransferCertificate(studentId, dto, auth);
  }

  @Post('students/:id/graduate')
  @Permissions('students:manage_lifecycle')
  graduateStudent(
    @Param('id') studentId: string,
    @Body() dto: GraduateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.graduateStudent(studentId, dto, auth);
  }

  @Get('import-review/queue')
  @Permissions('enrollments:read', 'students:read')
  listImportReviewQueue(
    @Query() query: ImportReviewQueueDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.listImportReviewQueue(query, auth);
  }

  @Get('iemis/readiness-summary')
  @Permissions('students:read')
  getIemisReadinessSummary(
    @Query() query: IemisReadinessSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getIemisReadinessSummary(query, auth);
  }

  @Get('workflow-labels')
  @Permissions('students:read')
  getWorkflowLabels() {
    return this.service.getWorkflowLabels();
  }
}
