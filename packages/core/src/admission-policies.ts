export const ADMISSION_POLICY_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "SCHEDULED",
  "EXPIRED",
  "ARCHIVED",
  "NEEDS_REVIEW",
] as const;

export const ADMISSION_POLICY_APPLICANT_TYPES = [
  "NEW",
  "TRANSFER",
  "BOTH",
] as const;

export const ADMISSION_DOCUMENT_TIMINGS = [
  "BEFORE_REVIEW",
  "BEFORE_ENROLLMENT",
] as const;

export type AdmissionPolicyStatus = (typeof ADMISSION_POLICY_STATUSES)[number];
export type AdmissionPolicyApplicantType =
  (typeof ADMISSION_POLICY_APPLICANT_TYPES)[number];
export type AdmissionDocumentTiming =
  (typeof ADMISSION_DOCUMENT_TIMINGS)[number];

export type AdmissionPolicyResolutionCandidate = {
  policyId: string;
  name: string;
};

export type AdmissionPolicyResolution = {
  policyId: string | null;
  versionId: string | null;
  policyName: string | null;
  reason: string;
  ambiguous: boolean;
  candidates: AdmissionPolicyResolutionCandidate[];
};

export type AdmissionPolicyDocumentRequirement = {
  id: string;
  documentKind: string;
  label: string;
  isRequired: boolean;
  requiresOriginalVerification: boolean;
  timing: AdmissionDocumentTiming;
  expiresAfterDays: number | null;
  canBeWaived: boolean;
  waivableByRoleKeys: string[];
  sortOrder: number;
};

export type AdmissionPolicyVersionSummary = {
  id: string;
  policyId: string;
  version: number;
  status: AdmissionPolicyStatus;
  admissionMode: "DIRECT_ALLOWED" | "REVIEW_REQUIRED";
  transferStudent: boolean | null;
  requiredFields: string[];
  requireSection: boolean;
  requireDocumentReview: boolean;
  requireInterview: boolean;
  requirePrincipalApproval: boolean;
  requireTransferCertificate: boolean;
  requirePriorMarksheet: boolean;
  requireStreamOrMarksReview: boolean;
  allowAdmissionWithDocumentsPending: boolean;
  enforceCapacityWhenAvailable: boolean;
  capacityOverride: number | null;
  approvalLevel: string | null;
  notesForOffice: string | null;
  activatedAt: string | null;
  createdAt: string;
  documentRequirements?: AdmissionPolicyDocumentRequirement[];
};

export type AdmissionPolicySummary = {
  id: string;
  name: string;
  status: AdmissionPolicyStatus;
  academicYearId: string | null;
  classId: string | null;
  gradeBand: string | null;
  applicantType: AdmissionPolicyApplicantType;
  source: string | null;
  isDefault: boolean;
  currentVersionId: string | null;
  updatedAt: string;
  admissionMode: "DIRECT_ALLOWED" | "REVIEW_REQUIRED";
  requiredDocumentCount: number;
  assessment: string;
  approvalLevel: string | null;
};

export type AdmissionPolicyListResponse = {
  summary: {
    activePolicies: number;
    policiesNeedingReview: number;
    applicationsWaitingForDocuments: number;
    applicationsWaitingForDecision: number;
  };
  policies: AdmissionPolicySummary[];
};

export type AdmissionPolicyDetail = AdmissionPolicySummary & {
  currentVersion: AdmissionPolicyVersionSummary | null;
  draftVersion: AdmissionPolicyVersionSummary | null;
  versions: AdmissionPolicyVersionSummary[];
};

export type AdmissionPolicyAuditEvent = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type CreateAdmissionPolicyPayload = {
  name: string;
  academicYearId?: string;
  classId?: string;
  gradeBand?: string;
  applicantType?: AdmissionPolicyApplicantType;
  source?: string;
};

export type UpdateAdmissionPolicyIdentityPayload =
  Partial<CreateAdmissionPolicyPayload>;

export type UpdateAdmissionPolicyVersionPayload = Partial<{
  admissionMode: "DIRECT_ALLOWED" | "REVIEW_REQUIRED";
  transferStudent: boolean;
  requiredFields: string[];
  requireSection: boolean;
  requireDocumentReview: boolean;
  requireInterview: boolean;
  requirePrincipalApproval: boolean;
  requireTransferCertificate: boolean;
  requirePriorMarksheet: boolean;
  requireStreamOrMarksReview: boolean;
  allowAdmissionWithDocumentsPending: boolean;
  enforceCapacityWhenAvailable: boolean;
  capacityOverride: number;
  approvalLevel: string;
  notesForOffice: string;
}>;

export type UpsertDocumentRequirementPayload = {
  documentKind: string;
  label: string;
  isRequired?: boolean;
  requiresOriginalVerification?: boolean;
  timing?: AdmissionDocumentTiming;
  expiresAfterDays?: number;
  canBeWaived?: boolean;
  waivableByRoleKeys?: string[];
  sortOrder?: number;
};
