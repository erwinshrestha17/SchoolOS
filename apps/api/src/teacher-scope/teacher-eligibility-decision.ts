import { TeacherEligibilityOutcome } from '@prisma/client';

/**
 * Phase 7.10 — the pure teacher-eligibility decision.
 *
 * `TeacherProfessionalEligibilityService` loads facts (single staff or a
 * batch) and calls `decideEligibility`. There is one decision procedure, so a
 * single assignment preflight, the read-only projection, the exceptions report
 * and the HR workspace can never disagree. Nothing here reads the database,
 * persists anything or grants anything: the result is a projection, and live
 * authority is still re-checked by `schoolos_teacher_eligibility_live` on
 * every authoritative write.
 */

export type PolicyScope =
  | 'NATIONAL'
  | 'PROVINCE'
  | 'DISTRICT'
  | 'LOCAL_LEVEL'
  | 'SCHOOL';

export interface PolicyFacts {
  id: string;
  policyKey: string;
  version: number;
  scope: PolicyScope;
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
}

export interface EmploymentFacts {
  id: string;
  localLevelId: number | null;
  districtId: number | null;
  provinceId: number | null;
  schoolTypeCode: string;
  employmentType: string;
  postCategoryCode: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface EvidenceFacts {
  id: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  subjectCode: string | null;
  levelCode: string | null;
  validFrom: Date;
  validUntil: Date | null;
}

export interface ResourceFacts {
  classFound: boolean;
  classLevel: number;
  subjectRequested: boolean;
  subjectFound: boolean;
  subjectCode: string | null;
}

export interface DecideInput {
  now: Date;
  staffActive: boolean;
  employment: EmploymentFacts | null;
  profile: { id: string; effectiveTo: Date | null } | null;
  resource: ResourceFacts;
  /** Approved policies effective at `now`, already limited to the school. */
  catalogue: PolicyFacts[];
  catalogueLimitReached: boolean;
  qualifications: EvidenceFacts[];
  licences: EvidenceFacts[];
}

export type EvidenceRequirementStatus =
  | 'MATCHED'
  | 'PENDING_REVIEW'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'MISSING';

export interface EvidenceRequirement {
  required: boolean;
  /** null when the selected policy and baselines do not require it. */
  status: EvidenceRequirementStatus | null;
  matchedId: string | null;
  pendingId: string | null;
  validUntil: Date | null;
}

export interface PolicyReference {
  id: string;
  policyKey: string;
  version: number;
  scope: PolicyScope;
  specificity: number;
  sourceTitle: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface EligibilityRequirements {
  policy: PolicyReference;
  /** Mandatory baselines that stay in force beside the selected policy. */
  baselines: PolicyReference[];
  qualification: EvidenceRequirement;
  licence: EvidenceRequirement;
}

/**
 * Reasons that stop the evaluation before any evidence is considered. The
 * assignment preflight rejects these without persisting a snapshot, exactly as
 * before 7.10.
 */
export const STRUCTURAL_REASON_CODES = [
  'EMPLOYMENT_INACTIVE',
  'EMPLOYMENT_UNVERIFIED',
  'TEACHER_PROFILE_MISSING',
  'CLASS_NOT_FOUND',
  'SUBJECT_NOT_FOUND',
  'TEACHER_POLICY_CATALOG_LIMIT_REACHED',
  'TEACHER_POLICY_UNAVAILABLE',
  'TEACHER_POLICY_CONFLICT',
] as const;

export interface EligibilityDecision {
  outcome: TeacherEligibilityOutcome;
  reasonCode: string;
  /** True when the preflight refuses without an audit snapshot. */
  structural: boolean;
  profileId: string | null;
  employmentId: string | null;
  policyVersionId: string | null;
  qualificationId: string | null;
  licenceId: string | null;
  validUntil: Date | null;
  requirements: EligibilityRequirements | null;
}

const SCOPE_RANK: Record<PolicyScope, number> = {
  NATIONAL: 0,
  PROVINCE: 1,
  DISTRICT: 2,
  LOCAL_LEVEL: 3,
  SCHOOL: 4,
};

export function policySpecificity(policy: PolicyFacts): number {
  return (
    Number(policy.schoolTypeCode !== null) +
    Number(policy.employmentType !== null) +
    Number(policy.postCategoryCode !== null) +
    Number(policy.classLevelMin !== null || policy.classLevelMax !== null) +
    Number(policy.subjectCode !== null)
  );
}

export function policyScopeRank(policy: PolicyFacts): number {
  return SCOPE_RANK[policy.scope];
}

/** Does `policy` apply to this employment and teaching resource? */
export function policyApplies(
  policy: PolicyFacts,
  employment: EmploymentFacts,
  resource: ResourceFacts,
  tenantId?: string,
): boolean {
  const scopeMatches =
    policy.scope === 'NATIONAL' ||
    (policy.scope === 'SCHOOL' &&
      (tenantId === undefined || policy.tenantId === tenantId) &&
      policy.localLevelId === employment.localLevelId) ||
    (policy.scope === 'LOCAL_LEVEL' &&
      employment.localLevelId !== null &&
      policy.localLevelId === employment.localLevelId) ||
    (policy.scope === 'DISTRICT' &&
      employment.districtId !== null &&
      policy.districtId === employment.districtId) ||
    (policy.scope === 'PROVINCE' &&
      employment.provinceId !== null &&
      policy.provinceId === employment.provinceId);
  return (
    scopeMatches &&
    (policy.schoolTypeCode === null ||
      policy.schoolTypeCode === employment.schoolTypeCode) &&
    (policy.employmentType === null ||
      policy.employmentType === employment.employmentType) &&
    (policy.postCategoryCode === null ||
      policy.postCategoryCode === employment.postCategoryCode) &&
    (policy.classLevelMin === null ||
      policy.classLevelMin <= resource.classLevel) &&
    (policy.classLevelMax === null ||
      policy.classLevelMax >= resource.classLevel) &&
    (policy.subjectCode === null || policy.subjectCode === resource.subjectCode)
  );
}

function reference(policy: PolicyFacts): PolicyReference {
  return {
    id: policy.id,
    policyKey: policy.policyKey,
    version: policy.version,
    scope: policy.scope,
    specificity: policySpecificity(policy),
    sourceTitle: policy.sourceTitle,
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo,
  };
}

function structuralDecision(reasonCode: string): EligibilityDecision {
  return {
    outcome: TeacherEligibilityOutcome.INELIGIBLE,
    reasonCode,
    structural: true,
    profileId: null,
    employmentId: null,
    policyVersionId: null,
    qualificationId: null,
    licenceId: null,
    validUntil: null,
    requirements: null,
  };
}

function evidenceMatches(
  evidence: EvidenceFacts,
  resource: ResourceFacts,
): boolean {
  return (
    (evidence.subjectCode === null ||
      evidence.subjectCode === resource.subjectCode) &&
    (evidence.levelCode === null ||
      evidence.levelCode === String(resource.classLevel))
  );
}

function newestFirst(left: EvidenceFacts, right: EvidenceFacts): number {
  return (
    +right.validFrom - +left.validFrom ||
    (left.id < right.id ? 1 : left.id > right.id ? -1 : 0)
  );
}

const STATUS_PRIORITY: Record<EvidenceRequirementStatus, number> = {
  MATCHED: 5,
  PENDING_REVIEW: 4,
  NOT_YET_VALID: 3,
  EXPIRED: 2,
  REVOKED: 1,
  MISSING: 0,
};

/**
 * Which evidence satisfies (or nearly satisfies) one requirement. Only a
 * VERIFIED row inside its validity window can match; the other states exist so
 * HR can see why a teacher is blocked and what would unblock them.
 */
export function evaluateEvidenceRequirement(
  required: boolean,
  evidence: EvidenceFacts[],
  resource: ResourceFacts,
  now: Date,
): { requirement: EvidenceRequirement; matched: EvidenceFacts | null } {
  if (!required) {
    return {
      requirement: {
        required: false,
        status: null,
        matchedId: null,
        pendingId: null,
        validUntil: null,
      },
      matched: null,
    };
  }
  const candidates = evidence
    .filter((row) => evidenceMatches(row, resource))
    .sort(newestFirst);
  const matched =
    candidates.find(
      (row) =>
        row.status === 'VERIFIED' &&
        row.validFrom <= now &&
        (row.validUntil === null || row.validUntil > now),
    ) ?? null;
  if (matched) {
    return {
      requirement: {
        required: true,
        status: 'MATCHED',
        matchedId: matched.id,
        pendingId: null,
        validUntil: matched.validUntil,
      },
      matched,
    };
  }
  const pending =
    candidates.find(
      (row) =>
        row.status === 'PENDING' &&
        (row.validUntil === null || row.validUntil > now),
    ) ?? null;
  let status: EvidenceRequirementStatus = 'MISSING';
  const consider = (candidate: EvidenceRequirementStatus) => {
    if (STATUS_PRIORITY[candidate] > STATUS_PRIORITY[status])
      status = candidate;
  };
  if (pending) consider('PENDING_REVIEW');
  for (const row of candidates) {
    if (row.status === 'VERIFIED') {
      consider(row.validFrom > now ? 'NOT_YET_VALID' : 'EXPIRED');
    } else if (row.status === 'REVOKED') {
      consider('REVOKED');
    }
  }
  return {
    requirement: {
      required: true,
      status,
      matchedId: null,
      pendingId: pending?.id ?? null,
      validUntil: null,
    },
    matched: null,
  };
}

/**
 * Baseline checks that do not depend on a class or subject: active staff,
 * authoritative employment, active teacher profile. Used for teachers with no
 * current assignment, where no class is invented to pick a policy.
 */
export function decideBaseline(
  input: Pick<DecideInput, 'staffActive' | 'employment' | 'profile'>,
): EligibilityDecision {
  if (!input.staffActive) return structuralDecision('EMPLOYMENT_INACTIVE');
  if (!input.employment) return structuralDecision('EMPLOYMENT_UNVERIFIED');
  if (!input.profile) {
    return {
      ...structuralDecision('TEACHER_PROFILE_MISSING'),
      employmentId: input.employment.id,
    };
  }
  const ends = [input.employment.effectiveTo, input.profile.effectiveTo].filter(
    (value): value is Date => value instanceof Date,
  );
  return {
    outcome: TeacherEligibilityOutcome.ELIGIBLE,
    reasonCode: 'NO_CURRENT_ASSIGNMENTS',
    structural: false,
    profileId: input.profile.id,
    employmentId: input.employment.id,
    policyVersionId: null,
    qualificationId: null,
    licenceId: null,
    validUntil:
      ends.length > 0 ? new Date(Math.min(...ends.map((d) => +d))) : null,
    requirements: null,
  };
}

/**
 * The single decision procedure. Order of refusals is part of the contract:
 * the assignment preflight maps `structural` refusals to "no snapshot" and
 * evidence refusals to a persisted INELIGIBLE snapshot.
 */
export function decideEligibility(input: DecideInput): EligibilityDecision {
  const baseline = decideBaseline(input);
  if (baseline.structural) return baseline;
  const { employment } = input;
  // decideBaseline already refused a missing employment; this narrows the type.
  if (!employment) return structuralDecision('EMPLOYMENT_UNVERIFIED');
  const profile = input.profile as { id: string; effectiveTo: Date | null };
  const { resource, now } = input;
  if (!resource.classFound) return structuralDecision('CLASS_NOT_FOUND');
  if (resource.subjectRequested && !resource.subjectFound)
    return structuralDecision('SUBJECT_NOT_FOUND');
  if (input.catalogueLimitReached)
    return structuralDecision('TEACHER_POLICY_CATALOG_LIMIT_REACHED');

  const matching = input.catalogue.filter((policy) =>
    policyApplies(policy, employment, resource),
  );
  const latestByKey = new Map<string, PolicyFacts>();
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
  if (applicable.length === 0)
    return structuralDecision('TEACHER_POLICY_UNAVAILABLE');

  applicable.sort(
    (left, right) =>
      policyScopeRank(right) - policyScopeRank(left) ||
      policySpecificity(right) - policySpecificity(left) ||
      +right.effectiveFrom - +left.effectiveFrom ||
      right.version - left.version,
  );
  const policy = applicable[0];
  if (applicable.length > 1) {
    const peer = applicable[1];
    if (
      peer.policyKey !== policy.policyKey &&
      policyScopeRank(peer) === policyScopeRank(policy) &&
      policySpecificity(peer) === policySpecificity(policy) &&
      +peer.effectiveFrom === +policy.effectiveFrom
    ) {
      return structuralDecision('TEACHER_POLICY_CONFLICT');
    }
  }

  // Mandatory baselines remain in force even when a school policy is more
  // specific. The review trigger also prevents a school override that
  // explicitly weakens a currently approved mandatory requirement.
  const governing = applicable.filter(
    (item) => item.id === policy.id || item.isMandatoryBaseline,
  );
  const requiresQualification = governing.some(
    (item) => item.requiresQualification === true,
  );
  const requiresLicence = governing.some(
    (item) => item.requiresLicence === true,
  );

  const qualification = evaluateEvidenceRequirement(
    requiresQualification,
    input.qualifications,
    resource,
    now,
  );
  const licence = evaluateEvidenceRequirement(
    requiresLicence,
    input.licences,
    resource,
    now,
  );
  const reason =
    requiresQualification && !qualification.matched
      ? 'QUALIFICATION_UNVERIFIED'
      : requiresLicence && !licence.matched
        ? 'TEACHING_LICENCE_UNVERIFIED'
        : 'POLICY_REQUIREMENTS_SATISFIED';
  const endDates = [
    employment.effectiveTo,
    profile.effectiveTo,
    policy.effectiveTo,
    qualification.matched?.validUntil,
    licence.matched?.validUntil,
  ].filter((value): value is Date => value instanceof Date);
  return {
    outcome:
      reason === 'POLICY_REQUIREMENTS_SATISFIED'
        ? TeacherEligibilityOutcome.ELIGIBLE
        : TeacherEligibilityOutcome.INELIGIBLE,
    reasonCode: reason,
    structural: false,
    profileId: profile.id,
    employmentId: employment.id,
    policyVersionId: policy.id,
    qualificationId: qualification.matched?.id ?? null,
    licenceId: licence.matched?.id ?? null,
    validUntil:
      endDates.length > 0
        ? new Date(Math.min(...endDates.map((value) => +value)))
        : null,
    requirements: {
      policy: reference(policy),
      baselines: applicable
        .filter((item) => item.isMandatoryBaseline && item.id !== policy.id)
        .map(reference),
      qualification: qualification.requirement,
      licence: licence.requirement,
    },
  };
}

// ---- workspace state ------------------------------------------------------

export type EligibilityState = 'ELIGIBLE' | 'NEEDS_REVIEW' | 'INELIGIBLE';

const NEEDS_PERSON_REASONS = new Set([
  'TEACHER_POLICY_CONFLICT',
  'TEACHER_POLICY_UNAVAILABLE',
  'TEACHER_POLICY_CATALOG_LIMIT_REACHED',
]);

/**
 * Projection vocabulary for the HR workspace. The persisted outcome stays
 * ELIGIBLE/INELIGIBLE; NEEDS_REVIEW means "a person must act, and it is not
 * the teacher's fault": a policy that cannot be resolved, or evidence that
 * would satisfy the policy once it is reviewed.
 */
export function deriveEligibilityState(
  decision: EligibilityDecision,
): EligibilityState {
  if (decision.outcome === TeacherEligibilityOutcome.ELIGIBLE)
    return 'ELIGIBLE';
  if (NEEDS_PERSON_REASONS.has(decision.reasonCode)) return 'NEEDS_REVIEW';
  const requirements = decision.requirements;
  if (!requirements) return 'INELIGIBLE';
  const unmet = [requirements.qualification, requirements.licence].filter(
    (item) => item.required && item.status !== 'MATCHED',
  );
  return unmet.length > 0 &&
    unmet.every((item) => item.status === 'PENDING_REVIEW')
    ? 'NEEDS_REVIEW'
    : 'INELIGIBLE';
}

export const STATE_SEVERITY: Record<EligibilityState, number> = {
  INELIGIBLE: 2,
  NEEDS_REVIEW: 1,
  ELIGIBLE: 0,
};

// ---- blocking changes -----------------------------------------------------

export type BlockingChangeKind =
  | 'EMPLOYMENT_ENDING'
  | 'PROFILE_ENDING'
  | 'EVIDENCE_EXPIRING'
  | 'POLICY_ENDING'
  | 'POLICY_REVISION_SCHEDULED';

export interface BlockingChange {
  kind: BlockingChangeKind;
  at: Date;
  evidenceKind: 'QUALIFICATION' | 'LICENCE' | null;
  /** Stable reference for de-duplication across assignments. */
  ref: string;
  policyKey: string | null;
}

export const MIN_HORIZON_DAYS = 1;
export const MAX_HORIZON_DAYS = 180;
export const DEFAULT_HORIZON_DAYS = 30;

export function clampHorizonDays(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value))
    return DEFAULT_HORIZON_DAYS;
  return Math.min(
    MAX_HORIZON_DAYS,
    Math.max(MIN_HORIZON_DAYS, Math.trunc(value)),
  );
}

function within(
  date: Date | null | undefined,
  now: Date,
  end: Date,
): date is Date {
  return date instanceof Date && date > now && date <= end;
}

/**
 * Dated events inside the horizon that will end (or re-decide) a currently
 * eligible result. Derived from the same facts as the decision; it never
 * changes the decision.
 */
export function collectBlockingChanges(input: {
  now: Date;
  horizonEnd: Date;
  decision: EligibilityDecision;
  employment: EmploymentFacts | null;
  profile: { id: string; effectiveTo: Date | null } | null;
  matchedQualification: EvidenceFacts | null;
  matchedLicence: EvidenceFacts | null;
  futurePolicies: PolicyFacts[];
  resource: ResourceFacts | null;
}): BlockingChange[] {
  const { now, horizonEnd, decision, employment, profile } = input;
  const out: BlockingChange[] = [];
  if (employment && within(employment.effectiveTo, now, horizonEnd)) {
    out.push({
      kind: 'EMPLOYMENT_ENDING',
      at: employment.effectiveTo,
      evidenceKind: null,
      ref: `employment:${employment.id}`,
      policyKey: null,
    });
  }
  if (profile && within(profile.effectiveTo, now, horizonEnd)) {
    out.push({
      kind: 'PROFILE_ENDING',
      at: profile.effectiveTo,
      evidenceKind: null,
      ref: `profile:${profile.id}`,
      policyKey: null,
    });
  }
  if (decision.requirements) {
    const policy = decision.requirements.policy;
    if (within(policy.effectiveTo, now, horizonEnd)) {
      out.push({
        kind: 'POLICY_ENDING',
        at: policy.effectiveTo,
        evidenceKind: null,
        ref: `policy-end:${policy.id}`,
        policyKey: policy.policyKey,
      });
    }
    for (const [kind, evidence] of [
      ['QUALIFICATION', input.matchedQualification],
      ['LICENCE', input.matchedLicence],
    ] as const) {
      if (evidence && within(evidence.validUntil, now, horizonEnd)) {
        out.push({
          kind: 'EVIDENCE_EXPIRING',
          at: evidence.validUntil,
          evidenceKind: kind,
          ref: `evidence:${evidence.id}`,
          policyKey: null,
        });
      }
    }
    if (employment && input.resource) {
      const selected = decision.requirements.policy;
      const selectedRank = SCOPE_RANK[selected.scope];
      for (const future of input.futurePolicies) {
        if (!within(future.effectiveFrom, now, horizonEnd)) continue;
        if (!policyApplies(future, employment, input.resource)) continue;
        const sameLineage = future.policyKey === selected.policyKey;
        const outranks =
          policyScopeRank(future) > selectedRank ||
          (policyScopeRank(future) === selectedRank &&
            policySpecificity(future) >= selected.specificity);
        if (!sameLineage && !outranks) continue;
        out.push({
          kind: 'POLICY_REVISION_SCHEDULED',
          at: future.effectiveFrom,
          evidenceKind: null,
          ref: `policy-start:${future.id}`,
          policyKey: future.policyKey,
        });
      }
    }
  }
  return out.sort((a, b) => +a.at - +b.at || a.ref.localeCompare(b.ref));
}
