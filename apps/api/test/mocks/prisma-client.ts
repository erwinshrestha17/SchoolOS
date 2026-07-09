class Decimal {
  private readonly numericValue: number;

  constructor(value: number | string | Decimal) {
    this.numericValue =
      value instanceof Decimal ? value.numericValue : Number(value);
  }

  static max(...values: Array<number | string | Decimal>) {
    return new Decimal(Math.max(...values.map(decimalToNumber)));
  }

  static min(...values: Array<number | string | Decimal>) {
    return new Decimal(Math.min(...values.map(decimalToNumber)));
  }

  eq(value: number | string | Decimal) {
    const other = decimalToNumber(value);
    return Math.abs(this.numericValue - other) < 1e-10;
  }

  equals(value: number | string | Decimal) {
    return this.eq(value);
  }

  add(value: number | string | Decimal) {
    return new Decimal(this.numericValue + decimalToNumber(value));
  }

  sub(value: number | string | Decimal) {
    return new Decimal(this.numericValue - decimalToNumber(value));
  }

  mul(value: number | string | Decimal) {
    return new Decimal(this.numericValue * decimalToNumber(value));
  }

  div(value: number | string | Decimal) {
    return new Decimal(this.numericValue / decimalToNumber(value));
  }

  gt(value: number | string | Decimal) {
    return this.numericValue > decimalToNumber(value);
  }

  gte(value: number | string | Decimal) {
    return this.numericValue >= decimalToNumber(value);
  }

  lt(value: number | string | Decimal) {
    return this.numericValue < decimalToNumber(value);
  }

  lte(value: number | string | Decimal) {
    return this.numericValue <= decimalToNumber(value);
  }

  toDecimalPlaces(places: number) {
    return new Decimal(Number(this.numericValue.toFixed(places)));
  }

  abs() {
    return new Decimal(Math.abs(this.numericValue));
  }

  plus(value: number | string | Decimal) {
    return this.add(value);
  }

  minus(value: number | string | Decimal) {
    return this.sub(value);
  }

  times(value: number | string | Decimal) {
    return this.mul(value);
  }

  dividedBy(value: number | string | Decimal) {
    return this.div(value);
  }

  isZero() {
    return this.numericValue === 0;
  }

  toNumber() {
    return this.numericValue;
  }

  toString() {
    return String(this.numericValue);
  }

  toFixed(places: number) {
    return this.numericValue.toFixed(places);
  }

  valueOf() {
    return this.numericValue;
  }
}

function decimalToNumber(value: number | string | Decimal) {
  return value instanceof Decimal ? value.toNumber() : Number(value);
}

export class PrismaClient {
  readonly __mock = true;
}

export const Prisma = {
  Decimal,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  validator:
    <T>() =>
    (val: T) =>
      val,
};

export const Mode = {
  SINGLE: 'SINGLE',
  MULTI: 'MULTI',
} as const;

export const AccountingReportMappingType = {
  CASH: 'CASH',
  BANK: 'BANK',
  VAT_OUTPUT: 'VAT_OUTPUT',
  VAT_INPUT: 'VAT_INPUT',
  TDS_PAYABLE: 'TDS_PAYABLE',
  TDS_PAID: 'TDS_PAID',
  PF_EMPLOYEE: 'PF_EMPLOYEE',
  PF_EMPLOYER: 'PF_EMPLOYER',
  PF_PAID: 'PF_PAID',
} as const;

export const UserStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export const AuthMethod = {
  PASSWORD: 'PASSWORD',
  OTP: 'OTP',
  BOTH: 'BOTH',
} as const;

export const OtpPurpose = {
  LOGIN: 'LOGIN',
  RESET: 'RESET',
  VERIFY: 'VERIFY',
} as const;

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;

export const ContractType = {
  PERMANENT: 'PERMANENT',
  TEMPORARY: 'TEMPORARY',
  PART_TIME: 'PART_TIME',
} as const;

export const StaffStatus = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
  INACTIVE: 'INACTIVE',
} as const;

export const StaffEmploymentType = {
  PERMANENT: 'PERMANENT',
  TEMPORARY: 'TEMPORARY',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERN: 'INTERN',
} as const;

export const EnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  PROMOTED: 'PROMOTED',
  TRANSFERRED: 'TRANSFERRED',
  EXITED: 'EXITED',
} as const;

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  LEAVE: 'LEAVE',
} as const;

export const ApprovalWorkflowType = {
  FEE_REVERSAL_REFUND: 'FEE_REVERSAL_REFUND',
  SCHOLARSHIP_DISCOUNT: 'SCHOLARSHIP_DISCOUNT',
  MARKS_CORRECTION: 'MARKS_CORRECTION',
  ATTENDANCE_CORRECTION: 'ATTENDANCE_CORRECTION',
  LEAVE_REQUEST: 'LEAVE_REQUEST',
  PAYROLL_POSTING_REVERSAL: 'PAYROLL_POSTING_REVERSAL',
  STUDENT_TRANSFER_WITHDRAWAL: 'STUDENT_TRANSFER_WITHDRAWAL',
  DOCUMENT_DELETION_ARCHIVE: 'DOCUMENT_DELETION_ARCHIVE',
  EMERGENCY_HIGH_IMPACT_NOTICE: 'EMERGENCY_HIGH_IMPACT_NOTICE',
  PLATFORM_SUPPORT_OVERRIDE: 'PLATFORM_SUPPORT_OVERRIDE',
  ADMISSION_CASE: 'ADMISSION_CASE',
} as const;

export const ApprovalRequestStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  APPLIED: 'APPLIED',
  APPLY_FAILED: 'APPLY_FAILED',
} as const;

export const ApprovalStepStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SKIPPED: 'SKIPPED',
} as const;

export const ApprovalDecisionType = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export const ApprovalFinalActionStatus = {
  NOT_READY: 'NOT_READY',
  READY: 'READY',
  APPLIED: 'APPLIED',
  FAILED: 'FAILED',
} as const;

export const AutomationTriggerType = {
  STUDENT_MARKED_ABSENT: 'STUDENT_MARKED_ABSENT',
  ATTENDANCE_NOT_MARKED_BY_CUTOFF: 'ATTENDANCE_NOT_MARKED_BY_CUTOFF',
  FEE_DUE_DATE_PASSED: 'FEE_DUE_DATE_PASSED',
  NOTICE_UNREAD_AFTER_WINDOW: 'NOTICE_UNREAD_AFTER_WINDOW',
  STAFF_CONTRACT_EXPIRING: 'STAFF_CONTRACT_EXPIRING',
  DOCUMENT_EXPIRING: 'DOCUMENT_EXPIRING',
  LOW_CANTEEN_BALANCE: 'LOW_CANTEEN_BALANCE',
  TRANSPORT_GPS_STALE: 'TRANSPORT_GPS_STALE',
  STAFF_LEAVE_APPROVED: 'STAFF_LEAVE_APPROVED',
  LIBRARY_BOOK_OVERDUE: 'LIBRARY_BOOK_OVERDUE',
  BUS_TRIP_STARTED: 'BUS_TRIP_STARTED',
  EXAM_RESULT_PUBLISHED: 'EXAM_RESULT_PUBLISHED',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  MANUAL: 'MANUAL',
} as const;

export const AutomationConditionOperator = {
  EXISTS: 'EXISTS',
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
  GREATER_THAN: 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL: 'GREATER_THAN_OR_EQUAL',
  LESS_THAN: 'LESS_THAN',
  LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
} as const;

export const AutomationActionType = {
  CREATE_NOTIFICATION_TASK: 'CREATE_NOTIFICATION_TASK',
  CREATE_APPROVAL_REQUEST: 'CREATE_APPROVAL_REQUEST',
  CREATE_SUBSTITUTION_TASK: 'CREATE_SUBSTITUTION_TASK',
  CREATE_EXPORT_JOB: 'CREATE_EXPORT_JOB',
  RECORD_AUDIT_EVENT: 'RECORD_AUDIT_EVENT',
  WEBHOOK_EVENT: 'WEBHOOK_EVENT',
} as const;

export const AutomationExecutionStatus = {
  SKIPPED: 'SKIPPED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;

export const AnalyticsSummaryDomain = {
  ATTENDANCE: 'ATTENDANCE',
  FEES: 'FEES',
  EXAMS: 'EXAMS',
  DASHBOARD: 'DASHBOARD',
  USAGE: 'USAGE',
} as const;

export const AnalyticsRefreshStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export const DocumentTemplateKind = {
  FEE_RECEIPT: 'FEE_RECEIPT',
  REPORT_CARD: 'REPORT_CARD',
  TRANSFER_CERTIFICATE: 'TRANSFER_CERTIFICATE',
  CHARACTER_CERTIFICATE: 'CHARACTER_CERTIFICATE',
  BONAFIDE_CERTIFICATE: 'BONAFIDE_CERTIFICATE',
  ATTENDANCE_CERTIFICATE: 'ATTENDANCE_CERTIFICATE',
  STUDENT_ID_CARD: 'STUDENT_ID_CARD',
  STAFF_ID_CARD: 'STAFF_ID_CARD',
  EXAM_ADMIT_CARD: 'EXAM_ADMIT_CARD',
  PAYMENT_DUE_LETTER: 'PAYMENT_DUE_LETTER',
  NOTICE_PDF: 'NOTICE_PDF',
  CUSTOM: 'CUSTOM',
} as const;

export const DocumentTemplateStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const GeneratedDocumentStatus = {
  QUEUED: 'QUEUED',
  GENERATED: 'GENERATED',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const AdmissionPolicyStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SCHEDULED: 'SCHEDULED',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
} as const;

export const AdmissionPolicyApplicantType = {
  NEW: 'NEW',
  TRANSFER: 'TRANSFER',
  BOTH: 'BOTH',
} as const;

export const AdmissionDocumentTiming = {
  BEFORE_REVIEW: 'BEFORE_REVIEW',
  BEFORE_ENROLLMENT: 'BEFORE_ENROLLMENT',
} as const;

export const DataExportJobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export const AttendanceConflictStatus = {
  NONE: 'NONE',
  FLAGGED: 'FLAGGED',
  REVIEWED: 'REVIEWED',
} as const;

export const AttendanceConflictDecision = {
  REVIEWED_WITHOUT_CHANGE: 'REVIEWED_WITHOUT_CHANGE',
  REVIEWED_AND_OVERRIDDEN: 'REVIEWED_AND_OVERRIDDEN',
  REJECTED_RESUBMISSION: 'REJECTED_RESUBMISSION',
} as const;

export const FeeFrequency = {
  ONE_TIME: 'ONE_TIME',
  MONTHLY: 'MONTHLY',
  TERM: 'TERM',
  ANNUAL: 'ANNUAL',
} as const;

export const BillingRunStatus = {
  DRAFT: 'DRAFT',
  GENERATED: 'GENERATED',
  VOID: 'VOID',
} as const;

export const DiscountType = {
  SIBLING: 'SIBLING',
  SCHOLARSHIP: 'SCHOLARSHIP',
  STAFF_CHILD: 'STAFF_CHILD',
  MANUAL: 'MANUAL',
} as const;

export const WaiverStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;

export const PaymentStatus = {
  SUCCESS: 'SUCCESS',
  REVERSED: 'REVERSED',
  FAILED: 'FAILED',
} as const;

export const ReceiptFileStatus = {
  PENDING: 'PENDING',
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export const OnlinePaymentIntentStatus = {
  CREATED: 'CREATED',
  READY: 'READY',
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export const PaymentMethod = {
  CASH: 'CASH',
  BANK: 'BANK',
  CHEQUE: 'CHEQUE',
  TRANSFER: 'TRANSFER',
  MOBILE: 'MOBILE',
} as const;

export const FinanceRequestStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
} as const;

export const FinanceRequestHistoryAction = {
  REQUESTED: 'REQUESTED',
  REVIEW_STARTED: 'REVIEW_STARTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
} as const;

export const FinanceRequestType = {
  REFUND: 'REFUND',
  REVERSAL: 'REVERSAL',
} as const;

export const SalaryStructureStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const SalaryComponentType = {
  EARNING: 'EARNING',
  DEDUCTION: 'DEDUCTION',
  EMPLOYER_CONTRIBUTION: 'EMPLOYER_CONTRIBUTION',
} as const;

export const PayrollPaymentStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
} as const;

export const StudentLifecycleStatus = {
  ACTIVE: 'ACTIVE',
  TRANSFERRED: 'TRANSFERRED',
  EXITED: 'EXITED',
  ALUMNI: 'ALUMNI',
  ARCHIVED: 'ARCHIVED',
  MERGED: 'MERGED',
  DELETED: 'DELETED',
} as const;

export const JournalSourceType = {
  MANUAL: 'MANUAL',
  INVOICE: 'INVOICE',
  FEE_PAYMENT: 'FEE_PAYMENT',
  PAYMENT_REFUND: 'PAYMENT_REFUND',
  PAYROLL: 'PAYROLL',
  PAYROLL_RUN: 'PAYROLL_RUN',
  PAYROLL_DISBURSEMENT: 'PAYROLL_DISBURSEMENT',
  CLOSING: 'CLOSING',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
  CORRECTION: 'CORRECTION',
} as const;

export const JournalLineSide = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export const ChartAccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

export const JournalEntryStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  CANCELLED: 'CANCELLED',
} as const;

export const StorageProvider = {
  LOCAL: 'LOCAL',
  S3: 'S3',
  R2: 'R2',
  MINIO: 'MINIO',
  GCP: 'GCP',
} as const;

export const FileVisibility = {
  PRIVATE: 'PRIVATE',
  TENANT: 'TENANT',
  OWNER: 'OWNER',
} as const;

export const FileStatus = {
  PENDING: 'PENDING',
  UPLOADED: 'UPLOADED',
  FAILED: 'FAILED',
  DELETED: 'DELETED',
} as const;

export const StudentDocumentKind = {
  BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
  TRANSFER_CERTIFICATE: 'TRANSFER_CERTIFICATE',
  PHOTO: 'PHOTO',
  ID_CARD: 'ID_CARD',
  ENROLLMENT_CONFIRMATION: 'ENROLLMENT_CONFIRMATION',
  OTHER: 'OTHER',
} as const;

export const StaffDocumentKind = {
  ID_CARD: 'ID_CARD',
  CITIZENSHIP: 'CITIZENSHIP',
  CONTRACT: 'CONTRACT',
  ACADEMIC_CERTIFICATE: 'ACADEMIC_CERTIFICATE',
  PAN_CARD: 'PAN_CARD',
  OFFER_LETTER: 'OFFER_LETTER',
  OTHER: 'OTHER',
} as const;

export const StaffLifecycleEventType = {
  HIRED: 'HIRED',
  PROMOTED: 'PROMOTED',
  TRANSFERRED: 'TRANSFERRED',
  ON_LEAVE: 'ON_LEAVE',
  RETURNED: 'RETURNED',
  TERMINATED: 'TERMINATED',
  RESIGNED: 'RESIGNED',
  STATUS_CHANGE: 'STATUS_CHANGE',
  CONTRACT_RENEWAL: 'CONTRACT_RENEWAL',
} as const;

export const StudentQrStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

export const NoticePriority = {
  NORMAL: 'NORMAL',
  URGENT: 'URGENT',
  EMERGENCY: 'EMERGENCY',
} as const;

export const AudienceType = {
  ALL: 'ALL',
  CLASS: 'CLASS',
  SECTION: 'SECTION',
  ROLE: 'ROLE',
} as const;

export const LibraryFineStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  WAIVED: 'WAIVED',
  VOID: 'VOID',
} as const;

export const EventType = {
  GENERAL: 'GENERAL',
  EXAM: 'EXAM',
  MEETING: 'MEETING',
  HOLIDAY: 'HOLIDAY',
} as const;

export const ActivityCategory = {
  LEARNING: 'LEARNING',
  OUTDOOR_PLAY: 'OUTDOOR_PLAY',
  ART_AND_CRAFT: 'ART_AND_CRAFT',
  CELEBRATION: 'CELEBRATION',
  SPORTS: 'SPORTS',
  GENERAL: 'GENERAL',
} as const;

export const MoodValue = {
  CALM: 'CALM',
  ENGAGED: 'ENGAGED',
  EXCITED: 'EXCITED',
  UNSETTLED: 'UNSETTLED',
  TIRED: 'TIRED',
} as const;

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
} as const;

export const NotificationStatus = {
  QUEUED: 'QUEUED',
  RETRY_PENDING: 'RETRY_PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'SKIPPED',
} as const;

export const ConsentType = {
  PRIVACY: 'PRIVACY',
  DATA_PROCESSING: 'DATA_PROCESSING',
  MEDICAL: 'MEDICAL',
  PHOTO_USAGE: 'PHOTO_USAGE',
  MESSAGING: 'MESSAGING',
} as const;

export const AttendanceSyncStatus = {
  ACCEPTED: 'ACCEPTED',
  CONFLICTED: 'CONFLICTED',
  REJECTED: 'REJECTED',
} as const;

export const AttendanceSyncRejectionReason = {
  LOCKED_SESSION: 'LOCKED_SESSION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ROSTER_MISMATCH: 'ROSTER_MISMATCH',
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
} as const;

export const ActivityReactionType = {
  HEART: 'HEART',
  CLAP: 'CLAP',
  STAR: 'STAR',
} as const;

export const DevelopmentalMilestoneStatus = {
  EMERGING: 'EMERGING',
  PROGRESSING: 'PROGRESSING',
  ACHIEVED: 'ACHIEVED',
  NEEDS_SUPPORT: 'NEEDS_SUPPORT',
} as const;

export const ActivityPostStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ActivityAttachmentProcessingStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  READY: 'READY',
} as const;

export const AssessmentType = {
  THEORY: 'THEORY',
  PRACTICAL: 'PRACTICAL',
  CAS: 'CAS',
  PROJECT: 'PROJECT',
  INTERNAL: 'INTERNAL',
  TERMINAL: 'TERMINAL',
} as const;

export const ExamTermStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const GradeLockStatus = {
  DRAFT: 'DRAFT',
  LOCKED: 'LOCKED',
} as const;

export const MarkEntryStatus = {
  DRAFT: 'DRAFT',
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
  MISSING: 'MISSING',
  WITHHELD: 'WITHHELD',
  SUBMITTED: 'SUBMITTED',
  RETEST: 'RETEST',
} as const;

export const AssessmentRetakeType = {
  RETEST: 'RETEST',
  MAKE_UP: 'MAKE_UP',
} as const;

export const AssessmentRetakeStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  APPLIED: 'APPLIED',
  CANCELLED: 'CANCELLED',
} as const;

export const AssessmentRetakeResultDecision = {
  PENDING: 'PENDING',
  KEEP_ORIGINAL: 'KEEP_ORIGINAL',
  USE_RETAKE: 'USE_RETAKE',
} as const;

export const HomeworkAssignmentStatus = {
  DRAFT: 'DRAFT',
  ASSIGNED: 'ASSIGNED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export const HomeworkSubmissionStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  SUBMITTED: 'SUBMITTED',
  LATE: 'LATE',
  REVIEWED: 'REVIEWED',
  NEEDS_CORRECTION: 'NEEDS_CORRECTION',
  EXCUSED: 'EXCUSED',
} as const;

export const TimetableVersionStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  LOCKED: 'LOCKED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const TeacherAvailabilityType = {
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export const TimetableSubstitutionStatus = {
  DRAFT: 'DRAFT',
  ASSIGNED: 'ASSIGNED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export const PayrollRunStatus = {
  DRAFT: 'DRAFT',
  GENERATED: 'GENERATED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  VOID: 'VOID',
} as const;

export const PayrollLineStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
} as const;

export const PayslipStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
} as const;

export const AccountingPeriodStatus = {
  OPEN: 'OPEN',
  LOCKED: 'LOCKED',
  CLOSED: 'CLOSED',
} as const;

export const ConversationType = {
  DIRECT: 'DIRECT',
  CLASS: 'CLASS',
  SECTION: 'SECTION',
} as const;

export const MessageStatus = {
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
} as const;

export const ProviderType = {
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  FCM: 'FCM',
  OBJECT_STORAGE: 'OBJECT_STORAGE',
  PAYMENT_GATEWAY: 'PAYMENT_GATEWAY',
  AI_PROVIDER: 'AI_PROVIDER',
} as const;

export const CommunicationTemplateCategory = {
  GENERAL: 'GENERAL',
  HOLIDAY: 'HOLIDAY',
  EMERGENCY: 'EMERGENCY',
  FEES: 'FEES',
  EXAMS: 'EXAMS',
  TRANSPORT_DELAY: 'TRANSPORT_DELAY',
  EVENT: 'EVENT',
} as const;

export const CommunicationTemplateChannel = {
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
} as const;

export const CommunicationTemplateStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ParentTeacherThreadStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  ESCALATED: 'ESCALATED',
} as const;

export const ParentTeacherSenderRole = {
  PARENT: 'PARENT',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN',
} as const;

export const ParentTeacherMessagePriority = {
  NORMAL: 'NORMAL',
  IMPORTANT: 'IMPORTANT',
  EMERGENCY: 'EMERGENCY',
} as const;

export const ChatAvailabilityAppliesToRole = {
  TEACHER: 'TEACHER',
  PARENT: 'PARENT',
  BOTH: 'BOTH',
} as const;

export const ChatEscalationStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const;

export const ChatAbuseReportStatus = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  DISMISSED: 'DISMISSED',
  ACTION_TAKEN: 'ACTION_TAKEN',
} as const;

export const LibraryCopyStatus = {
  AVAILABLE: 'AVAILABLE',
  ISSUED: 'ISSUED',
  LOST: 'LOST',
  DAMAGED: 'DAMAGED',
} as const;

export const LibraryIssueStatus = {
  ISSUED: 'ISSUED',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE',
  LOST: 'LOST',
} as const;

export const TransportVehicleStatus = {
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
} as const;

export const TransportEnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
} as const;

export const TransportBoardingStatus = {
  BOARDED: 'BOARDED',
  DROPPED: 'DROPPED',
  MISSED: 'MISSED',
} as const;

export const TransportTripStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const TransportStudentTripStatus = {
  PENDING: 'PENDING',
  BOARDED: 'BOARDED',
  DROPPED: 'DROPPED',
  ABSENT: 'ABSENT',
} as const;

export const CanteenMenuItemStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export const CanteenMealPlanStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export const CanteenEnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  ENDED: 'ENDED',
} as const;

export const CanteenMealServingStatus = {
  SERVED: 'SERVED',
  NOT_TAKEN: 'NOT_TAKEN',
  ABSENT: 'ABSENT',
  CANCELLED: 'CANCELLED',
} as const;

export const CanteenWalletTransactionType = {
  TOP_UP: 'TOP_UP',
  DEDUCTION: 'DEDUCTION',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const CanteenWalletTransactionSource = {
  MANUAL: 'MANUAL',
  POS_SALE: 'POS_SALE',
  MEAL_PURCHASE: 'MEAL_PURCHASE',
  FEE_INTEGRATION: 'FEE_INTEGRATION',
  ACCOUNTING_ADJUSTMENT: 'ACCOUNTING_ADJUSTMENT',
} as const;

export const CanteenPosSaleStatus = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const CanteenPaymentMethod = {
  CASH: 'CASH',
  WALLET: 'WALLET',
  STAFF_CREDIT: 'STAFF_CREDIT',
} as const;

export const LearningActivityType = {
  PRACTICE: 'PRACTICE',
  QUIZ: 'QUIZ',
  EXPLANATION: 'EXPLANATION',
  REVISION: 'REVISION',
  OBSERVATION: 'OBSERVATION',
} as const;

export const LearningDifficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;

export const LearningMode = {
  SMART_BOARD: 'SMART_BOARD',
  GROUP: 'GROUP',
  COMPUTER_LAB: 'COMPUTER_LAB',
  WORKSHEET: 'WORKSHEET',
  HYBRID: 'HYBRID',
} as const;

export const LearningAccessType = {
  SCHOOL_ONLY: 'SCHOOL_ONLY',
  CLASS_ONLY: 'CLASS_ONLY',
} as const;

export const LearningLanguageMode = {
  ENGLISH: 'ENGLISH',
  NEPALI: 'NEPALI',
  MIXED: 'MIXED',
} as const;

export const LearningActivityStatus = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  ARCHIVED: 'ARCHIVED',
} as const;

export const LearningSessionStatus = {
  LIVE: 'LIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  EXPIRED: 'EXPIRED',
} as const;

export const LearningParticipantStatus = {
  JOINED: 'JOINED',
  LEFT: 'LEFT',
  REMOVED: 'REMOVED',
} as const;

export const LearningAttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
} as const;

export const LearningQuestionType = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT_ANSWER: 'SHORT_ANSWER',
  MATCHING: 'MATCHING',
  ORDERING: 'ORDERING',
} as const;

export const LearningProgressLabel = {
  NEEDS_PRACTICE: 'NEEDS_PRACTICE',
  IMPROVING: 'IMPROVING',
  READY: 'READY',
  STRONG: 'STRONG',
} as const;

export const LearningResourceType = {
  FILE: 'FILE',
  LINK: 'LINK',
  NOTE: 'NOTE',
} as const;

export const LearningResourceStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
