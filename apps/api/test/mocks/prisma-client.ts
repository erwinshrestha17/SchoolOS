class Decimal {
  private readonly numericValue: number;

  constructor(value: number | string | Decimal) {
    this.numericValue =
      value instanceof Decimal ? value.numericValue : Number(value);
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

export const PaymentMethod = {
  CASH: 'CASH',
  BANK: 'BANK',
  CHEQUE: 'CHEQUE',
  TRANSFER: 'TRANSFER',
  MOBILE: 'MOBILE',
} as const;

export const FinanceRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
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
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
  MISSING: 'MISSING',
  WITHHELD: 'WITHHELD',
  SUBMITTED: 'SUBMITTED',
  RETEST: 'RETEST',
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
