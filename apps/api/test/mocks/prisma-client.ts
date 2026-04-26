class Decimal {
  private readonly numericValue: number;

  constructor(value: number | string | Decimal) {
    this.numericValue =
      value instanceof Decimal ? value.numericValue : Number(value);
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

  toDecimalPlaces(places: number) {
    return new Decimal(Number(this.numericValue.toFixed(places)));
  }

  toNumber() {
    return this.numericValue;
  }

  toString() {
    return String(this.numericValue);
  }

  valueOf() {
    return this.numericValue;
  }
}

function decimalToNumber(value: number | string | Decimal) {
  return value instanceof Decimal ? value.toNumber() : Number(value);
}

export class PrismaClient {}

export const Prisma = {
  Decimal,
};

export const Mode = {
  SINGLE: 'SINGLE',
  MULTI: 'MULTI',
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

export const PaymentMethod = {
  CASH: 'CASH',
  BANK: 'BANK',
  CHEQUE: 'CHEQUE',
  TRANSFER: 'TRANSFER',
  MOBILE: 'MOBILE',
} as const;

export const JournalSourceType = {
  MANUAL: 'MANUAL',
  INVOICE: 'INVOICE',
  FEE_PAYMENT: 'FEE_PAYMENT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const JournalLineSide = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export const ChartAccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

export const StorageProvider = {
  LOCAL: 'LOCAL',
  R2: 'R2',
} as const;

export const StudentDocumentKind = {
  BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
  TRANSFER_CERTIFICATE: 'TRANSFER_CERTIFICATE',
  PHOTO: 'PHOTO',
  ID_CARD: 'ID_CARD',
  ENROLLMENT_CONFIRMATION: 'ENROLLMENT_CONFIRMATION',
  OTHER: 'OTHER',
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
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export const ConsentType = {
  PRIVACY: 'PRIVACY',
  DATA_PROCESSING: 'DATA_PROCESSING',
  MEDICAL: 'MEDICAL',
  PHOTO_USAGE: 'PHOTO_USAGE',
  MESSAGING: 'MESSAGING',
} as const;
