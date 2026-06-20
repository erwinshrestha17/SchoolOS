import type { StudentDocument, StudentLifecycleStatus, StudentDuplicateCandidate, StudentProfile } from './student.js';
import type { AttendanceSummary, AttendanceSyncResult } from './attendance.js';
import type { ClassSummary, SectionSummary, SubjectSummary } from './academic.js';
import type { ParentTeacherThreadSummary } from './messaging.js';

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  hasNextPage?: boolean;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
  requestId?: string;
};

export type ApiErrorMeta = {
  statusCode: number;
  error: string;
  path?: string;
  method?: string;
};

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  mode?: string;
  isActive?: boolean;
};

export type AdmissionSummary = {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  fullNameNp: string | null;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
  documentCount: number;
  guardians: Array<{
    id: string;
    fullName: string;
    relation: string;
    primaryPhone: string;
    isPrimary: boolean;
  }>;
  latestEnrollment: {
    id: string;
    academicYear: string;
    status: string;
  } | null;
  latestInvoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  } | null;
};

export type AdmissionCreationResult = {
  student: {
    id: string;
    studentSystemId: string;
    fullNameEn: string;
  };
  enrollment: {
    id: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    rollNumber: number | null;
  };
  guardians: Array<{
    id: string;
    fullName: string;
    relation: string;
  }>;
  documents: StudentDocument[];
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  } | null;
};

export const ADMISSION_APPLICATION_STATUSES = [
  'INQUIRY',
  'APPLICATION',
  'DOCUMENT_PENDING',
  'ENTRANCE_INTERVIEW',
  'ACCEPTED',
  'ENROLLED',
  'REJECTED',
] as const;

export type AdmissionApplicationStatus =
  (typeof ADMISSION_APPLICATION_STATUSES)[number];

export type AdmissionApplicationDuplicateReview = {
  hasWarnings?: boolean;
  matches?: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    matchTypes: string[];
  }>;
};

export type AdmissionApplication = {
  id: string;
  status: AdmissionApplicationStatus;
  firstNameEn: string;
  lastNameEn: string;
  fullNameEn: string;
  firstNameNp: string | null;
  lastNameNp: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  guardianFullName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  academicYearId: string | null;
  classId: string | null;
  sectionId: string | null;
  previousSchool: string | null;
  source: string | null;
  notes: string | null;
  duplicateReview: AdmissionApplicationDuplicateReview | null;
  convertedStudentId: string | null;
  rejectedReason: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdmissionApplicationPayload = {
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp?: string;
  lastNameNp?: string;
  dateOfBirth?: string;
  gender?: string;
  guardianFullName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  previousSchool?: string;
  source?: string;
  notes?: string;
};

export type StudentDuplicateCandidateStudent = {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  dateOfBirth: string;
  admissionNumber: string | null;
  previousSchool: string | null;
  lifecycleStatus: StudentLifecycleStatus;
  className: string | null;
  sectionName: string | null;
  guardianPhones: string[];
};

export type StudentDuplicateCandidatesResult = {
  candidates: StudentDuplicateCandidate[];
  limit: number;
  reviewedStudentId: string | null;
};

export type NoticeSummary = {
  id: string;
  title: string;
  body?: string;
  priority: string;
  audienceType: string;
  classId?: string | null;
  sectionId?: string | null;
  scheduledFor?: string | null;
  publishedAt: string | null;
  createdAt?: string;
};

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  audienceType: string;
  classId: string | null;
  sectionId: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  createdAt: string;
};

export type RoleSummary = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export type AdmissionDuplicateWarning = {
  studentId: string;
  studentSystemId: string;
  fullNameEn: string;
  dateOfBirth: string;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
};

export type AdmissionDuplicateCheckResult = {
  hasWarnings: boolean;
  matches: AdmissionDuplicateWarning[];
};

export type BulkAdmissionImportResult = {
  totalRows: number;
  created: number;
  validated: number;
  failed: number;
  results: Array<{
    rowNumber: number;
    status: 'created' | 'validated' | 'failed';
    studentId?: string;
    studentSystemId?: string;
    errors?: string[];
    duplicates?: Array<
      AdmissionDuplicateWarning & {
        matchTypes?: string[];
      }
    >;
  }>;
  errorReportCsv: string;
};

export type AttendanceRosterStudent = {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  rollNumber: number | null;
  hasMedicalAlert: boolean;
  status: string;
  remark: string | null;
};

export type AttendanceOperationalSummary = {
  classDaily: {
    attendanceDate: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    submittedAt: string | null;
    totals: AttendanceSummary['totals'];
  };
  studentMonthly: {
    studentId: string;
    month: number;
    year: number;
    attendancePercent: number;
    consecutiveAbsences: number;
  } | null;
};

export type AttendanceSyncSubmission = AttendanceSyncResult;

export type AttendanceConflictReviewResult = {
  id: string;
  attendanceSessionId: string;
  status: string;
  decision: string;
  resolutionNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  affectedSyncSubmissionCount: number;
};

export type AttendanceCorrectionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type DefaulterReminderResult = {
  requested: number;
  reminded: number;
  channels: string[];
  deliveryResults: Array<{
    invoiceId: string;
    deliveryCount: number;
  }>;
};

export type PaymentGatewayReadiness = {
  enabled: boolean;
  status: string;
  provider: {
    id: string;
    name: string;
    environment: string;
    lastValidatedAt: string | Date | null;
  } | null;
  supportedPaymentMethods: string[];
  webhookReady: boolean;
  paymentIntentReady: boolean;
  idempotencyRequired: boolean;
  settlementTrackingReady: boolean;
  message: string;
};

export type NotificationDelivery = {
  id: string;
  channel: string;
  status: string;
  sourceType: string;
  sourceId: string;
  audienceType: string;
  destination: string | null;
  title: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationDeliveryFailureSummary = {
  id: string;
  status: string;
  channel: string;
  sourceType: string;
  sourceId: string;
  title: string;
  lastFailureReason: string | null;
  retryCount: number;
  retryStatus: 'retryable' | 'pending' | 'not_retryable';
  lastRetryAt: string | null;
  failedAt: string | null;
  createdAt: string;
  recipientSummary: {
    audienceType: string;
    recipientUserId: string | null;
    guardianId: string | null;
    studentId: string | null;
    destinationMasked: string | null;
  };
};

export type ConsentRecord = {
  id: string;
  guardianId: string;
  consentType: string;
  granted: boolean;
  version: string;
  capturedAt: string;
  revokedAt: string | null;
};

export type GuardianConsentStatus = {
  guardianId: string;
  consentType: string;
  granted: boolean;
  latestConsentId: string | null;
  version: string | null;
  capturedAt: string | null;
  revokedAt: string | null;
};

export type PromotionResult = {
  studentId: string;
  studentName: string;
  status: 'promoted' | 'skipped' | 'failed';
  reason?: string;
};

export type PublishingResult = {
  published: number;
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
};

export type TimetableVersionStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'LOCKED'
  | 'ARCHIVED';

export type TimetableValidationIssue = {
  type: string;
  message: string;
  slotId?: string;
  conflictingSlotId?: string;
  classId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  staffId?: string | null;
  roomId?: string | null;
  versionId?: string | null;
  affectedPeriodIds?: string[];
  dayOfWeek?: number;
  startsAt?: string;
  endsAt?: string;
};

export type HomeworkAssignmentSummary = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  assignedByStaffId?: string | null;
  title: string;
  instructions: string;
  assignedDate?: string;
  dueDate?: string;
  dueAt: string;
  status?: 'DRAFT' | 'ASSIGNED' | 'CLOSED' | 'CANCELLED';
  attachmentMetadata?: Record<string, unknown> | null;
  maxScore: number | null;
  submissions?: HomeworkSubmissionSummary[];
  class?: ClassSummary;
  section?: SectionSummary | null;
  subject?: SubjectSummary;
  assignedByStaff?: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export type HomeworkSubmissionSummary = {
  id: string;
  homeworkId: string;
  studentId: string;
  status: string;
  submittedAt: string | null;
  submissionText?: string | null;
  submissionContent: string | null;
  score: number | null;
  feedback: string | null;
  teacherRemarks?: string | null;
  correctionRemarks?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  returnedAt?: string | null;
  student?: StudentProfile;
  homework?: HomeworkAssignmentSummary;
  attachments?: Array<{
    id: string;
    fileAsset?: {
      id: string;
      originalFilename: string;
      publicUrl?: string | null;
      mimeType: string;
      sizeBytes: string | number;
      module?: string | null;
      entityId?: string | null;
    } | null;
  }>;
};

export type ParentTeacherThreadStatus = 'OPEN' | 'CLOSED' | 'ESCALATED';

export type ParentTeacherMessagePriority = 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';

export type ParentTeacherMessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export type ParentTeacherSenderRole = 'PARENT' | 'TEACHER' | 'ADMIN';

export type ChatAvailabilityAppliesToRole = 'TEACHER' | 'PARENT' | 'BOTH';

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
};

export type ParentTeacherThreadCreateResult = {
  thread: ParentTeacherThreadSummary;
  created: boolean;
};

export type FileStatus = 'PENDING' | 'UPLOADED' | 'FAILED' | 'DELETED';

export type FileAssetSummary = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  module: string | null;
  entityId: string | null;
  status: FileStatus;
  createdAt: string;
};
