import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProfessionalEvidenceStatus,
  StaffEmploymentStatus,
  TeacherProfileStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherProfessionalEligibilityService } from '../teacher-scope/teacher-professional-eligibility.service';
import type {
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

type EvidenceKind = 'qualification' | 'licence';
type Tx = Prisma.TransactionClient;

/**
 * Phase 5J/5K/5L: staff employment, teacher professional profile and
 * qualification/licence evidence.
 *
 * These are facts, not authorization. Holding a Teacher role never creates
 * any of them, and none of them grants SchoolOS access. The database guards
 * (see migration 20260928180000) own lifecycle legality; this service adds
 * tenant scoping, maker-checker, serialized verification and audit.
 *
 * Evidence documents stay protected: responses carry `documentId` only,
 * never a URL. Downloads go through the file registry's own authorization.
 */
@Injectable()
export class ProfessionalIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eligibility: TeacherProfessionalEligibilityService,
  ) {}

  async getOverview(staffId: string, actor: AuthContext) {
    const staff = await this.requireStaff(this.prisma, staffId, actor);
    const [employments, profile, assessments] = await Promise.all([
      this.prisma.staffEmployment.findMany({
        where: { tenantId: actor.tenantId, staffId },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        select: EMPLOYMENT_SELECT,
      }),
      this.prisma.teacherProfile.findFirst({
        where: { tenantId: actor.tenantId, staffId },
        select: {
          id: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
          qualifications: {
            orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
            select: {
              ...EVIDENCE_SELECT,
              qualification: true,
              institution: true,
            },
          },
          licences: {
            orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
            select: {
              ...EVIDENCE_SELECT,
              authorityCode: true,
              externalReference: true,
            },
          },
        },
      }),
      this.prisma.teacherEligibilityAssessment.findMany({
        where: { tenantId: actor.tenantId, staffId },
        orderBy: { evaluatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          outcome: true,
          reasonCode: true,
          evaluatedAt: true,
          validUntil: true,
          policyVersionId: true,
          employmentId: true,
          qualificationId: true,
          licenceId: true,
        },
      }),
    ]);
    const now = new Date();
    const currentEmployment =
      employments.find(
        (row) =>
          row.status === StaffEmploymentStatus.VERIFIED &&
          row.effectiveFrom <= now &&
          (row.effectiveTo === null || row.effectiveTo > now),
      ) ?? null;
    return {
      staffId: staff.id,
      currentEmploymentId: currentEmployment?.id ?? null,
      employments,
      teacherProfile: profile
        ? {
            ...profile,
            qualifications: profile.qualifications.map(withEvidenceState(now)),
            licences: profile.licences.map(withEvidenceState(now)),
          }
        : null,
      recentAssessments: assessments,
      // Explicit: a Teacher role is not evidence of any of the above.
      roleIsNotEvidence: true as const,
    };
  }

  // ---- 5J employment -----------------------------------------------------

  async createEmployment(
    staffId: string,
    dto: CreateStaffEmploymentDto,
    actor: AuthContext,
  ) {
    const effectiveFrom = parseDate(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = dto.effectiveTo
      ? parseDate(dto.effectiveTo, 'effectiveTo')
      : null;
    assertWindow(effectiveFrom, effectiveTo);
    return this.write(async (tx) => {
      await this.requireStaff(tx, staffId, actor);
      const row = await tx.staffEmployment.create({
        data: {
          tenantId: actor.tenantId,
          staffId,
          employmentType: dto.employmentType,
          postCategoryCode: dto.postCategoryCode.trim(),
          schoolTypeCode: dto.schoolTypeCode.trim(),
          localLevelId: dto.localLevelId ?? null,
          effectiveFrom,
          effectiveTo,
          contractId: dto.contractId ?? null,
          policyVersionId: dto.policyVersionId ?? null,
          submittedById: actor.userId,
        },
        select: EMPLOYMENT_SELECT,
      });
      await this.record(
        tx,
        actor,
        'create',
        'staff_employment',
        row.id,
        null,
        row,
      );
      return row;
    });
  }

  async reviewEmployment(
    staffId: string,
    employmentId: string,
    dto: ReviewProfessionalRecordDto,
    actor: AuthContext,
  ) {
    return this.write(async (tx) => {
      const staff = await this.lockStaff(tx, staffId, actor);
      const before = await tx.staffEmployment.findFirst({
        where: { id: employmentId, tenantId: actor.tenantId, staffId },
        select: { ...EMPLOYMENT_SELECT, submittedById: true },
      });
      if (!before) throw new NotFoundException('Employment record not found');
      if (before.status !== StaffEmploymentStatus.PENDING) {
        throw conflict(
          'EMPLOYMENT_NOT_PENDING',
          'Only pending employment can be reviewed',
        );
      }
      assertIndependentReviewer(actor, before.submittedById, staff.userId);
      if (dto.decision === 'VERIFY') {
        const overlap = await tx.staffEmployment.findFirst({
          where: {
            tenantId: actor.tenantId,
            staffId,
            id: { not: employmentId },
            status: StaffEmploymentStatus.VERIFIED,
            effectiveFrom: { lt: before.effectiveTo ?? FAR_FUTURE },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: before.effectiveFrom } },
            ],
          },
          select: { id: true },
        });
        if (overlap) {
          throw conflict(
            'EMPLOYMENT_OVERLAP',
            'Another verified employment period overlaps this one; end it first',
            { overlappingEmploymentId: overlap.id },
          );
        }
      }
      const after = await tx.staffEmployment.update({
        where: { id: employmentId },
        data: {
          status:
            dto.decision === 'VERIFY'
              ? StaffEmploymentStatus.VERIFIED
              : StaffEmploymentStatus.REJECTED,
          verifiedById: actor.userId,
          verifiedAt: new Date(),
        },
        select: EMPLOYMENT_SELECT,
      });
      await this.record(
        tx,
        actor,
        dto.decision === 'VERIFY' ? 'verify' : 'reject',
        'staff_employment',
        employmentId,
        before,
        { ...after, note: dto.note ?? null },
      );
      return after;
    });
  }

  async endEmployment(
    staffId: string,
    employmentId: string,
    dto: EndStaffEmploymentDto,
    actor: AuthContext,
  ) {
    const effectiveTo = parseDate(dto.effectiveTo, 'effectiveTo');
    return this.write(async (tx) => {
      const staff = await this.lockStaff(tx, staffId, actor);
      const before = await tx.staffEmployment.findFirst({
        where: { id: employmentId, tenantId: actor.tenantId, staffId },
        select: EMPLOYMENT_SELECT,
      });
      if (!before) throw new NotFoundException('Employment record not found');
      if (before.status !== StaffEmploymentStatus.VERIFIED) {
        throw conflict(
          'EMPLOYMENT_NOT_VERIFIED',
          'Only verified employment can be ended',
        );
      }
      assertIndependentReviewer(actor, null, staff.userId);
      if (effectiveTo <= before.effectiveFrom) {
        throw new BadRequestException(
          'effectiveTo must be after the employment start',
        );
      }
      if (before.effectiveTo && effectiveTo > before.effectiveTo) {
        throw new BadRequestException(
          'Ending cannot extend a verified employment period',
        );
      }
      const after = await tx.staffEmployment.update({
        where: { id: employmentId },
        data: {
          status: StaffEmploymentStatus.ENDED,
          effectiveTo,
          endedAt: new Date(),
          endReason: dto.reason.trim(),
        },
        select: EMPLOYMENT_SELECT,
      });
      await this.record(
        tx,
        actor,
        'end',
        'staff_employment',
        employmentId,
        before,
        after,
      );
      return after;
    });
  }

  // ---- 5K teacher profile ------------------------------------------------

  async createTeacherProfile(
    staffId: string,
    dto: CreateTeacherProfileDto,
    actor: AuthContext,
  ) {
    const effectiveFrom = parseDate(dto.effectiveFrom, 'effectiveFrom');
    return this.write(async (tx) => {
      await this.lockStaff(tx, staffId, actor);
      const existing = await tx.teacherProfile.findFirst({
        where: { tenantId: actor.tenantId, staffId },
        select: { id: true },
      });
      if (existing) {
        throw conflict(
          'TEACHER_PROFILE_EXISTS',
          'This staff member already has a teacher profile',
          {
            teacherProfileId: existing.id,
          },
        );
      }
      const row = await tx.teacherProfile.create({
        data: {
          tenantId: actor.tenantId,
          staffId,
          status: TeacherProfileStatus.ACTIVE,
          effectiveFrom,
        },
        select: {
          id: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });
      await this.record(
        tx,
        actor,
        'create',
        'teacher_profile',
        row.id,
        null,
        row,
      );
      return row;
    });
  }

  async deactivateTeacherProfile(
    staffId: string,
    dto: DeactivateTeacherProfileDto,
    actor: AuthContext,
  ) {
    const effectiveTo = parseDate(dto.effectiveTo, 'effectiveTo');
    return this.write(async (tx) => {
      await this.lockStaff(tx, staffId, actor);
      const before = await tx.teacherProfile.findFirst({
        where: { tenantId: actor.tenantId, staffId },
        select: {
          id: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });
      if (!before) throw new NotFoundException('Teacher profile not found');
      if (before.status !== TeacherProfileStatus.ACTIVE) {
        throw conflict(
          'TEACHER_PROFILE_INACTIVE',
          'Teacher profile is already inactive',
        );
      }
      if (effectiveTo <= before.effectiveFrom) {
        throw new BadRequestException(
          'effectiveTo must be after the profile start',
        );
      }
      const after = await tx.teacherProfile.update({
        where: { id: before.id },
        data: { status: TeacherProfileStatus.INACTIVE, effectiveTo },
        select: {
          id: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });
      await this.record(
        tx,
        actor,
        'deactivate',
        'teacher_profile',
        before.id,
        before,
        after,
      );
      return after;
    });
  }

  // ---- 5L qualification / licence evidence -------------------------------

  async addQualification(
    staffId: string,
    dto: CreateQualificationEvidenceDto,
    actor: AuthContext,
  ) {
    const window = evidenceWindow(dto);
    return this.write(async (tx) => {
      const profile = await this.requireProfile(tx, staffId, actor);
      const row = await tx.teacherQualificationEvidence.create({
        data: {
          tenantId: actor.tenantId,
          profileId: profile.id,
          qualification: dto.qualification.trim(),
          institution: blankToNull(dto.institution),
          ...evidenceCommon(dto, window, actor),
        },
        select: { ...EVIDENCE_SELECT, qualification: true, institution: true },
      });
      await this.record(
        tx,
        actor,
        'submit',
        'teacher_qualification_evidence',
        row.id,
        null,
        row,
      );
      return row;
    });
  }

  async addLicence(
    staffId: string,
    dto: CreateLicenceEvidenceDto,
    actor: AuthContext,
  ) {
    const window = evidenceWindow(dto);
    return this.write(async (tx) => {
      const profile = await this.requireProfile(tx, staffId, actor);
      const row = await tx.teachingLicenceEvidence.create({
        data: {
          tenantId: actor.tenantId,
          profileId: profile.id,
          authorityCode: dto.authorityCode.trim().toUpperCase(),
          externalReference: dto.externalReference.trim(),
          ...evidenceCommon(dto, window, actor),
        },
        select: {
          ...EVIDENCE_SELECT,
          authorityCode: true,
          externalReference: true,
        },
      });
      await this.record(
        tx,
        actor,
        'submit',
        'teaching_licence_evidence',
        row.id,
        null,
        row,
      );
      return row;
    });
  }

  async reviewEvidence(
    kind: EvidenceKind,
    staffId: string,
    evidenceId: string,
    dto: ReviewProfessionalRecordDto,
    actor: AuthContext,
  ) {
    return this.write(async (tx) => {
      const staff = await this.lockStaff(tx, staffId, actor);
      const before = await this.findEvidence(
        tx,
        kind,
        staffId,
        evidenceId,
        actor,
      );
      if (before.status !== ProfessionalEvidenceStatus.PENDING) {
        throw conflict(
          'EVIDENCE_NOT_PENDING',
          'Only pending evidence can be reviewed',
        );
      }
      assertIndependentReviewer(actor, before.submittedById, staff.userId);
      if (
        dto.decision === 'VERIFY' &&
        !before.documentId &&
        !before.sourceUri
      ) {
        throw conflict(
          'EVIDENCE_SOURCE_REQUIRED',
          'Attach a document or source reference before verifying evidence',
        );
      }
      const data = {
        status:
          dto.decision === 'VERIFY'
            ? ProfessionalEvidenceStatus.VERIFIED
            : ProfessionalEvidenceStatus.REJECTED,
        verifiedById: actor.userId,
        verifiedAt: new Date(),
      };
      const after = await this.updateEvidence(tx, kind, evidenceId, data);
      await this.record(
        tx,
        actor,
        dto.decision === 'VERIFY' ? 'verify' : 'reject',
        RESOURCE[kind],
        evidenceId,
        before,
        { ...after, note: dto.note ?? null },
      );
      return after;
    });
  }

  async revokeEvidence(
    kind: EvidenceKind,
    staffId: string,
    evidenceId: string,
    dto: RevokeProfessionalEvidenceDto,
    actor: AuthContext,
  ) {
    return this.write(async (tx) => {
      const staff = await this.lockStaff(tx, staffId, actor);
      const before = await this.findEvidence(
        tx,
        kind,
        staffId,
        evidenceId,
        actor,
      );
      if (before.status !== ProfessionalEvidenceStatus.VERIFIED) {
        throw conflict(
          'EVIDENCE_NOT_VERIFIED',
          'Only verified evidence can be revoked',
        );
      }
      assertIndependentReviewer(actor, null, staff.userId);
      const after = await this.updateEvidence(tx, kind, evidenceId, {
        status: ProfessionalEvidenceStatus.REVOKED,
        revokedAt: new Date(),
        revocationReason: dto.reason.trim(),
      });
      await this.record(
        tx,
        actor,
        'revoke',
        RESOURCE[kind],
        evidenceId,
        before,
        after,
      );
      return after;
    });
  }

  // ---- 5M projection -----------------------------------------------------

  async projectEligibility(
    staffId: string,
    query: EligibilityProjectionQueryDto,
    actor: AuthContext,
  ) {
    await this.requireStaff(this.prisma, staffId, actor);
    return this.eligibility.projectEligibility({
      tenantId: actor.tenantId,
      staffId,
      classId: query.classId,
      subjectId: query.subjectId ?? null,
    });
  }

  /**
   * 5M follow-up: active assignments whose professional eligibility no longer
   * holds (licence expired/revoked, employment ended, policy changed...).
   * Read-only report. It never revokes anything: the assignment keeps the
   * policy/evidence snapshot it was created under, and live authorization is
   * still enforced by the database guard on every activation.
   */
  async listEligibilityExceptions(actor: AuthContext) {
    const now = new Date();
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      select: {
        id: true,
        staffId: true,
        classId: true,
        sectionId: true,
        subjectId: true,
        assignmentType: true,
        effectiveFrom: true,
        staff: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
        eligibilityAssessment: {
          select: {
            id: true,
            outcome: true,
            reasonCode: true,
            evaluatedAt: true,
            policyVersionId: true,
          },
        },
      },
      orderBy: [{ staffId: 'asc' }, { classId: 'asc' }],
      take: EXCEPTION_SCAN_LIMIT + 1,
    });
    const truncated = assignments.length > EXCEPTION_SCAN_LIMIT;
    const scanned = assignments.slice(0, EXCEPTION_SCAN_LIMIT);

    const cache = new Map<
      string,
      Awaited<
        ReturnType<TeacherProfessionalEligibilityService['projectEligibility']>
      >
    >();
    const items: EligibilityExceptionItem[] = [];
    for (const assignment of scanned) {
      const key = `${assignment.staffId}|${assignment.classId}|${assignment.subjectId ?? ''}`;
      let projection = cache.get(key);
      if (!projection) {
        projection = await this.eligibility.projectEligibility({
          tenantId: actor.tenantId,
          staffId: assignment.staffId,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
        });
        cache.set(key, projection);
      }
      if (projection.outcome === 'ELIGIBLE') continue;
      items.push({
        assignmentId: assignment.id,
        assignmentType: assignment.assignmentType,
        effectiveFrom: assignment.effectiveFrom,
        staff: {
          id: assignment.staffId,
          name: `${assignment.staff.firstName} ${assignment.staff.lastName}`.trim(),
          employeeId: assignment.staff.employeeId,
        },
        className: assignment.class.name,
        sectionName: assignment.section.name,
        subjectName: assignment.subject?.name ?? null,
        currentReasonCode: projection.reasonCode,
        // What the assignment was created under (null for legacy rows).
        createdUnder: assignment.eligibilityAssessment,
      });
    }
    return { evaluatedAt: now, scanned: scanned.length, truncated, items };
  }

  // ---- helpers -----------------------------------------------------------

  private write<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn).catch((error: unknown) => {
      throw translateGuardError(error);
    });
  }

  private async requireStaff(
    db: Tx | PrismaService,
    staffId: string,
    actor: AuthContext,
  ) {
    const staff = await db.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  /** Serializes verification/ending per staff member (overlap race). */
  private async lockStaff(tx: Tx, staffId: string, actor: AuthContext) {
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string }>>`
      SELECT "id", "userId" FROM "Staff"
      WHERE "id" = ${staffId} AND "tenantId" = ${actor.tenantId}
      FOR UPDATE`;
    if (!rows[0]) throw new NotFoundException('Staff member not found');
    return rows[0];
  }

  private async requireProfile(tx: Tx, staffId: string, actor: AuthContext) {
    await this.requireStaff(tx, staffId, actor);
    const profile = await tx.teacherProfile.findFirst({
      where: { tenantId: actor.tenantId, staffId },
      select: { id: true },
    });
    if (!profile) {
      throw conflict(
        'TEACHER_PROFILE_MISSING',
        'Create a teacher profile before adding professional evidence',
      );
    }
    return profile;
  }

  private async findEvidence(
    tx: Tx,
    kind: EvidenceKind,
    staffId: string,
    evidenceId: string,
    actor: AuthContext,
  ) {
    const where = {
      id: evidenceId,
      tenantId: actor.tenantId,
      profile: { staffId },
    };
    const select = { ...EVIDENCE_SELECT, submittedById: true };
    const row =
      kind === 'qualification'
        ? await tx.teacherQualificationEvidence.findFirst({ where, select })
        : await tx.teachingLicenceEvidence.findFirst({ where, select });
    if (!row) throw new NotFoundException('Evidence not found');
    return row;
  }

  private updateEvidence(
    tx: Tx,
    kind: EvidenceKind,
    id: string,
    data: Prisma.TeacherQualificationEvidenceUpdateInput &
      Prisma.TeachingLicenceEvidenceUpdateInput,
  ) {
    return kind === 'qualification'
      ? tx.teacherQualificationEvidence.update({
          where: { id },
          data,
          select: EVIDENCE_SELECT,
        })
      : tx.teachingLicenceEvidence.update({
          where: { id },
          data,
          select: EVIDENCE_SELECT,
        });
  }

  private record(
    tx: Tx,
    actor: AuthContext,
    action: string,
    resource: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.audit.record(
      {
        action,
        resource,
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId,
        before,
        after,
      },
      tx,
    );
  }
}

const FAR_FUTURE = new Date('9999-12-31T00:00:00.000Z');

export interface EligibilityExceptionItem {
  assignmentId: string;
  assignmentType: string;
  effectiveFrom: Date;
  staff: { id: string; name: string; employeeId: string };
  className: string;
  sectionName: string;
  subjectName: string | null;
  currentReasonCode: string;
  createdUnder: {
    id: string;
    outcome: string;
    reasonCode: string;
    evaluatedAt: Date;
    policyVersionId: string;
  } | null;
}
/** Bounded report cost; the response says when it was truncated. */
const EXCEPTION_SCAN_LIMIT = 1000;

const RESOURCE: Record<EvidenceKind, string> = {
  qualification: 'teacher_qualification_evidence',
  licence: 'teaching_licence_evidence',
};

const EMPLOYMENT_SELECT = {
  id: true,
  staffId: true,
  employmentType: true,
  postCategoryCode: true,
  schoolTypeCode: true,
  localLevelId: true,
  effectiveFrom: true,
  effectiveTo: true,
  status: true,
  verifiedAt: true,
  endedAt: true,
  endReason: true,
  contractId: true,
  policyVersionId: true,
  createdAt: true,
} as const;

const EVIDENCE_SELECT = {
  id: true,
  subjectCode: true,
  levelCode: true,
  issuedOn: true,
  validFrom: true,
  validUntil: true,
  status: true,
  documentId: true,
  sourceUri: true,
  verifiedAt: true,
  revokedAt: true,
  revocationReason: true,
  createdAt: true,
} as const;

interface EvidenceRow {
  status: ProfessionalEvidenceStatus;
  validFrom: Date;
  validUntil: Date | null;
}

/**
 * Read-side state for UI. `effectiveState` is what eligibility would see:
 * only VERIFIED evidence inside its validity window counts.
 */
function withEvidenceState(now: Date) {
  return <T extends EvidenceRow>(row: T) => ({
    ...row,
    effectiveState:
      row.status !== ProfessionalEvidenceStatus.VERIFIED
        ? row.status
        : row.validFrom > now
          ? ('NOT_YET_VALID' as const)
          : row.validUntil && row.validUntil <= now
            ? ('EXPIRED' as const)
            : ('CURRENT' as const),
  });
}

function evidenceWindow(dto: {
  validFrom: string;
  validUntil?: string;
  issuedOn?: string;
}) {
  const validFrom = parseDate(dto.validFrom, 'validFrom');
  const validUntil = dto.validUntil
    ? parseDate(dto.validUntil, 'validUntil')
    : null;
  assertWindow(validFrom, validUntil);
  return {
    validFrom,
    validUntil,
    issuedOn: dto.issuedOn ? parseDate(dto.issuedOn, 'issuedOn') : null,
  };
}

function evidenceCommon(
  dto: {
    subjectCode?: string;
    levelCode?: string;
    documentId?: string;
    sourceUri?: string;
  },
  window: ReturnType<typeof evidenceWindow>,
  actor: AuthContext,
) {
  return {
    subjectCode: blankToNull(dto.subjectCode),
    levelCode: blankToNull(dto.levelCode),
    ...window,
    documentId: dto.documentId ?? null,
    sourceUri: dto.sourceUri ?? null,
    // Uploaded evidence is never verified by default (DB enforces PENDING).
    status: ProfessionalEvidenceStatus.PENDING,
    submittedById: actor.userId,
  };
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === '' ? null : (trimmed ?? null);
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date`);
  }
  return date;
}

function assertWindow(from: Date, to: Date | null) {
  if (to && to <= from) {
    throw new BadRequestException('End date must be after start date');
  }
}

/** Maker-checker, and nobody verifies their own professional record. */
export function assertIndependentReviewer(
  actor: AuthContext,
  submittedById: string | null,
  subjectUserId: string,
) {
  if (actor.userId === subjectUserId) {
    throw new ForbiddenException({
      code: 'PROFESSIONAL_SELF_REVIEW',
      message: 'You cannot review or end your own professional record',
    });
  }
  if (submittedById && submittedById === actor.userId) {
    throw new ForbiddenException({
      code: 'PROFESSIONAL_MAKER_CHECKER',
      message: 'A different person must review a record you submitted',
    });
  }
}

function conflict(
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return new ConflictException({ code, message, ...extra });
}

const GUARD_MESSAGES: Array<[RegExp, string, string]> = [
  [
    /Overlapping verified employment/,
    'EMPLOYMENT_OVERLAP',
    'Another verified employment period overlaps this one',
  ],
  [
    /must belong to the tenant|must match the tenant/,
    'PROFESSIONAL_REFERENCE_INVALID',
    'A referenced record (document, contract, policy or user) is not valid for this school',
  ],
  [
    /maker_checker/,
    'PROFESSIONAL_MAKER_CHECKER',
    'A different person must review a record you submitted',
  ],
  [
    /immutable/,
    'PROFESSIONAL_RECORD_IMMUTABLE',
    'This record can no longer be changed that way',
  ],
];

/** Database guards are the last line; surface them as stable 409s. */
export function translateGuardError(error: unknown): unknown {
  if (
    error instanceof NotFoundException ||
    error instanceof ConflictException ||
    error instanceof ForbiddenException ||
    error instanceof BadRequestException
  ) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  for (const [pattern, code, text] of GUARD_MESSAGES) {
    if (pattern.test(message)) return conflict(code, text);
  }
  return error;
}
