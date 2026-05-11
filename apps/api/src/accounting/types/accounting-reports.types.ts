import { Prisma, ChartAccountType, JournalLineSide } from '@prisma/client';

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: ChartAccountType;
  parentId: string | null;
  openingDebit: Prisma.Decimal;
  openingCredit: Prisma.Decimal;
  periodDebit: Prisma.Decimal;
  periodCredit: Prisma.Decimal;
  closingDebit: Prisma.Decimal;
  closingCredit: Prisma.Decimal;
  netBalance: Prisma.Decimal;
  normalBalanceSide: JournalLineSide;
}

export interface TrialBalanceResponse {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  totalOpeningDebit: Prisma.Decimal;
  totalOpeningCredit: Prisma.Decimal;
  totalPeriodDebit: Prisma.Decimal;
  totalPeriodCredit: Prisma.Decimal;
  totalClosingDebit: Prisma.Decimal;
  totalClosingCredit: Prisma.Decimal;
  isBalanced: boolean;
  imbalanceAmount: Prisma.Decimal;
  rows: TrialBalanceRow[];
  generatedAt: Date;
}

export interface GeneralLedgerRow {
  journalEntryId: string;
  journalLineId: string;
  entryDate: Date;
  postedAt: Date | null;
  entryNumber: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  sourceModule: string | null;
  sourceType: string;
  sourceId: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  runningBalance: Prisma.Decimal;
  runningBalanceSide: JournalLineSide;
  createdById: string | null;
  postedById: string | null;
  reversalOfId: string | null;
  correctionOfId: string | null;
}

export interface GeneralLedgerResponse {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  accountId?: string;
  accountCode?: string;
  openingBalance: Prisma.Decimal;
  openingBalanceSide: JournalLineSide;
  closingBalance: Prisma.Decimal;
  closingBalanceSide: JournalLineSide;
  totals: {
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
  };
  rows: GeneralLedgerRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  generatedAt: Date;
}
