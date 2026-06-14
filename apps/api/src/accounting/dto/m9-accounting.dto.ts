export const M9_ACCOUNTING_SOURCE_MODULES = [
  'FEES',
  'PAYROLL',
  'CANTEEN',
  'LIBRARY',
  'TRANSPORT',
] as const;
export type M9AccountingSourceModule =
  (typeof M9_ACCOUNTING_SOURCE_MODULES)[number];

export class CreateAccountingSourceMappingDto {
  sourceModule!: M9AccountingSourceModule;
  sourceType!: string;
  postingType?: string;
  debitAccountId!: string;
  creditAccountId!: string;
  description?: string;
}

export class PostMappedAccountingSourceDto {
  sourceModule!: M9AccountingSourceModule;
  sourceType!: string;
  sourceId!: string;
  postingType?: string;
  amount!: number;
  entryDate!: string;
  narration!: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}

export class GenerateAccountingReportSnapshotDto {
  reportType!: string;
  startDate?: string;
  endDate?: string;
  fiscalYearId?: string;
  fiscalPeriodId?: string;
}

export class ConfirmBankReconciliationDto {
  statementId!: string;
  journalLineId!: string;
  confirmationNote?: string;
}

export class ReverseBankReconciliationDto {
  reason!: string;
}
