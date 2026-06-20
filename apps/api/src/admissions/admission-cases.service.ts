import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EnrollmentStatus, Prisma, StudentLifecycleStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { encryptSensitiveField } from '../common/security/field-encryption';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdmissionPolicyRuleDto,
  CreateAdmissionCaseDto,
  DirectAdmitAdmissionCaseDto,
  FinalizeAdmissionCaseDto,
  ReviewAdmissionCaseDto,
  UpdateAdmissionCaseDto,
  UpdateAdmissionPolicyDto,
} from './dto/admission-case.dto';

const ADMISSION_POLICY_SETTING_KEY = 'admissions.policy.v1';
const DIRECT_CASE_STATUSES = ['DRAFT', 'NEEDS_INFORMATION', 'READY_TO_ADMIT'] as const;
const TERMINAL_CASE_STATUSES = ['ADMITTED', 'NOT_ADMITTED', 'CLOSED'] as const;

type AdmissionCaseStatus =
  | 'DRAFT'
  | 'NEEDS_INFORMATION'
  | 'READY_TO_ADMIT'
  | 'WAITING_FOR_REVIEW'
  | 'APPROVED'
  | 'ADMITTED'
  | 'NOT_ADMITTED'
  | 'CLOSED';

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
  documents?: Array<{ fileId: string; kind: string; title?: string }>;
  review?: {
    reviewerUserId?: string;
    dueDate?: string;
    notes?: Array<{ action: string; reason?: string; at: string; byUserId: string }>;
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

type AdmissionPolicy = { defaultPolicy: PolicyRule; overrides: PolicyRule[] };

type AdmissionCaseRecord = {
  id: string;
  tenantId: string;
  status: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp: string | null;
  lastNameNp: string | null;
  dateOfBirth: Date | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
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

const DEFAULT_POLICY: PolicyRule = {
  admissionMode: 'DIRECT_ALLOWED',
  allowAdmissionWithDocumentsPending: true,
  requireDocumentReview: false,
  requireInterview: false,
  requirePrincipalApproval: false,
  requireTransferCertificate: false,
  requirePriorMarksheet: false,
  requireStreamOrMarksReview: false,
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
      after: { defaultMode: policy.defaultPolicy.admissionMode, overrides: policy.overrides.length },
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

    const admissionCase = await this.getCase(created.id, actor);
    await this.auditService.record({
      action: 'admission_case_create',
      resource: 'admission_case',
      resourceId: created.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { source: created.source, displayStatus: admissionCase.displayStatus },
    });
    return admissionCase;
  }

  async updateCase(caseId: string, dto: UpdateAdmissionCaseDto, actor: AuthContext) {
    const current = await this.findTenantCase(caseId, actor);
    if (TERMINAL_CASE_STATUSES.includes(current.status as (typeof TERMINAL_CASE_STATUSES)[number])) {
      throw new BadRequestException('This admission case is closed and cannot be edited. Use a correction workflow if information must change.');
    }

    const nextMetadata = this.mergeMetadata(this.readMetadata(current.duplicateReview), dto);
    await this.prisma.admissionApplication.update({
      where: { id: current.id },
      data: {
        firstNameEn: dto.firstNameEn?.trim() || current.firstNameEn,
        lastNameEn: dto.lastNameEn?.trim() || current.lastNameEn,
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
        duplicateReview: nextMetadata as Prisma.InputJsonValue,
        updatedById: actor.userId,
      },
    });

    const result = await this.getCase(caseId, actor);
    if (!['APPROVED', 'ADMITTED', 'NOT_ADMITTED', 'CLOSED'].includes(current.status)) {
      await this.prisma.admissionApplication.update({
        where: { id: current.id },
        data: { status: result.storageStatus, updatedById: actor.userId },
      });
    }

    await this.auditService.record({
      action: 'admission_case_update',
      resource: 'admission_case',
      resourceId: current.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { displayStatus: result.displayStatus },
    });
    return this.getCase(caseId, actor);
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
      displayStatus: this.displayStatus(record.status, evaluation),
      ...evaluation,
    };
  }

  async reviewCase(caseId: string, dto: ReviewAdmissionCaseDto, actor: AuthContext) {
    const current = await this.findTenantCase(caseId, actor);
    if (['ADMITTED', 'NOT_ADMITTED', 'CLOSED'].includes(current.status)) {
      throw new BadRequestException('This admission case is no longer open for review.');
    }
    if (['REQUEST_INFORMATION', 'REJECT'].includes(dto.action) && !dto.reason?.trim()) {
      throw new BadRequestException('A clear reason is required for this review action.');
    }

    const metadata = this.readMetadata(current.duplicateReview);
    const notes = metadata.review?.notes ?? [];
    const nextMetadata: StoredCaseMetadata = {
      ...metadata,
      review: {
        reviewerUserId: dto.reviewerUserId ?? metadata.review?.reviewerUserId,
        dueDate: dto.dueDate ?? metadata.review?.dueDate,
        notes: [
          ...notes,
          { action: dto.action, reason: dto.reason?.trim(), at: new Date().toISOString(), byUserId: actor.userId },
        ],
      },
    };

    const statusByAction: Record<(typeof dto)['action'], string> = {
      REQUEST_INFORMATION: 'NEEDS_INFORMATION',
      ASSIGN_REVIEWER: 'WAITING_FOR_REVIEW',
      MARK_READY_FOR_REVIEW: 'WAITING_FOR_REVIEW',
      APPROVE: 'APPROVED',
      REJECT: 'NOT_ADMITTED',
      ESCALATE_TO_PRINCIPAL: 'WAITING_FOR_REVIEW',
      CLOSE: 'CLOSED',
    };
    const nextStatus = statusByAction[dto.action];

    const updated = await this.prisma.admissionApplication.update({
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
      after: { status: updated.status, reason: dto.reason?.trim() ?? null, reviewerUserId: dto.reviewerUserId ?? null },
    });
    return this.getCase(current.id, actor);
  }

  async directAdmit(caseId: string, dto: DirectAdmitAdmissionCaseDto, actor: AuthContext) {
    await this.updateCase(caseId, dto, actor);
    const current = await this.findTenantCase(caseId, actor);
    if (current.status === 'ADMITTED' && current.convertedStudentId) {
      return this.admittedResult(current.convertedStudentId, current.id, actor, true);
    }

    const evaluation = await this.evaluate(current, actor);
    if (evaluation.missingRequiredFields.length > 0 || evaluation.missingRequiredDocuments.length > 0) {
      throw new BadRequestException({
        message: 'Complete the required admission information before admitting this student.',
        missingRequiredFields: evaluation.missingRequiredFields,
        missingRequiredDocuments: evaluation.missingRequiredDocuments,
      });
    }
    if (evaluation.requiresReview) {
      await this.prisma.admissionApplication.update({
        where: { id: current.id },
        data: { status: 'WAITING_FOR_REVIEW', updatedById: actor.userId },
      });
      throw new BadRequestException('This admission needs review before it can be finalized.');
    }
    if (evaluation.duplicateRisk && !dto.overrideDuplicate) {
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
      if (!actor.permissions.includes('students:manage_lifecycle')) {
        throw new ForbiddenException('You do not have permission to override a duplicate warning.');
      }
    }

    const placement = await this.validatePlacement(current, actor);
    const metadata = this.readMetadata(current.duplicateReview);
    const documentRefs = metadata.documents ?? [];
    await this.validateDocumentReferences(documentRefs, actor);

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.admissionApplication.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          convertedStudentId: null,
          status: { in: [...DIRECT_CASE_STATUSES, 'APPROVED'] },
        },
        data: { status: 'FINALIZING', updatedById: actor.userId },
      });
      if (claim.count !== 1) {
        const retry = await tx.admissionApplication.findFirst({
          where: { id: current.id, tenantId: actor.tenantId },
          select: { convertedStudentId: true, status: true },
        });
        if (retry?.convertedStudentId) return { studentId: retry.convertedStudentId, alreadyAdmitted: true };
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
          admissionDate: this.caseAdmissionDate(metadata),
          classId: placement.classroom.id,
          sectionId: placement.section?.id ?? null,
          section: placement.section?.name ?? null,
          rollNumber: metadata.rollNumber ?? null,
          previousSchool: current.previousSchool,
          mediumOfInstruct: metadata.mediumOfInstruction ?? 'English',
          nationalStudentId: metadata.nationalStudentId ?? null,
          emergencyName: metadata.emergencyName ?? null,
          emergencyPhone: metadata.emergencyPhone ?? null,
          medicalConditions: encryptSensitiveField(metadata.medicalConditions, this.configService.medicalEncryptionKey),
          privacyConsentAt: new Date(),
          dataProcessingConsentedAt: new Date(),
          medicalConsentAt: metadata.medicalConditions ? new Date() : null,
        },
      });

      const guardian = await tx.guardian.upsert({
        where: {
          tenantId_primaryPhone: {
            tenantId: actor.tenantId,
            primaryPhone: this.normalizePhone(current.guardianPhone!),
          },
        },
        create: {
          tenantId: actor.tenantId,
          fullName: current.guardianFullName!,
          relation: current.guardianRelation!,
          primaryPhone: this.normalizePhone(current.guardianPhone!),
          email: current.guardianEmail,
          receivesAlerts: metadata.guardianReceivesAlerts ?? true,
          privacyConsentAt: new Date(),
        },
        update: {
          fullName: current.guardianFullName!,
          relation: current.guardianRelation!,
          email: current.guardianEmail,
          receivesAlerts: metadata.guardianReceivesAlerts ?? true,
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
          admissionDate: this.caseAdmissionDate(metadata),
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

      const followUps = this.followUps(current, metadata, evaluation);
      const completed = await tx.admissionApplication.update({
        where: { id: current.id },
        data: {
          status: 'ADMITTED',
          convertedStudentId: student.id,
          duplicateReview: {
            ...metadata,
            policySnapshot: evaluation.policyRequirements,
            followUps,
          } as Prisma.InputJsonValue,
          updatedById: actor.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'admission_case_direct_admit',
          resource: 'admission_case',
          resourceId: current.id,
          tenantId: actor.tenantId,
          userId: actor.userId,
          before: { status: current.status },
          after: {
            status: completed.status,
            studentId: student.id,
            guardianId: guardian.id,
            enrollmentId: enrollment.id,
            duplicateOverride: dto.overrideDuplicate ?? false,
            duplicateOverrideReason: dto.overrideDuplicate ? dto.overrideReason?.trim() : null,
            documentReferenceCount: documentRefs.length,
          },
        },
      });

      return { studentId: student.id, alreadyAdmitted: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return this.admittedResult(result.studentId, current.id, actor, result.alreadyAdmitted);
  }

  async finalizeApprovedCase(caseId: string, dto: FinalizeAdmissionCaseDto, actor: AuthContext) {
    const current = await this.findTenantCase(caseId, actor);
    if (!['APPROVED', 'ACCEPTED'].includes(current.status)) {
      throw new BadRequestException('Only approved admission cases can be finalized.');
    }
    if (current.convertedStudentId) {
      return this.admittedResult(current.convertedStudentId, current.id, actor, true);
    }
    return this.directAdmit(caseId, { ...dto, overrideDuplicate: dto.overrideDuplicate ?? false }, actor);
  }

  private async formatCase(record: AdmissionCaseRecord, actor: AuthContext) {
    const evaluation = await this.evaluate(record, actor);
    const metadata = this.readMetadata(record.duplicateReview);
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
      displayStatus: this.displayStatus(record.status, evaluation),
      storageStatus: this.storageStatus(record.status, evaluation),
      missingRequiredFields: evaluation.missingRequiredFields,
      missingRequiredDocuments: evaluation.missingRequiredDocuments,
      duplicateRisk: evaluation.duplicateRisk,
      duplicateCandidates: evaluation.duplicateCandidates,
      policyRequirements: evaluation.policyRequirements,
      canAdmitDirectly: evaluation.canAdmitDirectly,
      requiresReview: evaluation.requiresReview,
      requiresApproval: evaluation.requiresApproval,
      classSection: evaluation.classSection,
      capacityStatus: evaluation.capacityStatus,
      nextActionLabel: evaluation.nextActionLabel,
      followUps: metadata.followUps ?? this.followUps(record, metadata, evaluation),
      review: metadata.review ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      admittedStudentId: record.convertedStudentId,
    };
  }

  private async evaluate(record: AdmissionCaseRecord, actor: AuthContext) {
    const metadata = this.readMetadata(record.duplicateReview);
    const policy = await this.resolvePolicy(record, metadata, actor);
    const requiredFields = new Set([
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
    const values: Record<string, unknown> = {
      dateOfBirth: record.dateOfBirth,
      gender: record.gender,
      guardianFullName: record.guardianFullName,
      guardianRelation: record.guardianRelation,
      guardianPhone: record.guardianPhone,
      academicYearId: record.academicYearId,
      classId: record.classId,
      sectionId: record.sectionId,
    };
    const missingRequiredFields = [...requiredFields].filter((field) => !values[field]);

    const requiredDocuments = this.requiredDocuments(policy, metadata);
    const presentKinds = new Set((metadata.documents ?? []).map((document) => document.kind.toUpperCase()));
    const missingRequiredDocuments = requiredDocuments.filter((document) => !presentKinds.has(document.toUpperCase()));

    const placement = await this.validatePlacement(record, actor, false);
    const duplicateCandidates = await this.findDuplicateCandidates(record, actor);
    const duplicateRisk = duplicateCandidates.length > 0;
    const documentsBlock = !policy.allowAdmissionWithDocumentsPending && missingRequiredDocuments.length > 0;
    const capacityBlocked = placement.capacityStatus?.state === 'FULL';
    const requiresApproval = Boolean(policy.requirePrincipalApproval);
    const requiresReview = Boolean(
      policy.admissionMode === 'REVIEW_REQUIRED' ||
      policy.requireDocumentReview ||
      policy.requireInterview ||
      policy.requireStreamOrMarksReview ||
      requiresApproval ||
      duplicateRisk,
    );
    const canAdmitDirectly =
      missingRequiredFields.length === 0 &&
      !documentsBlock &&
      !capacityBlocked &&
      !requiresReview &&
      !record.convertedStudentId;

    const nextActionLabel = record.convertedStudentId
      ? 'Open student profile'
      : missingRequiredFields.length > 0 || documentsBlock
        ? 'Complete required information'
        : capacityBlocked
          ? 'Choose another section'
          : duplicateRisk
            ? 'Review duplicate warning'
            : requiresReview
              ? 'Send for review'
              : 'Admit student';

    return {
      missingRequiredFields,
      missingRequiredDocuments,
      duplicateRisk,
      duplicateCandidates,
      policyRequirements: {
        admissionMode: policy.admissionMode,
        requireDocumentReview: Boolean(policy.requireDocumentReview),
        requireInterview: Boolean(policy.requireInterview),
        requirePrincipalApproval: requiresApproval,
        allowAdmissionWithDocumentsPending: Boolean(policy.allowAdmissionWithDocumentsPending),
      },
      canAdmitDirectly,
      requiresReview,
      requiresApproval,
      classSection: placement.classSection,
      capacityStatus: placement.capacityStatus,
      nextActionLabel,
      suggestedStatus: record.convertedStudentId
        ? 'ADMITTED'
        : missingRequiredFields.length > 0 || documentsBlock
          ? 'NEEDS_INFORMATION'
          : requiresReview
            ? 'WAITING_FOR_REVIEW'
            : 'READY_TO_ADMIT',
    };
  }

  private async resolvePolicy(record: AdmissionCaseRecord, metadata: StoredCaseMetadata, actor: AuthContext) {
    const policy = await this.loadPolicy(actor.tenantId);
    const classroom = record.classId
      ? await this.prisma.class.findFirst({ where: { id: record.classId, tenantId: actor.tenantId }, select: { id: true, level: true } })
      : null;
    const gradeBand = this.gradeBand(classroom?.level ?? null);
    const transferStudent = metadata.transferStudent ?? record.source === 'TRANSFER_REQUEST';
    const candidates = policy.overrides
      .map((rule) => ({ rule, score: this.policyScore(rule, record, gradeBand, transferStudent) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => right.score - left.score);
    return { ...policy.defaultPolicy, ...(candidates[0]?.rule ?? {}) };
  }

  private async validatePlacement(record: AdmissionCaseRecord, actor: AuthContext, throwOnInvalid = true) {
    if (!record.academicYearId || !record.classId) {
      if (throwOnInvalid) throw new BadRequestException('Choose an academic year and class before admission.');
      return { academicYear: null, classroom: null, section: null, classSection: { valid: false, message: 'Academic year and class are required.' }, capacityStatus: null };
    }
    const [academicYear, classroom, section, sectionCount] = await Promise.all([
      this.prisma.academicYear.findFirst({ where: { id: record.academicYearId, tenantId: actor.tenantId }, select: { id: true, name: true } }),
      this.prisma.class.findFirst({ where: { id: record.classId, tenantId: actor.tenantId }, select: { id: true, name: true } }),
      record.sectionId ? this.prisma.section.findFirst({ where: { id: record.sectionId, tenantId: actor.tenantId }, select: { id: true, name: true, classId: true, capacity: true } }) : Promise.resolve(null),
      this.prisma.section.count({ where: { tenantId: actor.tenantId, classId: record.classId } }),
    ]);
    if (!academicYear || !classroom || (record.sectionId && (!section || section.classId !== record.classId))) {
      if (throwOnInvalid) throw new BadRequestException('The selected academic year, class, or section is not valid for this school.');
      return { academicYear: null, classroom: null, section: null, classSection: { valid: false, message: 'Choose a valid class and section for this school.' }, capacityStatus: null };
    }
    let capacityStatus: { state: 'NOT_CONFIGURED' | 'AVAILABLE' | 'FULL'; capacity: number | null; enrolled: number | null } | null = null;
    if (section?.capacity != null) {
      const enrolled = await this.prisma.enrollment.count({ where: { tenantId: actor.tenantId, academicYearId: academicYear.id, sectionId: section.id, status: EnrollmentStatus.ACTIVE } });
      capacityStatus = { state: enrolled >= section.capacity ? 'FULL' : 'AVAILABLE', capacity: section.capacity, enrolled };
    }
    return {
      academicYear,
      classroom,
      section,
      classSection: { valid: true, sectionRequired: sectionCount > 0, message: sectionCount > 0 && !section ? 'Select a section for this class.' : null },
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
        guardianLinks: { some: { guardian: { primaryPhone: this.normalizePhone(record.guardianPhone) } } },
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
    return matches.map((candidate) => ({
      studentId: candidate.id,
      studentSystemId: candidate.studentSystemId,
      fullNameEn: `${candidate.firstNameEn} ${candidate.lastNameEn}`.trim(),
      className: candidate.class.name,
      sectionName: candidate.sectionRef?.name ?? null,
      lifecycleStatus: candidate.lifecycleStatus,
    }));
  }

  private async validateDocumentReferences(documents: Array<{ fileId: string }>, actor: AuthContext) {
    if (documents.length === 0) return;
    const assets = await this.prisma.fileAsset.findMany({
      where: { tenantId: actor.tenantId, id: { in: documents.map((document) => document.fileId) }, softDeletedAt: null },
      select: { id: true },
    });
    if (assets.length !== new Set(documents.map((document) => document.fileId)).size) {
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
      student: { id: student.id, studentSystemId: student.studentSystemId, fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim() },
      redirectPath: `/dashboard/students/${student.id}`,
    };
  }

  private displayStatus(status: string, evaluation: Awaited<ReturnType<AdmissionCasesService['evaluate']>>): AdmissionCaseStatus {
    const legacy: Record<string, AdmissionCaseStatus> = {
      INQUIRY: 'DRAFT',
      APPLICATION: 'NEEDS_INFORMATION',
      DOCUMENT_PENDING: 'NEEDS_INFORMATION',
      ENTRANCE_INTERVIEW: 'WAITING_FOR_REVIEW',
      ACCEPTED: 'APPROVED',
      ENROLLED: 'ADMITTED',
      REJECTED: 'NOT_ADMITTED',
      FINALIZING: 'READY_TO_ADMIT',
    };
    return (legacy[status] ?? status ?? evaluation.suggestedStatus) as AdmissionCaseStatus;
  }

  private storageStatus(status: string, evaluation: Awaited<ReturnType<AdmissionCasesService['evaluate']>>) {
    if (['INQUIRY', 'APPLICATION', 'DOCUMENT_PENDING', 'ENTRANCE_INTERVIEW', 'ACCEPTED', 'ENROLLED', 'REJECTED', 'FINALIZING'].includes(status)) return evaluation.suggestedStatus;
    return status || evaluation.suggestedStatus;
  }

  private requiredDocuments(policy: PolicyRule, metadata: StoredCaseMetadata) {
    const required = new Set((policy.requiredDocuments ?? []).map((document) => document.toUpperCase()));
    if (metadata.transferStudent && policy.requireTransferCertificate) required.add('TRANSFER_CERTIFICATE');
    if (policy.requirePriorMarksheet) required.add('PRIOR_MARKSHEET');
    return [...required];
  }

  private followUps(record: AdmissionCaseRecord, metadata: StoredCaseMetadata, evaluation: Awaited<ReturnType<AdmissionCasesService['evaluate']>>) {
    const followUps: Array<{ code: string; label: string; blocking: boolean }> = [];
    if (evaluation.missingRequiredDocuments.length > 0) followUps.push({ code: 'DOCUMENTS_PENDING', label: 'Add missing student documents', blocking: false });
    if (!metadata.nationalStudentId) followUps.push({ code: 'IEMIS_INFORMATION_INCOMPLETE', label: 'Complete IEMIS information', blocking: false });
    followUps.push({ code: 'GUARDIAN_VERIFICATION_PENDING', label: 'Verify guardian portal access when ready', blocking: false });
    return followUps;
  }

  private mergeMetadata(current: StoredCaseMetadata, dto: CreateAdmissionCaseDto): StoredCaseMetadata {
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
      documents: dto.documents ? dto.documents.map((document) => ({ fileId: document.fileId, kind: document.kind, title: document.title })) : current.documents ?? [],
    };
  }

  private async findTenantCase(caseId: string, actor: AuthContext): Promise<AdmissionCaseRecord> {
    const record = await this.prisma.admissionApplication.findFirst({ where: { id: caseId, tenantId: actor.tenantId } });
    if (!record) throw new NotFoundException('Admission case not found.');
    return record;
  }

  private async loadPolicy(tenantId: string): Promise<AdmissionPolicy> {
    const setting = await this.prisma.tenantSetting.findFirst({ where: { tenantId, key: ADMISSION_POLICY_SETTING_KEY }, select: { value: true } });
    return this.normalizePolicy(setting?.value);
  }

  private normalizePolicy(value: unknown): AdmissionPolicy {
    const input = this.isRecord(value) ? value : {};
    const defaultPolicy = this.isRecord(input.defaultPolicy) ? input.defaultPolicy : {};
    const overrides = Array.isArray(input.overrides) ? input.overrides.filter(this.isRecord) : [];
    return {
      defaultPolicy: { ...DEFAULT_POLICY, ...defaultPolicy } as PolicyRule,
      overrides: overrides.map((rule) => ({ ...DEFAULT_POLICY, ...rule } as PolicyRule)),
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

  private readMetadata(value: Prisma.JsonValue | null): StoredCaseMetadata {
    return this.isRecord(value) ? (value as StoredCaseMetadata) : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private optionalString(next: string | undefined, current: string | null) {
    return typeof next === 'undefined' ? current : next.trim() || null;
  }

  private normalizePhone(phone: string) {
    return phone.replace(/[^0-9+]/g, '').trim();
  }

  private caseAdmissionDate(metadata: StoredCaseMetadata) {
    return metadata.admissionDate ? new Date(metadata.admissionDate) : new Date();
  }

  private newStudentSystemId() {
    return `STU-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
}
