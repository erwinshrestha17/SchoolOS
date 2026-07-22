import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalWorkflowType,
  type AdmissionPolicyVersion,
  type ApprovalPolicy,
  type Prisma,
} from '@prisma/client';
import { ADMISSION_POLICY_REQUIRED_FIELDS } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdmissionPolicyDto,
  ArchiveAdmissionPolicyDto,
  DuplicateAdmissionPolicyDto,
  UpdateAdmissionPolicyIdentityDto,
  UpdateAdmissionPolicyVersionDto,
  UpsertApprovalChainDto,
  UpsertDocumentRequirementDto,
} from './dto/admission-policy.dto';
import {
  ADMISSION_POLICY_TEMPLATES,
  findAdmissionPolicyTemplate,
} from './admission-policy-templates';

const APPROVAL_CHAIN_FINAL_ACTION_KEY = 'admissions.case.approve';

type ResolvableVersionFields = AdmissionPolicyVersion & {
  documentRequirements?: Array<{
    documentKind: string;
    label: string;
    isRequired: boolean;
    requiresOriginalVerification: boolean;
    timing: string;
    expiresAfterDays: number | null;
    canBeWaived: boolean;
    waivableByRoleKeys: string[];
    sortOrder: number;
  }>;
  approvalPolicy?: ApprovalPolicy | null;
};

type AdmissionPolicyCopyClient = Pick<
  Prisma.TransactionClient,
  | 'admissionPolicyDocumentRequirement'
  | 'admissionPolicyVersion'
  | 'approvalPolicy'
>;

interface EditableAdmissionPolicy {
  id: string;
  tenantId: string;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
}

const POLICY_WITH_VERSIONS_INCLUDE = {
  versions: {
    orderBy: { version: 'desc' as const },
    include: {
      documentRequirements: { orderBy: { sortOrder: 'asc' as const } },
      approvalPolicy: true,
    },
  },
};

function toApprovalChainShape(
  approvalPolicy: ApprovalPolicy | null | undefined,
) {
  if (!approvalPolicy) return null;
  const roles = Array.isArray(approvalPolicy.approverRoles)
    ? (approvalPolicy.approverRoles as unknown[]).map((role) =>
        typeof role === 'string' ? role : null,
      )
    : [];
  const permissions = Array.isArray(approvalPolicy.approverPermissions)
    ? (approvalPolicy.approverPermissions as unknown[]).map((permission) =>
        typeof permission === 'string' ? permission : null,
      )
    : [];
  const stageCount = Math.max(roles.length, permissions.length, 1);
  return {
    approvalPolicyId: approvalPolicy.id,
    minApprovals: approvalPolicy.minApprovals,
    stages: Array.from({ length: stageCount }, (_, index) => ({
      approverRole: roles[index] || null,
      approverPermission: permissions[index] || null,
    })),
  };
}

@Injectable()
export class AdmissionPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  listTemplates() {
    return ADMISSION_POLICY_TEMPLATES.map((template) => ({
      ...template,
      version: {
        ...template.version,
        requiredFields: [...template.version.requiredFields],
      },
      documents: template.documents.map((requirement) => ({
        ...requirement,
        waivableByRoleKeys: [...requirement.waivableByRoleKeys],
      })),
    }));
  }

  async list(actor: AuthContext) {
    const policies = await this.prisma.admissionPolicy.findMany({
      where: { tenantId: actor.tenantId, archivedAt: null },
      include: {
        currentVersion: {
          include: { documentRequirements: true, approvalPolicy: true },
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
    const versions = policy.versions.map((version) => ({
      ...version,
      approvalChain: toApprovalChainShape(version.approvalPolicy),
    }));
    const draftVersion =
      versions.find((version) => version.status === 'DRAFT') ?? null;
    const currentVersion =
      versions.find((version) => version.id === policy.currentVersionId) ??
      null;
    return {
      ...this.toSummary({ ...policy, currentVersion }),
      currentVersion,
      draftVersion,
      versions,
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
    const policyName = dto.name.trim();
    if (!policyName) {
      throw new BadRequestException('Admission policy name is required.');
    }
    const template = dto.templateId
      ? findAdmissionPolicyTemplate(dto.templateId)
      : null;
    if (dto.templateId && !template) {
      throw new BadRequestException('Admission policy template not found.');
    }
    await this.validateScopeReferences(dto, actor);

    const policyId = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.admissionPolicy.create({
        data: {
          tenantId: actor.tenantId,
          name: policyName,
          academicYearId: dto.academicYearId ?? null,
          classId: dto.classId ?? null,
          gradeBand: dto.gradeBand ?? template?.gradeBand ?? null,
          applicantType: dto.applicantType ?? template?.applicantType ?? 'BOTH',
          source: dto.source ?? null,
          status: 'DRAFT',
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      const version = await tx.admissionPolicyVersion.create({
        data: {
          tenantId: actor.tenantId,
          policyId: policy.id,
          version: 1,
          status: 'DRAFT',
          createdById: actor.userId,
          ...(template
            ? {
                ...template.version,
                requiredFields: [...template.version.requiredFields],
              }
            : {}),
        },
      });
      if (template?.documents.length) {
        await tx.admissionPolicyDocumentRequirement.createMany({
          data: template.documents.map((requirement) => ({
            tenantId: actor.tenantId,
            policyVersionId: version.id,
            documentKind: requirement.documentKind,
            label: requirement.label,
            isRequired: requirement.isRequired,
            requiresOriginalVerification:
              requirement.requiresOriginalVerification,
            timing: requirement.timing,
            expiresAfterDays: requirement.expiresAfterDays,
            canBeWaived: requirement.canBeWaived,
            waivableByRoleKeys: [...requirement.waivableByRoleKeys],
            sortOrder: requirement.sortOrder,
          })),
        });
      }
      await this.auditService.record(
        {
          action: 'admission_policy_create',
          resource: 'admission_policy',
          resourceId: policy.id,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: {
            name: policy.name,
            templateId: template?.id ?? null,
            versionId: version.id,
            documentRequirementCount: template?.documents.length ?? 0,
          },
        },
        tx,
      );
      return policy.id;
    });
    return this.get(policyId, actor);
  }

  async updateIdentity(
    policyId: string,
    dto: UpdateAdmissionPolicyIdentityDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    this.assertPolicyEditable(policy);
    await this.validateScopeReferences(dto, actor);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.admissionPolicy.updateMany({
        where: {
          id: policy.id,
          tenantId: actor.tenantId,
          updatedAt: policy.updatedAt,
          archivedAt: null,
          status: { not: 'ARCHIVED' },
        },
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
      if (result.count !== 1) this.throwPolicyChanged();
      await this.auditService.record(
        {
          action: 'admission_policy_update_identity',
          resource: 'admission_policy',
          resourceId: policy.id,
          tenantId: actor.tenantId,
          userId: actor.userId,
          before: { name: policy.name },
          after: { changedFields: Object.keys(dto) },
        },
        tx,
      );
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
    this.assertPolicyEditable(policy);
    const draft = policy.versions.find((version) => version.status === 'DRAFT');
    if (!draft) {
      throw new BadRequestException(
        'This policy has no draft version to edit. Start a new draft first.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.claimEditablePolicy(tx, policy, actor);
      const result = await tx.admissionPolicyVersion.updateMany({
        where: {
          id: draft.id,
          tenantId: actor.tenantId,
          policyId,
          status: 'DRAFT',
        },
        data: dto,
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'This policy draft changed. Reload it before saving again.',
        );
      }
      await this.auditService.record(
        {
          action: 'admission_policy_update_version',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: { versionId: draft.id, changedFields: Object.keys(dto) },
        },
        tx,
      );
    });
    return this.get(policyId, actor);
  }

  async startDraftVersion(policyId: string, actor: AuthContext) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId, {
      versions: { include: { documentRequirements: true } },
    });
    this.assertPolicyEditable(policy);
    const existingDraft = policy.versions.find(
      (version) => version.status === 'DRAFT',
    );
    if (existingDraft) return this.get(policyId, actor);

    const source =
      policy.versions.find(
        (version) => version.id === policy.currentVersionId,
      ) ?? null;
    const nextVersionNumber =
      policy.versions.reduce(
        (max, version) => Math.max(max, version.version),
        0,
      ) + 1;
    await this.prisma.$transaction(async (tx) => {
      await this.claimEditablePolicy(tx, policy, actor);
      const draft = await tx.admissionPolicyVersion.create({
        data: {
          tenantId: actor.tenantId,
          policyId,
          version: nextVersionNumber,
          status: 'DRAFT',
          createdById: actor.userId,
          ...this.versionFieldsFrom(source),
        },
      });
      await this.copyDocumentRequirements(source, draft.id, actor.tenantId, tx);
      await this.copyApprovalChain(
        source,
        draft.id,
        actor.tenantId,
        actor.userId,
        tx,
      );
      await this.auditService.record(
        {
          action: 'admission_policy_draft_started',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: { versionId: draft.id, version: draft.version },
        },
        tx,
      );
    });
    return this.get(policyId, actor);
  }

  async duplicate(
    policyId: string,
    dto: DuplicateAdmissionPolicyDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId, {
      versions: { include: { documentRequirements: true } },
    });
    const source =
      policy.versions.find(
        (version) => version.id === policy.currentVersionId,
      ) ??
      policy.versions.find((version) => version.status === 'DRAFT') ??
      null;

    const copyId = await this.prisma.$transaction(async (tx) => {
      const copy = await tx.admissionPolicy.create({
        data: {
          tenantId: actor.tenantId,
          name: dto.name?.trim() || `${policy.name} (Copy)`,
          // Scope is intentionally not carried over: a duplicated policy would
          // otherwise silently tie for every case the source already wins,
          // forcing disambiguation until staff re-scope it deliberately.
          applicantType: policy.applicantType,
          isDefault: false,
          status: 'DRAFT',
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      const version = await tx.admissionPolicyVersion.create({
        data: {
          tenantId: actor.tenantId,
          policyId: copy.id,
          version: 1,
          status: 'DRAFT',
          createdById: actor.userId,
          ...this.versionFieldsFrom(source),
        },
      });
      await this.copyDocumentRequirements(
        source,
        version.id,
        actor.tenantId,
        tx,
      );
      await this.copyApprovalChain(
        source,
        version.id,
        actor.tenantId,
        actor.userId,
        tx,
      );

      await this.auditService.record(
        {
          action: 'admission_policy_duplicate',
          resource: 'admission_policy',
          resourceId: copy.id,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: { name: copy.name, duplicatedFromPolicyId: policyId },
        },
        tx,
      );
      return copy.id;
    });
    return this.get(copyId, actor);
  }

  private versionFieldsFrom(source: ResolvableVersionFields | null) {
    return {
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
      enforceCapacityWhenAvailable:
        source?.enforceCapacityWhenAvailable ?? false,
      capacityOverride: source?.capacityOverride ?? null,
      notesForOffice: source?.notesForOffice ?? null,
    };
  }

  private async copyDocumentRequirements(
    source: ResolvableVersionFields | null,
    targetVersionId: string,
    tenantId: string,
    client: AdmissionPolicyCopyClient = this.prisma,
  ) {
    const requirements = source?.documentRequirements ?? [];
    if (requirements.length === 0) return;
    await client.admissionPolicyDocumentRequirement.createMany({
      data: requirements.map((requirement) => ({
        tenantId,
        policyVersionId: targetVersionId,
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

  private async copyApprovalChain(
    source: ResolvableVersionFields | null,
    targetVersionId: string,
    tenantId: string,
    userId: string,
    client: AdmissionPolicyCopyClient = this.prisma,
  ) {
    const sourceChain = source?.approvalPolicy;
    if (!sourceChain) return;
    const created = await client.approvalPolicy.create({
      data: {
        tenantId,
        workflowType: ApprovalWorkflowType.ADMISSION_CASE,
        name: `admission-policy-version:${targetVersionId}`,
        minApprovals: sourceChain.minApprovals,
        approverRoles: sourceChain.approverRoles as never,
        approverPermissions: sourceChain.approverPermissions as never,
        finalActionKey: APPROVAL_CHAIN_FINAL_ACTION_KEY,
        createdById: userId,
      },
    });
    await client.admissionPolicyVersion.update({
      where: { id: targetVersionId },
      data: { approvalPolicyId: created.id },
    });
  }

  async replaceApprovalChain(
    policyId: string,
    versionId: string,
    dto: UpsertApprovalChainDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    this.assertPolicyEditable(policy);
    const version = await this.findDraftVersionOrThrow(
      policyId,
      versionId,
      actor.tenantId,
    );
    const approverRoles = dto.stages.map((stage) => stage.approverRole ?? '');
    const approverPermissions = dto.stages.map(
      (stage) => stage.approverPermission ?? '',
    );
    const minApprovals = dto.minApprovals ?? dto.stages.length;

    await this.prisma.$transaction(async (tx) => {
      await this.claimEditablePolicy(tx, policy, actor);
      if (!version.approvalPolicyId) {
        const created = await tx.approvalPolicy.create({
          data: {
            tenantId: actor.tenantId,
            workflowType: ApprovalWorkflowType.ADMISSION_CASE,
            name: `admission-policy-version:${version.id}`,
            minApprovals,
            approverRoles: approverRoles as never,
            approverPermissions: approverPermissions as never,
            finalActionKey: APPROVAL_CHAIN_FINAL_ACTION_KEY,
            createdById: actor.userId,
          },
        });
        const attached = await tx.admissionPolicyVersion.updateMany({
          where: {
            id: version.id,
            tenantId: actor.tenantId,
            policyId,
            status: 'DRAFT',
            approvalPolicyId: null,
          },
          data: { approvalPolicyId: created.id },
        });
        if (attached.count !== 1) {
          throw new ConflictException(
            'This policy approval chain changed. Reload it before saving again.',
          );
        }
      } else {
        const updated = await tx.approvalPolicy.updateMany({
          where: {
            id: version.approvalPolicyId,
            tenantId: actor.tenantId,
          },
          data: {
            minApprovals,
            approverRoles: approverRoles as never,
            approverPermissions: approverPermissions as never,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'This policy approval chain is no longer available.',
          );
        }
      }

      await this.auditService.record(
        {
          action: 'admission_policy_update_approval_chain',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: {
            versionId: version.id,
            stageCount: dto.stages.length,
            minApprovals,
          },
        },
        tx,
      );
    });
    return this.get(policyId, actor);
  }

  async deleteApprovalChain(
    policyId: string,
    versionId: string,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    this.assertPolicyEditable(policy);
    const version = await this.findDraftVersionOrThrow(
      policyId,
      versionId,
      actor.tenantId,
    );
    await this.prisma.$transaction(async (tx) => {
      await this.claimEditablePolicy(tx, policy, actor);
      if (version.approvalPolicyId) {
        const detached = await tx.admissionPolicyVersion.updateMany({
          where: {
            id: version.id,
            tenantId: actor.tenantId,
            policyId,
            status: 'DRAFT',
            approvalPolicyId: version.approvalPolicyId,
          },
          data: { approvalPolicyId: null },
        });
        if (detached.count !== 1) {
          throw new ConflictException(
            'This policy approval chain changed. Reload it before removing it.',
          );
        }
        await tx.approvalPolicy.deleteMany({
          where: {
            id: version.approvalPolicyId,
            tenantId: actor.tenantId,
          },
        });
      }
      await this.auditService.record(
        {
          action: 'admission_policy_delete_approval_chain',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: { versionId: version.id },
        },
        tx,
      );
    });
    return this.get(policyId, actor);
  }

  async upsertDocumentRequirement(
    policyId: string,
    versionId: string,
    dto: UpsertDocumentRequirementDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    this.assertPolicyEditable(policy);
    const version = await this.findDraftVersionOrThrow(
      policyId,
      versionId,
      actor.tenantId,
    );
    const requirement = await this.prisma.$transaction(async (tx) => {
      await this.claimEditablePolicy(tx, policy, actor);
      const saved = await tx.admissionPolicyDocumentRequirement.upsert({
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
          requiresOriginalVerification:
            dto.requiresOriginalVerification ?? false,
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
      });
      await this.auditService.record(
        {
          action: 'admission_policy_upsert_document_requirement',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          after: {
            versionId: version.id,
            requirementId: saved.id,
            documentKind: saved.documentKind,
          },
        },
        tx,
      );
      return saved;
    });
    return requirement;
  }

  async deleteDocumentRequirement(
    policyId: string,
    versionId: string,
    requirementId: string,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    this.assertPolicyEditable(policy);
    await this.findDraftVersionOrThrow(policyId, versionId, actor.tenantId);
    await this.prisma.$transaction(async (tx) => {
      await this.claimEditablePolicy(tx, policy, actor);
      const deleted = await tx.admissionPolicyDocumentRequirement.deleteMany({
        where: {
          id: requirementId,
          tenantId: actor.tenantId,
          policyVersionId: versionId,
        },
      });
      if (deleted.count !== 1) {
        throw new NotFoundException('Document requirement not found.');
      }
      await this.auditService.record(
        {
          action: 'admission_policy_delete_document_requirement',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          before: { versionId, requirementId },
        },
        tx,
      );
    });
    return { deleted: true };
  }

  async activate(policyId: string, versionId: string, actor: AuthContext) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId, {
      versions: true,
    });
    this.assertPolicyEditable(policy);
    const target = policy.versions.find((version) => version.id === versionId);
    if (!target) throw new NotFoundException('Policy version not found.');
    if (target.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft version can be activated.');
    }
    this.assertSupportedRequiredFields(target.requiredFields);
    const previousActiveId = policy.currentVersionId;
    const activatedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Claim the policy using its last-seen timestamp. This prevents two
      // concurrent activation requests from both replacing the current
      // version and leaving a split active-version history.
      const policyClaim = await tx.admissionPolicy.updateMany({
        where: {
          id: policyId,
          tenantId: actor.tenantId,
          updatedAt: policy.updatedAt,
        },
        data: {
          currentVersionId: target.id,
          status: 'ACTIVE',
          updatedById: actor.userId,
        },
      });
      if (policyClaim.count !== 1) {
        throw new ConflictException(
          'This admission policy changed. Reload it before activating a version.',
        );
      }

      const versionClaim = await tx.admissionPolicyVersion.updateMany({
        where: {
          id: target.id,
          tenantId: actor.tenantId,
          policyId,
          status: 'DRAFT',
        },
        data: {
          status: 'ACTIVE',
          activatedAt,
          activatedById: actor.userId,
        },
      });
      if (versionClaim.count !== 1) {
        throw new ConflictException(
          'This policy version is no longer a draft. Reload the policy before trying again.',
        );
      }

      if (previousActiveId && previousActiveId !== target.id) {
        await tx.admissionPolicyVersion.updateMany({
          where: {
            id: previousActiveId,
            tenantId: actor.tenantId,
            policyId,
            status: 'ACTIVE',
          },
          data: { status: 'EXPIRED' },
        });
      }

      await this.auditService.record(
        {
          action: 'admission_policy_activate',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          before: { previousActiveVersionId: previousActiveId },
          after: { versionId: target.id, version: target.version },
        },
        tx,
      );
    });
    return this.get(policyId, actor);
  }

  async archive(
    policyId: string,
    dto: ArchiveAdmissionPolicyDto,
    actor: AuthContext,
  ) {
    const policy = await this.findPolicyOrThrow(policyId, actor.tenantId);
    if (policy.status === 'ARCHIVED' || policy.archivedAt) {
      return this.get(policyId, actor);
    }
    if (policy.isDefault) {
      throw new ConflictException(
        'The school default policy cannot be archived.',
      );
    }
    const reason = dto.reason.trim();
    if (reason.length < 5 || reason.length > 500) {
      throw new BadRequestException(
        'Archive reason must be between 5 and 500 characters.',
      );
    }
    const archivedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const archived = await tx.admissionPolicy.updateMany({
        where: {
          id: policyId,
          tenantId: actor.tenantId,
          updatedAt: policy.updatedAt,
          archivedAt: null,
          status: { not: 'ARCHIVED' },
        },
        data: {
          status: 'ARCHIVED',
          archivedAt,
          updatedById: actor.userId,
        },
      });
      if (archived.count !== 1) this.throwPolicyChanged();
      await this.auditService.record(
        {
          action: 'admission_policy_archive',
          resource: 'admission_policy',
          resourceId: policyId,
          tenantId: actor.tenantId,
          userId: actor.userId,
          before: {
            status: policy.status,
            currentVersionId: policy.currentVersionId,
          },
          after: { status: 'ARCHIVED', archivedAt, reason },
        },
        tx,
      );
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

  private assertPolicyEditable(policy: EditableAdmissionPolicy) {
    if (policy.status === 'ARCHIVED' || policy.archivedAt) {
      throw new ConflictException(
        'Archived admission policies are read-only. Duplicate this policy to create a new editable draft.',
      );
    }
  }

  private async claimEditablePolicy(
    client: Pick<Prisma.TransactionClient, 'admissionPolicy'>,
    policy: EditableAdmissionPolicy,
    actor: AuthContext,
  ) {
    const claimed = await client.admissionPolicy.updateMany({
      where: {
        id: policy.id,
        tenantId: actor.tenantId,
        updatedAt: policy.updatedAt,
        archivedAt: null,
        status: { not: 'ARCHIVED' },
      },
      data: { updatedById: actor.userId },
    });
    if (claimed.count !== 1) this.throwPolicyChanged();
  }

  private throwPolicyChanged(): never {
    throw new ConflictException(
      'This admission policy changed. Reload it before making another change.',
    );
  }

  private assertSupportedRequiredFields(requiredFields: string[]) {
    const supported = new Set<string>(ADMISSION_POLICY_REQUIRED_FIELDS);
    const unsupported = requiredFields.filter((field) => !supported.has(field));
    if (unsupported.length > 0) {
      throw new BadRequestException(
        'This policy contains unsupported required information. Edit the draft and choose only the available fields before activation.',
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
      versions: ResolvableVersionFields[];
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
        'This can only be edited on a draft version.',
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
      requirePrincipalApproval: boolean;
      requireInterview: boolean;
      requireDocumentReview: boolean;
      documentRequirements?: unknown[];
      approvalPolicy?: ApprovalPolicy | null;
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
      approvalChainSummary: (() => {
        const chain = toApprovalChainShape(
          policy.currentVersion?.approvalPolicy,
        );
        if (chain) {
          return {
            stageCount: chain.stages.length,
            minApprovals: chain.minApprovals,
          };
        }
        return policy.currentVersion?.requirePrincipalApproval
          ? { stageCount: 1, minApprovals: 1 }
          : null;
      })(),
    };
  }
}
