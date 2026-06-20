export const ADMISSION_CASE_DISPLAY_STATUSES = [
  'DRAFT',
  'NEEDS_INFORMATION',
  'READY_TO_ADMIT',
  'WAITING_FOR_REVIEW',
  'APPROVED',
  'ADMITTED',
  'NOT_ADMITTED',
  'CLOSED',
] as const;

export const ADMISSION_CASE_SOURCES = [
  'OFFICE_WALK_IN',
  'PARENT_ONLINE',
  'PHONE_INQUIRY',
  'TRANSFER_REQUEST',
  'IMPORT',
] as const;

export type AdmissionCaseDisplayStatus =
  (typeof ADMISSION_CASE_DISPLAY_STATUSES)[number];
export type AdmissionCaseSource = (typeof ADMISSION_CASE_SOURCES)[number];

export type AdmissionCaseDocumentReference = {
  fileId: string;
  kind: string;
  title?: string | null;
};

export type AdmissionPolicyRule = {
  admissionMode: 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED';
  academicYearId?: string;
  gradeBand?: string;
  classId?: string;
  source?: AdmissionCaseSource;
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

export type AdmissionPolicy = {
  defaultPolicy: AdmissionPolicyRule;
  overrides: AdmissionPolicyRule[];
};

export type AdmissionCaseEligibility = {
  missingRequiredFields: string[];
  missingRequiredDocuments: string[];
  duplicateRisk: boolean;
  duplicateCandidates: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
    lifecycleStatus: string;
  }>;
  policyRequirements: {
    admissionMode: 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED';
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
  };
  canAdmitDirectly: boolean;
  canOverrideDuplicate: boolean;
  requiresReview: boolean;
  requiresApproval: boolean;
  classSection: {
    valid: boolean;
    sectionRequired?: boolean;
    academicYearName?: string | null;
    className?: string | null;
    sectionName?: string | null;
    message: string | null;
  };
  capacityStatus: {
    state: 'NOT_CONFIGURED' | 'AVAILABLE' | 'FULL';
    capacity: number | null;
    enrolled: number | null;
  } | null;
  nextActionLabel: string;
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
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
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
  createdAt: string;
  updatedAt: string;
} & AdmissionCaseEligibility;

export type CreateAdmissionCasePayload = {
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp?: string;
  lastNameNp?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
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
};

export type UpdateAdmissionCasePayload = Partial<CreateAdmissionCasePayload>;

export type DirectAdmitAdmissionCasePayload = UpdateAdmissionCasePayload & {
  overrideDuplicate?: boolean;
  overrideReason?: string;
};
