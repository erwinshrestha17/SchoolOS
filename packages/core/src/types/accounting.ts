export type JournalEntryView = {
  id: string;
  entryNumber: string;
  entryDate: string;
  narration: string;
  status: string;
  sourceModule?: string | null;
  sourceType: string;
  sourceId?: string | null;
  reference?: string | null;
  totalDebit: number;
  totalCredit: number;
  postedBy?: {
    firstName: string;
    lastName: string;
  } | null;
  lines: Array<{
    id: string;
    side: 'DEBIT' | 'CREDIT';
    amount: number;
    description: string | null;
    accountName: string;
    accountCode: string;
    chartAccount: {
      code: string;
      name: string;
    };
  }>;
};

export type AccountingPeriodSummary = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  closedAt: string | null;
};

export type ChartAccountSummary = {
  id: string;
  code: string;
  name: string;
  type: string;
  isSystem: boolean;
  isActive?: boolean;
  parentId?: string | null;
  children?: ChartAccountSummary[];
};

export type FiscalYearSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  periods?: FiscalPeriodSummary[];
};

export type FiscalPeriodSummary = {
  id: string;
  fiscalYearId: string;
  label: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: string;
};

export type AccountingReport = {
  trialBalance: Array<{
    accountId: string;
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totals: {
    debit: number;
    credit: number;
  };
  incomeStatement: {
    income: number;
    expenses: number;
    netIncome: number;
  };
  balanceSheet?: {
    assets: number;
    liabilities: number;
    equity: number;
  };
  cashFlow?: {
    netCashMovement: number;
  };
  balanced: boolean;
};
