import type {
  AdmissionDocumentTiming,
  AdmissionPolicyResolution,
} from "./admission-policies.js";
import type { EducationProgram } from "./types.js";

export const ADMISSION_CASE_DISPLAY_STATUSES = [
  "DRAFT",
  "NEEDS_INFORMATION",
  "READY_TO_ADMIT",
  "WAITING_FOR_REVIEW",
  "WAITLISTED",
  "APPROVED",
  "ADMITTED",
  "NOT_ADMITTED",
  "CLOSED",
] as const;

export const ADMISSION_CASE_SOURCES = [
  "OFFICE_WALK_IN",
  "PARENT_ONLINE",
  "PHONE_INQUIRY",
  "TRANSFER_REQUEST",
  "IMPORT",
] as const;

/**
 * Admission-policy fields that the case evaluator can resolve from persisted
 * application data. Keeping this list in the shared contract prevents a
 * policy from creating a blocker that no API or client can satisfy.
 */
export const ADMISSION_POLICY_REQUIRED_FIELDS = [
  "firstNameEn",
  "lastNameEn",
  "firstNameNp",
  "lastNameNp",
  "dateOfBirth",
  "gender",
  "guardianFullName",
  "guardianRelation",
  "guardianPhone",
  "guardianEmail",
  "academicYearId",
  "classId",
  "sectionId",
  "previousSchool",
  "admissionDate",
  "nationalStudentId",
  "emergencyName",
  "emergencyPhone",
] as const;

export const ADMISSION_CASE_REVIEW_ACTIONS = [
  "REQUEST_INFORMATION",
  "ASSIGN_REVIEWER",
  "MARK_READY_FOR_REVIEW",
  "APPROVE",
  "REJECT",
  "ESCALATE_TO_PRINCIPAL",
  "CLOSE",
  "WAITLIST",
  "PROMOTE_FROM_WAITLIST",
] as const;

export const ADMISSION_ASSESSMENT_TABS = [
  "TODAY",
  "UPCOMING",
  "AWAITING_RESULTS",
] as const;

export const ADMISSION_ASSESSMENT_MODES = [
  "IN_PERSON",
  "PHONE",
  "ONLINE",
  "WRITTEN",
] as const;

export const ADMISSION_ASSESSMENT_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const ADMISSION_ASSESSMENT_RESULTS = [
  "PASSED",
  "NEEDS_FOLLOW_UP",
  "FAILED",
  "NO_SHOW",
] as const;

export type AdmissionCaseDisplayStatus =
  (typeof ADMISSION_CASE_DISPLAY_STATUSES)[number];
export type AdmissionCaseSource = (typeof ADMISSION_CASE_SOURCES)[number];
export type AdmissionPolicyRequiredField =
  (typeof ADMISSION_POLICY_REQUIRED_FIELDS)[number];
export type AdmissionCaseReviewAction =
  (typeof ADMISSION_CASE_REVIEW_ACTIONS)[number];
export type AdmissionAssessmentTab = (typeof ADMISSION_ASSESSMENT_TABS)[number];
export type AdmissionAssessmentMode =
  (typeof ADMISSION_ASSESSMENT_MODES)[number];
export type AdmissionAssessmentStatus =
  (typeof ADMISSION_ASSESSMENT_STATUSES)[number];
export type AdmissionAssessmentResult =
  (typeof ADMISSION_ASSESSMENT_RESULTS)[number];

export const ADMISSION_CASE_QUEUE_NAMES = [
  "NEEDS_INFORMATION",
  "WAITING_FOR_REVIEW",
  "READY_TO_ADMIT",
  "WAITLISTED",
  "APPROVED",
  "NOT_ADMITTED",
  "DOCUMENTS_PENDING",
  "DUPLICATE_WARNINGS",
  "COMPLETED",
] as const;

export type AdmissionCaseQueueName =
  (typeof ADMISSION_CASE_QUEUE_NAMES)[number];

export type AdmissionWaitlistCapacity = {
  state: "NOT_CONFIGURED" | "AVAILABLE" | "NEARLY_FULL" | "FULL";
  capacity: number | null;
  enrolled: number | null;
  seatsAvailable: number | null;
  enforced: boolean;
};

export type AdmissionCaseQueueItem = {
  id: string;
  displayStatus: AdmissionCaseDisplayStatus;
  fullNameEn: string;
  guardianFullName: string | null;
  guardianPhone: string | null;
  source: AdmissionCaseSource;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  admittedStudentId: string | null;
  hasDuplicateWarning: boolean;
  hasDocumentsPending: boolean;
  waitlistCapacity: AdmissionWaitlistCapacity | null;
  canPromoteFromWaitlist: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionCaseQueuePage = {
  items: AdmissionCaseQueueItem[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type AdmissionCaseDocumentReference = {
  fileId: string;
  kind: string;
  title?: string | null;
};

export type AdmissionCaseDocumentWaiver = {
  documentKind: string;
  reason: string;
  at: string;
  byUserId: string;
};

export type WaiveCaseDocumentPayload = {
  documentKind: string;
  reason?: string;
};

export type AdmissionDocumentRequestMissingDocument = {
  documentKind: string;
  label: string;
  timing: AdmissionDocumentTiming;
  requiresOriginalVerification: boolean;
  canBeWaived: boolean;
};

export type AdmissionDocumentRequestItem = {
  admissionCaseId: string;
  admittedStudentId: string | null;
  applicantName: string;
  guardianFullName: string | null;
  guardianPhone: string | null;
  classId: string | null;
  className: string | null;
  program: EducationProgram | null;
  displayStatus: AdmissionCaseDisplayStatus;
  policyId: string | null;
  policyName: string | null;
  missingDocuments: AdmissionDocumentRequestMissingDocument[];
  daysPending: number;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionDocumentRequestSummary = {
  casesWithRequests: number;
  totalMissingDocuments: number;
  beforeReviewDocuments: number;
  beforeEnrollmentDocuments: number;
  casesWithoutGuardianPhone: number;
  oldestDaysPending: number;
};

export type AdmissionDocumentRequestPage = {
  items: AdmissionDocumentRequestItem[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  scanComplete: boolean;
  summary: AdmissionDocumentRequestSummary;
};

export const ADMISSION_DOCUMENT_REMINDER_STATES = [
  "QUEUED",
  "ALREADY_QUEUED",
  "SKIPPED",
] as const;

export type AdmissionDocumentReminderState =
  (typeof ADMISSION_DOCUMENT_REMINDER_STATES)[number];

export const ADMISSION_DOCUMENT_REMINDER_SKIP_REASONS = [
  "CASE_UNAVAILABLE",
  "CASE_CLOSED",
  "NO_GUARDIAN_PHONE",
  "NO_LONGER_MISSING",
  "DELIVERY_UNAVAILABLE",
] as const;

export type AdmissionDocumentReminderSkipReason =
  (typeof ADMISSION_DOCUMENT_REMINDER_SKIP_REASONS)[number];

export type RequestAdmissionDocumentRemindersPayload = {
  admissionCaseIds: string[];
};

export type AdmissionDocumentReminderResult = {
  admissionCaseId: string;
  state: AdmissionDocumentReminderState;
  reason: AdmissionDocumentReminderSkipReason | null;
};

export type AdmissionDocumentReminderBatchResult = {
  requested: number;
  queued: number;
  alreadyQueued: number;
  skipped: number;
  results: AdmissionDocumentReminderResult[];
};

export type AdmissionAssessmentSessionSummary = {
  id: string;
  admissionCaseId: string;
  applicantName: string;
  guardianFullName: string | null;
  guardianPhone: string | null;
  classId: string | null;
  className: string | null;
  program: EducationProgram | null;
  displayStatus: AdmissionCaseDisplayStatus;
  policyId: string | null;
  policyName: string | null;
  status: AdmissionAssessmentStatus;
  scheduledAt: string;
  durationMinutes: number;
  mode: AdmissionAssessmentMode;
  location: string | null;
  notes: string | null;
  interviewerUserId: string | null;
  result: AdmissionAssessmentResult | null;
  resultNotes: string | null;
  resultScore: number | null;
  resultRecordedAt: string | null;
  resultRecordedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionAssessmentCandidate = {
  admissionCaseId: string;
  applicantName: string;
  guardianFullName: string | null;
  guardianPhone: string | null;
  classId: string | null;
  className: string | null;
  program: EducationProgram | null;
  displayStatus: AdmissionCaseDisplayStatus;
  policyId: string | null;
  policyName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionAssessmentWorkspaceSummary = {
  today: number;
  upcoming: number;
  awaitingResults: number;
  needsScheduling: number;
};

export type AdmissionAssessmentSessionPage = {
  items: AdmissionAssessmentSessionSummary[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  summary: AdmissionAssessmentWorkspaceSummary;
};

export type AdmissionAssessmentCandidatePage = {
  items: AdmissionAssessmentCandidate[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type ScheduleAdmissionAssessmentPayload = {
  bsDate: string;
  startTime: string;
  durationMinutes?: number;
  mode?: AdmissionAssessmentMode;
  location?: string;
  notes?: string;
};

export type RecordAdmissionAssessmentResultPayload = {
  result: AdmissionAssessmentResult;
  score?: number;
  notes?: string;
};

export type AdmissionCaseApprovalChainState = {
  approvalPolicyId: string;
  activeRequestId: string | null;
  currentStageIndex: number | null;
  totalStages: number | null;
  currentStageRole: string | null;
  currentStagePermission: string | null;
};

export type AdmissionCaseEligibility = {
  missingRequiredFields: string[];
  missingRequiredDocuments: string[];
  waivedDocuments: AdmissionCaseDocumentWaiver[];
  waivableMissingDocuments: string[];
  duplicateRisk: boolean;
  duplicateCandidates: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
    lifecycleStatus: string;
  }>;
  relatedStudentCandidates: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
    lifecycleStatus: string;
    guardianName: string | null;
    guardianRelation: string | null;
    matchReasons: string[];
  }>;
  policyRequirements: {
    admissionMode: "DIRECT_ALLOWED" | "REVIEW_REQUIRED";
    requireDocumentReview: boolean;
    requireInterview: boolean;
    requirePrincipalApproval: boolean;
    requireTransferCertificate: boolean;
    requirePriorMarksheet: boolean;
    requireStreamOrMarksReview: boolean;
    allowAdmissionWithDocumentsPending: boolean;
    enforceCapacityWhenAvailable: boolean;
    requireSection: boolean;
    requiredDocuments: string[];
    requiredFields: string[];
    capacityOverride: number | null;
  };
  policy: AdmissionPolicyResolution;
  canAdmitDirectly: boolean;
  canOverrideDuplicate: boolean;
  requiresReview: boolean;
  requiresApproval: boolean;
  classSection: {
    valid: boolean;
    sectionRequired?: boolean;
    academicYearName?: string | null;
    className?: string | null;
    classLevel?: number | null;
    program?: EducationProgram | null;
    sectionName?: string | null;
    message: string | null;
  };
  capacityStatus: {
    state: "NOT_CONFIGURED" | "AVAILABLE" | "NEARLY_FULL" | "FULL";
    capacity: number | null;
    enrolled: number | null;
  } | null;
  nextActionLabel: string;
  assessmentSession: AdmissionAssessmentSessionSummary | null;
  approvalChain: AdmissionCaseApprovalChainState | null;
};

export type AdmissionCaseReviewHistoryItem = {
  action: AdmissionCaseReviewAction;
  reason: string | null;
  at: string;
  byUserId: string;
};

export type AdmissionCaseReview = {
  reviewerUserId: string | null;
  dueDate: string | null;
  history: AdmissionCaseReviewHistoryItem[];
  availableActions: AdmissionCaseReviewAction[];
};

export type AdmissionCase = {
  id: string;
  source: AdmissionCaseSource;
  student: {
    firstNameEn: string;
    lastNameEn: string;
    firstNameNp: string | null;
    lastNameNp: string | null;
    dateOfBirth: string | null;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
  };
  guardian: {
    fullName: string | null;
    relationship: string | null;
    phone: string | null;
    email: string | null;
    receivesAlerts: boolean;
  };
  academic: {
    academicYearId: string | null;
    classId: string | null;
    program: EducationProgram | null;
    sectionId: string | null;
    admissionDate: string | null;
    rollNumber: number | null;
    mediumOfInstruction: string;
  };
  transferStudent: boolean;
  previousSchool: string | null;
  notes: string | null;
  documents: AdmissionCaseDocumentReference[];
  displayStatus: AdmissionCaseDisplayStatus;
  admittedStudentId: string | null;
  followUps: Array<{ code: string; label: string; blocking: boolean }>;
  review: AdmissionCaseReview;
  createdAt: string;
  updatedAt: string;
} & AdmissionCaseEligibility;

export type CreateAdmissionCasePayload = {
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp?: string;
  lastNameNp?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  guardianFullName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianReceivesAlerts?: boolean;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  source?: AdmissionCaseSource;
  transferStudent?: boolean;
  previousSchool?: string;
  notes?: string;
  admissionDate?: string;
  rollNumber?: number;
  mediumOfInstruction?: string;
  nationalStudentId?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  documents?: AdmissionCaseDocumentReference[];
  policyId?: string;
};

export type UpdateAdmissionCasePayload = Partial<CreateAdmissionCasePayload>;

export type DirectAdmitAdmissionCasePayload = UpdateAdmissionCasePayload & {
  overrideDuplicate?: boolean;
  overrideReason?: string;
};

export type ReviewAdmissionCasePayload = {
  action: AdmissionCaseReviewAction;
  reviewerUserId?: string;
  reason?: string;
  dueDate?: string;
};
