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
  Gender,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { encryptSensitiveField } from '../common/security/field-encryption';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdmissionCaseDto,
  DirectAdmitAdmissionCaseDto,
  FinalizeAdmissionCaseDto,
  ReviewAdmissionCaseDto,
  UpdateAdmissionCaseDto,
  UpdateAdmissionPolicyDto,
} from './dto/admission-case.dto';

const ADMISSION_POLICY_SETTING_KEY = 'admissions.policy.v1';
const TERMINAL_STATUSES = new Set(['ADMITTED', 'ENROLLED', 'NOT_ADMITTED', 'REJECTED', 'CLOSED']);
const REVIEW_LOCKED_STATUSES = new Set(['WAITING_FOR_REVIEW', 'ENTRANCE_INTERVIEW', 'APPROVED', 'ACCEPTED']);
const ADMITTABLE_STORAGE_STATUSES = ['DRAFT', 'NEEDS_INFORMATION', 'READY_TO_ADMIT', 'APPROVED', 'ACCEPTED'] as const;

const LEGACY_DISPLAY_STATUS: Record<string, AdmissionDisplayStatus> = {
  INQUIRY: 'DRAFT',
  APPLICATION: 'NEEDS_INFORMATION',
  DOCUMENT_PENDING: 'NEEDS_INFORMATION',
  ENTRANCE_INTERVIEW: 'WAITING_FOR_REVIEW',
  ACCEPTED: 'APPROVED',
  ENROLLED: 'ADMITTED',
  REJECTED: 'NOT_ADMITTED',
};

type AdmissionDisplayStatus =
  | 'DRAFT'
  | 'NEEDS_INFORMATION'
  | 'READY_TO_ADMIT'
  | 'WAITING_FOR_REVIEW'
  | 'APPROVED'
  | 'ADMITTED'
  | 'NOT_ADMITTED'
  | 'CLOSED';

type StoredDocumentReference = {
  fileId: string;
  kind: string;
  title?: string;
};

type StoredReviewNote = {
  action: string;
  reason?: string;
  at: string;
  byUserId: string;
};

type StoredCaseMetadata = {
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
};

type PolicyRule = {
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
};

type AdmissionPolicy = {
  defaultPolicy: PolicyRule;
  overrides: PolicyRule[];
};

type AdmissionCaseRecord = {
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
};

type CapacityStatus = {
  state: 'NOT_CONFIGURED' | 'AVAILABLE' | 'FULL';
  capacity: number | null;
  enrolled: number | null;
};

type AdmissionEvaluation = {
  missingRequiredFields: string[];
  missingRequiredDocuments: string[];
  duplicateRisk: boolean;
  duplicateCandidates: NonNullable<StoredCaseMetadata['duplicateCandidates']>;
  policyRequirements: {
    admissionMode: 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED';
    requireDocumentReview: boolean;
    requireInterview: boolean;
    requirePrincipalApproval: boolean;
    allowAdmissionWithDocumentsPending: boolean;
    enforceCapacityWhenAvailable: boolean;
    requiredDocuments: string[];
    requiredFields: string[];
  };
  canAdmitDirectly: boolean;
  requiresReview: boolean;
  requiresApproval: boolean;
  classSection: {
    valid: boolean;
    sectionRequired?: boolean;
    message: string | null;
  };
  capacityStatus: CapacityStatus | null;
  suggestedStatus: AdmissionDisplayStatus;
  nextActionLabel: string;
};

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
  ) {}

  async getPolicy(actor: AuthContext) {
    return this.loadPolicy(actor.tenantId);
  }

  async updatePolicy(dto: UpdateAdmissionPolicyDto, actor: AuthContext) {
    const policy = this.normalizePolicy(dto);
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
        value: policy as Prisma.InputJsonValue,
      },
      update: { value: policy as Prisma.InputJsonValue },
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
    const created = await this.prisma.admissionApplication.create({
      data: {
        tenantId: actor.tenantId,
        status: 'DRAFT',
        firstNameEn: dto.firstNameEn.trim(),
        lastNameEn: dto.lastNameEn.trim(),
        firstNameNp: dto.firstNameNp?.trim() || null,
        lastNameNp: dto.lastNameNp?.trim() || null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        guardianFullName: dto.guardianFullName?.trim() || null,
        guardianRelation: dto.guardianRelation?.trim() || null,
        guardianPhone: dto.guardianPhone?.trim() || null,
        guardianEmail: dto.guardianEmail?.trim() || null,
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

  async updateCase(caseId: string, dto: UpdateAdmissionCaseDto, actor: AuthContext) {
    const current = await this.findTenantCase(caseId, actor);
    if (TERMINAL_STATUSES.has(current.status)) {
      throw new BadRequestException(
        'This admission case is closed and cannot be edited. Use a correction workflow if information must change.',
      );
    }

    const metadata = this.mergeMetadata(this.readMetadata(current.duplicateReview), dto);
    const updated = await this.prisma.admissionApplication.update({
      where: { id: current.id },
      data: {
        firstNameEn: this.requiredString(dto.firstNameEn, current.firstNameEn),
        lastNameEn: this.requiredString(dto.lastNameEn, current.lastNameEn),
        firstNameNp: this.optionalString(dto.firstNameNp, current.firstNameNp),
        lastNameNp: this.optionalString(dto.lastNameNp, current.lastNameNp),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : current.dateOfBirth,
        gender: dto.gender ?? current.gender,
        guardianFullName: this.optionalString(dto.guardianFullName, current.guardianFullName),
        guardianRelation: this.optionalString(dto.guardianRelation, current.guardianRelation),
        guardianPhone: this.optionalString(dto.guardianPhone, current.guardianPhone),
        guardianEmail: this.optionalString(dto.guardianEmail, current.guardianEmail),
        academicYearId: dto.academicYearId ?? current.academicYearId,
        classId: dto.classId ?? current.classId,
        sectionId: dto.sectionId ?? current.sectionId,
        previousSchool: this.optionalString(dto.previousSchool, current.previousSchool),
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
        duplicateReview: this.persistedMetadata(metadata, evaluation) as Prisma.InputJsonValue,
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

  async reviewCase(caseId: string, dto: ReviewAdmissionCaseDto, actor: AuthContext) {
    const current = await this.findTenantCase(caseId, actor);
    if (TERMINAL_STATUSES.has(current.status)) {
      throw new BadRequestException('This admission case is no longer open for review.');
    }
    if (['REQUEST_INFORMATION', 'REJECT'].includes(dto.action) && !dto.reason?.trim()) {
      throw new BadRequestException('A clear reason is required for this action.');
    }
    if (dto.reviewerUserId) {
      const reviewer = await this.prisma.user.findFirst({
        where: { id: dto.reviewerUserId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!reviewer) {
        throw new BadRequestException('The selected reviewer does not belong to this school.');
      }
    }

    const evaluation = await this.evaluate(current, actor);
    if (dto.action === 'APPROVE') {
      const documentBlock =
        evaluation.missingRequiredDocuments.length > 0 &&
        !evaluation.policyRequirements.allowAdmissionWithDocumentsPending;
      const capacityBlock = this.capacityBlocksAdmission(evaluation);
      if (evaluation.missingRequiredFields.length > 0 || documentBlock || capacityBlock) {
        throw new BadRequestException('Resolve the blocking admission requirements before approving this case.');
      }
      if (evaluation.duplicateRisk && !dto.reason?.trim()) {
        throw new BadRequestException('Record the duplicate review decision before approving this case.');
      }
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

    const statusByAction: Record<ReviewAdmissionCaseDto['action'], string> = {
      REQUEST_INFORMATION: 'NEEDS_INFORMATION',
      ASSIGN_REVIEWER: 'WAITING_FOR_REVIEW',
      MARK_READY_FOR_REVIEW: 'WAITING_FOR_REVIEW',
      APPROVE: 'APPROVED',
      REJECT: 'NOT_ADMITTED',
      ESCALATE_TO_PRINCIPAL: 'WAITING_FOR_REVIEW',
      CLOSE: 'CLOSED',
    };
    const nextStatus = statusByAction[dto.action];

    await this.prisma.admissionApplication.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        rejectedReason: dto.action === 'REJECT' ? dto.reason!.trim() : null,
        duplicateReview: nextMetadata as Prisma.InputJsonValue,
        updatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: `admission_case_${dto.action.toLowerCase()}`,
      resource: 'admission_case',
      resourceId: current.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { status: current.status },
      after: { status: nextStatus, reason: dto.reason?.trim() ?? null },
    });

    return this.getCase(current.id, actor);
  }

  async directAdmit(caseId: string, dto: DirectAdmitAdmissionCaseDto, actor: AuthContext) {
    return this.admit(caseId, dto, actor, false);
  }

  async finalizeApprovedCase(caseId: string, dto: FinalizeAdmissionCaseDto, actor: AuthContext) {
    return this.admit(caseId, dto, actor, true);
  }

  private async admit(
    caseId: string,
    dto: DirectAdmitAdmissionCaseDto | FinalizeAdmissionCaseDto,
    actor: AuthContext,
    approvedFinalization: boolean,
  ) {
    let current = await this.findTenantCase(caseId, actor);
    if (this.displayStatus(current.status) === 'ADMITTED' && current.convertedStudentId) {
      return this.admittedResult(current.convertedStudentId, current.id, actor, true);
    }

    if (this.hasCaseUpdates(dto)) {
      await this.updateCase(caseId, dto, actor);
      current = await this.findTenantCase(caseId, actor);
    }

    const displayStatus = this.displayStatus(current.status);
    if (approvedFinalization && displayStatus !== 'APPROVED') {
      throw new BadRequestException('Only approved admission cases can be finalized.');
    }

    const evaluation = await this.evaluate(current, actor);
    const documentBlock =
      evaluation.missingRequiredDocuments.length > 0 &&
      !evaluation.policyRequirements.allowAdmissionWithDocumentsPending;
    if (evaluation.missingRequiredFields.length > 0 || documentBlock) {
      throw new BadRequestException({
        message: 'Complete the required admission information before admitting this student.',
        missingRequiredFields: evaluation.missingRequiredFields,
        missingRequiredDocuments: documentBlock ? evaluation.missingRequiredDocuments : [],
      });
    }
    if (this.capacityBlocksAdmission(evaluation)) {
      throw new BadRequestException('The selected section is full. Choose another section before admission.');
    }

    const reviewIsApproved = displayStatus === 'APPROVED';
    if (evaluation.requiresReview && !reviewIsApproved) {
      await this.prisma.admissionApplication.update({
        where: { id: current.id },
        data: { status: 'WAITING_FOR_REVIEW', updatedById: actor.userId },
      });
      throw new BadRequestException('This admission needs review before it can be finalized.');
    }
    if (evaluation.duplicateRisk && !reviewIsApproved && !dto.overrideDuplicate) {
      throw new ConflictException({
        message: 'Possible duplicate students need review before admission.',
        admissionCaseId: current.id,
        duplicateCandidates: evaluation.duplicateCandidates,
      });
    }
    if (dto.overrideDuplicate) {
      if (!dto.overrideReason?.trim()) {
        throw new BadRequestException('Provide a reason before overriding a duplicate warning.');
      }
      if (!actor.permissions?.includes('students:manage_lifecycle')) {
        throw new ForbiddenException('You do not have permission to override a duplicate warning.');
      }
    }

    const placement = await this.validatePlacement(current, actor, true);
    const metadata = this.readMetadata(current.duplicateReview);
    await this.validateDocumentReferences(metadata.documents ?? [], actor);
    const followUps = this.followUps(metadata, evaluation);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const claim = await tx.admissionApplication.updateMany({
          where: {
            id: current.id,
            tenantId: actor.tenantId,
            convertedStudentId: null,
            status: { in: ADMITTABLE_STORAGE_STATUSES },
          },
          data: { status: 'FINALIZING', updatedById: actor.userId },
        });
        if (claim.count !== 1) {
          const existing = await tx.admissionApplication.findFirst({
            where: { id: current.id, tenantId: actor.tenantId },
            select: { convertedStudentId: true },
          });
          if (existing?.convertedStudentId) {
            return { studentId: existing.convertedStudentId, alreadyAdmitted: true };
          }
          throw new ConflictException('This admission case changed while it was being admitted. Refresh and try again.');
        }

        const student = await tx.student.create({
          data: {
            tenantId: actor.tenantId,
            studentSystemId: this.newStudentSystemId(),
            firstNameEn: current.firstNameEn,
            lastNameEn: current.lastNameEn,
            firstNameNp: current.firstNameNp,
            lastNameNp: current.lastNameNp,
            dateOfBirth: current.dateOfBirth!,
            gender: current.gender!,
            admissionDate: this.admissionDate(metadata),
            classId: placement.classroom.id,
            sectionId: placement.section?.id ?? null,
            section: placement.section?.name ?? null,
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

        const phone = this.normalizePhone(current.guardianPhone!);
        const existingGuardian = await tx.guardian.findUnique({
          where: {
            tenantId_primaryPhone: {
              tenantId: actor.tenantId,
              primaryPhone: phone,
            },
          },
          select: { id: true },
        });
        const guardian = existingGuardian
          ? await tx.guardian.update({
              where: { id: existingGuardian.id },
              data: {
                fullName: current.guardianFullName!,
                relation: current.guardianRelation!,
                email: current.guardianEmail,
                receivesAlerts: metadata.guardianReceivesAlerts ?? true,
              },
            })
          : await tx.guardian.create({
              data: {
                tenantId: actor.tenantId,
                fullName: current.guardianFullName!,
                relation: current.guardianRelation!,
                primaryPhone: phone,
                email: current.guardianEmail,
                receivesAlerts: metadata.guardianReceivesAlerts ?? true,
                privacyConsentAt: new Date(),
              },
            });

        await tx.studentGuardian.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            guardianId: guardian.id,
            relation: current.guardianRelation!,
            isPrimary: true,
          },
        });

        const enrollment = await tx.enrollment.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            academicYearId: placement.academicYear.id,
            classId: placement.classroom.id,
            sectionId: placement.section?.id ?? null,
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

        await tx.admissionApplication.update({
          where: { id: current.id },
          data: {
            status: 'ADMITTED',
            convertedStudentId: student.id,
            duplicateReview: {
              ...this.persistedMetadata(metadata, evaluation),
              followUps,
            } as Prisma.InputJsonValue,
            updatedById: actor.userId,
          },
        });

        await tx.auditLog.create({
          data: {
            action: approvedFinalization ? 'admission_case_finalize' : 'admission_case_direct_admit',
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
              duplicateOverrideReason: dto.overrideDuplicate ? dto.overrideReason?.trim() : null,
              documentReferenceCount: metadata.documents?.length ?? 0,
              followUpCodes: followUps.map((item) => item.code),
            },
          },
        });

        return { studentId: student.id, alreadyAdmitted: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.admittedResult(result.studentId, current.id, actor, result.alreadyAdmitted);
  }

  private async formatCase(record: AdmissionCaseRecord, actor: AuthContext) {
    const metadata = this.readMetadata(record.duplicateReview);
    const evaluation = await this.evaluate(record, actor);
    const displayStatus = this.displayStatus(record.status);
    const reviewComplete = displayStatus === 'APPROVED' || displayStatus === 'ADMITTED';
    return {
      id: record.id,
      source: record.source ?? 'OFFICE_WALK_IN',
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
      transferStudent: metadata.transferStudent ?? record.source === 'TRANSFER_REQUEST',
      previousSchool: record.previousSchool,
      notes: record.notes,
      documents: (metadata.documents ?? []).map((document) => ({
        fileId: document.fileId,
        kind: document.kind,
        title: document.title ?? null,
      })),
      displayStatus,
      storageStatus: record.status,
      missingRequiredFields: evaluation.missingRequiredFields,
      missingRequiredDocuments: evaluation.missingRequiredDocuments,
      duplicateRisk: evaluation.duplicateRisk,
      duplicateCandidates: evaluation.duplicateCandidates,
      policyRequirements: evaluation.policyRequirements,
      canAdmitDirectly: evaluation.canAdmitDirectly && !reviewComplete,
      requiresReview: evaluation.requiresReview && !reviewComplete,
      requiresApproval: evaluation.requiresApproval && !reviewComplete,
      classSection: evaluation.classSection,
      capacityStatus: evaluation.capacityStatus,
      nextActionLabel: this.nextActionLabel(record, evaluation, displayStatus),
      followUps: metadata.followUps ?? this.followUps(metadata, evaluation),
      review: metadata.review ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      admittedStudentId: record.convertedStudentId,
    };
  }

  private async evaluate(record: AdmissionCaseRecord, actor: AuthContext): Promise<AdmissionEvaluation> {
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
      dateOfBirth: record.dateOfBirth,
      gender: record.gender,
      guardianFullName: record.guardianFullName,
      guardianRelation: record.guardianRelation,
      guardianPhone: record.guardianPhone,
      academicYearId: record.academicYearId,
      classId: record.classId,
      sectionId: record.sectionId,
    };
    const missingRequiredFields = [...requiredFields].filter((field) => !fieldValues[field]);
    const requiredDocuments = this.requiredDocuments(policy, metadata, record.source);
    const documentKinds = new Set((metadata.documents ?? []).map((document) => document.kind.toUpperCase()));
    const missingRequiredDocuments = requiredDocuments.filter((kind) => !documentKinds.has(kind));

    const placement = await this.validatePlacement(record, actor, false);
    const duplicateCandidates = await this.findDuplicateCandidates(record, actor);
    const duplicateRisk = duplicateCandidates.length > 0;
    const documentBlocksAdmission =
      missingRequiredDocuments.length > 0 && !policy.allowAdmissionWithDocumentsPending;
    const capacityBlocksAdmission =
      policy.enforceCapacityWhenAvailable === true && placement.capacityStatus?.state === 'FULL';
    const requiresApproval = policy.requirePrincipalApproval === true;
    const requiresReview =
      policy.admissionMode === 'REVIEW_REQUIRED' ||
      policy.requireDocumentReview === true ||
      policy.requireInterview === true ||
      policy.requireStreamOrMarksReview === true ||
      requiresApproval ||
      duplicateRisk;
    const canAdmitDirectly =
      !record.convertedStudentId &&
      missingRequiredFields.length === 0 &&
      !documentBlocksAdmission &&
      !capacityBlocksAdmission &&
      !requiresReview;

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
      policyRequirements: {
        admissionMode: policy.admissionMode,
        requireDocumentReview: policy.requireDocumentReview === true,
        requireInterview: policy.requireInterview === true,
        requirePrincipalApproval: requiresApproval,
        allowAdmissionWithDocumentsPending: policy.allowAdmissionWithDocumentsPending === true,
        enforceCapacityWhenAvailable: policy.enforceCapacityWhenAvailable === true,
        requiredDocuments,
        requiredFields: [...requiredFields],
      },
      canAdmitDirectly,
      requiresReview,
      requiresApproval,
      classSection: placement.classSection,
      capacityStatus: placement.capacityStatus,
      suggestedStatus,
      nextActionLabel: canAdmitDirectly ? 'Admit student' : 'Review admission',
    };
  }

  private async resolvePolicy(record: AdmissionCaseRecord, metadata: StoredCaseMetadata, actor: AuthContext) {
    const configured = await this.loadPolicy(actor.tenantId);
    const classroom = record.classId
      ? await this.prisma.class.findFirst({
          where: { id: record.classId, tenantId: actor.tenantId },
          select: { level: true },
        })
      : null;
    const gradeBand = this.gradeBand(classroom?.level ?? null);
    const transferStudent = metadata.transferStudent ?? record.source === 'TRANSFER_REQUEST';
    const matchingOverride = configured.overrides
      .map((rule) => ({ rule, score: this.policyScore(rule, record, gradeBand, transferStudent) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => right.score - left.score)[0]?.rule;
    return { ...configured.defaultPolicy, ...(matchingOverride ?? {}) };
  }

  private async validatePlacement(record: AdmissionCaseRecord, actor: AuthContext, throwOnInvalid: boolean) {
    if (!record.academicYearId || !record.classId) {
      if (throwOnInvalid) throw new BadRequestException('Choose an academic year and class before admission.');
      return {
        academicYear: null,
        classroom: null,
        section: null,
        classSection: { valid: false, message: 'Academic year and class are required.' },
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
      this.prisma.section.count({ where: { tenantId: actor.tenantId, classId: record.classId } }),
    ]);

    if (!academicYear || !classroom || (record.sectionId && (!section || section.classId !== record.classId))) {
      if (throwOnInvalid) {
        throw new BadRequestException('The selected academic year, class, or section is not valid for this school.');
      }
      return {
        academicYear: null,
        classroom: null,
        section: null,
        classSection: { valid: false, message: 'Choose a valid class and section for this school.' },
        capacityStatus: null as CapacityStatus | null,
      };
    }

    let capacityStatus: CapacityStatus | null = null;
    if (section?.capacity != null) {
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
      classSection: {
        valid: true,
        sectionRequired: sectionCount > 0,
        message: sectionCount > 0 && !section ? 'Select a section for this class.' : null,
      },
      capacityStatus,
    };
  }

  private async findDuplicateCandidates(record: AdmissionCaseRecord, actor: AuthContext) {
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
          some: { guardian: { primaryPhone: this.normalizePhone(record.guardianPhone) } },
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

  private async validateDocumentReferences(documents: StoredDocumentReference[], actor: AuthContext) {
    if (!documents.length) return;
    const distinctIds = [...new Set(documents.map((document) => document.fileId))];
    const files = await this.prisma.fileAsset.findMany({
      where: { tenantId: actor.tenantId, id: { in: distinctIds }, softDeletedAt: null },
      select: { id: true },
    });
    if (files.length !== distinctIds.length) {
      throw new BadRequestException('One or more admission documents are unavailable for this school. Upload them again before admission.');
    }
  }

  private async admittedResult(studentId: string, admissionCaseId: string, actor: AuthContext, alreadyAdmitted: boolean) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: { id: true, studentSystemId: true, firstNameEn: true, lastNameEn: true },
    });
    if (!student) throw new NotFoundException('The admitted student could not be found in this school.');
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
    return (LEGACY_DISPLAY_STATUS[status] ?? status) as AdmissionDisplayStatus;
  }

  private nextStatusAfterSave(status: string, evaluation: AdmissionEvaluation) {
    if (TERMINAL_STATUSES.has(status) || REVIEW_LOCKED_STATUSES.has(status) || status in LEGACY_DISPLAY_STATUS) {
      return status;
    }
    return evaluation.suggestedStatus;
  }

  private nextActionLabel(record: AdmissionCaseRecord, evaluation: AdmissionEvaluation, displayStatus: AdmissionDisplayStatus) {
    if (record.convertedStudentId || displayStatus === 'ADMITTED') return 'Open student profile';
    if (displayStatus === 'APPROVED') return 'Finalize admission';
    if (evaluation.missingRequiredFields.length > 0) return 'Complete required information';
    if (evaluation.missingRequiredDocuments.length > 0 && !evaluation.policyRequirements.allowAdmissionWithDocumentsPending) return 'Add required documents';
    if (this.capacityBlocksAdmission(evaluation)) return 'Choose another section';
    if (evaluation.duplicateRisk) return 'Review duplicate warning';
    if (evaluation.requiresReview) return 'Send for review';
    return 'Admit student';
  }

  private capacityBlocksAdmission(evaluation: AdmissionEvaluation) {
    return evaluation.policyRequirements.enforceCapacityWhenAvailable && evaluation.capacityStatus?.state === 'FULL';
  }

  private requiredDocuments(policy: PolicyRule, metadata: StoredCaseMetadata, source: string | null) {
    const documents = new Set((policy.requiredDocuments ?? []).map((value) => value.toUpperCase()));
    if ((metadata.transferStudent || source === 'TRANSFER_REQUEST') && policy.requireTransferCertificate) {
      documents.add('TRANSFER_CERTIFICATE');
    }
    if (policy.requirePriorMarksheet) documents.add('PRIOR_MARKSHEET');
    return [...documents];
  }

  private followUps(metadata: StoredCaseMetadata, evaluation: AdmissionEvaluation) {
    const items: Array<{ code: string; label: string; blocking: boolean }> = [];
    if (evaluation.missingRequiredDocuments.length > 0) {
      items.push({ code: 'DOCUMENTS_PENDING', label: 'Add missing student documents', blocking: false });
    }
    if (!metadata.nationalStudentId) {
      items.push({ code: 'IEMIS_INFORMATION_INCOMPLETE', label: 'Complete IEMIS information', blocking: false });
    }
    items.push({ code: 'GUARDIAN_VERIFICATION_PENDING', label: 'Verify guardian portal access when ready', blocking: false });
    items.push({ code: 'QR_ID_REVIEW', label: 'Review QR and ID card readiness', blocking: false });
    return items;
  }

  private persistedMetadata(metadata: StoredCaseMetadata, evaluation: AdmissionEvaluation): StoredCaseMetadata {
    return {
      ...metadata,
      duplicateRisk: evaluation.duplicateRisk,
      duplicateCandidates: evaluation.duplicateCandidates,
      policySnapshot: evaluation.policyRequirements,
    };
  }

  private mergeMetadata(current: StoredCaseMetadata, dto: Partial<CreateAdmissionCaseDto>): StoredCaseMetadata {
    return {
      ...current,
      schemaVersion: 1,
      transferStudent: dto.transferStudent ?? current.transferStudent,
      guardianReceivesAlerts: dto.guardianReceivesAlerts ?? current.guardianReceivesAlerts,
      admissionDate: dto.admissionDate ?? current.admissionDate,
      mediumOfInstruction: dto.mediumOfInstruction ?? current.mediumOfInstruction,
      rollNumber: dto.rollNumber ?? current.rollNumber,
      nationalStudentId: dto.nationalStudentId ?? current.nationalStudentId,
      emergencyName: dto.emergencyName ?? current.emergencyName,
      emergencyPhone: dto.emergencyPhone ?? current.emergencyPhone,
      medicalConditions: dto.medicalConditions ?? current.medicalConditions,
      documents: dto.documents
        ? dto.documents.map((document) => ({ fileId: document.fileId, kind: document.kind, title: document.title }))
        : current.documents ?? [],
    };
  }

  private async findTenantCase(caseId: string, actor: AuthContext): Promise<AdmissionCaseRecord> {
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
    const defaultPolicy = this.isRecord(root.defaultPolicy) ? root.defaultPolicy : {};
    const overrides = Array.isArray(root.overrides)
      ? root.overrides.filter((rule): rule is Record<string, unknown> => this.isRecord(rule))
      : [];
    return {
      defaultPolicy: { ...DEFAULT_POLICY, ...defaultPolicy } as PolicyRule,
      overrides: overrides.map((rule) => ({ ...DEFAULT_POLICY, ...rule }) as PolicyRule),
    };
  }

  private policyScore(rule: PolicyRule, record: AdmissionCaseRecord, gradeBand: string | null, transferStudent: boolean) {
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
      if (rule.source !== record.source) return -1;
      score += 4;
    }
    if (typeof rule.transferStudent === 'boolean') {
      if (rule.transferStudent !== transferStudent) return -1;
      score += 4;
    }
    return score;
  }

  private gradeBand(level: number | null) {
    if (level == null) return null;
    if (level <= 0) return 'MONTESSORI';
    if (level <= 5) return 'PRIMARY';
    if (level <= 10) return 'BASIC_SECONDARY';
    return 'GRADE_11_12';
  }

  private hasCaseUpdates(dto: DirectAdmitAdmissionCaseDto | FinalizeAdmissionCaseDto) {
    const { overrideDuplicate: _overrideDuplicate, overrideReason: _overrideReason, ...updates } = dto;
    return Object.values(updates).some((value) => typeof value !== 'undefined');
  }

  private readMetadata(value: Prisma.JsonValue | null): StoredCaseMetadata {
    return this.isRecord(value) ? (value as StoredCaseMetadata) : {};
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

  private normalizePhone(value: string) {
    return value.replace(/[^0-9+]/g, '').trim();
  }

  private admissionDate(metadata: StoredCaseMetadata) {
    return metadata.admissionDate ? new Date(metadata.admissionDate) : new Date();
  }

  private newStudentSystemId() {
    return `STU-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
}
