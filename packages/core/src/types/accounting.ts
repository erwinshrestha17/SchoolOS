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

export type FiscalPeriodCloseReadiness = {
  checkedAt: string;
  period: FiscalPeriodSummary & { fiscalYearName: string };
  journals: {
    draft: number;
    submitted: number;
    approvedUnposted: number;
    posted: number;
    postedSourceWithoutMapping: number;
    unbalancedPosted: number;
  };
  unreconciledBankItems: number;
  trialBalance: {
    debit: string;
    credit: string;
    balanced: boolean;
  };
  blockers: Array<{
    code:
      | 'DRAFT_JOURNALS'
      | 'SUBMITTED_JOURNALS'
      | 'APPROVED_UNPOSTED_JOURNALS'
      | 'POSTED_SOURCE_WITHOUT_MAPPING'
      | 'UNRECONCILED_BANK_ITEMS'
      | 'UNBALANCED_POSTED_JOURNALS'
      | 'UNBALANCED_TRIAL_BALANCE';
    count: number;
    safeMessage: string;
    resolutionRoute: string;
  }>;
  unavailableChecks: Array<
    'NEEDS_POSTING_FAILURE_CONTRACT' | 'NEEDS_REPORT_SNAPSHOT_POLICY'
  >;
  readyToClose: boolean;
};

export type FiscalCloseIssueSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export type FiscalYearCloseIssueCode =
  | 'OPEN_PERIODS'
  | 'DRAFT_JOURNALS'
  | 'SUBMITTED_JOURNALS'
  | 'APPROVED_UNPOSTED_JOURNALS'
  | 'MISSING_SOURCE_MAPPINGS'
  | 'UNRECONCILED_BANK_ITEMS'
  | 'UNBALANCED_JOURNALS'
  | 'TRIAL_BALANCE_NOT_READY'
  | 'OPENING_BALANCE_INCOMPLETE'
  | 'PAYROLL_POSTING_INCOMPLETE';

export type FiscalYearCloseReadiness = {
  checkedAt: string;
  lastCalculatedAt: string;
  stale: boolean;
  fiscalYear: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    bsStartDate: string;
    bsEndDate: string;
  };
  periods: {
    total: number;
    open: number;
    locked: number;
    closed: number;
  };
  journals: {
    draft: number;
    submitted: number;
    approvedUnposted: number;
    posted: number;
    postedSourceWithoutMapping: number;
    unbalancedPosted: number;
  };
  unreconciledBankItems: number;
  trialBalance: {
    debit: string;
    credit: string;
    balanced: boolean;
  };
  openingBalance: {
    exists: boolean;
    status: string | null;
  };
  payroll: {
    approvedUnposted: number;
  };
  issues: Array<{
    code: FiscalYearCloseIssueCode;
    severity: FiscalCloseIssueSeverity;
    count: number;
    safeMessage: string;
    resolutionRoute: string;
  }>;
  blockingIssueCount: number;
  warningCount: number;
  readinessStatus: 'READY' | 'NEEDS_ACKNOWLEDGEMENT' | 'BLOCKED' | 'CLOSED';
  allowedActions: Array<'CLOSE' | 'REOPEN'>;
  unavailableChecks: Array<
    | 'NEEDS_POSTING_FAILURE_CONTRACT'
    | 'NEEDS_REPORT_SNAPSHOT_POLICY'
    | 'NEEDS_EXPORT_JOB_SCOPE_CONFIRMATION'
    | 'NEEDS_FEE_POSTING_RECONCILIATION_CONTRACT'
    | 'NEEDS_WARNING_ACKNOWLEDGEMENT_CONTRACT'
  >;
  readyToClose: boolean;
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

export type AccountingReportFilters = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  accountId?: string;
};

export type AccountingTrialBalanceResponse = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  totalOpeningDebit: string;
  totalOpeningCredit: string;
  totalPeriodDebit: string;
  totalPeriodCredit: string;
  totalClosingDebit: string;
  totalClosingCredit: string;
  isBalanced: boolean;
  imbalanceAmount: string;
  rows: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    parentId: string | null;
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
    netBalance: string;
    normalBalanceSide: 'DEBIT' | 'CREDIT';
  }>;
  generatedAt: string;
};

export type AccountingGeneralLedgerResponse = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  accountId: string;
  accountCode: string;
  openingBalance: string;
  openingBalanceSide: 'DEBIT' | 'CREDIT';
  closingBalance: string;
  closingBalanceSide: 'DEBIT' | 'CREDIT';
  totals: { debit: string; credit: string };
  rows: Array<{
    journalEntryId: string;
    journalLineId: string;
    entryDate: string;
    postedAt: string | null;
    entryNumber: string | null;
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string | null;
    sourceModule: string | null;
    sourceType: string;
    sourceId: string | null;
    debit: string;
    credit: string;
    runningBalance: string;
    runningBalanceSide: 'DEBIT' | 'CREDIT';
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  generatedAt: string;
};

export type AccountingCashBookResponse = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  account?: { id: string; code: string; name: string };
  openingBalance: string;
  openingBalanceSide: 'DEBIT' | 'CREDIT';
  totalReceipts: string;
  totalPayments: string;
  closingBalance: string;
  closingBalanceSide: 'DEBIT' | 'CREDIT';
  rows: Array<{
    journalEntryId: string;
    journalLineId: string;
    entryDate: string;
    postedAt: string | null;
    entryNumber: string | null;
    accountId: string;
    accountCode: string;
    accountName: string;
    narration: string | null;
    sourceModule: string | null;
    sourceType: string;
    sourceId: string | null;
    receiptAmount: string;
    paymentAmount: string;
    runningBalance: string;
    runningBalanceSide: 'DEBIT' | 'CREDIT';
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  generatedAt: string;
  setupWarnings?: string[];
};

export type AccountingIncomeStatementResponse = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  sections: Array<{
    section: 'INCOME' | 'EXPENSE';
    total: string;
    accounts: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
  }>;
  totalIncome: string;
  totalExpense: string;
  netSurplusOrDeficit: string;
  resultType: 'SURPLUS' | 'DEFICIT' | 'BREAK_EVEN';
  generatedAt: string;
};

export type AccountingBalanceSheetResponse = {
  fiscalYearId: string;
  asOfDate: string;
  sections: Array<{
    section: 'ASSETS' | 'LIABILITIES' | 'EQUITY';
    total: string;
    accounts: Array<{
      accountId?: string;
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
  }>;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
  imbalanceAmount: string;
  generatedAt: string;
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

export type BankStatementImportLine = {
  statementDate: string;
  description: string;
  reference?: string | null;
  debitAmount: string;
  creditAmount: string;
};

export type BankStatementImportPreview = {
  account: { id: string; code: string; name: string };
  fingerprint: string;
  lineCount: number;
  rows: BankStatementImportLine[];
  readyToCommit: boolean;
};

export type BankStatementImportResult = {
  importBatchId: string;
  count: number;
  idempotent: boolean;
  statements: BankStatementLineSummary[];
};

export type BankStatementImportJobQueuedResult = {
  jobId: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  importBatchId: string | null;
  totalRows: number;
  processedRows: number;
  syncThreshold?: number;
  backgroundThreshold?: number;
  reused: boolean;
};

export type BankStatementImportJobStatus = {
  id: string;
  tenantId: string;
  accountId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRows: number;
  processedRows: number;
  insertedRows: number | null;
  duplicateRows: number | null;
  errorRows: number | null;
  errorSummary: string | null;
  importBatchId: string | null;
  requestedBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type BankStatementLineSummary = {
  id: string;
  accountId: string;
  statementDate: string;
  description: string;
  reference: string | null;
  debitAmount: string;
  creditAmount: string;
  isReconciled: boolean;
  reconciledAt: string | null;
  journalLineId: string | null;
  importBatchId: string | null;
};

export type BankReconciliationSuggestion = {
  bankTransactionId: string;
  amount: string;
  statementDate: string;
  reference: string | null;
  description: string;
  candidates: Array<{
    candidateJournalId: string;
    ledgerTransactionId: string;
    bankTransactionId: string;
    score: number;
    confidence: 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW';
    matchedFields: string[];
    warningFlags: string[];
    suggestedAction: 'REVIEW_AND_CONFIRM' | 'MANUAL_REVIEW';
    reason: string;
  }>;
};

export type BankReconciliationSummary = {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalStatements: number;
  reconciledStatements: number;
  unreconciledStatements: number;
  statementBalance: { debit: string; credit: string };
  ledgerBalance: { debit: string; credit: string };
};
