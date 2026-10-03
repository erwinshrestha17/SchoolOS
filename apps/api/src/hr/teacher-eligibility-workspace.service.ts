import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  TeacherBlockingChange,
  TeacherEligibilityAssignmentResult,
  TeacherEligibilityPolicyRef,
  TeacherEligibilityRequirement,
  TeacherEligibilityState,
  TeacherEligibilitySummary,
  TeacherEligibilityWorkspace,
  TeacherEligibilityWorkspaceItem,
  TeacherEvidenceChecklistItem,
  TeacherEvidenceRequirement,
  TeacherEvidenceRequirementStatus,
} from '@schoolos/core';
import type { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  hasDomainPermission,
  requireDomainPermission,
} from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';
import {
  clampHorizonDays,
  collectBlockingChanges,
  decideBaseline,
  deriveEligibilityState,
  STATE_SEVERITY,
  type BlockingChange,
  type EligibilityDecision,
  type EligibilityRequirements,
  type EvidenceFacts,
  type EvidenceRequirement,
} from '../teacher-scope/teacher-eligibility-decision';
import {
  TeacherProfessionalEligibilityService,
  type EligibilityFacts,
} from '../teacher-scope/teacher-professional-eligibility.service';
import type { EligibilityWorkspaceQueryDto } from './dto/professional-identity.dto';
import { withEvidenceState } from './professional-identity.service';

/**
 * Bounds. A school with more teachers than this gets `truncated: true`
 * instead of a silently partial total.
 */
export const WORKSPACE_POPULATION_LIMIT = 2000;
const ASSIGNMENT_SCAN_LIMIT = 10000;
const DAY_MS = 24 * 60 * 60 * 1000;

const EVIDENCE_PRIORITY: Record<TeacherEvidenceRequirementStatus, number> = {
  MISSING: 0,
  REVOKED: 1,
  EXPIRED: 2,
  NOT_YET_VALID: 3,
  PENDING_REVIEW: 4,
  MATCHED: 5,
};

interface AssignmentRow {
  id: string;
  staffId: string;
  classId: string;
  subjectId: string | null;
  assignmentType: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  class: { name: string };
  section: { name: string };
  subject: { name: string } | null;
  eligibilityAssessment: {
    id: string;
    outcome: string;
    reasonCode: string;
    evaluatedAt: Date;
  } | null;
}

interface StaffRow {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
}

interface Evaluated {
  staff: StaffRow;
  state: TeacherEligibilityState;
  atRisk: boolean;
  primaryReasonCode: string;
  policy: TeacherEligibilityPolicyRef | null;
  evidence: TeacherEligibilityWorkspaceItem['evidence'];
  employment: TeacherEligibilityWorkspaceItem['employment'];
  assignmentResults: Array<{
    row: AssignmentRow;
    decision: EligibilityDecision;
    state: TeacherEligibilityState;
  }>;
  upcoming: AssignmentRow[];
  blockingChanges: TeacherBlockingChange[];
  baseline: EligibilityDecision | null;
}

const iso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

function policyRef(
  policy: EligibilityRequirements['policy'],
): TeacherEligibilityPolicyRef {
  return {
    id: policy.id,
    policyKey: policy.policyKey,
    version: policy.version,
    scope: policy.scope,
    sourceTitle: policy.sourceTitle,
    effectiveFrom: policy.effectiveFrom.toISOString(),
    effectiveTo: iso(policy.effectiveTo),
  };
}

function evidenceRequirement(
  value: EvidenceRequirement,
): TeacherEvidenceRequirement {
  return {
    required: value.required,
    status: value.status,
    matchedId: value.matchedId,
    pendingId: value.pendingId,
    validUntil: iso(value.validUntil),
  };
}

function requirementView(
  requirements: EligibilityRequirements | null,
): TeacherEligibilityRequirement | null {
  if (!requirements) return null;
  return {
    policy: policyRef(requirements.policy),
    baselines: requirements.baselines.map(policyRef),
    qualification: evidenceRequirement(requirements.qualification),
    licence: evidenceRequirement(requirements.licence),
  };
}

function worstEvidence(
  statuses: Array<TeacherEvidenceRequirementStatus | null>,
): TeacherEvidenceRequirementStatus | null {
  let worst: TeacherEvidenceRequirementStatus | null = null;
  for (const status of statuses) {
    if (!status) continue;
    if (!worst || EVIDENCE_PRIORITY[status] < EVIDENCE_PRIORITY[worst])
      worst = status;
  }
  return worst;
}

function searchWhere(search: string | undefined): Prisma.StaffWhereInput {
  const terms = (search ?? '').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return {};
  return {
    AND: terms.map((term) => ({
      OR: [
        { employeeId: { contains: term, mode: 'insensitive' as const } },
        { firstName: { contains: term, mode: 'insensitive' as const } },
        { lastName: { contains: term, mode: 'insensitive' as const } },
      ],
    })),
  };
}

/**
 * Phase 7.10 (7L): the HR teacher-eligibility workspace.
 *
 * Strictly read-only. It runs the same pure decision as the assignment
 * preflight (`decideEligibility`) over the whole school in a few bounded
 * queries and reports the result — it never grants, revokes, overrides or
 * persists anything. A Teacher role is not evidence: a person with an
 * assignment but no profile or verified employment is listed as ineligible.
 */
@Injectable()
export class TeacherEligibilityWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: TeacherProfessionalEligibilityService,
  ) {}

  async getWorkspace(
    query: EligibilityWorkspaceQueryDto,
    actor: AuthContext,
  ): Promise<TeacherEligibilityWorkspace> {
    requireDomainPermission(actor, 'hr:read');
    const now = new Date();
    const horizonDays = clampHorizonDays(query.horizonDays);
    const { staff, truncated } = await this.population(actor, query.search);
    const evaluated = await this.evaluate(actor, staff, now, horizonDays);

    const totals = {
      total: evaluated.length,
      eligible: evaluated.filter((item) => item.state === 'ELIGIBLE').length,
      needsReview: evaluated.filter((item) => item.state === 'NEEDS_REVIEW')
        .length,
      ineligible: evaluated.filter((item) => item.state === 'INELIGIBLE')
        .length,
      atRisk: evaluated.filter((item) => item.atRisk).length,
    };
    const filtered = evaluated
      .filter((item) => !query.status || item.state === query.status)
      .filter((item) => !query.atRiskOnly || item.atRisk)
      .sort(
        (left, right) =>
          STATE_SEVERITY[right.state] - STATE_SEVERITY[left.state] ||
          Number(right.atRisk) - Number(left.atRisk) ||
          left.staff.firstName.localeCompare(right.staff.firstName) ||
          left.staff.lastName.localeCompare(right.staff.lastName) ||
          left.staff.id.localeCompare(right.staff.id),
      );
    const limit = query.limit ?? 25;
    const page = query.page ?? 1;
    const items = filtered
      .slice((page - 1) * limit, page * limit)
      .map((item) => this.toItem(item));
    return {
      evaluatedAt: now.toISOString(),
      horizonDays,
      totals,
      truncated,
      page,
      limit,
      totalItems: filtered.length,
      items,
    };
  }

  async getSummary(
    staffId: string,
    horizonDaysInput: number | undefined,
    actor: AuthContext,
  ): Promise<TeacherEligibilitySummary> {
    requireDomainPermission(actor, 'hr:read');
    const now = new Date();
    const horizonDays = clampHorizonDays(horizonDaysInput);
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    const [evaluated] = await this.evaluate(actor, [staff], now, horizonDays);
    const canReadReferences = hasDomainPermission(actor, 'hr:documents:read');
    const [profile, assessments] = await Promise.all([
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
              id: true,
              qualification: true,
              subjectCode: true,
              levelCode: true,
              validFrom: true,
              validUntil: true,
              status: true,
              documentId: true,
              sourceUri: true,
            },
          },
          licences: {
            orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              authorityCode: true,
              subjectCode: true,
              levelCode: true,
              validFrom: true,
              validUntil: true,
              status: true,
              documentId: true,
              sourceUri: true,
              externalReference: true,
            },
          },
        },
      }),
      this.prisma.teacherEligibilityAssessment.findMany({
        where: { tenantId: actor.tenantId, staffId },
        orderBy: { evaluatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          outcome: true,
          reasonCode: true,
          evaluatedAt: true,
          validUntil: true,
        },
      }),
    ]);
    const stateOf = withEvidenceState(now);
    const evidence: TeacherEvidenceChecklistItem[] = [
      ...(profile?.qualifications ?? []).map((row) => ({
        kind: 'QUALIFICATION' as const,
        label: canReadReferences ? row.qualification : 'Qualification',
        externalReference: null as string | null,
        row,
      })),
      ...(profile?.licences ?? []).map((row) => ({
        kind: 'LICENCE' as const,
        label: canReadReferences ? row.authorityCode : 'Teaching licence',
        externalReference: canReadReferences ? row.externalReference : null,
        row,
      })),
    ].map(({ kind, label, externalReference, row }) => ({
      id: row.id,
      kind,
      label,
      subjectCode: row.subjectCode,
      levelCode: row.levelCode,
      validFrom: row.validFrom.toISOString(),
      validUntil: iso(row.validUntil),
      status: row.status,
      effectiveState: stateOf(row).effectiveState,
      // Phase 7.10 (O3): references only with `hr:documents:read`.
      documentId: canReadReferences ? row.documentId : null,
      sourceUri: canReadReferences ? row.sourceUri : null,
      externalReference,
      referencesRedacted: !canReadReferences,
    }));
    return {
      staffId: staff.id,
      name: `${staff.firstName} ${staff.lastName}`.trim(),
      employeeId: staff.employeeId,
      evaluatedAt: now.toISOString(),
      horizonDays,
      state: evaluated.state,
      atRisk: evaluated.atRisk,
      primaryReasonCode: evaluated.primaryReasonCode,
      employment: evaluated.employment,
      profile: profile
        ? {
            id: profile.id,
            status: profile.status,
            effectiveFrom: profile.effectiveFrom.toISOString(),
            effectiveTo: iso(profile.effectiveTo),
          }
        : null,
      assignments: evaluated.assignmentResults.map(
        ({ row, decision, state }): TeacherEligibilityAssignmentResult => ({
          assignmentId: row.id,
          assignmentType: row.assignmentType,
          className: row.class.name,
          sectionName: row.section.name,
          subjectName: row.subject?.name ?? null,
          effectiveFrom: row.effectiveFrom.toISOString(),
          effectiveUntil: iso(row.effectiveUntil),
          state,
          reasonCode: decision.reasonCode,
          validUntil: iso(decision.validUntil),
          requirements: requirementView(decision.requirements),
          createdUnder: row.eligibilityAssessment
            ? {
                id: row.eligibilityAssessment.id,
                outcome: row.eligibilityAssessment.outcome,
                reasonCode: row.eligibilityAssessment.reasonCode,
                evaluatedAt:
                  row.eligibilityAssessment.evaluatedAt.toISOString(),
              }
            : null,
        }),
      ),
      upcomingAssignments: evaluated.upcoming.map((row) => ({
        assignmentId: row.id,
        className: row.class.name,
        sectionName: row.section.name,
        subjectName: row.subject?.name ?? null,
        effectiveFrom: row.effectiveFrom.toISOString(),
      })),
      evidence,
      blockingChanges: evaluated.blockingChanges,
      recentAssessments: assessments.map((row) => ({
        id: row.id,
        outcome: row.outcome,
        reasonCode: row.reasonCode,
        evaluatedAt: row.evaluatedAt.toISOString(),
        validUntil: iso(row.validUntil),
      })),
      roleIsNotEvidence: true,
    };
  }

  // ---- internals ----------------------------------------------------------

  /**
   * Teachers: active staff with a teacher profile, plus anyone (even an
   * inactive or terminated staff member) who still holds a current or future
   * ACTIVE assignment — that is exactly the case HR must see.
   */
  private async population(actor: AuthContext, search: string | undefined) {
    const now = new Date();
    const [profileRows, assignmentRows] = await Promise.all([
      this.prisma.teacherProfile.findMany({
        where: { tenantId: actor.tenantId },
        select: { staffId: true },
      }),
      this.prisma.teacherAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          status: 'ACTIVE',
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
        select: { staffId: true },
        distinct: ['staffId'],
      }),
    ]);
    const assigned = new Set(assignmentRows.map((row) => row.staffId));
    const candidateIds = new Set<string>([
      ...profileRows.map((row) => row.staffId),
      ...assigned,
    ]);
    if (candidateIds.size === 0) return { staff: [], truncated: false };
    const rows = await this.prisma.staff.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: [...candidateIds] },
        ...searchWhere(search),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        status: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
      take: WORKSPACE_POPULATION_LIMIT + 1,
    });
    const staff = rows
      // Active staff with a profile, or anyone who still holds an assignment.
      .filter((row) => row.status === 'ACTIVE' || assigned.has(row.id))
      .map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        employeeId: row.employeeId,
      }));
    return {
      staff: staff.slice(0, WORKSPACE_POPULATION_LIMIT),
      truncated: rows.length > WORKSPACE_POPULATION_LIMIT,
    };
  }

  private async evaluate(
    actor: AuthContext,
    staff: StaffRow[],
    now: Date,
    horizonDays: number,
  ): Promise<Evaluated[]> {
    if (staff.length === 0) return [];
    const horizonEnd = new Date(now.getTime() + horizonDays * DAY_MS);
    const staffIds = staff.map((row) => row.id);
    const assignments = (await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: { in: staffIds },
        status: 'ACTIVE',
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      select: {
        id: true,
        staffId: true,
        classId: true,
        subjectId: true,
        assignmentType: true,
        effectiveFrom: true,
        effectiveUntil: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
        eligibilityAssessment: {
          select: {
            id: true,
            outcome: true,
            reasonCode: true,
            evaluatedAt: true,
          },
        },
      },
      orderBy: [{ staffId: 'asc' }, { effectiveFrom: 'asc' }, { id: 'asc' }],
      take: ASSIGNMENT_SCAN_LIMIT,
    })) as AssignmentRow[];

    const current = assignments.filter((row) => row.effectiveFrom <= now);
    const facts = await this.eligibility.loadFacts(this.prisma, {
      tenantId: actor.tenantId,
      staffIds,
      classIds: [...new Set(current.map((row) => row.classId))],
      subjectIds: [
        ...new Set(
          current
            .map((row) => row.subjectId)
            .filter((value): value is string => value !== null),
        ),
      ],
      now,
      horizonEnd,
    });

    return staff.map((row) => {
      const mine = assignments.filter((item) => item.staffId === row.id);
      return this.evaluateStaff(
        row,
        facts,
        mine.filter((item) => item.effectiveFrom <= now),
        mine.filter((item) => item.effectiveFrom > now),
        horizonEnd,
      );
    });
  }

  private evaluateStaff(
    staff: StaffRow,
    facts: EligibilityFacts,
    current: AssignmentRow[],
    upcoming: AssignmentRow[],
    horizonEnd: Date,
  ): Evaluated {
    const employmentFacts = facts.employments.get(staff.id) ?? null;
    const profileFacts = facts.profiles.get(staff.id) ?? null;
    const employment: Evaluated['employment'] = employmentFacts
      ? {
          id: employmentFacts.id,
          effectiveFrom: employmentFacts.effectiveFrom.toISOString(),
          effectiveTo: iso(employmentFacts.effectiveTo),
          postCategoryCode: employmentFacts.postCategoryCode,
          employmentType: employmentFacts.employmentType,
        }
      : null;
    const qualifications = profileFacts
      ? (facts.qualifications.get(profileFacts.id) ?? [])
      : [];
    const licences = profileFacts
      ? (facts.licences.get(profileFacts.id) ?? [])
      : [];
    const pick = (list: EvidenceFacts[], id: string | null) =>
      id ? (list.find((item) => item.id === id) ?? null) : null;

    const results: Evaluated['assignmentResults'] = current.map((row) => {
      const decision = this.eligibility.decideFor(
        facts,
        staff.id,
        row.classId,
        row.subjectId,
      );
      return { row, decision, state: deriveEligibilityState(decision) };
    });
    const baseline =
      results.length === 0
        ? decideBaseline({
            staffActive: facts.activeStaff.has(staff.id),
            employment: employmentFacts,
            profile: profileFacts,
          })
        : null;
    const decisions = baseline
      ? [baseline]
      : results.map((result) => result.decision);
    const states = decisions.map(deriveEligibilityState);

    let worstIndex = 0;
    states.forEach((state, index) => {
      if (STATE_SEVERITY[state] > STATE_SEVERITY[states[worstIndex]])
        worstIndex = index;
    });
    const state = states[worstIndex];
    const worstDecision = decisions[worstIndex];

    // Blocking changes, de-duplicated across assignments.
    const merged = new Map<string, BlockingChange & { affected: number }>();
    const collectFor = (
      decision: EligibilityDecision,
      resourceClassId: string | null,
      resourceSubjectId: string | null,
      affectsAssignment: boolean,
    ) => {
      const classLevel =
        resourceClassId !== null
          ? facts.classLevels.get(resourceClassId)
          : undefined;
      const subject =
        resourceSubjectId !== null
          ? facts.subjects.get(resourceSubjectId)
          : undefined;
      const changes = collectBlockingChanges({
        now: facts.now,
        horizonEnd,
        decision,
        employment: employmentFacts,
        profile: profileFacts,
        matchedQualification: pick(qualifications, decision.qualificationId),
        matchedLicence: pick(licences, decision.licenceId),
        futurePolicies: facts.futurePolicies,
        resource:
          classLevel !== undefined
            ? {
                classFound: true,
                classLevel,
                subjectRequested: resourceSubjectId !== null,
                subjectFound: Boolean(subject),
                subjectCode: subject?.code ?? null,
              }
            : null,
      });
      for (const change of changes) {
        const prior = merged.get(change.ref);
        if (prior) prior.affected += affectsAssignment ? 1 : 0;
        else
          merged.set(change.ref, {
            ...change,
            affected: affectsAssignment ? 1 : 0,
          });
      }
    };
    if (baseline) collectFor(baseline, null, null, false);
    for (const result of results)
      collectFor(
        result.decision,
        result.row.classId,
        result.row.subjectId,
        true,
      );
    const blockingChanges: TeacherBlockingChange[] = [...merged.values()]
      .sort((a, b) => +a.at - +b.at || a.ref.localeCompare(b.ref))
      .map((change) => ({
        kind: change.kind,
        at: change.at.toISOString(),
        evidenceKind: change.evidenceKind,
        policyKey: change.policyKey,
        affectedAssignments: change.affected,
      }));

    const requirementsList = decisions
      .map((decision) => decision.requirements)
      .filter((value): value is EligibilityRequirements => value !== null);
    return {
      staff,
      state,
      atRisk: state === 'ELIGIBLE' && blockingChanges.length > 0,
      primaryReasonCode: worstDecision.reasonCode,
      policy: worstDecision.requirements
        ? policyRef(worstDecision.requirements.policy)
        : null,
      evidence: {
        qualification: worstEvidence(
          requirementsList.map((item) => item.qualification.status),
        ),
        licence: worstEvidence(
          requirementsList.map((item) => item.licence.status),
        ),
      },
      employment,
      assignmentResults: results,
      upcoming,
      blockingChanges,
      baseline,
    };
  }

  private toItem(item: Evaluated): TeacherEligibilityWorkspaceItem {
    const passing = item.assignmentResults.filter(
      (result) => result.state === 'ELIGIBLE',
    ).length;
    const needsReview = item.assignmentResults.filter(
      (result) => result.state === 'NEEDS_REVIEW',
    ).length;
    return {
      staffId: item.staff.id,
      name: `${item.staff.firstName} ${item.staff.lastName}`.trim(),
      employeeId: item.staff.employeeId,
      state: item.state,
      atRisk: item.atRisk,
      primaryReasonCode: item.primaryReasonCode,
      employment: item.employment,
      policy: item.policy,
      evidence: item.evidence,
      assignments: {
        current: item.assignmentResults.length,
        passing,
        needsReview,
        failing: item.assignmentResults.length - passing - needsReview,
        upcoming: item.upcoming.length,
      },
      nextBlockingChange: item.blockingChanges[0] ?? null,
      blockingChangeCount: item.blockingChanges.length,
    };
  }
}
