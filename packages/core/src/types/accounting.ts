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

export type AccountingDashboardSummary = {
  generatedAt: string;
  staleAfterSeconds: number;
  activeFiscalYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  activePeriod: {
    id: string;
    label: string;
    periodNumber: number;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  journalsByStatus: Record<string, number>;
  pendingJournalSubmissions: number;
  pendingJournalApprovals: number;
  approvedButUnpostedJournals: number;
  unreconciledBankItems: number;
  activeSourceMappings: number;
  sourceMappingIssueCount: number;
  postedSourceEntries: number;
  postedSourceEntriesWithoutId: number;
  exportJobsByStatus: Record<string, number>;
  activeExportJobs: number;
  failedExportJobs: number;
  failedSourcePostings: null;
  failedSourcePostingsAvailability: 'NEEDS_POSTING_FAILURE_CONTRACT';
  trialBalance: {
    totalDebit: string;
    totalCredit: string;
    balanced: boolean;
  };
  closingBlockerCount: number;
  recentJournals: Array<{
    id: string;
    entryNumber: string | null;
    entryDate: string;
    narration: string;
    status: string;
    sourceModule: string | null;
    sourceType: string;
    sourceId: string | null;
    reversalOfId: string | null;
    correctionOfId: string | null;
    totalDebit: string;
  }>;
};

export type AccountingSourceMappingSummary = {
  id: string;
  sourceModule: 'FEES' | 'PAYROLL' | 'CANTEEN' | 'LIBRARY' | 'TRANSPORT';
  sourceType: string;
  postingType: string;
  description: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  archivedAt: string | null;
  debitAccount: Pick<
    ChartAccountSummary,
    'id' | 'code' | 'name' | 'type' | 'isActive'
  >;
  creditAccount: Pick<
    ChartAccountSummary,
    'id' | 'code' | 'name' | 'type' | 'isActive'
  >;
};

export type AccountingSourceMappingHealth = {
  checkedAt: string;
  sampledPostedSourceEntries: number;
  sampleLimit: number;
  missingSourceId: {
    count: number;
    samples: Array<{
      id: string;
      entryNumber: string | null;
      sourceModule: string | null;
      sourceType: string;
    }>;
  };
  modules: Array<{
    sourceModule: AccountingSourceMappingSummary['sourceModule'];
    postedCount: number;
    missingSourceIdCount: number;
    sampleEntryIds: string[];
    configuredMappingCount: number;
  }>;
  isClean: boolean;
};
