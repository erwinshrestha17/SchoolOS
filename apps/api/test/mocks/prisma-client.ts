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

export const FeeFrequency = {
  ONE_TIME: 'ONE_TIME',
  MONTHLY: 'MONTHLY',
  TERM: 'TERM',
  ANNUAL: 'ANNUAL',
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
