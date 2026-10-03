/**
 * Phase 5M: plain-language labels for professional-eligibility reason codes.
 * The server decides eligibility; clients only render these labels.
 */
export const TEACHER_ELIGIBILITY_REASON_LABELS: Readonly<
  Record<string, string>
> = Object.freeze({
  POLICY_REQUIREMENTS_SATISFIED: "Meets the applicable eligibility policy",
  EMPLOYMENT_INACTIVE: "Staff record is not active",
  EMPLOYMENT_UNVERIFIED: "No current verified employment",
  TEACHER_PROFILE_MISSING: "No active teacher profile",
  QUALIFICATION_UNVERIFIED:
    "No current verified qualification for this level/subject",
  TEACHING_LICENCE_UNVERIFIED:
    "Teaching licence missing, expired or revoked for this level/subject",
  TEACHER_POLICY_UNAVAILABLE: "No approved eligibility policy applies",
  TEACHER_POLICY_CONFLICT: "Conflicting eligibility policies apply",
  TEACHER_POLICY_CATALOG_LIMIT_REACHED:
    "Eligibility policy catalogue is too large to evaluate",
  NO_CURRENT_ASSIGNMENTS:
    "No current teaching assignment — policy is checked when a class or subject is assigned",
  CLASS_NOT_FOUND: "Class no longer exists",
  SUBJECT_NOT_FOUND: "Subject no longer exists",
});

export function teacherEligibilityReasonLabel(reasonCode: string): string {
  return (
    TEACHER_ELIGIBILITY_REASON_LABELS[reasonCode] ??
    "Not eligible under the applicable policy"
  );
}

// ---- Phase 7.10: HR teacher-eligibility workspace --------------------------
//
// Projection vocabulary only. The persisted eligibility outcome stays
// ELIGIBLE / INELIGIBLE; NEEDS_REVIEW means a person must act and the teacher
// is not at fault. None of this grants or revokes anything, and a Teacher
// role is never evidence.

export type TeacherEligibilityState =
  | "ELIGIBLE"
  | "NEEDS_REVIEW"
  | "INELIGIBLE";

export type TeacherEvidenceRequirementStatus =
  | "MATCHED"
  | "PENDING_REVIEW"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "REVOKED"
  | "MISSING";

export type TeacherBlockingChangeKind =
  | "EMPLOYMENT_ENDING"
  | "PROFILE_ENDING"
  | "EVIDENCE_EXPIRING"
  | "POLICY_ENDING"
  | "POLICY_REVISION_SCHEDULED";

export interface TeacherEligibilityPolicyRef {
  id: string;
  policyKey: string;
  version: number;
  scope: "NATIONAL" | "PROVINCE" | "DISTRICT" | "LOCAL_LEVEL" | "SCHOOL";
  sourceTitle: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface TeacherEvidenceRequirement {
  required: boolean;
  /** null when no applicable policy requires this evidence. */
  status: TeacherEvidenceRequirementStatus | null;
  matchedId: string | null;
  pendingId: string | null;
  validUntil: string | null;
}

export interface TeacherEligibilityRequirement {
  policy: TeacherEligibilityPolicyRef;
  /** Mandatory baselines that stay in force beside the selected policy. */
  baselines: TeacherEligibilityPolicyRef[];
  qualification: TeacherEvidenceRequirement;
  licence: TeacherEvidenceRequirement;
}

export interface TeacherBlockingChange {
  kind: TeacherBlockingChangeKind;
  /** ISO instant the change takes effect. */
  at: string;
  evidenceKind: "QUALIFICATION" | "LICENCE" | null;
  policyKey: string | null;
  affectedAssignments: number;
}

export interface TeacherEligibilityWorkspaceItem {
  staffId: string;
  name: string;
  employeeId: string;
  state: TeacherEligibilityState;
  /** Eligible today, but a blocking change falls inside the horizon. */
  atRisk: boolean;
  primaryReasonCode: string;
  employment: {
    id: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    postCategoryCode: string;
    employmentType: string;
  } | null;
  policy: TeacherEligibilityPolicyRef | null;
  evidence: {
    qualification: TeacherEvidenceRequirementStatus | null;
    licence: TeacherEvidenceRequirementStatus | null;
  };
  assignments: {
    current: number;
    passing: number;
    needsReview: number;
    failing: number;
    upcoming: number;
  };
  nextBlockingChange: TeacherBlockingChange | null;
  blockingChangeCount: number;
}

export interface TeacherEligibilityWorkspace {
  evaluatedAt: string;
  horizonDays: number;
  totals: {
    total: number;
    eligible: number;
    needsReview: number;
    ineligible: number;
    atRisk: number;
  };
  /** True when the school has more teachers than one evaluation covers. */
  truncated: boolean;
  page: number;
  limit: number;
  totalItems: number;
  items: TeacherEligibilityWorkspaceItem[];
}

export interface TeacherEligibilityAssignmentResult {
  assignmentId: string;
  assignmentType: string;
  className: string;
  sectionName: string;
  subjectName: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  state: TeacherEligibilityState;
  reasonCode: string;
  validUntil: string | null;
  requirements: TeacherEligibilityRequirement | null;
  /** The decision this assignment was created under (null = legacy row). */
  createdUnder: {
    id: string;
    outcome: string;
    reasonCode: string;
    evaluatedAt: string;
  } | null;
}

export interface TeacherEvidenceChecklistItem {
  id: string;
  kind: "QUALIFICATION" | "LICENCE";
  label: string;
  subjectCode: string | null;
  levelCode: string | null;
  validFrom: string;
  validUntil: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "REVOKED";
  effectiveState: string;
  /** Null when the viewer lacks `hr:documents:read`. */
  documentId: string | null;
  sourceUri: string | null;
  externalReference: string | null;
  referencesRedacted: boolean;
}

export interface TeacherEligibilitySummary {
  staffId: string;
  name: string;
  employeeId: string;
  evaluatedAt: string;
  horizonDays: number;
  state: TeacherEligibilityState;
  atRisk: boolean;
  primaryReasonCode: string;
  employment: TeacherEligibilityWorkspaceItem["employment"];
  profile: {
    id: string;
    status: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  assignments: TeacherEligibilityAssignmentResult[];
  upcomingAssignments: Array<{
    assignmentId: string;
    className: string;
    sectionName: string;
    subjectName: string | null;
    effectiveFrom: string;
  }>;
  evidence: TeacherEvidenceChecklistItem[];
  blockingChanges: TeacherBlockingChange[];
  recentAssessments: Array<{
    id: string;
    outcome: string;
    reasonCode: string;
    evaluatedAt: string;
    validUntil: string | null;
  }>;
  roleIsNotEvidence: true;
}

export const TEACHER_ELIGIBILITY_STATE_LABELS: Readonly<
  Record<TeacherEligibilityState, string>
> = Object.freeze({
  ELIGIBLE: "Eligible",
  NEEDS_REVIEW: "Needs review",
  INELIGIBLE: "Ineligible",
});

export const TEACHER_EVIDENCE_STATUS_LABELS: Readonly<
  Record<TeacherEvidenceRequirementStatus, string>
> = Object.freeze({
  MATCHED: "Verified",
  PENDING_REVIEW: "Pending review",
  NOT_YET_VALID: "Not yet valid",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
  MISSING: "Missing",
});

export function teacherBlockingChangeLabel(
  change: Pick<TeacherBlockingChange, "kind" | "evidenceKind">,
): string {
  switch (change.kind) {
    case "EMPLOYMENT_ENDING":
      return "Employment ends";
    case "PROFILE_ENDING":
      return "Teacher profile ends";
    case "POLICY_ENDING":
      return "Applicable policy ends";
    case "POLICY_REVISION_SCHEDULED":
      return "A new policy revision takes effect";
    case "EVIDENCE_EXPIRING":
      return change.evidenceKind === "LICENCE"
        ? "Teaching licence expires"
        : "Qualification expires";
  }
}

/** Attention items shown beside the state chip (never a persisted reason). */
export const TEACHER_ATTENTION_LABELS: Readonly<Record<string, string>> =
  Object.freeze({
    EMPLOYMENT_ENDING: "Employment is ending soon",
    EVIDENCE_EXPIRING: "Evidence is expiring soon",
    EVIDENCE_PENDING_REVIEW: "Evidence is waiting for review",
    POLICY_REVISION_SCHEDULED: "A policy revision is scheduled",
  });
