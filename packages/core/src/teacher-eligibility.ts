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
  CLASS_NOT_FOUND: "Class no longer exists",
  SUBJECT_NOT_FOUND: "Subject no longer exists",
});

export function teacherEligibilityReasonLabel(reasonCode: string): string {
  return (
    TEACHER_ELIGIBILITY_REASON_LABELS[reasonCode] ??
    "Not eligible under the applicable policy"
  );
}
