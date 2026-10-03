import type { ResourceAuthorization } from "../authorization-contract.js";
export type JournalSourceKind =
  | "FEE_INVOICE"
  | "FEE_INVOICE_ADJUSTMENT"
  | "FEE_WAIVER"
  | "FEE_RECEIPT"
  | "FEE_REFUND"
  | "PAYROLL_ACCRUAL"
  | "PAYROLL_DISBURSEMENT"
  | "CANTEEN"
  | "VENDOR_BILL"
  | "VENDOR_PAYMENT"
  | "MANUAL_JOURNAL"
  | "REVERSAL"
  | "CORRECTION"
  | "OPENING_BALANCE"
  | "FISCAL_YEAR_CLOSE"
  | "UNKNOWN";

/** One step of approval evidence: who did it and when. Never notes. */
export type AccountingActorEvent = {
  duty: string;
  actor: { id: string; name: string } | null;
  at: string | null;
};

/**
 * Phase 7.11a: the business record behind a journal entry. `restricted`
 * means the viewer cannot read that domain; only kind and label are shown.
 */
export type JournalSourceSummary = {
  kind: JournalSourceKind;
  label: string;
  reference: string | null;
  status: string | null;
  href: string | null;
  relatedJournalId: string | null;
  restricted: boolean;
  approvals: AccountingActorEvent[];
  documents: Array<{ label: string; fileAssetId: string }>;
};

export type JournalEntryView = {
  id: string;
  entryNumber: string | null;
  entryDate: string;
  narration: string;
  status: string;
  allowedActions?: {
    submit: boolean;
    review: boolean;
    approve: boolean;
    post: boolean;
    reject: boolean;
    cancel: boolean;
  };
  /** Canonical Phase 3A projection; read it instead of allowedActions. */
  authorization?: ResourceAuthorization;
  sourceModule?: string | null;
  sourceType: string;
  sourceId?: string | null;
  postingType?: string | null;
  reversalOfId?: string | null;
  correctionOfId?: string | null;
  reversalReason?: string | null;
  correctionReason?: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: Array<{
    id: string;
    side: "DEBIT" | "CREDIT";
    /** Decimal amounts arrive as strings. */
    amount: number | string;
    debit?: number | string;
    credit?: number | string;
    lineNumber?: number;
    description: string | null;
    /** Present on the journal detail response. */
    accountName?: string;
    accountCode?: string;
    chartAccount: {
      code: string;
      name: string;
    };
  }>;
  /** Journal detail only (Phase 7.11a). */
  actors?: AccountingActorEvent[];
  source?: JournalSourceSummary | null;
  postingBatch?: {
    id: string;
    sourceModule: string;
    sourceType: string;
    sourceBatchId: string;
    postingType: string;
    status: string;
  } | null;
  reversedBy?: { id: string; entryNumber: string | null } | null;
  correctedBy?: { id: string; entryNumber: string | null } | null;
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
  reopenedWarning?: boolean;
};

export type AccountingPostingBatchStatus =
  | "DRAFT"
  | "READY"
  | "POSTING"
  | "POSTED"
  | "FAILED"
  | "REVERSED";

export type AccountingPostingBatchSummary = {
  id: string;
  sourceModule: "M3" | "M7" | string;
  sourceType: string;
  sourceBatchId: string;
  postingType: string;
  status: AccountingPostingBatchStatus;
  fiscalYearId: string;
  fiscalPeriodId: string | null;
  sourceTotal: string;
  postedTotal: string;
  reconciliationDifference: string;
  journalEntryId: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  retryCount: number;
  itemCount?: number;
  postedAt: string | null;
  createdAt: string;
};

/**
 * Phase 7.11d: one item of the close inventory. `restricted` means the viewer
 * cannot act on it: the item and its severity are shown, the count is not.
 */
export type FiscalCloseItem = {
  code: string;
  severity: "BLOCKING" | "WARNING";
  count: number | null;
  amount: string | null;
  restricted: boolean;
  message: string;
  consequence: string;
  resolutionRoute: string;
};

export type FiscalCloseReadinessIssue = {
  code: string;
  count: number | null;
  restricted: boolean;
  amount: string | null;
  safeMessage: string;
  consequence: string;
  resolutionRoute: string;
};

export type FiscalCloseJournalCounts = {
  draft: number;
  submitted: number;
  reviewed: number;
  approvedUnposted: number;
  posted: number;
  postedSourceWithoutMapping: number;
  unbalancedPosted: number;
};

export type FiscalPeriodCloseReadiness = {
  checkedAt: string;
  period: FiscalPeriodSummary & { fiscalYearName: string };
  journals: FiscalCloseJournalCounts;
  unreconciledBankItems: number;
  trialBalance: {
    debit: string;
    credit: string;
    balanced: boolean;
  };
  blockers: FiscalCloseReadinessIssue[];
  warnings: FiscalCloseReadinessIssue[];
  unavailableChecks: Array<"NEEDS_REPORT_SNAPSHOT_POLICY">;
  readyToClose: boolean;
};

export type FiscalCloseIssueSeverity = "BLOCKING" | "WARNING" | "INFO";

export type FiscalYearCloseIssueCode = string;

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
  journals: FiscalCloseJournalCounts;
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
  issues: Array<
    FiscalCloseReadinessIssue & { severity: FiscalCloseIssueSeverity }
  >;
  blockingIssueCount: number;
  warningCount: number;
  readinessStatus: "READY" | "NEEDS_ACKNOWLEDGEMENT" | "BLOCKED" | "CLOSED";
  allowedActions: Array<"CLOSE" | "REOPEN">;
  unavailableChecks: Array<
    | "NEEDS_REPORT_SNAPSHOT_POLICY"
    | "NEEDS_EXPORT_JOB_SCOPE_CONFIRMATION"
    | "NEEDS_FEE_POSTING_RECONCILIATION_CONTRACT"
  >;
  readyToClose: boolean;
};

/** Phase 7.11d: what a period close depends on and will mean. */
export type FiscalPeriodClosePreview = {
  kind: "PERIOD";
  checkedAt: string;
  period: {
    id: string;
    fiscalYearId: string;
    fiscalYearName: string;
    label: string;
    periodNumber: number;
    startDate: string;
    endDate: string;
    bsStartDate: string;
    bsEndDate: string;
    status: string;
  };
  previousPeriod: { id: string; label: string; status: string } | null;
  nextPeriod: { id: string; label: string; status: string } | null;
  blockers: FiscalCloseItem[];
  warnings: FiscalCloseItem[];
  consequences: string[];
  /** Every warning code; the close must acknowledge each one. */
  requiredAcknowledgements: string[];
  readyToClose: boolean;
  /** Send back as `expectedPreviewFingerprint` when closing. */
  previewFingerprint: string;
  authorization: ResourceAuthorization<"close", "inventory">;
};

/** Phase 7.11d: the year preview, including the exact closing lines. */
export type FiscalYearClosePreview = {
  kind: "YEAR";
  checkedAt: string;
  fiscalYear: FiscalYearCloseReadiness["fiscalYear"];
  blockers: FiscalCloseItem[];
  warnings: FiscalCloseItem[];
  closing: {
    postingType: string;
    supplementary: boolean;
    previousClosingEntries: Array<{
      id: string;
      entryNumber: string;
      postingType: string | null;
      status: string;
      postedAt: string | null;
    }>;
    entryDate: string;
    bsEntryDate: string;
    lines: Array<{
      chartAccountId: string;
      code: string;
      name: string;
      debit: string;
      credit: string;
      description: string;
    }>;
    netResult: string;
    resultType: "SURPLUS" | "DEFICIT" | "NONE";
    retainedEarningsAccount: { id: string; code: string; name: string } | null;
  };
  consequences: string[];
  requiredAcknowledgements: string[];
  readyToClose: boolean;
  previewFingerprint: string;
  authorization: ResourceAuthorization<"close", "inventory" | "closingLines">;
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

/** Phase 7.11a: PRE_CLOSING excludes fiscal-year closing entries. */
export type AccountingLedgerStage = "PRE_CLOSING" | "POST_CLOSING";

export type AccountingReportFilters = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  accountId?: string;
  /** Trial balance and general ledger only. */
  stage?: AccountingLedgerStage;
  page?: number;
  limit?: number;
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
    normalBalanceSide: "DEBIT" | "CREDIT";
  }>;
  stage?: AccountingLedgerStage;
  setupWarnings?: string[];
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
  openingBalanceSide: "DEBIT" | "CREDIT";
  closingBalance: string;
  closingBalanceSide: "DEBIT" | "CREDIT";
  /** Totals over every row matching the filter, not only this page. */
  totals: { debit: string; credit: string };
  /** Balance carried into the first row of this page. */
  pageOpeningBalance?: string;
  pageOpeningBalanceSide?: "DEBIT" | "CREDIT";
  stage?: AccountingLedgerStage;
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
    runningBalanceSide: "DEBIT" | "CREDIT";
    entryStatus?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  generatedAt: string;
};

export type AccountingCashBookResponse = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  account?: { id: string; code: string; name: string };
  openingBalance: string;
  openingBalanceSide: "DEBIT" | "CREDIT";
  totalReceipts: string;
  totalPayments: string;
  closingBalance: string;
  closingBalanceSide: "DEBIT" | "CREDIT";
  pageOpeningBalance?: string;
  pageOpeningBalanceSide?: "DEBIT" | "CREDIT";
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
    runningBalanceSide: "DEBIT" | "CREDIT";
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  generatedAt: string;
  setupWarnings?: string[];
};

export type AccountingIncomeStatementResponse = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  sections: Array<{
    section: "INCOME" | "EXPENSE";
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
  resultType: "SURPLUS" | "DEFICIT" | "BREAK_EVEN";
  stage?: AccountingLedgerStage;
  /** Comparative columns are not implemented. */
  comparisonSupported?: false;
  generatedAt: string;
};

export type AccountingBalanceSheetResponse = {
  fiscalYearId: string;
  asOfDate: string;
  sections: Array<{
    section: "ASSETS" | "LIABILITIES" | "EQUITY";
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
  stage?: AccountingLedgerStage;
  setupWarnings?: string[];
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
  failedSourcePostingsAvailability: "NEEDS_POSTING_FAILURE_CONTRACT";
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
  sourceModule: "FEES" | "PAYROLL" | "CANTEEN" | "LIBRARY" | "TRANSPORT";
  sourceType: string;
  postingType: string;
  description: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  archivedAt: string | null;
  debitAccount: Pick<
    ChartAccountSummary,
    "id" | "code" | "name" | "type" | "isActive"
  >;
  creditAccount: Pick<
    ChartAccountSummary,
    "id" | "code" | "name" | "type" | "isActive"
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
    sourceModule: AccountingSourceMappingSummary["sourceModule"];
    postedCount: number;
    missingSourceIdCount: number;
    sampleEntryIds: string[];
    configuredMappingCount: number;
  }>;
  isClean: boolean;
};

export type FinancialAuditLogSummary = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: string;
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
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
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
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
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
    confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW";
    matchedFields: string[];
    warningFlags: string[];
    suggestedAction: "REVIEW_AND_CONFIRM" | "MANUAL_REVIEW";
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

export type BankReconciliationSessionView = {
  id: string;
  accountId: string;
  fiscalPeriodId: string | null;
  statementFrom: string;
  statementTo: string;
  status:
    | "OPEN"
    | "SUBMITTED"
    | "REVIEWED"
    | "FINALIZED"
    | "REOPENED"
    | "CANCELLED";
  revision: number;
  statementReference: string | null;
  openingBookBalance: string;
  closingBookBalance: string;
  openingBankBalance: string;
  closingBankBalance: string;
  difference: string;
  createdById: string;
  submittedById: string | null;
  reviewedById: string | null;
  reviewReason: string | null;
  finalizedById: string | null;
  finalizedAt: string | null;
  issues: string[];
  unmatchedStatementCount: number;
  unmatchedBookCount: number;
  matches: Array<{
    id: string;
    statementId: string;
    journalLineId: string | null;
    status: "MATCHED" | "UNMATCHED";
    bankAmount: string;
    bookAmount: string;
    reason: string | null;
  }>;
  history: Array<{
    id: string;
    action: string;
    actorUserId: string;
    reason: string | null;
    createdAt: string;
  }>;
  allowedActions: Record<
    "manage" | "submit" | "review" | "return" | "finalize" | "cancel",
    boolean
  >;
  /** Canonical Phase 3A projection; read it instead of allowedActions. */
  authorization?: ResourceAuthorization;
};
export type PrepareBankReconciliation = {
  accountId: string;
  fiscalPeriodId: string;
  statementFrom: string;
  statementTo: string;
  openingBankBalance: string;
  closingBankBalance: string;
  statementReference: string;
};

/** Phase 7.11b: receivables aging as of a Nepal school day. */
export type ReceivablesAgingBucketTotal = {
  bucket: "CURRENT" | "0-30" | "31-60" | "61-90" | "90+";
  invoiceCount: number;
  studentCount: number;
  outstanding: string;
};

export type ReceivablesAgingResponse = {
  asOfDate: string;
  totals: {
    buckets: ReceivablesAgingBucketTotal[];
    totalOutstanding: string;
    overdueOutstanding: string;
    invoiceCount: number;
    studentCount: number;
  };
  advancesHeld: string;
  byClass: Array<{
    classId: string | null;
    className: string;
    invoiceCount: number;
    studentCount: number;
    outstanding: string;
    overdueOutstanding: string;
  }>;
  rows: Array<{
    invoiceId: string;
    invoiceNumber: string;
    studentId: string;
    studentName: string;
    studentSystemId: string;
    className: string;
    sectionName: string | null;
    dueDate: string;
    totalAmount: string;
    received: string;
    outstanding: string;
    daysOverdue: number;
    bucket: ReceivablesAgingBucketTotal["bucket"];
    ledgerHref: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  basis: string;
  generatedAt: string;
};

export type ReceivablesReconciliationCause =
  | "INVOICE_NOT_POSTED"
  | "VOID_NOT_REVERSED"
  | "LATE_FEE_NOT_POSTED"
  | "WAIVER_WITHOUT_INVOICE"
  | "OPENING_BALANCE"
  | "MANUAL_JOURNAL";

export type ReceivablesReconciliationResponse = {
  asOfDate: string;
  controlAccounts: Array<{ id: string; code: string; name: string }>;
  subledgerTotal: string;
  ledgerBalance: string;
  /** Ledger minus subledger. */
  difference: string;
  items: Array<{
    cause: ReceivablesReconciliationCause;
    label: string;
    count: number;
    /** Contribution to the difference (ledger minus subledger). */
    effect: string;
    examples: Array<{ reference: string; amount: string }>;
  }>;
  unexplained: string;
  isReconciled: boolean;
  isFullyExplained: boolean;
  generatedAt: string;
};

/** Phase 7.11c: accounts payable. Money is a decimal string in NPR. */
export type PayablesAccountRef = { id: string; code: string; name: string };
export type PayablesVendorRef = {
  id: string;
  vendorCode: string;
  displayName: string;
  panNumber: string | null;
};

export type PayablesMappingState =
  | "READY"
  | "MISSING"
  | "AMBIGUOUS"
  | "INVALID";

export type PayablesSetup = {
  ready: boolean;
  accountsPayable: {
    mappingType: "ACCOUNTS_PAYABLE";
    state: PayablesMappingState;
    account: PayablesAccountRef | null;
  };
  vatInput: {
    mappingType: "VAT_INPUT";
    state: PayablesMappingState;
    account: PayablesAccountRef | null;
  };
  tdsPayable: {
    mappingType: "TDS_PAYABLE";
    state: PayablesMappingState;
    account: PayablesAccountRef | null;
  };
  paymentAccounts: Array<PayablesAccountRef & { kind: "CASH" | "BANK" }>;
  expenseAccounts: PayablesAccountRef[];
  taxPolicy: string;
};

export type FinanceVendorView = {
  id: string;
  vendorCode: string;
  legalName: string;
  displayName: string;
  panNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE";
  outstandingAmount: string;
  createdAt: string;
  updatedAt: string;
  authorization: ResourceAuthorization<"update" | "deactivate", "contact">;
};

export type VendorBillStatus = "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED";

export type VendorBillView = {
  id: string;
  expenseNumber: string;
  vendor: PayablesVendorRef | null;
  vendorBillNumber: string | null;
  expenseDate: string;
  dueDate: string | null;
  description: string;
  expenseAccount: PayablesAccountRef;
  amount: string;
  taxAmount: string;
  totalAmount: string;
  status: VendorBillStatus;
  supportingFileAssetId: string | null;
  fiscalYearId: string;
  fiscalPeriodId: string | null;
  /** What an approver signs: send it back as `expectedFingerprint`. */
  contentFingerprint: string;
  rejection: {
    at: string;
    reason: string | null;
    actor: { id: string; name: string } | null;
  } | null;
  reversalReason: string | null;
  events: AccountingActorEvent[];
  payable: {
    id: string;
    payableNumber: string;
    status: FinancePayableStatus;
    originalAmount: string;
    outstandingAmount: string;
  } | null;
  journal: { id: string; entryNumber: string } | null;
  createdAt: string;
  updatedAt: string;
  authorization: ResourceAuthorization<
    "update" | "submit" | "approve" | "reject" | "reverse",
    "amounts" | "approvals"
  >;
};

export type FinancePayableStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "VOID";

export type FinancePayableView = {
  id: string;
  payableNumber: string;
  vendor: PayablesVendorRef | null;
  bill: {
    id: string;
    expenseNumber: string;
    vendorBillNumber: string | null;
    description: string;
    expenseDate: string;
  };
  dueDate: string;
  originalAmount: string;
  outstandingAmount: string;
  paidAmount: string;
  status: FinancePayableStatus;
  daysOverdue: number;
  bucket: ReceivablesAgingBucketTotal["bucket"] | null;
  voided: { date: string; reason: string | null } | null;
  authorization: ResourceAuthorization<"settle", "settlements">;
};

export type PayableSettlementView = {
  id: string;
  amount: string;
  withheldTaxAmount: string;
  cashAmount: string;
  paymentAccount: PayablesAccountRef;
  settledAt: string;
  paymentReference: string | null;
  journalEntryId: string | null;
  reversalOfId: string | null;
  reversalReason: string | null;
  reversedBySettlementId: string | null;
  paidBy: { id: string; name: string } | null;
  createdAt: string;
  authorization: ResourceAuthorization<"reverse", "amounts">;
};

export type FinancePayableDetail = FinancePayableView & {
  settlements: PayableSettlementView[];
};

export type PayablesAgingResponse = {
  asOfDate: string;
  totals: {
    buckets: Array<{
      bucket: ReceivablesAgingBucketTotal["bucket"];
      payableCount: number;
      vendorCount: number;
      outstanding: string;
    }>;
    totalOutstanding: string;
    overdueOutstanding: string;
    payableCount: number;
    vendorCount: number;
  };
  byVendor: Array<{
    vendor: PayablesVendorRef | null;
    payableCount: number;
    outstanding: string;
    overdueOutstanding: string;
    buckets: Array<{
      bucket: ReceivablesAgingBucketTotal["bucket"];
      outstanding: string;
    }>;
  }>;
  rows: Array<{
    payableId: string;
    payableNumber: string;
    vendor: PayablesVendorRef | null;
    billNumber: string;
    vendorBillNumber: string | null;
    dueDate: string;
    originalAmount: string;
    outstanding: string;
    daysOverdue: number;
    bucket: ReceivablesAgingBucketTotal["bucket"];
  }>;
  pagination: { page: number; limit: number; total: number };
  /** The mapped Accounts Payable account on the same day (null if unmapped). */
  ledger: {
    account: PayablesAccountRef;
    balance: string;
    subledgerTotal: string;
    difference: string;
    matches: boolean;
  } | null;
};
