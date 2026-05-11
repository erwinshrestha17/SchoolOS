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

export interface CashBookRow {
  journalEntryId: string;
  journalLineId: string;
  entryDate: Date;
  postedAt: Date | null;
  entryNumber: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  narration: string | null;
  sourceModule: string | null;
  sourceType: string;
  sourceId: string | null;
  receiptAmount: Prisma.Decimal;
  paymentAmount: Prisma.Decimal;
  runningBalance: Prisma.Decimal;
  runningBalanceSide: JournalLineSide;
  postedById: string | null;
}

export interface CashBookResponse {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  account?: { id: string; code: string; name: string };
  openingBalance: Prisma.Decimal;
  openingBalanceSide: JournalLineSide;
  totalReceipts: Prisma.Decimal;
  totalPayments: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
  closingBalanceSide: JournalLineSide;
  rows: CashBookRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  generatedAt: Date;
  setupWarnings?: string[];
}

export interface IncomeStatementAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: Prisma.Decimal;
}

export interface IncomeStatementSection {
  section: 'INCOME' | 'EXPENSE';
  total: Prisma.Decimal;
  accounts: IncomeStatementAccount[];
}

export interface IncomeStatementResponse {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  sections: IncomeStatementSection[];
  totalIncome: Prisma.Decimal;
  totalExpense: Prisma.Decimal;
  netSurplusOrDeficit: Prisma.Decimal;
  resultType: 'SURPLUS' | 'DEFICIT' | 'BREAK_EVEN';
  generatedAt: Date;
}

export interface BalanceSheetAccount {
  accountId?: string;
  accountCode: string;
  accountName: string;
  amount: Prisma.Decimal;
}

export interface BalanceSheetSection {
  section: 'ASSETS' | 'LIABILITIES' | 'EQUITY';
  total: Prisma.Decimal;
  accounts: BalanceSheetAccount[];
}

export interface BalanceSheetResponse {
  fiscalYearId: string;
  asOfDate: Date;
  sections: BalanceSheetSection[];
  totalAssets: Prisma.Decimal;
  totalLiabilities: Prisma.Decimal;
  totalEquity: Prisma.Decimal;
  totalLiabilitiesAndEquity: Prisma.Decimal;
  isBalanced: boolean;
  imbalanceAmount: Prisma.Decimal;
  generatedAt: Date;
}

export interface TaxSummaryResponse {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  vat?: {
    outputVat: Prisma.Decimal;
    inputVat: Prisma.Decimal;
    netVat: Prisma.Decimal;
    status: 'PAYABLE' | 'RECEIVABLE' | 'ZERO';
  };
  tds?: {
    deductedPayable: Prisma.Decimal;
    paid: Prisma.Decimal;
    netPayable: Prisma.Decimal;
  };
  pf?: {
    employeeContribution: Prisma.Decimal;
    employerContribution: Prisma.Decimal;
    paid: Prisma.Decimal;
    netPayable: Prisma.Decimal;
  };
  setupWarnings: string[];
  generatedAt: Date;
}
