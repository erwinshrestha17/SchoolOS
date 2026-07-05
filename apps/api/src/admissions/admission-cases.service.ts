import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EnrollmentStatus,
  FileStatus,
  Gender,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import {
  ADMISSION_CASE_REVIEW_ACTIONS,
  type AdmissionCaseReviewAction,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { encryptSensitiveField } from '../common/security/field-encryption';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRecordsService } from '../student-records/student-records.service';
import {
  optionalNepalPhone,
  optionalPersonName,
  optionalProfileEmail,
  parseDateOfBirth,
  requireNepalPhone,
  requirePersonName,
} from '../common/validation/contact-profile';
import {
  CreateAdmissionCaseDto,
  DirectAdmitAdmissionCaseDto,
  FinalizeAdmissionCaseDto,
  ReviewAdmissionCaseDto,
  UpdateAdmissionCaseDto,
  UpdateAdmissionPolicyDto,
} from './dto/admission-case.dto';

const ADMISSION_POLICY_SETTING_KEY = 'admissions.policy.v1';
const TERMINAL_STATUSES = new Set([
  'ADMITTED',
  'ENROLLED',
  'NOT_ADMITTED',
  'REJECTED',
  'CLOSED',
]);
const REVIEW_LOCKED_STATUSES = new Set([
  'WAITING_FOR_REVIEW',
  'ENTRANCE_INTERVIEW',
  'APPROVED',
  'ACCEPTED',
]);
const ADMITTABLE_STORAGE_STATUSES = [
  'DRAFT',
  'NEEDS_INFORMATION',
  'READY_TO_ADMIT',
  'APPROVED',
  'ACCEPTED',
] as const;
const ADMISSION_CASE_REVIEW_ACTION_SET = new Set<string>(
  ADMISSION_CASE_REVIEW_ACTIONS,
);
const REVIEW_ACTIONS_REQUIRING_REASON = new Set<AdmissionCaseReviewAction>([
  'REQUEST_INFORMATION',
  'APPROVE',
  'REJECT',
  'ESCALATE_TO_PRINCIPAL',
  'CLOSE',
]);

const LEGACY_DISPLAY_STATUS: Partial<Record<string, AdmissionDisplayStatus>> = {
  INQUIRY: 'DRAFT',
  APPLICATION: 'NEEDS_INFORMATION',
  DOCUMENT_PENDING: 'NEEDS_INFORMATION',
  ENTRANCE_INTERVIEW: 'WAITING_FOR_REVIEW',
  ACCEPTED: 'APPROVED',
  ENROLLED: 'ADMITTED',
  REJECTED: 'NOT_ADMITTED',
  FINALIZING: 'READY_TO_ADMIT',
};
const DISPLAY_STATUSES = new Set<AdmissionDisplayStatus>([
  'DRAFT',
  'NEEDS_INFORMATION',
  'READY_TO_ADMIT',
  'WAITING_FOR_REVIEW',
  'APPROVED',
  'ADMITTED',
  'NOT_ADMITTED',
  'CLOSED',
]);

type AdmissionDisplayStatus =
  | 'DRAFT'
  | 'NEEDS_INFORMATION'
  | 'READY_TO_ADMIT'
  | 'WAITING_FOR_REVIEW'
  | 'APPROVED'
  | 'ADMITTED'
  | 'NOT_ADMITTED'
  | 'CLOSED';

type AdmissionSource =
  | 'OFFICE_WALK_IN'
  | 'PARENT_ONLINE'
  | 'PHONE_INQUIRY'
  | 'TRANSFER_REQUEST'
  | 'IMPORT';

interface StoredDocumentReference {
  fileId: string;
  kind: string;
  title?: string;
}

interface StoredReviewNote {
  action: string;
  reason?: string;
  at: string;
  byUserId: string;
}

interface StoredCaseMetadata {
  schemaVersion?: number;
  transferStudent?: boolean;
  guardianReceivesAlerts?: boolean;
  admissionDate?: string;
  mediumOfInstruction?: string;
  rollNumber?: number;
  nationalStudentId?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  documents?: StoredDocumentReference[];
  duplicateRisk?: boolean;
  duplicateCandidates?: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
    lifecycleStatus: string;
  }>;
  review?: {
    reviewerUserId?: string;
    dueDate?: string;
    notes?: StoredReviewNote[];
  };
  policySnapshot?: Record<string, unknown>;
  followUps?: Array<{ code: string; label: string; blocking: boolean }>;
}

interface PolicyRule {
  admissionMode: 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED';
  academicYearId?: string;
  gradeBand?: string;
  classId?: string;
  source?: string;
  transferStudent?: boolean;
  requireDocumentReview?: boolean;
  requireInterview?: boolean;
  requirePrincipalApproval?: boolean;
  requireTransferCertificate?: boolean;
  requirePriorMarksheet?: boolean;
  requireStreamOrMarksReview?: boolean;
  allowAdmissionWithDocumentsPending?: boolean;
  enforceCapacityWhenAvailable?: boolean;
  requireSection?: boolean;
  requiredDocuments?: string[];
  requiredFields?: string[];
}

interface AdmissionPolicy {
  defaultPolicy: PolicyRule;
  overrides: PolicyRule[];
}

interface AdmissionCaseRecord {
  id: string;
  tenantId: string;
  status: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp: string | null;
  lastNameNp: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  guardianFullName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  academicYearId: string | null;
  classId: string | null;
  sectionId: string | null;
  previousSchool: string | null;
  source: string | null;
  notes: string | null;
  duplicateReview: Prisma.JsonValue | null;
  convertedStudentId: string | null;
  rejectedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CapacityStatus {
  state: 'NOT_CONFIGURED' | 'AVAILABLE' | 'FULL';
  capacity: number | null;
  enrolled: number | null;
}

interface AdmissionEvaluation {
  missingRequiredFields: string[];
  missingRequiredDocuments: string[];
  duplicateRisk: boolean;
  duplicateCandidates: NonNullable<StoredCaseMetadata['duplicateCandidates']>;
  relatedStudentCandidates: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
    lifecycleStatus: string;
    guardianName: string | null;
    guardianRelation: string | null;
    matchReasons: string[];
  }>;
  policyRequirements: {
    admissionMode: 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED';
    requireDocumentReview: boolean;
    requireInterview: boolean;
    requirePrincipalApproval: boolean;
    requireTransferCertificate: boolean;
    requirePriorMarksheet: boolean;
    requireStreamOrMarksReview: boolean;
    allowAdmissionWithDocumentsPending: boolean;
    enforceCapacityWhenAvailable: boolean;
    requireSection: boolean;
    requiredDocuments: string[];
    requiredFields: string[];
  };
  canAdmitDirectly: boolean;
  canOverrideDuplicate: boolean;
  requiresReview: boolean;
  requiresApproval: boolean;
  classSection: {
    valid: boolean;
    sectionRequired?: boolean;
    academicYearName?: string | null;
    className?: string | null;
    sectionName?: string | null;
    message: string | null;
  };
  capacityStatus: CapacityStatus | null;
  suggestedStatus: AdmissionDisplayStatus;
  nextActionLabel: string;
}

const DEFAULT_POLICY: PolicyRule = {
  admissionMode: 'DIRECT_ALLOWED',
  requireDocumentReview: false,
  requireInterview: false,
  requirePrincipalApproval: false,
  requireTransferCertificate: false,
  requirePriorMarksheet: false,
  requireStreamOrMarksReview: false,
  allowAdmissionWithDocumentsPending: true,
  enforceCapacityWhenAvailable: false,
  requireSection: false,
  requiredDocuments: [],
  requiredFields: [],
};

@Injectable()
export class AdmissionCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly studentRecordsService: StudentRecordsService,
  ) {}

  async getPolicy(actor: AuthContext) {
    return this.loadPolicy(actor.tenantId);
  }

  async updatePolicy(dto: UpdateAdmissionPolicyDto, actor: AuthContext) {
    const policy = this.normalizePolicy(dto);
    await this.validatePolicyScopes(policy, actor);
    await this.prisma.tenantSetting.upsert({
      where: {
        tenantId_key: {
          tenantId: actor.tenantId,
          key: ADMISSION_POLICY_SETTING_KEY,
        },
      },
      create: {
        tenantId: actor.tenantId,
        key: ADMISSION_POLICY_SETTING_KEY,
        value: policy as unknown as Prisma.InputJsonValue,
      },
      update: { value: policy as unknown as Prisma.InputJsonValue },
    });

    await this.auditService.record({
      action: 'admission_policy_update',
      resource: 'admission_policy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        defaultMode: policy.defaultPolicy.admissionMode,
        overrideCount: policy.overrides.length,
      },
    });

    return policy;
  }

  async createCase(dto: CreateAdmissionCaseDto, actor: AuthContext) {
    const metadata = this.mergeMetadata({}, dto);
    await this.validateDocumentReferences(metadata.documents ?? [], actor);
    const created = await this.prisma.admissionApplication.create({
      data: {
        tenantId: actor.tenantId,
        status: 'DRAFT',
        firstNameEn: requirePersonName(dto.firstNameEn, 'firstNameEn'),
        lastNameEn: requirePersonName(dto.lastNameEn, 'lastNameEn'),
        firstNameNp: optionalPersonName(dto.firstNameNp, 'firstNameNp'),
        lastNameNp: optionalPersonName(dto.lastNameNp, 'lastNameNp'),
        dateOfBirth: dto.dateOfBirth ? parseDateOfBirth(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        guardianFullName: optionalPersonName(
          dto.guardianFullName,
          'guardianFullName',
        ),
        guardianRelation: dto.guardianRelation?.trim() || null,
        guardianPhone: optionalNepalPhone(dto.guardianPhone),
        guardianEmail: optionalProfileEmail(dto.guardianEmail),
        academicYearId: dto.academicYearId ?? null,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        previousSchool: dto.previousSchool?.trim() || null,
        source: dto.source ?? 'OFFICE_WALK_IN',
        notes: dto.notes?.trim() || null,
        duplicateReview: metadata as Prisma.InputJsonValue,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });

    const evaluation = await this.evaluate(created, actor);
    const nextMetadata = this.persistedMetadata(metadata, evaluation);
    const nextStatus = evaluation.suggestedStatus;
    await this.prisma.admissionApplication.update({
      where: { id: created.id },
      data: {
        status: nextStatus,
        duplicateReview: nextMetadata as Prisma.InputJsonValue,
        updatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'admission_case_create',
      resource: 'admission_case',
      resourceId: created.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        source: created.source,
        displayStatus: nextStatus,
      },
    });

    return this.getCase(created.id, actor);
  }

  async updateCase(
    caseId: string,
    dto: UpdateAdmissionCaseDto,
    actor: AuthContext,
  ) {
    const current = await this.findTenantCase(caseId, actor);
    if (TERMINAL_STATUSES.has(current.status)) {
      throw new BadRequestException(
        'This admission case is closed and cannot be edited. Use a correction workflow if information must change.',
      );
    }

    const metadata = this.mergeMetadata(
      this.readMetadata(current.duplicateReview),
      dto,
    );
    await this.validateDocumentReferences(
      metadata.documents ?? [],
      actor,
      current.id,
    );
    const updated = await this.prisma.admissionApplication.update({
      where: { id: current.id },
      data: {
        firstNameEn: dto.firstNameEn
          ? requirePersonName(dto.firstNameEn, 'firstNameEn')
          : current.firstNameEn,
        lastNameEn: dto.lastNameEn
          ? requirePersonName(dto.lastNameEn, 'lastNameEn')
          : current.lastNameEn,
        firstNameNp:
          dto.firstNameNp !== undefined
            ? optionalPersonName(dto.firstNameNp, 'firstNameNp')
            : current.firstNameNp,
        lastNameNp:
          dto.lastNameNp !== undefined
            ? optionalPersonName(dto.lastNameNp, 'lastNameNp')
            : current.lastNameNp,
        dateOfBirth: dto.dateOfBirth
          ? parseDateOfBirth(dto.dateOfBirth)
          : current.dateOfBirth,
        gender: dto.gender ?? current.gender,
        guardianFullName:
          dto.guardianFullName !== undefined
            ? optionalPersonName(dto.guardianFullName, 'guardianFullName')
            : current.guardianFullName,
        guardianRelation: this.optionalString(
          dto.guardianRelation,
          current.guardianRelation,
        ),
        guardianPhone:
          dto.guardianPhone !== undefined
            ? optionalNepalPhone(dto.guardianPhone)
            : current.guardianPhone,
        guardianEmail:
          dto.guardianEmail !== undefined
            ? optionalProfileEmail(dto.guardianEmail)
            : current.guardianEmail,
        academicYearId: dto.academicYearId ?? current.academicYearId,
        classId: dto.classId ?? current.classId,
        sectionId: dto.sectionId ?? current.sectionId,
        previousSchool: this.optionalString(
          dto.previousSchool,
          current.previousSchool,
        ),
        source: dto.source ?? current.source,
        notes: this.optionalString(dto.notes, current.notes),
        duplicateReview: metadata as Prisma.InputJsonValue,
        updatedById: actor.userId,
      },
    });

    const evaluation = await this.evaluate(updated, actor);
    const nextStatus = this.nextStatusAfterSave(updated.status, evaluation);
    await this.prisma.admissionApplication.update({
      where: { id: updated.id },
      data: {
        status: nextStatus,
        duplicateReview: this.persistedMetadata(
          metadata,
          evaluation,
        ) as Prisma.InputJsonValue,
        updatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'admission_case_update',
      resource: 'admission_case',
      resourceId: current.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { status: current.status },
      after: { status: nextStatus },
    });

    return this.getCase(current.id, actor);
  }

  async getCase(caseId: string, actor: AuthContext) {
    const record = await this.findTenantCase(caseId, actor);
    return this.formatCase(record, actor);
  }

  async evaluateCase(caseId: string, actor: AuthContext) {
    const record = await this.findTenantCase(caseId, actor);
    const evaluation = await this.evaluate(record, actor);
    return {
      admissionCaseId: record.id,
      displayStatus: this.displayStatus(record.status),
      ...evaluation,
    };
  }

  async reviewCase(
    caseId: string,
    dto: ReviewAdmissionCaseDto,
    actor: AuthContext,
  ) {
    if (!actor.permissions.includes('students:manage_lifecycle')) {
      throw new ForbiddenException(
        'You do not have permission to review admission cases.',
      );
    }
    const current = await this.findTenantCase(caseId, actor);
    if (TERMINAL_STATUSES.has(current.status)) {
      throw new BadRequestException(
        'This admission case is no longer open for review.',
      );
    }
    if (
      REVIEW_ACTIONS_REQUIRING_REASON.has(dto.action) &&
      (dto.reason?.trim().length ?? 0) < 5
    ) {
      throw new BadRequestException(
        'A clear reason of at least five characters is required for this action.',
      );
    }
    if (dto.action === 'ASSIGN_REVIEWER' && !dto.reviewerUserId) {
      throw new BadRequestException(
        'Choose an authorized reviewer for this admission case.',
      );
    }
    if (
      dto.action !== 'ASSIGN_REVIEWER' &&
      (dto.reviewerUserId || dto.dueDate)
    ) {
      throw new BadRequestException(
        'Reviewer and due date can only be changed by the assign reviewer action.',
      );
    }
    if (dto.reviewerUserId) {
      const reviewer = await this.prisma.user.findFirst({
        where: {
          id: dto.reviewerUserId,
          tenantId: actor.tenantId,
          status: 'ACTIVE',
          userRoles: {
            some: {
              tenantId: actor.tenantId,
              role: {
                tenantId: actor.tenantId,
                rolePermissions: {
                  some: {
                    permission: {
                      resource: 'students',
                      action: 'manage_lifecycle',
                    },
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!reviewer) {
        throw new BadRequestException(
          'Choose an active reviewer who can manage admission decisions for this school.',
        );
      }
    }

    const evaluation = await this.evaluate(current, actor);
    if (dto.action === 'APPROVE') {
      if (
        evaluation.requiresApproval &&
        !actor.roles.some((role) =>
          ['principal', 'platform_super_admin'].includes(role),
        )
      ) {
        throw new ForbiddenException(
          'This admission requires approval from the principal.',
        );
      }
      const documentBlock =
        evaluation.missingRequiredDocuments.length > 0 &&
        !evaluation.policyRequirements.allowAdmissionWithDocumentsPending;
      const capacityBlock = this.capacityBlocksAdmission(evaluation);
      if (
        evaluation.missingRequiredFields.length > 0 ||
        documentBlock ||
        capacityBlock
      ) {
        throw new BadRequestException(
          'Resolve the blocking admission requirements before approving this case.',
        );
      }
      if (evaluation.duplicateRisk && !dto.reason?.trim()) {
        throw new BadRequestException(
          'Record the duplicate review decision before approving this case.',
        );
      }
    }
    const availableActions = this.availableReviewActions(
      current,
      evaluation,
      actor,
    );
    if (!availableActions.includes(dto.action)) {
      throw new ConflictException(
        `The ${this.reviewActionLabel(dto.action)} action is not available while this case is ${this.displayStatus(current.status).toLowerCase().replaceAll('_', ' ')}.`,
      );
    }

    const metadata = this.readMetadata(current.duplicateReview);
    const notes = metadata.review?.notes ?? [];
    const nextMetadata: StoredCaseMetadata = {
      ...this.persistedMetadata(metadata, evaluation),
      review: {
        reviewerUserId: dto.reviewerUserId ?? metadata.review?.reviewerUserId,
        dueDate: dto.dueDate ?? metadata.review?.dueDate,
        notes: [
          ...notes,
          {
            action: dto.action,
            reason: dto.reason?.trim(),
            at: new Date().toISOString(),
            byUserId: actor.userId,
          },
        ],
      },
    };

    const nextStatus = this.reviewActionStatus(dto.action, current.status);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.admissionApplication.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          status: current.status,
          updatedAt: current.updatedAt,
        },
        data: {
          status: nextStatus,
          rejectedReason:
            dto.action === 'REJECT' ? (dto.reason?.trim() ?? null) : null,
          duplicateReview: nextMetadata as Prisma.InputJsonValue,
          updatedById: actor.userId,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'This admission case changed while it was being reviewed. Refresh and try again.',
        );
      }

      await this.auditService.record(
        {
          action: `admission_case_${dto.action.toLowerCase()}`,
          resource: 'admission_case',
          resourceId: current.id,
          tenantId: actor.tenantId,
          userId: actor.userId,
          before: { status: current.status },
          after: {
            status: nextStatus,
            reason: dto.reason?.trim() ?? null,
            reviewerUserId: dto.reviewerUserId ?? null,
            dueDate: dto.dueDate ?? null,
          },
        },
        tx,
      );
    });

    return this.getCase(current.id, actor);
  }

  async directAdmit(
    caseId: string,
    dto: DirectAdmitAdmissionCaseDto,
    actor: AuthContext,
  ) {
    return this.admit(caseId, dto, actor, false);
  }

  async finalizeApprovedCase(
    caseId: string,
    dto: FinalizeAdmissionCaseDto,
    actor: AuthContext,
  ) {
    return this.admit(caseId, dto, actor, true);
  }

  private async admit(
    caseId: string,
    dto: DirectAdmitAdmissionCaseDto | FinalizeAdmissionCaseDto,
    actor: AuthContext,
    approvedFinalization: boolean,
  ) {
    let current = await this.findTenantCase(caseId, actor);
    if (
      this.displayStatus(current.status) === 'ADMITTED' &&
      current.convertedStudentId
    ) {
      return this.admittedResult(
        current.convertedStudentId,
        current.id,
        actor,
        true,
      );
    }

    if (this.hasCaseUpdates(dto)) {
      await this.updateCase(caseId, dto, actor);
      current = await this.findTenantCase(caseId, actor);
    }

    const displayStatus = this.displayStatus(current.status);
    if (approvedFinalization && displayStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Only approved admission cases can be finalized.',
      );
    }

    const evaluation = await this.evaluate(current, actor);
    const documentBlock =
      evaluation.missingRequiredDocuments.length > 0 &&
      !evaluation.policyRequirements.allowAdmissionWithDocumentsPending;
    if (evaluation.missingRequiredFields.length > 0 || documentBlock) {
      throw new BadRequestException({
        message:
          'Complete the required admission information before admitting this student.',
        missingRequiredFields: evaluation.missingRequiredFields,
        missingRequiredDocuments: documentBlock
          ? evaluation.missingRequiredDocuments
          : [],
      });
    }
    if (this.capacityBlocksAdmission(evaluation)) {
      throw new BadRequestException(
        'The selected section is full. Choose another section before admission.',
      );
    }

    const reviewIsApproved = displayStatus === 'APPROVED';
    const duplicateOverrideRequested =
      evaluation.duplicateRisk && dto.overrideDuplicate === true;
    if (duplicateOverrideRequested) {
      if (!dto.overrideReason?.trim()) {
        throw new BadRequestException(
          'Provide a reason before overriding a duplicate warning.',
        );
      }
      if (!actor.permissions?.includes('students:manage_lifecycle')) {
        throw new ForbiddenException(
          'You do not have permission to override a duplicate warning.',
        );
      }
    }

    const policyRequiresReview = this.policyRequiresReview(evaluation);
    if (!reviewIsApproved && policyRequiresReview) {
      await this.prisma.admissionApplication.update({
        where: { id: current.id },
        data: { status: 'WAITING_FOR_REVIEW', updatedById: actor.userId },
      });
      throw new BadRequestException(
        'This admission needs review before it can be finalized.',
      );
    }
    if (
      evaluation.duplicateRisk &&
      !reviewIsApproved &&
      !duplicateOverrideRequested
    ) {
      await this.prisma.admissionApplication.update({
        where: { id: current.id },
        data: { status: 'WAITING_FOR_REVIEW', updatedById: actor.userId },
      });
      throw new ConflictException({
        message: 'Possible duplicate students need review before admission.',
        admissionCaseId: current.id,
        duplicateCandidates: evaluation.duplicateCandidates,
      });
    }
    const placement = await this.validatePlacement(current, actor, true);
    const academicYear = placement.academicYear;
    const classroom = placement.classroom;
    const section = placement.section;

    if (!academicYear || !classroom) {
      throw new BadRequestException(
        'The selected academic year or class is not valid for this school.',
      );
    }

    const metadata = this.readMetadata(current.duplicateReview);
    await this.validateDocumentReferences(
      metadata.documents ?? [],
      actor,
      current.id,
    );
    const followUps = this.followUps(metadata, evaluation);
    const dateOfBirth = current.dateOfBirth;
    const gender = current.gender;
    const guardianPhone = current.guardianPhone;
    const guardianFullName = current.guardianFullName;
    const guardianRelation = current.guardianRelation;
    if (
      !dateOfBirth ||
      !gender ||
      !guardianPhone ||
      !guardianFullName ||
      !guardianRelation
    ) {
      throw new BadRequestException(
        'Complete the required student and guardian information before admission.',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const claim = await tx.admissionApplication.updateMany({
          where: {
            id: current.id,
            tenantId: actor.tenantId,
            convertedStudentId: null,
            status: { in: [...ADMITTABLE_STORAGE_STATUSES] },
          },
          data: { status: 'FINALIZING', updatedById: actor.userId },
        });
        if (claim.count !== 1) {
          const existing = await tx.admissionApplication.findFirst({
            where: { id: current.id, tenantId: actor.tenantId },
            select: { convertedStudentId: true },
          });
          if (existing?.convertedStudentId) {
            return {
              studentId: existing.convertedStudentId,
              alreadyAdmitted: true,
            };
          }
          throw new ConflictException(
            'This admission case changed while it was being admitted. Refresh and try again.',
          );
        }

        const student = await tx.student.create({
          data: {
            tenantId: actor.tenantId,
            studentSystemId: this.newStudentSystemId(),
            firstNameEn: current.firstNameEn,
            lastNameEn: current.lastNameEn,
            firstNameNp: current.firstNameNp,
            lastNameNp: current.lastNameNp,
            dateOfBirth,
            gender,
            admissionDate: this.admissionDate(metadata),
            classId: classroom.id,
            sectionId: section?.id ?? null,
            section: section?.name ?? null,
            rollNumber: metadata.rollNumber ?? null,
            previousSchool: current.previousSchool,
            mediumOfInstruct: metadata.mediumOfInstruction ?? 'English',
            nationalStudentId: metadata.nationalStudentId ?? null,
            emergencyName: metadata.emergencyName ?? null,
            emergencyPhone: metadata.emergencyPhone ?? null,
            medicalConditions: encryptSensitiveField(
              metadata.medicalConditions,
              this.configService.medicalEncryptionKey,
            ),
            privacyConsentAt: new Date(),
            dataProcessingConsentedAt: new Date(),
            medicalConsentAt: metadata.medicalConditions ? new Date() : null,
          },
        });

        const phone = requireNepalPhone(guardianPhone);
        const guardianName = requirePersonName(
          guardianFullName,
          'guardianFullName',
        );
        const existingGuardian = await tx.guardian.findFirst({
          where: {
            tenantId: actor.tenantId,
            primaryPhone: phone,
            fullName: { equals: guardianName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        const guardian = existingGuardian
          ? existingGuardian
          : await tx.guardian.create({
              data: {
                tenantId: actor.tenantId,
                fullName: guardianName,
                relation: guardianRelation,
                primaryPhone: phone,
                email: optionalProfileEmail(current.guardianEmail),
                receivesAlerts: metadata.guardianReceivesAlerts ?? true,
                privacyConsentAt: new Date(),
              },
            });

        await tx.studentGuardian.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            guardianId: guardian.id,
            relation: guardianRelation,
            isPrimary: true,
          },
        });

        const enrollment = await tx.enrollment.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            academicYearId: academicYear.id,
            classId: classroom.id,
            sectionId: section?.id ?? null,
            rollNumber: metadata.rollNumber ?? null,
            admissionDate: this.admissionDate(metadata),
            mediumOfInstruction: metadata.mediumOfInstruction ?? 'English',
            status: EnrollmentStatus.ACTIVE,
          },
        });

        await tx.studentLifecycleTransition.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            fromStatus: null,
            toStatus: StudentLifecycleStatus.ACTIVE,
            reason: 'Initial admission through unified admission case',
            changedById: actor.userId,
            metadata: { admissionCaseId: current.id, source: current.source },
          },
        });

        await this.studentRecordsService.attachRegisteredAdmissionDocuments(
          tx,
          {
            tenantId: actor.tenantId,
            studentId: student.id,
            admissionCaseId: current.id,
            documents: metadata.documents ?? [],
            userId: actor.userId,
          },
        );

        await tx.admissionApplication.update({
          where: { id: current.id },
          data: {
            status: 'ADMITTED',
            convertedStudentId: student.id,
            duplicateReview: {
              ...this.persistedMetadata(metadata, evaluation),
              followUps,
            } as unknown as Prisma.InputJsonValue,
            updatedById: actor.userId,
          },
        });

        await tx.auditLog.create({
          data: {
            action: approvedFinalization
              ? 'admission_case_finalize'
              : 'admission_case_direct_admit',
            resource: 'admission_case',
            resourceId: current.id,
            tenantId: actor.tenantId,
            userId: actor.userId,
            before: { status: current.status },
            after: {
              status: 'ADMITTED',
              studentId: student.id,
              guardianId: guardian.id,
              enrollmentId: enrollment.id,
              guardianReused: Boolean(existingGuardian),
              duplicateOverride: dto.overrideDuplicate ?? false,
              duplicateOverrideReason: dto.overrideDuplicate
                ? dto.overrideReason?.trim()
                : null,
              documentReferenceCount: metadata.documents?.length ?? 0,
              followUpCodes: followUps.map((item) => item.code),
            },
          },
        });

        return { studentId: student.id, alreadyAdmitted: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.admittedResult(
      result.studentId,
      current.id,
      actor,
      result.alreadyAdmitted,
    );
  }

  private async formatCase(record: AdmissionCaseRecord, actor: AuthContext) {
    const metadata = this.readMetadata(record.duplicateReview);
    const evaluation = await this.evaluate(record, actor);
    const displayStatus = this.displayStatus(record.status);
    const reviewComplete =
      displayStatus === 'APPROVED' || displayStatus === 'ADMITTED';
    return {
      id: record.id,
      source: this.admissionSource(record.source),
      student: {
        firstNameEn: record.firstNameEn,
        lastNameEn: record.lastNameEn,
        firstNameNp: record.firstNameNp,
        lastNameNp: record.lastNameNp,
        dateOfBirth: record.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: record.gender,
      },
      guardian: {
        fullName: record.guardianFullName,
        relationship: record.guardianRelation,
        phone: record.guardianPhone,
        email: record.guardianEmail,
        receivesAlerts: metadata.guardianReceivesAlerts ?? true,
      },
      academic: {
        academicYearId: record.academicYearId,
        classId: record.classId,
        sectionId: record.sectionId,
        admissionDate: metadata.admissionDate ?? null,
        rollNumber: metadata.rollNumber ?? null,
        mediumOfInstruction: metadata.mediumOfInstruction ?? 'English',
      },
      transferStudent:
        metadata.transferStudent ??
        this.admissionSource(record.source) === 'TRANSFER_REQUEST',
      previousSchool: record.previousSchool,
      notes: record.notes,
      documents: (metadata.documents ?? []).map((document) => ({
        fileId: document.fileId,
        kind: document.kind,
        title: document.title ?? null,
      })),
      displayStatus,
      missingRequiredFields: evaluation.missingRequiredFields,
      missingRequiredDocuments: evaluation.missingRequiredDocuments,
      duplicateRisk: evaluation.duplicateRisk,
      duplicateCandidates: evaluation.duplicateCandidates,
      relatedStudentCandidates: evaluation.relatedStudentCandidates,
      policyRequirements: evaluation.policyRequirements,
      canAdmitDirectly: evaluation.canAdmitDirectly && !reviewComplete,
      canOverrideDuplicate: evaluation.canOverrideDuplicate && !reviewComplete,
      requiresReview: evaluation.requiresReview && !reviewComplete,
      requiresApproval: evaluation.requiresApproval && !reviewComplete,
      classSection: evaluation.classSection,
      capacityStatus: evaluation.capacityStatus,
      nextActionLabel: this.nextActionLabel(record, evaluation, displayStatus),
      followUps: metadata.followUps ?? this.followUps(metadata, evaluation),
      review: {
        reviewerUserId: metadata.review?.reviewerUserId ?? null,
        dueDate: metadata.review?.dueDate ?? null,
        history: (metadata.review?.notes ?? [])
          .filter((item) => ADMISSION_CASE_REVIEW_ACTION_SET.has(item.action))
          .map((item) => ({
            action: item.action as AdmissionCaseReviewAction,
            reason: item.reason ?? null,
            at: item.at,
            byUserId: item.byUserId,
          })),
        availableActions: this.availableReviewActions(
          record,
          evaluation,
          actor,
        ),
      },
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      admittedStudentId: record.convertedStudentId,
    };
  }

  private async evaluate(
    record: AdmissionCaseRecord,
    actor: AuthContext,
  ): Promise<AdmissionEvaluation> {
    const metadata = this.readMetadata(record.duplicateReview);
    const policy = await this.resolvePolicy(record, metadata, actor);
    const requiredFields = new Set<string>([
      'dateOfBirth',
      'gender',
      'guardianFullName',
      'guardianRelation',
      'guardianPhone',
      'academicYearId',
      'classId',
      ...(policy.requiredFields ?? []),
    ]);
    if (policy.requireSection) requiredFields.add('sectionId');

    const fieldValues: Record<string, unknown> = {
      firstNameEn: record.firstNameEn,
      lastNameEn: record.lastNameEn,
      firstNameNp: record.firstNameNp,
      lastNameNp: record.lastNameNp,
      dateOfBirth: record.dateOfBirth,
      gender: record.gender,
      guardianFullName: record.guardianFullName,
      guardianRelation: record.guardianRelation,
      guardianPhone: record.guardianPhone,
      academicYearId: record.academicYearId,
      classId: record.classId,
      sectionId: record.sectionId,
      previousSchool: record.previousSchool,
      admissionDate: metadata.admissionDate,
      nationalStudentId: metadata.nationalStudentId,
      emergencyName: metadata.emergencyName,
      emergencyPhone: metadata.emergencyPhone,
    };
    const missingRequiredFields = [...requiredFields].filter(
      (field) => !fieldValues[field],
    );
    const requiredDocuments = this.requiredDocuments(
      policy,
      metadata,
      record.source,
    );
    const documentKinds = new Set(
      (metadata.documents ?? []).map((document) =>
        this.normalizeDocumentKind(document.kind),
      ),
    );
    const missingRequiredDocuments = requiredDocuments.filter(
      (kind) => !documentKinds.has(kind),
    );

    const placement = await this.validatePlacement(record, actor, false);
    const duplicateCandidates = await this.findDuplicateCandidates(
      record,
      actor,
    );
    const duplicateCandidateIds = new Set(
      duplicateCandidates.map((candidate) => candidate.studentId),
    );
    const relatedStudentCandidates = (
      await this.findRelatedStudentCandidates(record, actor)
    ).filter((candidate) => !duplicateCandidateIds.has(candidate.studentId));
    const duplicateRisk = duplicateCandidates.length > 0;
    const documentBlocksAdmission =
      missingRequiredDocuments.length > 0 &&
      !policy.allowAdmissionWithDocumentsPending;
    const capacityBlocksAdmission =
      policy.enforceCapacityWhenAvailable === true &&
      placement.capacityStatus?.state === 'FULL';
    const requiresApproval = policy.requirePrincipalApproval === true;
    const policyRequirements: AdmissionEvaluation['policyRequirements'] = {
      admissionMode: policy.admissionMode,
      requireDocumentReview: policy.requireDocumentReview === true,
      requireInterview: policy.requireInterview === true,
      requirePrincipalApproval: requiresApproval,
      requireTransferCertificate: policy.requireTransferCertificate === true,
      requirePriorMarksheet: policy.requirePriorMarksheet === true,
      requireStreamOrMarksReview: policy.requireStreamOrMarksReview === true,
      allowAdmissionWithDocumentsPending:
        policy.allowAdmissionWithDocumentsPending === true,
      enforceCapacityWhenAvailable:
        policy.enforceCapacityWhenAvailable === true,
      requireSection: policy.requireSection === true,
      requiredDocuments,
      requiredFields: [...requiredFields],
    };
    const policyRequiresReview = this.policyRequiresReview({
      policyRequirements,
    });
    const requiresReview = policyRequiresReview || duplicateRisk;
    const canAdmitDirectly =
      !record.convertedStudentId &&
      missingRequiredFields.length === 0 &&
      !documentBlocksAdmission &&
      !capacityBlocksAdmission &&
      !requiresReview;
    const canOverrideDuplicate =
      duplicateRisk &&
      !record.convertedStudentId &&
      missingRequiredFields.length === 0 &&
      !documentBlocksAdmission &&
      !capacityBlocksAdmission &&
      !policyRequiresReview &&
      actor.permissions.includes('students:manage_lifecycle');

    const suggestedStatus: AdmissionDisplayStatus = record.convertedStudentId
      ? 'ADMITTED'
      : missingRequiredFields.length > 0 || documentBlocksAdmission
        ? 'NEEDS_INFORMATION'
        : requiresReview
          ? 'WAITING_FOR_REVIEW'
          : 'READY_TO_ADMIT';

    return {
      missingRequiredFields,
      missingRequiredDocuments,
      duplicateRisk,
      duplicateCandidates,
      relatedStudentCandidates,
      policyRequirements,
      canAdmitDirectly,
      canOverrideDuplicate,
      requiresReview,
      requiresApproval,
      classSection: {
        ...placement.classSection,
        sectionRequired:
          policy.requireSection === true && placement.hasSections,
        message:
          policy.requireSection === true &&
          placement.hasSections &&
          !record.sectionId
            ? 'Select a section for this class.'
            : placement.classSection.message,
      },
      capacityStatus: placement.capacityStatus,
      suggestedStatus,
      nextActionLabel: canAdmitDirectly ? 'Admit student' : 'Review admission',
    };
  }

  private async resolvePolicy(
    record: AdmissionCaseRecord,
    metadata: StoredCaseMetadata,
    actor: AuthContext,
  ) {
    const configured = await this.loadPolicy(actor.tenantId);
    const classroom = record.classId
      ? await this.prisma.class.findFirst({
          where: { id: record.classId, tenantId: actor.tenantId },
          select: { level: true },
        })
      : null;
    const gradeBand = this.gradeBand(classroom?.level ?? null);
    const source = this.admissionSource(record.source);
    const transferStudent =
      metadata.transferStudent ?? source === 'TRANSFER_REQUEST';
    const matchingOverride = configured.overrides
      .map((rule) => ({
        rule,
        score: this.policyScore(rule, record, gradeBand, transferStudent),
      }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => right.score - left.score)[0]?.rule;
    return { ...configured.defaultPolicy, ...(matchingOverride ?? {}) };
  }

  private async validatePlacement(
    record: AdmissionCaseRecord,
    actor: AuthContext,
    throwOnInvalid: boolean,
  ) {
    if (!record.academicYearId || !record.classId) {
      if (throwOnInvalid)
        throw new BadRequestException(
          'Choose an academic year and class before admission.',
        );
      return {
        academicYear: null,
        classroom: null,
        section: null,
        hasSections: false,
        classSection: {
          valid: false,
          academicYearName: null,
          className: null,
          sectionName: null,
          message: 'Academic year and class are required.',
        },
        capacityStatus: null as CapacityStatus | null,
      };
    }

    const [academicYear, classroom, section, sectionCount] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: record.academicYearId, tenantId: actor.tenantId },
        select: { id: true, name: true },
      }),
      this.prisma.class.findFirst({
        where: { id: record.classId, tenantId: actor.tenantId },
        select: { id: true, name: true },
      }),
      record.sectionId
        ? this.prisma.section.findFirst({
            where: { id: record.sectionId, tenantId: actor.tenantId },
            select: { id: true, name: true, classId: true, capacity: true },
          })
        : Promise.resolve(null),
      this.prisma.section.count({
        where: { tenantId: actor.tenantId, classId: record.classId },
      }),
    ]);

    if (
      !academicYear ||
      !classroom ||
      (record.sectionId && section?.classId !== record.classId)
    ) {
      if (throwOnInvalid) {
        throw new BadRequestException(
          'The selected academic year, class, or section is not valid for this school.',
        );
      }
      return {
        academicYear: null,
        classroom: null,
        section: null,
        hasSections: false,
        classSection: {
          valid: false,
          academicYearName: null,
          className: null,
          sectionName: null,
          message: 'Choose a valid class and section for this school.',
        },
        capacityStatus: null as CapacityStatus | null,
      };
    }

    let capacityStatus: CapacityStatus | null = null;
    if (section?.capacity !== null && section?.capacity !== undefined) {
      const enrolled = await this.prisma.enrollment.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId: academicYear.id,
          sectionId: section.id,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      capacityStatus = {
        state: enrolled >= section.capacity ? 'FULL' : 'AVAILABLE',
        capacity: section.capacity,
        enrolled,
      };
    }

    return {
      academicYear,
      classroom,
      section,
      hasSections: sectionCount > 0,
      classSection: {
        valid: true,
        academicYearName: academicYear.name,
        className: classroom.name,
        sectionName: section?.name ?? null,
        message: null,
      },
      capacityStatus,
    };
  }

  private async findDuplicateCandidates(
    record: AdmissionCaseRecord,
    actor: AuthContext,
  ) {
    const conditions: Prisma.StudentWhereInput[] = [];
    if (record.dateOfBirth) {
      conditions.push({
        dateOfBirth: record.dateOfBirth,
        firstNameEn: { equals: record.firstNameEn, mode: 'insensitive' },
        lastNameEn: { equals: record.lastNameEn, mode: 'insensitive' },
      });
    }
    if (record.guardianPhone) {
      conditions.push({
        firstNameEn: { equals: record.firstNameEn, mode: 'insensitive' },
        lastNameEn: { equals: record.lastNameEn, mode: 'insensitive' },
        guardianLinks: {
          some: {
            guardian: {
              primaryPhone: requireNepalPhone(record.guardianPhone),
            },
          },
        },
      });
    }
    if (conditions.length === 0) return [];

    const matches = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId, OR: conditions },
      select: {
        id: true,
        studentSystemId: true,
        firstNameEn: true,
        lastNameEn: true,
        lifecycleStatus: true,
        class: { select: { name: true } },
        sectionRef: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return matches.map((student) => ({
      studentId: student.id,
      studentSystemId: student.studentSystemId,
      fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      className: student.class.name,
      sectionName: student.sectionRef?.name ?? null,
      lifecycleStatus: student.lifecycleStatus,
    }));
  }

  private async findRelatedStudentCandidates(
    record: AdmissionCaseRecord,
    actor: AuthContext,
  ) {
    if (!record.guardianPhone) return [];
    const guardianPhone = requireNepalPhone(record.guardianPhone);
    const guardianName = record.guardianFullName
      ? requirePersonName(record.guardianFullName, 'guardianFullName')
      : null;
    const lastNameEn = record.lastNameEn.trim().toLowerCase();
    const lastNameNp = record.lastNameNp?.trim().toLowerCase() ?? null;

    const matches = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        guardianLinks: {
          some: {
            guardian: {
              OR: [
                { primaryPhone: guardianPhone },
                { secondaryPhone: guardianPhone },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        studentSystemId: true,
        firstNameEn: true,
        lastNameEn: true,
        lastNameNp: true,
        lifecycleStatus: true,
        class: { select: { name: true } },
        sectionRef: { select: { name: true } },
        guardianLinks: {
          where: {
            guardian: {
              OR: [
                { primaryPhone: guardianPhone },
                { secondaryPhone: guardianPhone },
              ],
            },
          },
          select: {
            relation: true,
            guardian: { select: { fullName: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return matches.map((student) => {
      const linkedGuardian = student.guardianLinks?.[0] ?? null;
      const linkedGuardianName = linkedGuardian?.guardian.fullName ?? null;
      const reasons = ['Guardian phone already has linked student records.'];
      if (student.lastNameEn.trim().toLowerCase() === lastNameEn) {
        reasons.push('English family name matches.');
      }
      if (
        lastNameNp &&
        student.lastNameNp?.trim().toLowerCase() === lastNameNp
      ) {
        reasons.push('Nepali family name matches.');
      }
      if (
        guardianName &&
        linkedGuardianName?.trim().toLowerCase() === guardianName.toLowerCase()
      ) {
        reasons.push('Guardian name matches an existing guardian.');
      }

      return {
        studentId: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? null,
        lifecycleStatus: student.lifecycleStatus,
        guardianName: linkedGuardianName,
        guardianRelation: linkedGuardian?.relation ?? null,
        matchReasons: [...new Set(reasons)],
      };
    });
  }

  private async validateDocumentReferences(
    documents: StoredDocumentReference[],
    actor: AuthContext,
    admissionCaseId?: string,
  ) {
    if (!documents.length) return;
    const distinctIds = [
      ...new Set(documents.map((document) => document.fileId)),
    ];
    if (distinctIds.length !== documents.length) {
      throw new BadRequestException(
        'Each admission document can be linked only once.',
      );
    }

    try {
      const files = await Promise.all(
        distinctIds.map((fileId) =>
          this.fileRegistryService.getFileMetadata(actor.tenantId, fileId),
        ),
      );
      const invalid = files.some(
        (file) =>
          file.status !== FileStatus.UPLOADED ||
          file.module !== 'admissions' ||
          (file.entityId !== null && file.entityId !== admissionCaseId) ||
          (file.entityId === null && file.uploadedByUserId !== actor.userId),
      );
      if (invalid) throw new Error('invalid admission document ownership');
    } catch {
      throw new BadRequestException(
        'One or more admission documents are unavailable for this admission case. Upload them again before admission.',
      );
    }
  }

  private async admittedResult(
    studentId: string,
    admissionCaseId: string,
    actor: AuthContext,
    alreadyAdmitted: boolean,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: {
        id: true,
        studentSystemId: true,
        firstNameEn: true,
        lastNameEn: true,
      },
    });
    if (!student)
      throw new NotFoundException(
        'The admitted student could not be found in this school.',
      );
    return {
      admissionCaseId,
      alreadyAdmitted,
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      },
      redirectPath: `/dashboard/students/${student.id}`,
    };
  }

  private displayStatus(status: string): AdmissionDisplayStatus {
    const mapped = LEGACY_DISPLAY_STATUS[status];
    if (mapped) return mapped;
    return DISPLAY_STATUSES.has(status as AdmissionDisplayStatus)
      ? (status as AdmissionDisplayStatus)
      : 'DRAFT';
  }

  private availableReviewActions(
    record: AdmissionCaseRecord,
    evaluation: AdmissionEvaluation,
    actor: AuthContext,
  ): AdmissionCaseReviewAction[] {
    if (
      !actor.permissions.includes('students:manage_lifecycle') ||
      TERMINAL_STATUSES.has(record.status)
    ) {
      return [];
    }

    const displayStatus = this.displayStatus(record.status);
    if (displayStatus === 'APPROVED' || displayStatus === 'ADMITTED') {
      return [];
    }

    const actions: AdmissionCaseReviewAction[] = ['ASSIGN_REVIEWER'];
    if (
      ['DRAFT', 'NEEDS_INFORMATION', 'READY_TO_ADMIT'].includes(displayStatus)
    ) {
      actions.push('MARK_READY_FOR_REVIEW', 'CLOSE');
      return actions;
    }

    if (displayStatus === 'WAITING_FOR_REVIEW') {
      actions.push(
        'REQUEST_INFORMATION',
        'REJECT',
        'ESCALATE_TO_PRINCIPAL',
        'CLOSE',
      );
      const principalApprovalAllowed =
        !evaluation.requiresApproval ||
        actor.roles.some((role) =>
          ['principal', 'platform_super_admin'].includes(role),
        );
      const documentBlock =
        evaluation.missingRequiredDocuments.length > 0 &&
        !evaluation.policyRequirements.allowAdmissionWithDocumentsPending;
      if (
        principalApprovalAllowed &&
        evaluation.missingRequiredFields.length === 0 &&
        !documentBlock &&
        !this.capacityBlocksAdmission(evaluation)
      ) {
        actions.push('APPROVE');
      }
    }

    return actions;
  }

  private reviewActionStatus(
    action: AdmissionCaseReviewAction,
    currentStatus: string,
  ) {
    const statusByAction: Record<AdmissionCaseReviewAction, string> = {
      REQUEST_INFORMATION: 'NEEDS_INFORMATION',
      ASSIGN_REVIEWER: currentStatus,
      MARK_READY_FOR_REVIEW: 'WAITING_FOR_REVIEW',
      APPROVE: 'APPROVED',
      REJECT: 'NOT_ADMITTED',
      ESCALATE_TO_PRINCIPAL: 'WAITING_FOR_REVIEW',
      CLOSE: 'CLOSED',
    };
    return statusByAction[action];
  }

  private reviewActionLabel(action: AdmissionCaseReviewAction) {
    return action.toLowerCase().replaceAll('_', ' ');
  }

  private nextStatusAfterSave(status: string, evaluation: AdmissionEvaluation) {
    if (TERMINAL_STATUSES.has(status) || REVIEW_LOCKED_STATUSES.has(status)) {
      return status;
    }
    return evaluation.suggestedStatus;
  }

  private nextActionLabel(
    record: AdmissionCaseRecord,
    evaluation: AdmissionEvaluation,
    displayStatus: AdmissionDisplayStatus,
  ) {
    if (record.convertedStudentId || displayStatus === 'ADMITTED')
      return 'Open student profile';
    if (displayStatus === 'APPROVED') return 'Finalize admission';
    if (evaluation.missingRequiredFields.length > 0)
      return 'Complete required information';
    if (
      evaluation.missingRequiredDocuments.length > 0 &&
      !evaluation.policyRequirements.allowAdmissionWithDocumentsPending
    )
      return 'Add required documents';
    if (this.capacityBlocksAdmission(evaluation))
      return 'Choose another section';
    if (evaluation.duplicateRisk) return 'Review duplicate warning';
    if (evaluation.requiresReview) return 'Send for review';
    return 'Admit student';
  }

  private capacityBlocksAdmission(evaluation: AdmissionEvaluation) {
    return (
      evaluation.policyRequirements.enforceCapacityWhenAvailable &&
      evaluation.capacityStatus?.state === 'FULL'
    );
  }

  private policyRequiresReview(
    evaluation: Pick<AdmissionEvaluation, 'policyRequirements'>,
  ) {
    const policy = evaluation.policyRequirements;
    return (
      policy.admissionMode === 'REVIEW_REQUIRED' ||
      policy.requireDocumentReview ||
      policy.requireInterview ||
      policy.requirePrincipalApproval ||
      policy.requireStreamOrMarksReview
    );
  }

  private requiredDocuments(
    policy: PolicyRule,
    metadata: StoredCaseMetadata,
    source: string | null,
  ) {
    const documents = new Set(
      (policy.requiredDocuments ?? []).map((value) =>
        this.normalizeDocumentKind(value),
      ),
    );
    if (
      (metadata.transferStudent ||
        this.admissionSource(source) === 'TRANSFER_REQUEST') &&
      policy.requireTransferCertificate
    ) {
      documents.add('TRANSFER_CERTIFICATE');
    }
    if (policy.requirePriorMarksheet) documents.add('PRIOR_MARKSHEET');
    return [...documents];
  }

  private followUps(
    metadata: StoredCaseMetadata,
    evaluation: AdmissionEvaluation,
  ) {
    const items: Array<{ code: string; label: string; blocking: boolean }> = [];
    if (evaluation.missingRequiredDocuments.length > 0) {
      items.push({
        code: 'DOCUMENTS_PENDING',
        label: 'Add missing student documents',
        blocking: false,
      });
    }
    if (!metadata.nationalStudentId) {
      items.push({
        code: 'IEMIS_INFORMATION_INCOMPLETE',
        label: 'Complete IEMIS information',
        blocking: false,
      });
    }
    items.push({
      code: 'GUARDIAN_VERIFICATION_PENDING',
      label: 'Verify guardian portal access when ready',
      blocking: false,
    });
    items.push({
      code: 'QR_ID_REVIEW',
      label: 'Review QR and ID card readiness',
      blocking: false,
    });
    return items;
  }

  private persistedMetadata(
    metadata: StoredCaseMetadata,
    evaluation: AdmissionEvaluation,
  ): StoredCaseMetadata {
    return {
      ...metadata,
      duplicateRisk: evaluation.duplicateRisk,
      duplicateCandidates: evaluation.duplicateCandidates,
      policySnapshot: evaluation.policyRequirements,
    };
  }

  private mergeMetadata(
    current: StoredCaseMetadata,
    dto: Partial<CreateAdmissionCaseDto>,
  ): StoredCaseMetadata {
    return {
      ...current,
      schemaVersion: 1,
      transferStudent: dto.transferStudent ?? current.transferStudent,
      guardianReceivesAlerts:
        dto.guardianReceivesAlerts ?? current.guardianReceivesAlerts,
      admissionDate: dto.admissionDate ?? current.admissionDate,
      mediumOfInstruction:
        dto.mediumOfInstruction ?? current.mediumOfInstruction,
      rollNumber: dto.rollNumber ?? current.rollNumber,
      nationalStudentId: dto.nationalStudentId ?? current.nationalStudentId,
      emergencyName: dto.emergencyName ?? current.emergencyName,
      emergencyPhone: dto.emergencyPhone ?? current.emergencyPhone,
      medicalConditions: dto.medicalConditions ?? current.medicalConditions,
      documents: dto.documents
        ? dto.documents.map((document) => ({
            fileId: document.fileId,
            kind: this.normalizeDocumentKind(document.kind),
            title: document.title,
          }))
        : (current.documents ?? []),
    };
  }

  private async findTenantCase(
    caseId: string,
    actor: AuthContext,
  ): Promise<AdmissionCaseRecord> {
    const record = await this.prisma.admissionApplication.findFirst({
      where: { id: caseId, tenantId: actor.tenantId },
    });
    if (!record) throw new NotFoundException('Admission case not found.');
    return record;
  }

  private async loadPolicy(tenantId: string): Promise<AdmissionPolicy> {
    const setting = await this.prisma.tenantSetting.findFirst({
      where: { tenantId, key: ADMISSION_POLICY_SETTING_KEY },
      select: { value: true },
    });
    return this.normalizePolicy(setting?.value);
  }

  private normalizePolicy(value: unknown): AdmissionPolicy {
    const root = this.isRecord(value) ? value : {};
    const defaultPolicy = this.isRecord(root.defaultPolicy)
      ? root.defaultPolicy
      : {};
    const overrides = Array.isArray(root.overrides)
      ? root.overrides.filter((rule): rule is Record<string, unknown> =>
          this.isRecord(rule),
        )
      : [];
    const normalizedDefault = this.normalizePolicyRule(
      defaultPolicy,
      DEFAULT_POLICY.admissionMode,
      true,
    );
    return {
      defaultPolicy: normalizedDefault,
      overrides: overrides.map((rule) =>
        this.normalizePolicyRule(rule, normalizedDefault.admissionMode, false),
      ),
    };
  }

  private normalizePolicyRule(
    value: Record<string, unknown>,
    fallbackMode: PolicyRule['admissionMode'],
    includeDefaults: boolean,
  ): PolicyRule {
    const mode =
      value.admissionMode === 'REVIEW_REQUIRED' ||
      value.admissionMode === 'DIRECT_ALLOWED'
        ? value.admissionMode
        : fallbackMode;
    const rule = {
      ...(includeDefaults ? DEFAULT_POLICY : {}),
      ...value,
      admissionMode: mode,
    };
    if (Array.isArray(value.requiredDocuments)) {
      rule.requiredDocuments = value.requiredDocuments
        .filter((item): item is string => typeof item === 'string')
        .map((item) => this.normalizeDocumentKind(item))
        .filter(Boolean);
    }
    if (Array.isArray(value.requiredFields)) {
      rule.requiredFields = value.requiredFields
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return rule;
  }

  private async validatePolicyScopes(
    policy: AdmissionPolicy,
    actor: AuthContext,
  ) {
    const rules = [policy.defaultPolicy, ...policy.overrides];
    const academicYearIds = [
      ...new Set(rules.flatMap((rule) => rule.academicYearId ?? [])),
    ];
    const classIds = [...new Set(rules.flatMap((rule) => rule.classId ?? []))];
    const [academicYears, classes] = await Promise.all([
      academicYearIds.length
        ? this.prisma.academicYear.findMany({
            where: { tenantId: actor.tenantId, id: { in: academicYearIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      classIds.length
        ? this.prisma.class.findMany({
            where: { tenantId: actor.tenantId, id: { in: classIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    if (
      academicYears.length !== academicYearIds.length ||
      classes.length !== classIds.length
    ) {
      throw new BadRequestException(
        'Admission policy scopes must use academic years and classes from this school.',
      );
    }
  }

  private normalizeDocumentKind(value: string) {
    return value
      .trim()
      .replace(/[\s-]+/g, '_')
      .toUpperCase();
  }

  private admissionSource(value: string | null): AdmissionSource {
    const normalized = value
      ?.trim()
      .toUpperCase()
      .replace(/[\s/-]+/g, '_');
    if (
      normalized === 'PARENT_ONLINE' ||
      normalized === 'ONLINE' ||
      normalized === 'WEBSITE'
    ) {
      return 'PARENT_ONLINE';
    }
    if (normalized === 'PHONE_INQUIRY' || normalized === 'PHONE') {
      return 'PHONE_INQUIRY';
    }
    if (normalized === 'TRANSFER_REQUEST' || normalized === 'TRANSFER') {
      return 'TRANSFER_REQUEST';
    }
    if (normalized === 'IMPORT' || normalized === 'BULK_IMPORT') {
      return 'IMPORT';
    }
    return 'OFFICE_WALK_IN';
  }

  private policyScore(
    rule: PolicyRule,
    record: AdmissionCaseRecord,
    gradeBand: string | null,
    transferStudent: boolean,
  ) {
    let score = 0;
    if (rule.academicYearId) {
      if (rule.academicYearId !== record.academicYearId) return -1;
      score += 8;
    }
    if (rule.classId) {
      if (rule.classId !== record.classId) return -1;
      score += 16;
    }
    if (rule.gradeBand) {
      if (rule.gradeBand !== gradeBand) return -1;
      score += 4;
    }
    if (rule.source) {
      if (rule.source !== this.admissionSource(record.source)) return -1;
      score += 4;
    }
    if (typeof rule.transferStudent === 'boolean') {
      if (rule.transferStudent !== transferStudent) return -1;
      score += 4;
    }
    return score;
  }

  private gradeBand(level: number | null) {
    if (level === null) return null;
    if (level <= 0) return 'MONTESSORI';
    if (level <= 5) return 'PRIMARY';
    if (level <= 10) return 'BASIC_SECONDARY';
    return 'GRADE_11_12';
  }

  private hasCaseUpdates(
    dto: DirectAdmitAdmissionCaseDto | FinalizeAdmissionCaseDto,
  ) {
    const {
      overrideDuplicate: _overrideDuplicate,
      overrideReason: _overrideReason,
      ...updates
    } = dto;
    return Object.values(updates).some((value) => typeof value !== 'undefined');
  }

  private readMetadata(value: Prisma.JsonValue | null): StoredCaseMetadata {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private requiredString(next: string | undefined, current: string) {
    return typeof next === 'undefined' ? current : next.trim() || current;
  }

  private optionalString(next: string | undefined, current: string | null) {
    return typeof next === 'undefined' ? current : next.trim() || null;
  }

  private admissionDate(metadata: StoredCaseMetadata) {
    return metadata.admissionDate
      ? new Date(metadata.admissionDate)
      : new Date();
  }

  private newStudentSystemId() {
    return `STU-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
}
