import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  CreateLicenceEvidenceDto,
  CreateQualificationEvidenceDto,
  CreateStaffEmploymentDto,
  CreateTeacherProfileDto,
  DeactivateTeacherProfileDto,
  EligibilityProjectionQueryDto,
  EndStaffEmploymentDto,
  ReviewProfessionalRecordDto,
  RevokeProfessionalEvidenceDto,
} from './dto/professional-identity.dto';
import { ProfessionalIdentityService } from './professional-identity.service';

/**
 * Phase 5J–5M professional identity. Reads need `hr:read`; every write needs
 * `hr:manage`, and verification/revocation additionally require a reviewer
 * who is neither the submitter nor the staff member (service-enforced and
 * DB-checked).
 */
@Controller('hr/staff/:staffId/professional')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrProfessionalIdentityController {
  constructor(private readonly service: ProfessionalIdentityService) {}

  @Get()
  @Permissions('hr:read')
  overview(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getOverview(staffId, auth);
  }

  @Get('eligibility')
  @Permissions('hr:read')
  eligibility(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Query() query: EligibilityProjectionQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.projectEligibility(staffId, query, auth);
  }

  @Post('employments')
  @Permissions('hr:manage')
  createEmployment(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: CreateStaffEmploymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createEmployment(staffId, dto, auth);
  }

  @Post('employments/:employmentId/review')
  @Permissions('hr:manage')
  reviewEmployment(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('employmentId', ParseUUIDPipe) employmentId: string,
    @Body() dto: ReviewProfessionalRecordDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.reviewEmployment(staffId, employmentId, dto, auth);
  }

  @Post('employments/:employmentId/end')
  @Permissions('hr:manage')
  endEmployment(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('employmentId', ParseUUIDPipe) employmentId: string,
    @Body() dto: EndStaffEmploymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.endEmployment(staffId, employmentId, dto, auth);
  }

  @Post('teacher-profile')
  @Permissions('hr:manage')
  createTeacherProfile(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: CreateTeacherProfileDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createTeacherProfile(staffId, dto, auth);
  }

  @Post('teacher-profile/deactivate')
  @Permissions('hr:manage')
  deactivateTeacherProfile(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: DeactivateTeacherProfileDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.deactivateTeacherProfile(staffId, dto, auth);
  }

  @Post('qualifications')
  @Permissions('hr:manage')
  addQualification(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: CreateQualificationEvidenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.addQualification(staffId, dto, auth);
  }

  @Post('qualifications/:evidenceId/review')
  @Permissions('hr:manage')
  reviewQualification(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: ReviewProfessionalRecordDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.reviewEvidence(
      'qualification',
      staffId,
      evidenceId,
      dto,
      auth,
    );
  }

  @Post('qualifications/:evidenceId/revoke')
  @Permissions('hr:manage')
  revokeQualification(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: RevokeProfessionalEvidenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.revokeEvidence(
      'qualification',
      staffId,
      evidenceId,
      dto,
      auth,
    );
  }

  @Post('licences')
  @Permissions('hr:manage')
  addLicence(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: CreateLicenceEvidenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.addLicence(staffId, dto, auth);
  }

  @Post('licences/:evidenceId/review')
  @Permissions('hr:manage')
  reviewLicence(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: ReviewProfessionalRecordDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.reviewEvidence(
      'licence',
      staffId,
      evidenceId,
      dto,
      auth,
    );
  }

  @Post('licences/:evidenceId/revoke')
  @Permissions('hr:manage')
  revokeLicence(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: RevokeProfessionalEvidenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.revokeEvidence(
      'licence',
      staffId,
      evidenceId,
      dto,
      auth,
    );
  }
}

/** Tenant-wide professional eligibility reports (Phase 5M follow-up). */
@Controller('hr/professional')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrProfessionalReportsController {
  constructor(private readonly service: ProfessionalIdentityService) {}

  @Get('eligibility-exceptions')
  @Permissions('hr:read')
  eligibilityExceptions(@CurrentAuth() auth: AuthContext) {
    return this.service.listEligibilityExceptions(auth);
  }
}
