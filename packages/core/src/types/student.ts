import type { ActivityPost } from './activity.js';
import type { StudentDuplicateCandidateStudent } from './common.js';

export type GuardianProfile = {
  id: string;
  fullName: string;
  relation: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string | null;
  occupation: string | null;
  wardNumber: string | null;
  isPrimary: boolean;
  consentedAt: string | null;
};

export type EnrollmentRecord = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  rollNumber: number | null;
  admissionNumber: string | null;
  admissionDate: string;
  mediumOfInstruction: string;
  status: string;
};

export type StudentProfile = {
  id: string;
  studentSystemId: string;
  firstNameEn?: string;
  lastNameEn?: string;
  fullNameEn?: string;
  fullNameNp?: string | null;
  gender?: string;
  dateOfBirth?: string;
  admissionNumber?: string | null;
  admissionDate?: string;
  motherTongue?: string | null;
  disabilityFlag?: string | null;
  nationalStudentId?: string | null;
  className?: string | null;
  sectionName?: string | null;
  class?: {
    id: string;
    name: string;
  };
  section?: string | null;
  rollNumber?: number | null;
  guardians?: GuardianProfile[];
  documentCount?: number;
  medicalConditions?: string | null;
  severeAllergies?: string | null;
  medications?: string | null;
  specialNeeds?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  doctorName?: string | null;
  doctorPhone?: string | null;
  lifecycleStatus?: string;
  photoUrl?: string;
  activeIdentity?: {
    id: string;
    status: string;
  } | null;
  qrCredential?: {
    id: string;
    status: string;
    createdById?: string | null;
    updatedById?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    rotatedAt: string | null;
    revokedAt?: string | null;
    rotateReason?: string | null;
    revokeReason?: string | null;
    lastScannedAt: string | null;
  } | null;
};

export type StudentModuleSummary = {
  totalStudents: number;
  activeStudents: number;
  transferredStudents: number;
  exitedStudents: number;
  alumniStudents: number;
  archivedStudents: number;
  mergedStudents: number;
  deletedStudents: number;
  newAdmissions: number;
  pendingApplications: number;
  missingDocuments: number;
  duplicateCandidates: number;
  iemisReady: number;
  iemisIssues: number;
  qrActive: number;
  qrMissing: number;
  byStatus: Array<{ status: StudentLifecycleStatus; count: number }>;
  filters: {
    academicYearId: string | null;
    classId: string | null;
    sectionId: string | null;
    status: StudentLifecycleStatus | null;
    search: string | null;
  };
};

export enum StudentQrResolvePurpose {
  GENERAL_STUDENT_LOOKUP = 'GENERAL_STUDENT_LOOKUP',
  LIBRARY = 'LIBRARY',
  CANTEEN = 'CANTEEN',
  TRANSPORT = 'TRANSPORT',
  ATTENDANCE = 'ATTENDANCE',
}

export type StudentQrCredentialSummary = {
  id: string;
  studentId: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED';
  createdById: string | null;
  updatedById: string | null;
  expiresAt: string | null;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  rotateReason: string | null;
  revokeReason: string | null;
  lastScannedAt: string | null;
};

export type StudentQrStatusHistory = {
  activeCredential: StudentQrCredentialSummary | null;
  history: StudentQrCredentialSummary[];
};

export type StudentProfileEnrollment = {
  id: string;
  academicYearId: string;
  academicYear: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  rollNumber: number | null;
  status: string;
  admissionDate: string;
};

export type StudentProfileInvoiceLine = {
  id: string;
  feeHeadId: string;
  feeHeadName: string;
  description: string;
  quantity: number;
  unitAmount: number;
  vatAmount: number;
  totalAmount: number;
  lineItems?: any[];
};

export type StudentProfileInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  issuedAt: string;
  lines: StudentProfileInvoiceLine[];
};

export type StudentProfileAttendanceRecord = {
  id: string;
  attendanceDate: string;
  status: string;
  remark: string | null;
  lateAt: string | null;
  submittedAt: string | null;
};

export type StudentProfileDetail = {
  student: StudentProfile & {
    lifecycleStatus?: string;
  };
  guardians: GuardianProfile[];
  enrollments: StudentProfileEnrollment[];
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  invoices: StudentProfileInvoice[];
  attendanceRecords: StudentProfileAttendanceRecord[];
  activityPosts: ActivityPost[];
};

export type UpdateStudentProfilePayload = {
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameNp?: string | null;
  lastNameNp?: string | null;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  motherTongue?: string | null;
  ethnicity?: string | null;
  disabilityFlag?: string | null;
  confirmNoDisability?: boolean;
  nationalStudentId?: string | null;
  admissionNumber?: string | null;
  classId?: string;
  sectionId?: string | null;
  rollNumber?: number | null;
  mediumOfInstruction?: string;
  medicalConditions?: string | null;
  severeAllergies?: string | null;
  medications?: string | null;
  specialNeeds?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  doctorName?: string | null;
  doctorPhone?: string | null;
};

export type UpdateStudentGuardianPayload = {
  fullName?: string;
  relation?: string;
  primaryPhone?: string;
  secondaryPhone?: string | null;
  email?: string | null;
  occupation?: string | null;
  homeAddress?: string | null;
  wardNumber?: string | null;
  isPrimary?: boolean;
};

export type StudentLifecycleStatus =
  | 'ACTIVE'
  | 'TRANSFERRED'
  | 'EXITED'
  | 'ALUMNI'
  | 'ARCHIVED'
  | 'MERGED'
  | 'DELETED';

export type StudentLifecycleTransition = {
  id: string;
  studentId: string;
  fromStatus: StudentLifecycleStatus;
  toStatus: StudentLifecycleStatus;
  reason: string;
  changedAt: string;
  feeClearanceWaived: boolean;
  metadata?: Record<string, unknown> | null;
};

export type StudentFeeClearance = {
  studentId: string;
  studentSystemId: string;
  cleared: boolean;
  outstandingAmount: number;
  waivedAt: string | Date | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    dueDate: string | Date;
  }>;
};

export type StudentLifecycleActionResult = {
  id: string;
  studentSystemId: string;
  lifecycleStatus: StudentLifecycleStatus;
  exitedAt: string | Date | null;
  destinationSchool?: string | null;
  feeClearance?: StudentFeeClearance;
};

export type StudentTransferPayload = {
  reason: string;
  destinationSchool?: string | null;
  conductRemark?: string | null;
  exitedAt?: string;
  waiveFeeClearance?: boolean;
};

export type StudentArchivePayload = {
  reason: string;
  exitedAt?: string;
};

export type StudentDeletePayload = {
  reason: string;
  deletedAt?: string;
};

export type RevokeGeneratedStudentDocumentPayload = {
  reason: string;
};

export type UploadStudentDocumentPayload = {
  studentId: string;
  kind: string;
  title?: string | null;
  fileName: string;
  contentType: string;
  base64Content: string;
  expiryDate?: string | null;
  notes?: string | null;
  reason?: string | null;
};

export type DuplicateStudentMergeCounts = {
  guardianLinks: number;
  documents: number;
  generatedDocuments: number;
  invoices: number;
  payments: number;
  feeWaivers: number;
  notificationDeliveries: number;
  developmentalMilestones: number;
  moodLogs: number;
  libraryIssues: number;
  transportEnrollments: number;
  transportLogs: number;
  conversations: number;
  conversationParticipants: number;
};

export type DuplicateStudentMergeResult = {
  sourceStudent: {
    id: string;
    studentSystemId: string;
    lifecycleStatus: StudentLifecycleStatus;
  };
  targetStudent: {
    id: string;
    studentSystemId: string;
    lifecycleStatus: StudentLifecycleStatus;
  };
  mergedAt: string;
  mergeCounts: DuplicateStudentMergeCounts;
};

export type GeneratedStudentDocumentMeta = {
  id: string;
  studentId: string;
  kind: string;
  title?: string | null;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  pdfUrl: string;
  generatedById?: string | null;
  generatedAt?: string | null;
  checksumSha256: string | null;
  storageObjectKey: string | null;
  signedAt: string | null;
  version: number;
  retentionUntil: string | null;
  revokedAt: string | null;
};

export type GuardianIdentityVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REVOKED';

export type GuardianIdentityVerification = {
  id: string;
  guardianId: string;
  status: GuardianIdentityVerificationStatus;
  documentType: string;
  documentNumber: string | null;
  evidenceDocumentId: string | null;
  notes: string | null;
  submittedById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IemisValidationIssue = {
  studentId: string;
  studentSystemId: string;
  field: string;
  message: string;
};

export type StudentIemisReadinessSummary = {
  studentId: string;
  studentSystemId: string;
  fullNameEn: string;
  className: string;
  sectionName: string | null;
  eligible: boolean;
  score: number;
  issuesCount: number;
  issues: Array<{ field: string; message: string }>;
};

export type IemisExportRow = {
  studentSystemId: string;
  nationalStudentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp: string;
  lastNameNp: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  motherTongue: string;
  ethnicity: string;
  disabilityFlag: string;
  admissionDate: string;
  admissionNumber: string;
  lifecycleStatus: StudentLifecycleStatus;
  academicYear: string;
  className: string;
  sectionName: string;
  rollNumber: string | number;
  primaryGuardianName: string;
  primaryGuardianRelation: string;
  primaryGuardianPhone: string;
  primaryGuardianEmail: string;
  wardNumber: string;
  guardianCount: number;
};

export type IemisExportResult = {
  formatVersion: 'SCHOLOS-IEMIS-1.0';
  exportedAt: string;
  exportId: string;
  fileAssetId: string;
  fileName: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  issues: IemisValidationIssue[];
  headers: Array<keyof IemisExportRow>;
  rows: IemisExportRow[];
  csv: string;
};

export type StudentDuplicateCandidate = {
  sourceStudent: StudentDuplicateCandidateStudent;
  candidateStudent: StudentDuplicateCandidateStudent;
  score: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  blockedReason: string | null;
};

export type StudentDocument = {
  id: string;
  studentId: string;
  fileId?: string | null;
  kind: string;
  status?: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: string;
  objectKey?: string;
  publicUrl?: string | null;
  notes?: string | null;
  expiryDate?: string | null;
  verifiedAt?: string | null;
  uploadedById?: string | null;
  uploadedAt: string;
};

export type StudentDocumentHistory = {
  id: string;
  documentId: string | null;
  action: string;
  documentTitle: string | null;
  documentKind: string | null;
  performedBy: string;
  reason: string | null;
  createdAt: string;
};

export type GeneratedStudentDocument = {
  id: string;
  studentId: string;
  kind: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  pdfUrl: string;
  generatedById: string | null;
  generatedAt: string;
};

export type SiblingGroup = {
  id: string;
  name: string;
  discountEligible: boolean;
  members: Array<{
    id: string;
    studentId: string;
    relationLabel: string | null;
  }>;
};
