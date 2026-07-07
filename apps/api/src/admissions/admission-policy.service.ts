import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdmissionPolicyVersion } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdmissionPolicyDto,
  UpdateAdmissionPolicyIdentityDto,
  UpdateAdmissionPolicyVersionDto,
  UpsertDocumentRequirementDto,
} from './dto/admission-policy.dto';

const POLICY_WITH_VERSIONS_INCLUDE = {
  versions: {
    orderBy: { version: 'desc' as const },
    include: { documentRequirements: { orderBy: { sortOrder: 'asc' as const } } },
  },
};

@Injectable()
export class AdmissionPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthContext) {
    const policies = await this.prisma.admissionPolicy.findMany({
      where: { tenantId: actor.tenantId, archivedAt: null },
      include: {
        currentVersion: {
          include: { documentRequirements: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const [applicationsWaitingForDocuments, applicationsWaitingForDecision] =
      await Promise.all([
        this.prisma.admissionApplication.count({
          where: { tenantId: actor.tenantId, status: 'NEEDS_INFORMATION' },
        }),
        this.prisma.admissionApplication.count({
          where: { tenantId: actor.tenantId, status: 'WAITING_FOR_REVIEW' },
        }),
      ]);
    return {
      summary: {
        activePolicies: policies.filter((policy) => policy.status === 'ACTIVE')
          .length,
        policiesNeedingReview: policies.filter(
          (policy) => policy.status === 'NEEDS_REVIEW',
        ).length,
        applicationsWaitingForDocuments,
        applicationsWaitingForDecision,
      },
      policies: policies.map((policy) => this.toSummary(policy)),
    };
  }

  async get(policyId: string, actor: AuthContext) {
    const policy = await this.findPolicyOrThrow(
      policyId,
      actor.tenantId,
      POLICY_WITH_VERSIONS_INCLUDE,
    );
    const draftVersion =
      policy.versions.find((version) => version.status === 'DRAFT') ?? null;
    const currentVersion =
      policy.versions.find((version) => version.id === policy.currentVersionId) ??
      null;
    return {
      ...this.toSummary({ ...policy, currentVersion }),
      currentVersion,
      draftVersion,
      versions: policy.versions,
    };
  }

  async listVersions(policyId: string, actor: AuthContext) {
    await this.findPolicyOrThrow(policyId, actor.tenantId);
    return this.prisma.admissionPolicyVersion.findMany({
      where: { tenantId: actor.tenantId, policyId },
      orderBy: { version: 'desc' },
    });
  }

  async listAuditTrail(policyId: string, actor: AuthContext) {
    await this.findPolicyOrThrow(policyId, actor.tenantId);
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: actor.tenantId,
        resource: 'admission_policy',
        resourceId: policyId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateAdmissionPolicyDto, actor: AuthContext) {
    await this.validateScopeReferences(dto, actor);
    const policy = await this.prisma.admissionPolicy.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        academicYearId: dto.academicYearId ?? null,
        classId: dto.classId ?? null,
        gradeBand: dto.gradeBand ?? null,
        applicantType: dto.applicantType ?? 'BOTH',
        source: dto.source ?? null,
        status: 'DRAFT',
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    await this.prisma.admissionPolicyVersion.create({
      data: {
        tenantId: actor.tenantId,
        policyId: policy.id,
        version: 1,
        status: 'DRAFT',
        createdById: actor.userId,
      },
    });
    await this.auditService.record({
      action: 'admission_policy_create',
      resource: 'admission_policy',
      resourceId: policy.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { name: policy.name },
    });
    return this.get(policy.id, actor);
  }

  async updateIdentity(
    policyId: string,
    dto: UpdateAdmissionPolicyIdentityDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    await this.validateScopeReferences(dto, actor);
    const updated = await this.prisma.admissionPolicy.update({
      where: { id: policy.id },
      data: {
        name: dto.name,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        gradeBand: dto.gradeBand,
        applicantType: dto.applicantType,
        source: dto.source,
        updatedById: actor.userId,
      },
    });
    await this.auditService.record({
      action: 'admission_policy_update_identity',
      resource: 'admission_policy',
      resourceId: policy.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { name: policy.name },
      after: { name: updated.name },
    });
    return this.get(policyId, actor);
  }

  async updateDraftVersion(
    policyId: string,
    dto: UpdateAdmissionPolicyVersionDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId, {
      versions: true,
    });
    const draft = policy.versions.find((version) => version.status === 'DRAFT');
    if (!draft) {
      throw new BadRequestException(
        'This policy has no draft version to edit. Start a new draft first.',
      );
    }
    const updated = await this.prisma.admissionPolicyVersion.update({
      where: { id: draft.id },
      data: dto,
    });
    await this.auditService.record({
      action: 'admission_policy_update_version',
      resource: 'admission_policy',
      resourceId: policyId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { versionId: updated.id, changedFields: Object.keys(dto) },
    });
    return this.get(policyId, actor);
  }

  async startDraftVersion(policyId: string, actor: AuthContext) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId, {
      versions: { include: { documentRequirements: true } },
    });
    const existingDraft = policy.versions.find(
      (version) => version.status === 'DRAFT',
    );
    if (existingDraft) return this.get(policyId, actor);

    const source =
      policy.versions.find((version) => version.id === policy.currentVersionId) ??
      null;
    const nextVersionNumber =
      policy.versions.reduce((max, version) => Math.max(max, version.version), 0) +
      1;
    const draft = await this.prisma.admissionPolicyVersion.create({
      data: {
        tenantId: actor.tenantId,
        policyId,
        version: nextVersionNumber,
        status: 'DRAFT',
        admissionMode: source?.admissionMode ?? 'REVIEW_REQUIRED',
        transferStudent: source?.transferStudent ?? null,
        requiredFields: source?.requiredFields ?? [],
        requireSection: source?.requireSection ?? false,
        requireDocumentReview: source?.requireDocumentReview ?? false,
        requireInterview: source?.requireInterview ?? false,
        requirePrincipalApproval: source?.requirePrincipalApproval ?? false,
        requireTransferCertificate: source?.requireTransferCertificate ?? false,
        requirePriorMarksheet: source?.requirePriorMarksheet ?? false,
        requireStreamOrMarksReview: source?.requireStreamOrMarksReview ?? false,
        allowAdmissionWithDocumentsPending:
          source?.allowAdmissionWithDocumentsPending ?? true,
        enforceCapacityWhenAvailable: source?.enforceCapacityWhenAvailable ?? false,
        capacityOverride: source?.capacityOverride ?? null,
        approvalLevel: source?.approvalLevel ?? null,
        notesForOffice: source?.notesForOffice ?? null,
        createdById: actor.userId,
      },
    });
    const sourceRequirements =
      (source as (AdmissionPolicyVersion & { documentRequirements?: unknown[] }) | null)
        ?.documentRequirements ?? [];
    if (Array.isArray(sourceRequirements) && sourceRequirements.length > 0) {
      await this.prisma.admissionPolicyDocumentRequirement.createMany({
        data: (
          sourceRequirements as Array<{
            documentKind: string;
            label: string;
            isRequired: boolean;
            requiresOriginalVerification: boolean;
            timing: string;
            expiresAfterDays: number | null;
            canBeWaived: boolean;
            waivableByRoleKeys: string[];
            sortOrder: number;
          }>
        ).map((requirement) => ({
          tenantId: actor.tenantId,
          policyVersionId: draft.id,
          documentKind: requirement.documentKind,
          label: requirement.label,
          isRequired: requirement.isRequired,
          requiresOriginalVerification: requirement.requiresOriginalVerification,
          timing: requirement.timing as never,
          expiresAfterDays: requirement.expiresAfterDays,
          canBeWaived: requirement.canBeWaived,
          waivableByRoleKeys: requirement.waivableByRoleKeys,
          sortOrder: requirement.sortOrder,
        })),
      });
    }
    await this.auditService.record({
      action: 'admission_policy_draft_started',
      resource: 'admission_policy',
      resourceId: policyId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { versionId: draft.id, version: draft.version },
    });
    return this.get(policyId, actor);
  }

  async upsertDocumentRequirement(
    policyId: string,
    versionId: string,
    dto: UpsertDocumentRequirementDto,
    actor: AuthContext,
  ) {
    const version = await this.findDraftVersionOrThrow(
      policyId,
      versionId,
      actor.tenantId,
    );
    const requirement = await this.prisma.admissionPolicyDocumentRequirement.upsert(
      {
        where: {
          policyVersionId_documentKind: {
            policyVersionId: version.id,
            documentKind: dto.documentKind,
          },
        },
        create: {
          tenantId: actor.tenantId,
          policyVersionId: version.id,
          documentKind: dto.documentKind,
          label: dto.label,
          isRequired: dto.isRequired ?? true,
          requiresOriginalVerification: dto.requiresOriginalVerification ?? false,
          timing: dto.timing ?? 'BEFORE_ENROLLMENT',
          expiresAfterDays: dto.expiresAfterDays ?? null,
          canBeWaived: dto.canBeWaived ?? false,
          waivableByRoleKeys: dto.waivableByRoleKeys ?? [],
          sortOrder: dto.sortOrder ?? 0,
        },
        update: {
          label: dto.label,
          isRequired: dto.isRequired,
          requiresOriginalVerification: dto.requiresOriginalVerification,
          timing: dto.timing,
          expiresAfterDays: dto.expiresAfterDays,
          canBeWaived: dto.canBeWaived,
          waivableByRoleKeys: dto.waivableByRoleKeys,
          sortOrder: dto.sortOrder,
        },
      },
    );
    return requirement;
  }

  async deleteDocumentRequirement(
    policyId: string,
    versionId: string,
    requirementId: string,
    actor: AuthContext,
  ) {
    await this.findDraftVersionOrThrow(policyId, versionId, actor.tenantId);
    await this.prisma.admissionPolicyDocumentRequirement.deleteMany({
      where: { id: requirementId, tenantId: actor.tenantId, policyVersionId: versionId },
    });
    return { deleted: true };
  }

  async activate(policyId: string, versionId: string, actor: AuthContext) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId, {
      versions: true,
    });
    const target = policy.versions.find((version) => version.id === versionId);
    if (!target) throw new NotFoundException('Policy version not found.');
    if (target.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft version can be activated.');
    }
    const previousActiveId = policy.currentVersionId;

    await this.prisma.admissionPolicyVersion.update({
      where: { id: target.id },
      data: { status: 'ACTIVE', activatedAt: new Date(), activatedById: actor.userId },
    });
    if (previousActiveId && previousActiveId !== target.id) {
      await this.prisma.admissionPolicyVersion.update({
        where: { id: previousActiveId },
        data: { status: 'EXPIRED' },
      });
    }
    await this.prisma.admissionPolicy.update({
      where: { id: policyId },
      data: {
        currentVersionId: target.id,
        status: 'ACTIVE',
        updatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'admission_policy_activate',
      resource: 'admission_policy',
      resourceId: policyId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { previousActiveVersionId: previousActiveId },
      after: { versionId: target.id, version: target.version },
    });
    return this.get(policyId, actor);
  }

  async archive(policyId: string, actor: AuthContext) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    if (policy.isDefault) {
      throw new ConflictException('The school default policy cannot be archived.');
    }
    await this.prisma.admissionPolicy.update({
      where: { id: policyId },
      data: { status: 'ARCHIVED', archivedAt: new Date(), updatedById: actor.userId },
    });
    await this.auditService.record({
      action: 'admission_policy_archive',
      resource: 'admission_policy',
      resourceId: policyId,
      tenantId: actor.tenantId,
      userId: actor.userId,
    });
    return this.get(policyId, actor);
  }

  private async validateScopeReferences(
    scope: { academicYearId?: string; classId?: string },
    actor: AuthContext,
  ) {
    const [academicYear, classRecord] = await Promise.all([
      scope.academicYearId
        ? this.prisma.academicYear.findFirst({
            where: { id: scope.academicYearId, tenantId: actor.tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
      scope.classId
        ? this.prisma.class.findFirst({
            where: { id: scope.classId, tenantId: actor.tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (
      (scope.academicYearId && !academicYear) ||
      (scope.classId && !classRecord)
    ) {
      throw new BadRequestException(
        'Admission policy scopes must use academic years and classes from this school.',
      );
    }
  }

  private async findPolicyOrThrow(
    policyId: string,
    tenantId: string,
    include?: Record<string, unknown>,
  ) {
    const policy = await this.prisma.admissionPolicy.findFirst({
      where: { id: policyId, tenantId },
      include,
    });
    if (!policy) throw new NotFoundException('Admission policy not found.');
    return policy as typeof policy & {
      versions: Array<AdmissionPolicyVersion & { documentRequirements?: unknown[] }>;
    };
  }

  private async findDraftVersionOrThrow(
    policyId: string,
    versionId: string,
    tenantId: string,
  ) {
    const version = await this.prisma.admissionPolicyVersion.findFirst({
      where: { id: versionId, policyId, tenantId },
    });
    if (!version) throw new NotFoundException('Policy version not found.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException(
        'Document requirements can only be edited on a draft version.',
      );
    }
    return version;
  }

  private toSummary(policy: {
    id: string;
    name: string;
    status: string;
    academicYearId: string | null;
    classId: string | null;
    gradeBand: string | null;
    applicantType: string;
    source: string | null;
    isDefault: boolean;
    currentVersionId: string | null;
    updatedAt: Date;
    currentVersion?: {
      admissionMode: string;
      approvalLevel: string | null;
      requireInterview: boolean;
      requireDocumentReview: boolean;
      documentRequirements?: unknown[];
    } | null;
  }) {
    return {
      id: policy.id,
      name: policy.name,
      status: policy.status,
      academicYearId: policy.academicYearId,
      classId: policy.classId,
      gradeBand: policy.gradeBand,
      applicantType: policy.applicantType,
      source: policy.source,
      isDefault: policy.isDefault,
      currentVersionId: policy.currentVersionId,
      updatedAt: policy.updatedAt,
      admissionMode:
        policy.currentVersion?.admissionMode === 'REVIEW_REQUIRED'
          ? 'REVIEW_REQUIRED'
          : 'DIRECT_ALLOWED',
      requiredDocumentCount:
        policy.currentVersion?.documentRequirements?.length ?? 0,
      assessment: policy.currentVersion?.requireInterview
        ? 'Interview'
        : policy.currentVersion?.requireDocumentReview
          ? 'Document review'
          : 'No assessment required',
      approvalLevel: policy.currentVersion?.approvalLevel ?? null,
    };
  }
}
