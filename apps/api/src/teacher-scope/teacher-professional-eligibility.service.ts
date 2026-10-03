import { ConflictException, Injectable } from '@nestjs/common';
import {
  NepalHrPolicyKind,
  NepalHrPolicyReviewStatus,
  Prisma,
  TeacherEligibilityOutcome,
  TeacherProfileStatus,
} from '@prisma/client';
import { AUTHORITATIVE_EMPLOYMENT_STATUSES } from '../hr/employment-timeline';
import { PrismaService } from '../prisma/prisma.service';
import {
  decideEligibility,
  type EligibilityDecision,
  type EmploymentFacts,
  type EvidenceFacts,
  type PolicyFacts,
} from './teacher-eligibility-decision';

interface AssignmentContext {
  tenantId: string;
  staffId: string;
  classId: string;
  subjectId?: string | null;
  actorId?: string;
}

const POLICY_CATALOG_LIMIT = 1000;

export interface EligibilityResourceRequest {
  staffId: string;
  classId: string;
  subjectId: string | null;
}

export function eligibilityResourceKey(
  resource: EligibilityResourceRequest,
): string {
  return `${resource.staffId}|${resource.classId}|${resource.subjectId ?? ''}`;
}

/** Everything the pure decision needs, loaded once for a bounded staff set. */
export interface EligibilityFacts {
  tenantId: string;
  now: Date;
  activeStaff: Set<string>;
  employments: Map<string, EmploymentFacts>;
  profiles: Map<string, { id: string; effectiveTo: Date | null }>;
  /** Keyed by teacher profile id. */
  qualifications: Map<string, EvidenceFacts[]>;
  licences: Map<string, EvidenceFacts[]>;
  classLevels: Map<string, number>;
  subjects: Map<string, { code: string; classId: string }>;
  catalogue: PolicyFacts[];
  catalogueLimitReached: boolean;
  futurePolicies: PolicyFacts[];
}

const EVIDENCE_FACT_SELECT = {
  id: true,
  status: true,
  subjectCode: true,
  levelCode: true,
  validFrom: true,
  validUntil: true,
} as const;

function toPolicyFacts(row: {
  id: string;
  policyKey: string;
  version: number;
  scope: PolicyFacts['scope'];
  tenantId: string | null;
  provinceId: number | null;
  districtId: number | null;
  localLevelId: number | null;
  schoolTypeCode: string | null;
  employmentType: string | null;
  postCategoryCode: string | null;
  classLevelMin: number | null;
  classLevelMax: number | null;
  subjectCode: string | null;
  isMandatoryBaseline: boolean;
  requiresQualification: boolean | null;
  requiresLicence: boolean | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceTitle: string;
}): PolicyFacts {
  return {
    id: row.id,
    policyKey: row.policyKey,
    version: row.version,
    scope: row.scope,
    tenantId: row.tenantId,
    provinceId: row.provinceId,
    districtId: row.districtId,
    localLevelId: row.localLevelId,
    schoolTypeCode: row.schoolTypeCode,
    employmentType: row.employmentType,
    postCategoryCode: row.postCategoryCode,
    classLevelMin: row.classLevelMin,
    classLevelMax: row.classLevelMax,
    subjectCode: row.subjectCode,
    isMandatoryBaseline: row.isMandatoryBaseline,
    requiresQualification: row.requiresQualification,
    requiresLicence: row.requiresLicence,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    sourceTitle: row.sourceTitle,
  };
}

const PRECONDITION_MESSAGE =
  'Current verified employment and professional eligibility are required for this teaching assignment';

export interface TeacherEligibilityProjection {
  outcome: TeacherEligibilityOutcome;
  reasonCode: string;
  policyVersionId: string | null;
  employmentId: string | null;
  qualificationId: string | null;
  licenceId: string | null;
  validUntil: Date | null;
  evaluatedAt: Date;
  /** Always false: projections are never authority. */
  persisted: false;
}

interface EligibilityEvaluation {
  profileId: string;
  employmentId: string;
  policyVersionId: string;
  qualificationId: string | null;
  licenceId: string | null;
  outcome: TeacherEligibilityOutcome;
  reasonCode: string;
  validUntil: Date | null;
}

function eligibilityRejectionReason(error: unknown): string | null {
  if (!(error instanceof ConflictException)) return null;
  const body = error.getResponse() as { code?: unknown; reason?: unknown };
  return body.code === 'TEACHER_PROFESSIONAL_ELIGIBILITY_REQUIRED' &&
    typeof body.reason === 'string'
    ? body.reason
    : null;
}

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
    const evaluation = await this.evaluate(input, db, now);
    const assessment = await db.teacherEligibilityAssessment.create({
      data: {
        tenantId: input.tenantId,
        staffId: input.staffId,
        profileId: evaluation.profileId,
        employmentId: evaluation.employmentId,
        policyVersionId: evaluation.policyVersionId,
        qualificationId: evaluation.qualificationId,
        licenceId: evaluation.licenceId,
        outcome: evaluation.outcome,
        reasonCode: evaluation.reasonCode,
        evaluatedAt: now,
        validUntil: evaluation.validUntil,
        evaluatedById: input.actorId,
      },
      select: { id: true },
    });
    if (evaluation.outcome !== TeacherEligibilityOutcome.ELIGIBLE)
      reject(evaluation.reasonCode);
    return assessment.id;
  }

  /**
   * 5M read projection. Runs the exact preflight evaluation without
   * persisting a decision snapshot, so UI can show outcome + reason code.
   * It never grants anything: assignment creation still runs the preflight
   * and the database guard rechecks live authority.
   */
  async projectEligibility(
    input: Omit<AssignmentContext, 'actorId'>,
  ): Promise<TeacherEligibilityProjection> {
    const evaluatedAt = new Date();
    try {
      const evaluation = await this.evaluate(input, this.prisma, evaluatedAt);
      return {
        outcome: evaluation.outcome,
        reasonCode: evaluation.reasonCode,
        policyVersionId: evaluation.policyVersionId,
        employmentId: evaluation.employmentId,
        qualificationId: evaluation.qualificationId,
        licenceId: evaluation.licenceId,
        validUntil: evaluation.validUntil,
        evaluatedAt,
        persisted: false,
      };
    } catch (error) {
      const reason = eligibilityRejectionReason(error);
      if (!reason) throw error;
      return {
        outcome: TeacherEligibilityOutcome.INELIGIBLE,
        reasonCode: reason,
        policyVersionId: null,
        employmentId: null,
        qualificationId: null,
        licenceId: null,
        validUntil: null,
        evaluatedAt,
        persisted: false,
      };
    }
  }

  private async evaluate(
    input: Omit<AssignmentContext, 'actorId'>,
    db: Prisma.TransactionClient | PrismaService,
    now: Date,
  ): Promise<EligibilityEvaluation> {
    const facts = await this.loadFacts(db, {
      tenantId: input.tenantId,
      staffIds: [input.staffId],
      classIds: [input.classId],
      subjectIds: input.subjectId ? [input.subjectId] : [],
      now,
    });
    const decision = this.decideFor(
      facts,
      input.staffId,
      input.classId,
      input.subjectId ?? null,
    );
    if (decision.structural) reject(decision.reasonCode);
    const { profileId, employmentId, policyVersionId } = decision;
    if (!profileId || !employmentId || !policyVersionId)
      throw new Error(
        'Non-structural eligibility decision lacks its authoritative references',
      );
    return {
      profileId,
      employmentId,
      policyVersionId,
      qualificationId: decision.qualificationId,
      licenceId: decision.licenceId,
      outcome: decision.outcome,
      reasonCode: decision.reasonCode,
      validUntil: decision.validUntil,
    };
  }

  /**
   * Phase 7.10 batch evaluation: loads the school's facts and the policy
   * catalogue once, then decides every requested (staff, class, subject)
   * with the same pure procedure as the single-assignment preflight. Never
   * persists anything. Callers keep the staff set bounded.
   */
  async evaluateMany(input: {
    tenantId: string;
    resources: readonly EligibilityResourceRequest[];
    now?: Date;
  }): Promise<Map<string, EligibilityDecision>> {
    const now = input.now ?? new Date();
    const facts = await this.loadFacts(this.prisma, {
      tenantId: input.tenantId,
      staffIds: [...new Set(input.resources.map((item) => item.staffId))],
      classIds: [...new Set(input.resources.map((item) => item.classId))],
      subjectIds: [
        ...new Set(
          input.resources
            .map((item) => item.subjectId)
            .filter((value): value is string => value !== null),
        ),
      ],
      now,
    });
    const decisions = new Map<string, EligibilityDecision>();
    for (const resource of input.resources) {
      if (decisions.has(eligibilityResourceKey(resource))) continue;
      decisions.set(
        eligibilityResourceKey(resource),
        this.decideFor(
          facts,
          resource.staffId,
          resource.classId,
          resource.subjectId,
        ),
      );
    }
    return decisions;
  }

  /** Decide one resource from already loaded facts (pure, no I/O). */
  decideFor(
    facts: EligibilityFacts,
    staffId: string,
    classId: string,
    subjectId: string | null,
  ): EligibilityDecision {
    const classLevel = facts.classLevels.get(classId);
    const subject = subjectId ? facts.subjects.get(subjectId) : undefined;
    const profile = facts.profiles.get(staffId) ?? null;
    return decideEligibility({
      now: facts.now,
      staffActive: facts.activeStaff.has(staffId),
      employment: facts.employments.get(staffId) ?? null,
      profile,
      resource: {
        classFound: classLevel !== undefined,
        classLevel: classLevel ?? 0,
        subjectRequested: subjectId !== null,
        subjectFound: Boolean(subject && subject.classId === classId),
        subjectCode:
          subject && subject.classId === classId ? subject.code : null,
      },
      catalogue: facts.catalogue,
      catalogueLimitReached: facts.catalogueLimitReached,
      qualifications: profile
        ? (facts.qualifications.get(profile.id) ?? [])
        : [],
      licences: profile ? (facts.licences.get(profile.id) ?? []) : [],
    });
  }

  /**
   * Bounded, tenant-anchored fact loading shared by the single preflight, the
   * read-only projection, the exceptions report and the workspace. Callers cap
   * the staff set; every query filters by tenant.
   */
  async loadFacts(
    db: Prisma.TransactionClient | PrismaService,
    input: {
      tenantId: string;
      staffIds: string[];
      classIds: string[];
      subjectIds: string[];
      now: Date;
      /** When set, also loads approved policies that start before this. */
      horizonEnd?: Date;
    },
  ): Promise<EligibilityFacts> {
    const { tenantId, now } = input;
    const [staffRows, employmentRows, profileRows, classRows, subjectRows] =
      await Promise.all([
        db.staff.findMany({
          where: {
            id: { in: input.staffIds },
            tenantId,
            status: 'ACTIVE',
            joiningDate: { lte: now },
          },
          select: { id: true },
        }),
        db.staffEmployment.findMany({
          where: {
            tenantId,
            staffId: { in: input.staffIds },
            // Phase 7.10: authoritative = verified (current) or ended
            // (historical); an ended employment stays valid until effectiveTo.
            status: { in: [...AUTHORITATIVE_EMPLOYMENT_STATUSES] },
            verifiedAt: { not: null },
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          include: { localLevel: { include: { district: true } } },
          orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
        }),
        db.teacherProfile.findMany({
          where: {
            tenantId,
            staffId: { in: input.staffIds },
            status: TeacherProfileStatus.ACTIVE,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          select: { id: true, staffId: true, effectiveTo: true },
        }),
        input.classIds.length > 0
          ? db.class.findMany({
              where: { id: { in: input.classIds }, tenantId },
              select: { id: true, level: true },
            })
          : Promise.resolve([] as Array<{ id: string; level: number }>),
        input.subjectIds.length > 0
          ? db.subject.findMany({
              where: { id: { in: input.subjectIds }, tenantId },
              select: { id: true, code: true, classId: true },
            })
          : Promise.resolve(
              [] as Array<{ id: string; code: string; classId: string }>,
            ),
      ]);

    const employments = new Map<string, EmploymentFacts>();
    for (const row of employmentRows) {
      if (employments.has(row.staffId)) continue;
      employments.set(row.staffId, {
        id: row.id,
        localLevelId: row.localLevelId,
        districtId: row.localLevel?.districtId ?? null,
        provinceId: row.localLevel?.district.provinceId ?? null,
        schoolTypeCode: row.schoolTypeCode,
        employmentType: row.employmentType,
        postCategoryCode: row.postCategoryCode,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      });
    }
    const profiles = new Map<
      string,
      { id: string; effectiveTo: Date | null }
    >();
    for (const row of profileRows)
      profiles.set(row.staffId, { id: row.id, effectiveTo: row.effectiveTo });

    const localLevelIds = new Set<number>();
    const districtIds = new Set<number>();
    const provinceIds = new Set<number>();
    for (const employment of employments.values()) {
      if (employment.localLevelId !== null)
        localLevelIds.add(employment.localLevelId);
      if (employment.districtId !== null)
        districtIds.add(employment.districtId);
      if (employment.provinceId !== null)
        provinceIds.add(employment.provinceId);
    }
    const scope: Prisma.NepalHrPolicyVersionWhereInput[] = [
      { scope: 'NATIONAL' },
      { scope: 'SCHOOL', tenantId },
    ];
    if (localLevelIds.size > 0)
      scope.push({
        scope: 'LOCAL_LEVEL',
        localLevelId: { in: [...localLevelIds] },
      });
    if (districtIds.size > 0)
      scope.push({ scope: 'DISTRICT', districtId: { in: [...districtIds] } });
    if (provinceIds.size > 0)
      scope.push({ scope: 'PROVINCE', provinceId: { in: [...provinceIds] } });
    const baseWhere = {
      kind: NepalHrPolicyKind.TEACHER_PROFESSIONAL_ELIGIBILITY,
      reviewStatus: NepalHrPolicyReviewStatus.APPROVED,
    } as const;
    const profileIds = [...profiles.values()].map((item) => item.id);
    const [candidates, future, qualificationRows, licenceRows] =
      await Promise.all([
        db.nepalHrPolicyVersion.findMany({
          where: {
            ...baseWhere,
            effectiveFrom: { lte: now },
            AND: [
              { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
              { OR: scope },
            ],
          },
          take: POLICY_CATALOG_LIMIT,
        }),
        input.horizonEnd
          ? db.nepalHrPolicyVersion.findMany({
              where: {
                ...baseWhere,
                effectiveFrom: { gt: now, lte: input.horizonEnd },
                OR: scope,
              },
              take: POLICY_CATALOG_LIMIT,
            })
          : Promise.resolve([]),
        profileIds.length > 0
          ? db.teacherQualificationEvidence.findMany({
              where: { tenantId, profileId: { in: profileIds } },
              select: { ...EVIDENCE_FACT_SELECT, profileId: true },
            })
          : Promise.resolve([]),
        profileIds.length > 0
          ? db.teachingLicenceEvidence.findMany({
              where: { tenantId, profileId: { in: profileIds } },
              select: { ...EVIDENCE_FACT_SELECT, profileId: true },
            })
          : Promise.resolve([]),
      ]);

    const groupEvidence = (
      rows: Array<EvidenceFacts & { profileId: string }>,
    ) => {
      const grouped = new Map<string, EvidenceFacts[]>();
      for (const { profileId, ...row } of rows) {
        const list = grouped.get(profileId) ?? [];
        list.push(row);
        grouped.set(profileId, list);
      }
      return grouped;
    };
    return {
      tenantId,
      now,
      activeStaff: new Set(staffRows.map((row) => row.id)),
      employments,
      profiles,
      qualifications: groupEvidence(qualificationRows),
      licences: groupEvidence(licenceRows),
      classLevels: new Map(classRows.map((row) => [row.id, row.level])),
      subjects: new Map(
        subjectRows.map((row) => [
          row.id,
          { code: row.code, classId: row.classId },
        ]),
      ),
      catalogue: candidates.map(toPolicyFacts),
      catalogueLimitReached: candidates.length === POLICY_CATALOG_LIMIT,
      futurePolicies: future.map(toPolicyFacts),
    };
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
