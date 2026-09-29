import { ConflictException, Injectable } from '@nestjs/common';
import {
  NepalHrPolicyKind,
  NepalHrPolicyReviewStatus,
  Prisma,
  StaffEmploymentStatus,
  TeacherEligibilityOutcome,
  TeacherProfileStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AssignmentContext {
  tenantId: string;
  staffId: string;
  classId: string;
  subjectId?: string | null;
  actorId?: string;
}

const PRECONDITION_MESSAGE =
  'Current verified employment and professional eligibility are required for this teaching assignment';

function reject(reason: string): never {
  throw new ConflictException({
    code: 'TEACHER_PROFESSIONAL_ELIGIBILITY_REQUIRED',
    message: PRECONDITION_MESSAGE,
    reason,
  });
}

/**
 * P0-N3 assignment preflight. The decision is an immutable audit snapshot;
 * the database trigger and TeacherScopeService still recheck live authority.
 */
@Injectable()
export class TeacherProfessionalEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async preflightAssignment(
    input: AssignmentContext,
    transaction?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = transaction ?? this.prisma;
    const now = new Date();
    const staff = await db.staff.findFirst({
      where: {
        id: input.staffId,
        tenantId: input.tenantId,
        status: 'ACTIVE',
        joiningDate: { lte: now },
      },
      select: { id: true },
    });
    if (!staff) reject('EMPLOYMENT_INACTIVE');

    const employment = await db.staffEmployment.findFirst({
      where: {
        tenantId: input.tenantId,
        staffId: input.staffId,
        status: StaffEmploymentStatus.VERIFIED,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      include: { localLevel: { include: { district: true } } },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    if (!employment) reject('EMPLOYMENT_UNVERIFIED');

    const profile = await db.teacherProfile.findFirst({
      where: {
        tenantId: input.tenantId,
        staffId: input.staffId,
        status: TeacherProfileStatus.ACTIVE,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      select: { id: true, effectiveTo: true },
    });
    if (!profile) reject('TEACHER_PROFILE_MISSING');

    const schoolClass = await db.class.findFirst({
      where: { id: input.classId, tenantId: input.tenantId },
      select: { level: true },
    });
    if (!schoolClass) reject('CLASS_NOT_FOUND');
    const subject = input.subjectId
      ? await db.subject.findFirst({
          where: {
            id: input.subjectId,
            tenantId: input.tenantId,
            classId: input.classId,
          },
          select: { code: true },
        })
      : null;
    if (input.subjectId && !subject) reject('SUBJECT_NOT_FOUND');

    const scope: Prisma.NepalHrPolicyVersionWhereInput[] = [
      { scope: 'NATIONAL' },
      { scope: 'SCHOOL', tenantId: input.tenantId },
    ];
    if (employment.localLevelId) {
      scope.push({
        scope: 'LOCAL_LEVEL',
        localLevelId: employment.localLevelId,
      });
      scope.push({
        scope: 'DISTRICT',
        districtId: employment.localLevel?.districtId,
      });
      scope.push({
        scope: 'PROVINCE',
        provinceId: employment.localLevel?.district.provinceId,
      });
    }
    const candidates = await db.nepalHrPolicyVersion.findMany({
      where: {
        kind: NepalHrPolicyKind.TEACHER_PROFESSIONAL_ELIGIBILITY,
        reviewStatus: NepalHrPolicyReviewStatus.APPROVED,
        effectiveFrom: { lte: now },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          { OR: scope },
        ],
      },
      take: 1000,
    });
    if (candidates.length === 1000)
      reject('TEACHER_POLICY_CATALOG_LIMIT_REACHED');
    const matching = candidates.filter(
      (policy) =>
        (policy.scope !== 'SCHOOL' ||
          policy.localLevelId === employment.localLevelId) &&
        (policy.schoolTypeCode === null ||
          policy.schoolTypeCode === employment.schoolTypeCode) &&
        (policy.employmentType === null ||
          policy.employmentType === employment.employmentType) &&
        (policy.postCategoryCode === null ||
          policy.postCategoryCode === employment.postCategoryCode) &&
        (policy.classLevelMin === null ||
          policy.classLevelMin <= schoolClass.level) &&
        (policy.classLevelMax === null ||
          policy.classLevelMax >= schoolClass.level) &&
        (policy.subjectCode === null || policy.subjectCode === subject?.code),
    );
    const latestByKey = new Map<string, (typeof matching)[number]>();
    for (const policy of matching) {
      const prior = latestByKey.get(policy.policyKey);
      if (
        !prior ||
        policy.effectiveFrom > prior.effectiveFrom ||
        (policy.effectiveFrom.getTime() === prior.effectiveFrom.getTime() &&
          policy.version > prior.version)
      )
        latestByKey.set(policy.policyKey, policy);
    }
    const applicable = [...latestByKey.values()];
    if (applicable.length === 0) reject('TEACHER_POLICY_UNAVAILABLE');

    const scopeRank = {
      NATIONAL: 0,
      PROVINCE: 1,
      DISTRICT: 2,
      LOCAL_LEVEL: 3,
      SCHOOL: 4,
    } as const;
    const specificity = (policy: (typeof applicable)[number]) =>
      Number(policy.schoolTypeCode !== null) +
      Number(policy.employmentType !== null) +
      Number(policy.postCategoryCode !== null) +
      Number(policy.classLevelMin !== null || policy.classLevelMax !== null) +
      Number(policy.subjectCode !== null);
    applicable.sort(
      (left, right) =>
        scopeRank[right.scope] - scopeRank[left.scope] ||
        specificity(right) - specificity(left) ||
        +right.effectiveFrom - +left.effectiveFrom ||
        right.version - left.version,
    );
    const policy = applicable[0];
    if (applicable.length > 1) {
      const peer = applicable[1];
      if (
        peer.policyKey !== policy.policyKey &&
        scopeRank[peer.scope] === scopeRank[policy.scope] &&
        specificity(peer) === specificity(policy) &&
        +peer.effectiveFrom === +policy.effectiveFrom
      ) {
        reject('TEACHER_POLICY_CONFLICT');
      }
    }

    // Mandatory baselines remain in force even when a school policy is more
    // specific. The review trigger also prevents a school override that
    // explicitly weakens a currently approved mandatory requirement.
    const requiresQualification = applicable.some(
      (item) =>
        (item.id === policy.id || item.isMandatoryBaseline) &&
        item.requiresQualification === true,
    );
    const requiresLicence = applicable.some(
      (item) =>
        (item.id === policy.id || item.isMandatoryBaseline) &&
        item.requiresLicence === true,
    );

    const qualification = requiresQualification
      ? await db.teacherQualificationEvidence.findFirst({
          where: {
            tenantId: input.tenantId,
            profileId: profile.id,
            status: 'VERIFIED',
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            AND: [
              {
                OR: [
                  { subjectCode: null },
                  { subjectCode: subject?.code ?? null },
                ],
              },
              {
                OR: [
                  { levelCode: null },
                  { levelCode: String(schoolClass.level) },
                ],
              },
            ],
          },
          orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
        })
      : null;
    const licence = requiresLicence
      ? await db.teachingLicenceEvidence.findFirst({
          where: {
            tenantId: input.tenantId,
            profileId: profile.id,
            status: 'VERIFIED',
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
            AND: [
              {
                OR: [
                  { subjectCode: null },
                  { subjectCode: subject?.code ?? null },
                ],
              },
              {
                OR: [
                  { levelCode: null },
                  { levelCode: String(schoolClass.level) },
                ],
              },
            ],
          },
          orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
        })
      : null;
    const reason =
      requiresQualification && !qualification
        ? 'QUALIFICATION_UNVERIFIED'
        : requiresLicence && !licence
          ? 'TEACHING_LICENCE_UNVERIFIED'
          : 'POLICY_REQUIREMENTS_SATISFIED';
    const endDates = [
      employment.effectiveTo,
      profile.effectiveTo,
      policy.effectiveTo,
      qualification?.validUntil,
      licence?.validUntil,
    ].filter((value): value is Date => value instanceof Date);
    const assessment = await db.teacherEligibilityAssessment.create({
      data: {
        tenantId: input.tenantId,
        staffId: input.staffId,
        profileId: profile.id,
        employmentId: employment.id,
        policyVersionId: policy.id,
        qualificationId: qualification?.id,
        licenceId: licence?.id,
        outcome:
          reason === 'POLICY_REQUIREMENTS_SATISFIED'
            ? TeacherEligibilityOutcome.ELIGIBLE
            : TeacherEligibilityOutcome.INELIGIBLE,
        reasonCode: reason,
        evaluatedAt: now,
        validUntil:
          endDates.length > 0
            ? new Date(Math.min(...endDates.map((value) => +value)))
            : null,
        evaluatedById: input.actorId,
      },
      select: { id: true },
    });
    if (reason !== 'POLICY_REQUIREMENTS_SATISFIED') reject(reason);
    return assessment.id;
  }

  async isLive(input: {
    tenantId: string;
    staffId: string;
    assessmentId: string | null;
    classId: string;
    subjectId: string | null;
    at: Date;
  }): Promise<boolean> {
    if (!input.assessmentId) return false;
    const rows = await this.prisma.$queryRaw<Array<{ allowed: boolean }>>`
      SELECT schoolos_teacher_eligibility_live(
        ${input.tenantId}, ${input.staffId}, ${input.assessmentId},
        ${input.at}, ${input.classId}, ${input.subjectId}
      ) AS allowed`;
    return rows[0]?.allowed ?? false;
  }
}
