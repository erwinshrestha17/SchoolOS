import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  RECEIVABLES_AGING_BUCKETS,
  type ReceivablesAgingBucket,
} from '@schoolos/core';

/**
 * Phase 7.11c — payables. Money is a decimal string in NPR with at most two
 * paisa digits (never a float). Dates are YYYY-MM-DD accounting dates. VAT and
 * withheld tax are typed from the vendor's bill; nothing here computes a rate.
 */
const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const MONEY_MESSAGE = 'must be an NPR amount with at most two decimals';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'must be a YYYY-MM-DD date';
const PAN = /^\d{9}$/;

export const FINANCE_VENDOR_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const FINANCE_EXPENSE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'POSTED',
  'REVERSED',
] as const;
export const FINANCE_PAYABLE_STATUSES = [
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
] as const;

class PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class ListVendorsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(FINANCE_VENDOR_STATUSES)
  status?: (typeof FINANCE_VENDOR_STATUSES)[number];
}

export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @Matches(PAN, { message: 'panNumber must be 9 digits' })
  panNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  /** Empty string clears the PAN. */
  @IsOptional()
  @Matches(/^(\d{9})?$/, { message: 'panNumber must be 9 digits' })
  panNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ListVendorBillsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(FINANCE_EXPENSE_STATUSES)
  status?: (typeof FINANCE_EXPENSE_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  vendorId?: string;
}

export class CreateVendorBillDto {
  /** Required: a retried create returns the original draft. */
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;

  @IsUUID()
  vendorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vendorBillNumber?: string;

  @Matches(DATE_ONLY, { message: `expenseDate ${DATE_MESSAGE}` })
  expenseDate!: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: `dueDate ${DATE_MESSAGE}` })
  dueDate?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description!: string;

  @IsUUID()
  expenseAccountId!: string;

  /** Amount before VAT, from the bill. */
  @Matches(MONEY, { message: `amount ${MONEY_MESSAGE}` })
  amount!: string;

  /** VAT shown on the bill (claimable input VAT). Never computed. */
  @IsOptional()
  @Matches(MONEY, { message: `taxAmount ${MONEY_MESSAGE}` })
  taxAmount?: string;

  @IsOptional()
  @IsUUID()
  supportingFileAssetId?: string;
}

export class UpdateVendorBillDto {
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  /** Empty string clears the bill number. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vendorBillNumber?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: `expenseDate ${DATE_MESSAGE}` })
  expenseDate?: string;

  /** Empty string clears the due date. */
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: `dueDate ${DATE_MESSAGE}` })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  expenseAccountId?: string;

  @IsOptional()
  @Matches(MONEY, { message: `amount ${MONEY_MESSAGE}` })
  amount?: string;

  @IsOptional()
  @Matches(MONEY, { message: `taxAmount ${MONEY_MESSAGE}` })
  taxAmount?: string;

  /** Empty string clears the document link. */
  @IsOptional()
  @Matches(/^([0-9a-fA-F-]{36})?$/, {
    message: 'supportingFileAssetId must be a file id',
  })
  supportingFileAssetId?: string;
}

export class ApproveVendorBillDto {
  /** The content fingerprint the approver reviewed. */
  @Matches(/^[0-9a-f]{64}$/, { message: 'expectedFingerprint is required' })
  expectedFingerprint!: string;
}

export class ReverseWithDateDto extends ReasonDto {
  /** Accounting date of the reversal (default: today in Nepal). */
  @IsOptional()
  @Matches(DATE_ONLY, { message: `reversalDate ${DATE_MESSAGE}` })
  reversalDate?: string;
}

export class ListPayablesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(FINANCE_PAYABLE_STATUSES)
  status?: (typeof FINANCE_PAYABLE_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  vendorId?: string;
}

export class SettlePayableDto {
  /** Required: a retried payment returns the original settlement. */
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;

  /** Amount of the payable cleared (cash paid + tax withheld). */
  @Matches(MONEY, { message: `amount ${MONEY_MESSAGE}` })
  amount!: string;

  /** Tax withheld from the vendor (TDS), from the bill. Never computed. */
  @IsOptional()
  @Matches(MONEY, { message: `withheldTaxAmount ${MONEY_MESSAGE}` })
  withheldTaxAmount?: string;

  @IsUUID()
  paymentAccountId!: string;

  @Matches(DATE_ONLY, { message: `settledAt ${DATE_MESSAGE}` })
  settledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;
}

export class PayablesAgingQueryDto extends PageQueryDto {
  @IsOptional()
  @Matches(DATE_ONLY, { message: `asOfDate ${DATE_MESSAGE}` })
  asOfDate?: string;

  @IsOptional()
  @IsIn(RECEIVABLES_AGING_BUCKETS)
  bucket?: ReceivablesAgingBucket;

  @IsOptional()
  @IsUUID()
  vendorId?: string;
}
