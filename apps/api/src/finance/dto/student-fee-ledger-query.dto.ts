import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const STUDENT_FEE_LEDGER_EVENT_TYPES = [
  'INVOICE',
  'PAYMENT',
  'WAIVER',
  'REFUND',
  'REVERSAL',
] as const;

export type StudentFeeLedgerEventType =
  (typeof STUDENT_FEE_LEDGER_EVENT_TYPES)[number];

export class StudentFeeLedgerQueryDto {
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
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  invoiceStatus?: InvoiceStatus;

  @IsOptional()
  @IsIn(STUDENT_FEE_LEDGER_EVENT_TYPES)
  transactionType?: StudentFeeLedgerEventType;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
