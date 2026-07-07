import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AdmissionPolicyService } from './admission-policy.service';
import {
  ActivateAdmissionPolicyVersionDto,
  CreateAdmissionPolicyDto,
  UpdateAdmissionPolicyIdentityDto,
  UpdateAdmissionPolicyVersionDto,
  UpsertDocumentRequirementDto,
} from './dto/admission-policy.dto';

@Controller('admissions/policies')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class AdmissionPolicyController {
  constructor(private readonly admissionPolicyService: AdmissionPolicyService) {}

  @Get()
  @Permissions('admission_policy:read')
  list(@CurrentAuth() actor: AuthContext) {
    return this.admissionPolicyService.list(actor);
  }

  @Get(':policyId')
  @Permissions('admission_policy:read')
  get(@Param('policyId') policyId: string, @CurrentAuth() actor: AuthContext) {
    return this.admissionPolicyService.get(policyId, actor);
  }

  @Get(':policyId/versions')
  @Permissions('admission_policy:read')
  listVersions(
    @Param('policyId') policyId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.listVersions(policyId, actor);
  }

  @Get(':policyId/audit')
  @Permissions('admission_policy:read')
  listAuditTrail(
    @Param('policyId') policyId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.listAuditTrail(policyId, actor);
  }

  @Post()
  @Permissions('admission_policy:manage')
  create(
    @Body() dto: CreateAdmissionPolicyDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.create(dto, actor);
  }

  @Patch(':policyId')
  @Permissions('admission_policy:manage')
  updateIdentity(
    @Param('policyId') policyId: string,
    @Body() dto: UpdateAdmissionPolicyIdentityDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.updateIdentity(policyId, dto, actor);
  }

  @Patch(':policyId/draft-version')
  @Permissions('admission_policy:manage')
  updateDraftVersion(
    @Param('policyId') policyId: string,
    @Body() dto: UpdateAdmissionPolicyVersionDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.updateDraftVersion(policyId, dto, actor);
  }

  @Post(':policyId/draft-version')
  @Permissions('admission_policy:manage')
  startDraftVersion(
    @Param('policyId') policyId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.startDraftVersion(policyId, actor);
  }

  @Post(':policyId/versions/:versionId/document-requirements')
  @Permissions('admission_policy:manage')
  upsertDocumentRequirement(
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpsertDocumentRequirementDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.upsertDocumentRequirement(
      policyId,
      versionId,
      dto,
      actor,
    );
  }

  @Delete(':policyId/versions/:versionId/document-requirements/:requirementId')
  @Permissions('admission_policy:manage')
  deleteDocumentRequirement(
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
    @Param('requirementId') requirementId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.deleteDocumentRequirement(
      policyId,
      versionId,
      requirementId,
      actor,
    );
  }

  @Post(':policyId/activate')
  @Permissions('admission_policy:manage')
  activate(
    @Param('policyId') policyId: string,
    @Body() dto: ActivateAdmissionPolicyVersionDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionPolicyService.activate(policyId, dto.versionId, actor);
  }

  @Post(':policyId/archive')
  @Permissions('admission_policy:manage')
  archive(@Param('policyId') policyId: string, @CurrentAuth() actor: AuthContext) {
    return this.admissionPolicyService.archive(policyId, actor);
  }
}
