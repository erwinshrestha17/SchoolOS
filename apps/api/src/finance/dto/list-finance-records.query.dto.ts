import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BillingRunStatus,
  FinanceRequestStatus,
  FinanceRequestType,
  InvoiceStatus,
  JournalSourceType,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';

export const FINANCE_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type FinanceSortDirection = (typeof FINANCE_SORT_DIRECTIONS)[number];

export class BaseFinanceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(FINANCE_SORT_DIRECTIONS)
  sortDirection?: FinanceSortDirection;
}

export class ListInvoicesQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  outstandingOnly?: boolean;

  @IsOptional()
  @IsIn(['issuedAt', 'dueDate', 'invoiceNumber', 'totalAmount'])
  sortBy?: 'issuedAt' | 'dueDate' | 'invoiceNumber' | 'totalAmount';
}

export class ListPaymentsQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @IsOptional()
  @IsDateString()
  paidTo?: string;

  @IsOptional()
  @IsIn(['paidAt', 'amount', 'createdAt'])
  sortBy?: 'paidAt' | 'amount' | 'createdAt';
}

export class ListReceiptsQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsDateString()
  issuedFrom?: string;

  @IsOptional()
  @IsDateString()
  issuedTo?: string;

  @IsOptional()
  @IsIn(['issuedAt', 'receiptNumber'])
  sortBy?: 'issuedAt' | 'receiptNumber';
}

export class ListBillingRunsQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  feePlanId?: string;

  @IsOptional()
  @IsEnum(BillingRunStatus)
  status?: BillingRunStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  runYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  runMonth?: number;

  @IsOptional()
  @IsIn(['generatedAt', 'runYear', 'runMonth'])
  sortBy?: 'generatedAt' | 'runYear' | 'runMonth';
}

export class ListDiscountRulesQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'name', 'updatedAt'])
  sortBy?: 'createdAt' | 'name' | 'updatedAt';
}

export class ListWaiversQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsIn(['createdAt', 'amount', 'approvedAt'])
  sortBy?: 'createdAt' | 'amount' | 'approvedAt';
}

export class ListFinanceApprovalRequestsQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsEnum(FinanceRequestType)
  type?: FinanceRequestType;

  @IsOptional()
  @IsEnum(FinanceRequestStatus)
  status?: FinanceRequestStatus;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'status'])
  sortBy?: 'createdAt' | 'updatedAt' | 'status';
}

export class ListLedgerEntriesQueryDto extends BaseFinanceListQueryDto {
  @IsOptional()
  @IsEnum(JournalSourceType)
  sourceType?: JournalSourceType;

  @IsOptional()
  @IsDateString()
  entryFrom?: string;

  @IsOptional()
  @IsDateString()
  entryTo?: string;

  @IsOptional()
  @IsIn(['entryDate', 'createdAt', 'entryNumber'])
  sortBy?: 'entryDate' | 'createdAt' | 'entryNumber';
}
