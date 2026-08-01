import type { PaginatedResponse } from "./common.js";
import type {
  FinancialReportDrilldown,
  FinancialReportEnvelope,
} from "./financial-reporting.js";

export type FinanceMoneyAmount = string;

export type FinanceDashboardSummary = {
  period: {
    fromDate: string;
    toDate: string;
    timeZone: string;
    startUtc: string;
    endExclusiveUtc: string;
  };
  collectedToday: {
    grossAmount: FinanceMoneyAmount;
    refundedAmount: FinanceMoneyAmount;
    netAmount: FinanceMoneyAmount;
  };
  outstanding: {
    amount: FinanceMoneyAmount;
  };
  overdue: {
    studentCount: number;
    amount: FinanceMoneyAmount;
  };
  pendingApprovalCount: number;
  cashierClose: {
    state: "NOT_STARTED" | "OPEN" | "CLOSED";
    latestCloseId: string | null;
    latestCloseNumber: string | null;
    latestClosedAt: string | null;
    unclosedPaymentCount: number;
  };
  receiptsIssued: number;
  generatedAt: string;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  issuedAt?: string;
  totalAmount: FinanceMoneyAmount;
  studentId?: string;
  paidAmount?: FinanceMoneyAmount;
  outstandingAmount?: FinanceMoneyAmount;
  student?: {
    id: string;
    name: string;
    studentSystemId?: string;
  };
};

export type StudentCollectionContext = {
  student: {
    id: string;
    studentSystemId: string;
    name: string;
    className: string | null;
    sectionName: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    dueDate: string;
    totalAmount: FinanceMoneyAmount;
    paidAmount: FinanceMoneyAmount;
    outstandingAmount: FinanceMoneyAmount;
  }>;
};

export type CollectionStudentSearchResult = {
  id: string;
  studentSystemId: string;
  name: string;
  className: string;
  sectionName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  openInvoiceCount: number;
  totalOutstanding: FinanceMoneyAmount;
};

export type CollectionStudentSearchResponse = {
  items: CollectionStudentSearchResult[];
  generatedAt: string;
};

export type LedgerStudentSearchResult = {
  id: string;
  studentSystemId: string;
  name: string;
  className: string;
  sectionName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  invoiceCount: number;
};

export type LedgerStudentSearchResponse = {
  items: LedgerStudentSearchResult[];
  generatedAt: string;
};

export type InvoiceDetailLine = {
  id: string;
  feeHeadId: string;
  feeHeadCode: string;
  feeHeadName: string;
  description: string;
  periodLabel: string;
  quantity: number;
  unitAmount: FinanceMoneyAmount;
  baseAmount: FinanceMoneyAmount;
  discountAmount: FinanceMoneyAmount;
  waiverAmount: FinanceMoneyAmount;
  lateFeeAmount: FinanceMoneyAmount;
  vatAmount: FinanceMoneyAmount;
  totalAmount: FinanceMoneyAmount;
  netAmount: FinanceMoneyAmount;
};

export type InvoiceDetailPayment = {
  id: string;
  amount: FinanceMoneyAmount;
  allocatedAmount: FinanceMoneyAmount;
  refundedAmount: FinanceMoneyAmount;
  netAmount: FinanceMoneyAmount;
  method: string;
  referenceNumber: string | null;
  paidAt: string;
  narration: string | null;
  collector: {
    id: string;
    email: string | null;
  } | null;
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
    fileAssetId: string | null;
    fileStatus: "PENDING" | "AVAILABLE" | "UNAVAILABLE";
  } | null;
  refunds: Array<{
    id: string;
    refundNumber: string;
    amount: FinanceMoneyAmount;
    refundDate: string;
    reason: string;
    referenceNumber: string | null;
  }>;
  journalEntryNumber: string | null;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  fiscalYear: string | null;
  billNumber: string | null;
  status: string;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  reportCardBlocked: boolean;
  hallTicketBlocked: boolean;
  academicYear: {
    id: string;
    name: string;
  };
  billingRun: {
    id: string;
    runMonth: number;
    runYear: number;
  } | null;
  student: {
    id: string;
    studentSystemId: string;
    name: string;
    className: string;
    sectionName: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  subtotal: FinanceMoneyAmount;
  vatAmount: FinanceMoneyAmount;
  totalAmount: FinanceMoneyAmount;
  paidAmount: FinanceMoneyAmount;
  outstandingAmount: FinanceMoneyAmount;
  totalWaivedAmount: FinanceMoneyAmount;
  lines: InvoiceDetailLine[];
  waivers: Array<{
    id: string;
    feeHeadId: string | null;
    feeHeadName: string | null;
    amount: FinanceMoneyAmount;
    reason: string;
    status: string;
    approvedAt: string | null;
    approvedBy: {
      id: string;
      email: string | null;
    } | null;
  }>;
  payments: InvoiceDetailPayment[];
  allocations: PaymentAllocationSummary[];
  source: {
    billingRunId: string | null;
    enrollmentId: string | null;
  };
};

export type StudentFeeLedgerRow = {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT" | "WAIVER" | "REFUND" | "REVERSAL";
  reference: string;
  description: string;
  debit: FinanceMoneyAmount;
  credit: FinanceMoneyAmount;
  runningBalance: FinanceMoneyAmount;
  affectsBalance: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentId: string | null;
  receiptNumber: string | null;
  status: string | null;
  /** Context-preserving link back to the originating source record. */
  drilldown?: FinancialReportDrilldown;
};

export type StudentFeeLedger = {
  student: {
    id: string;
    studentSystemId: string;
    name: string;
    className: string;
    sectionName: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  openingBalance: FinanceMoneyAmount;
  totalInvoiced: FinanceMoneyAmount;
  totalPaid: FinanceMoneyAmount;
  totalWaived: FinanceMoneyAmount;
  totalRefunded: FinanceMoneyAmount;
  outstandingBalance: FinanceMoneyAmount;
  rows: StudentFeeLedgerRow[];
};

/** Totals for the rows on the displayed page only. Never official figures. */
export type StudentFeeLedgerPageTotals = {
  rowCount: number;
  debit: FinanceMoneyAmount;
  credit: FinanceMoneyAmount;
};

/** Backend-owned totals for the whole filtered window, across every page. */
export type StudentFeeLedgerWindowTotals = StudentFeeLedgerPageTotals;

/**
 * FEE-01 Student Fee Ledger.
 *
 * Carries the canonical versioned report metadata envelope alongside its own
 * typed rows. `generatedAt`, `pagination`, and report-wide `totals` come from
 * the envelope; `pageTotals` describes only the rows actually displayed.
 */
export type StudentFeeLedgerPage = StudentFeeLedger &
  FinancialReportEnvelope & {
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
    pageTotals: StudentFeeLedgerPageTotals;
    windowTotals: StudentFeeLedgerWindowTotals;
    filters: {
      fromDate: string | null;
      toDate: string | null;
      academicYearId: string | null;
      invoiceStatus: string | null;
      transactionType: StudentFeeLedgerRow["type"] | null;
      sortDirection: "asc" | "desc";
    };
  };

export type PaymentReceipt = {
  paymentId: string;
  receiptNumber: string;
  invoiceId: string | null;
  invoiceIds: string[];
  amount: FinanceMoneyAmount;
  allocatedAmount: FinanceMoneyAmount;
  unallocatedAmount: FinanceMoneyAmount;
  allocations: PaymentAllocationSummary[];
  method: string;
  paidAt: string;
};

export type PaymentRefundSummary = {
  refundId: string;
  refundNumber: string;
  paymentId: string;
  invoiceId: string | null;
  amount: FinanceMoneyAmount;
  refundDate: string;
  journalEntryNumber: string;
  remainingRefundableAmount: FinanceMoneyAmount;
  invoiceStatus: string | null;
};

export type PaymentRefundPayload = {
  idempotencyKey: string;
  amount?: FinanceMoneyAmount;
  reason: string;
  refundDate?: string;
  referenceNumber?: string;
  narration?: string;
};

export type PaymentAllocationType =
  | "INVOICE"
  | "ADVANCE"
  | "UNALLOCATED"
  | "REFUND"
  | "REVERSAL"
  | "REALLOCATION";

export type PaymentAllocationSummary = {
  id?: string;
  paymentId?: string;
  invoiceId: string | null;
  invoiceNumber?: string | null;
  amount: FinanceMoneyAmount;
  allocationType: PaymentAllocationType;
  allocatedAt?: string;
  reversedAt?: string | null;
  allocatedById?: string | null;
  reversedById?: string | null;
  allocationGroupId?: string | null;
  reason?: string | null;
  reversalReason?: string | null;
};

export type CashierCloseMethodBreakdown = {
  method: string;
  grossCollected: FinanceMoneyAmount;
  totalRefunded: FinanceMoneyAmount;
  netCollected: FinanceMoneyAmount;
  paymentCount: number;
  refundCount: number;
};

export type CashierClosePreview = {
  openedAt: string | Date;
  closedAt: string | Date;
  collectorUserId: string | null;
  paymentMethod: string | null;
  grossCollected: FinanceMoneyAmount;
  totalRefunded: FinanceMoneyAmount;
  netCollected: FinanceMoneyAmount;
  expectedCashAmount: FinanceMoneyAmount;
  actualCashAmount?: FinanceMoneyAmount | null;
  varianceAmount?: FinanceMoneyAmount | null;
  varianceReason?: string | null;
  denominationBreakdown?: Record<string, unknown> | null;
  methodBreakdown: CashierCloseMethodBreakdown[];
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
  byMethod?: Array<{
    method: string;
    count: number;
    amount: FinanceMoneyAmount;
  }>;
  byUser?: Array<{
    userId: string;
    userName: string;
    amount: FinanceMoneyAmount;
  }>;
};

export type CashierCloseSummary = {
  id: string;
  closeNumber: string;
  status:
    | "OPEN"
    | "COUNTED"
    | "SUBMITTED"
    | "APPROVED"
    | "CLOSED"
    | "DEPOSITED";
  openedAt: string | Date;
  closedAt: string | Date | null;
  countedThroughAt?: string | Date | null;
  countedAt?: string | Date | null;
  countedById?: string | null;
  submittedAt?: string | Date | null;
  submittedById?: string | null;
  approvedAt?: string | Date | null;
  approvedById?: string | null;
  depositedAt?: string | Date | null;
  depositedById?: string | null;
  depositId?: string | null;
  reopenedAt?: string | Date | null;
  reopenedById?: string | null;
  reopenReason?: string | null;
  collectorUser?: {
    id: string;
    email: string | null;
  } | null;
  paymentMethod?: string | null;
  grossCollected: FinanceMoneyAmount;
  totalRefunded: FinanceMoneyAmount;
  netCollected: FinanceMoneyAmount;
  expectedCashAmount: FinanceMoneyAmount;
  actualCashAmount?: FinanceMoneyAmount | null;
  varianceAmount?: FinanceMoneyAmount | null;
  varianceReason?: string | null;
  denominationBreakdown?: Record<string, unknown> | null;
  methodBreakdown: CashierCloseMethodBreakdown[];
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
  notes?: string | null;
  closePdfFile?: {
    fileAssetId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
  closedBy?: {
    id: string;
    email: string | null;
  } | null;
  createdAt?: string | Date;
};

export type CashDepositSummary = {
  id: string;
  depositNumber: string;
  cashierCloseId: string;
  cashierCloseNumber: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: FinanceMoneyAmount;
  depositDate: string;
  referenceNumber: string | null;
  status: "DRAFT" | "SUBMITTED" | "DEPOSITED" | "REVERSED";
  journalEntryId: string | null;
  submittedAt: string | null;
  depositedAt: string | null;
  createdAt: string;
};

export type CashDepositPage = {
  items: CashDepositSummary[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type ReconciliationRow = {
  paymentId: string;
  paymentDate: string;
  refundDate: string | null;
  receiptNumber: string | null;
  refundNumber: string | null;
  invoiceId: string;
  invoiceNumber: string;
  student: {
    id: string;
    name: string;
    className: string;
  };
  collector: {
    id: string;
    email: string | null;
  } | null;
  method: string;
  grossAmount: FinanceMoneyAmount;
  refundedAmount: FinanceMoneyAmount;
  netAmount: FinanceMoneyAmount;
  journalEntryNumber: string | null;
  refundJournalEntryNumbers: string[];
  statusMarkers: string[];
};

export type ReconciliationSummary = {
  openedAt: string;
  closedAt: string;
  totalRows: number;
  grossCollected: FinanceMoneyAmount;
  totalRefunded: FinanceMoneyAmount;
  netCollected: FinanceMoneyAmount;
  rows: ReconciliationRow[];
};

export type FeeHeadSummary = {
  id: string;
  code: string;
  name: string;
  frequency: string;
  defaultAmount: FinanceMoneyAmount;
  vatApplicable: boolean;
};

export type FeePlanSummary = {
  id: string;
  code: string;
  name: string;
  academicYearId: string;
  classId: string | null;
  isActive: boolean;
  academicYear?: {
    id: string;
    name: string;
  };
  class?: {
    id: string;
    name: string;
  } | null;
  items?: Array<{
    id: string;
    feeHeadId: string;
    amount: FinanceMoneyAmount;
  }>;
};

export type FeeBillingRun = {
  id: string;
  academicYearId: string;
  feePlanId: string | null;
  runMonth: number;
  runYear: number;
  status: string;
  generatedAt: string;
  invoiceCount?: number;
  academicYear?: {
    id: string;
    name: string;
  };
  feePlan?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export type FeeDueScheduleSummary = {
  id: string;
  academicYearId: string;
  feePlanId: string | null;
  name: string;
  scheduleType: string;
  dueDate: string;
  reminderDays: number[];
  stopOnPaid: boolean;
  lastProcessedAt: string | null;
};

export type FeeCollectionReport = {
  totalBilled: FinanceMoneyAmount;
  totalCollected: FinanceMoneyAmount;
  totalRefunded: FinanceMoneyAmount;
  netCollected: FinanceMoneyAmount;
  totalOutstanding: FinanceMoneyAmount;
  totalWaived: FinanceMoneyAmount;
  collectionTrend: Array<{ month: string; amount: FinanceMoneyAmount }>;
  refundTrend: Array<{ month: string; amount: FinanceMoneyAmount }>;
  netCollectionTrend: Array<{
    month: string;
    amount: FinanceMoneyAmount;
  }>;
  classWiseBreakdown: Array<{
    className: string;
    amount: FinanceMoneyAmount;
  }>;
  feeHeadWiseBreakdown: Array<{
    feeHeadName: string;
    amount: FinanceMoneyAmount;
  }>;
  period: {
    fromDate: string;
    toDate: string;
    timeZone: string;
  } | null;
  generatedAt: string;
};

export type DuesReportFilters = {
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  feeHeadId?: string;
  studentId?: string;
  page?: number;
  limit?: number;
};

export type DuesReportRow = {
  studentId: string;
  studentName: string;
  studentSystemId: string;
  className: string;
  sectionName: string;
  feeHeadId: string;
  feeHead: string;
  billed: FinanceMoneyAmount;
  waived: FinanceMoneyAmount;
  paid: FinanceMoneyAmount;
  outstanding: FinanceMoneyAmount;
  dueDate: string;
  invoiceNumber: string;
  status: string;
  agingBucket: string;
};

export type DuesReportResponse = {
  rows: DuesReportRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalBilled: FinanceMoneyAmount;
    totalWaived: FinanceMoneyAmount;
    totalPaid: FinanceMoneyAmount;
    totalOutstanding: FinanceMoneyAmount;
  };
};

export type InvoiceRegisterReport = {
  rows: Array<{
    invoiceId: string;
    invoiceNumber: string;
    studentSystemId: string;
    studentName: string;
    className: string;
    sectionName: string;
    billingPeriod: string;
    feeHeadNames: string;
    grossAmount: FinanceMoneyAmount;
    discountAmount: FinanceMoneyAmount;
    netAmount: FinanceMoneyAmount;
    paidAmount: FinanceMoneyAmount;
    balanceAmount: FinanceMoneyAmount;
    dueDate: string;
    issuedAt: string;
    status: string;
    journalEntryId: string | null;
    journalEntryNumber: string | null;
    postingStatus: "POSTED" | "PENDING";
  }>;
  summary: {
    totalInvoices: number;
    displayedInvoices: number;
    totalGrossAmount: FinanceMoneyAmount;
    totalNetAmount: FinanceMoneyAmount;
    totalPaidAmount: FinanceMoneyAmount;
    totalBalanceAmount: FinanceMoneyAmount;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ReceiptRegisterReport = {
  rows: Array<{
    receiptNumber: string;
    issuedAt: string;
    studentSystemId: string;
    studentName: string;
    invoiceNumber: string;
    amount: FinanceMoneyAmount;
    refundedAmount: FinanceMoneyAmount;
    netAmount: FinanceMoneyAmount;
    paymentMethod: string;
    paymentStatus: string;
    cashierEmail: string | null;
    reprintCount: number;
    latestReprintAt: string | null;
  }>;
  summary: {
    totalReceipts: number;
    displayedReceipts: number;
    totalAmount: FinanceMoneyAmount;
    totalRefundedAmount: FinanceMoneyAmount;
    totalNetAmount: FinanceMoneyAmount;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ReceiptSequenceExceptionReport = {
  rows: Array<{
    fiscalYear: string;
    receiptNumber: string;
    exceptionType:
      | "MISSING_SEQUENCE"
      | "DUPLICATE_NUMBER"
      | "OUT_OF_SEQUENCE"
      | "REVERSED_PAYMENT";
    expectedSequence: number | null;
    actualSequence: number | null;
    issuedAt: string | null;
    details: string;
  }>;
  summary: {
    totalExceptions: number;
    missingSequenceCount: number;
    duplicateCount: number;
    outOfSequenceCount: number;
    reversedPaymentCount: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type RefundReversalRegisterReport = {
  rows: Array<{
    recordType: "REFUND" | "REVERSAL";
    recordNumber: string;
    originalReceiptNumber: string | null;
    originalPaymentId: string;
    invoiceNumber: string;
    studentSystemId: string;
    studentName: string;
    amount: FinanceMoneyAmount;
    reason: string;
    processedAt: string;
    requestedByEmail: string | null;
    approvedByEmail: string | null;
    journalEntryNumber: string | null;
    reversalOfJournalEntryNumber: string | null;
    status: string;
  }>;
  summary: {
    totalRecords: number;
    refundCount: number;
    reversalCount: number;
    totalAmount: FinanceMoneyAmount;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type UnallocatedPaymentReport = {
  rows: Array<{
    paymentId: string;
    paymentDate: string;
    receiptNumber: string | null;
    studentId: string;
    studentSystemId: string;
    studentName: string;
    paymentMethod: string;
    paymentStatus: string;
    referenceNumber: string | null;
    originalAmount: FinanceMoneyAmount;
    unallocatedBalance: FinanceMoneyAmount;
    balanceType: "ADVANCE" | "UNALLOCATED";
    journalEntryId: string | null;
    journalEntryNumber: string | null;
    postingStatus: "POSTED" | "PENDING";
  }>;
  summary: {
    totalPayments: number;
    totalUnallocatedAmount: FinanceMoneyAmount;
    displayedUnallocatedAmount: FinanceMoneyAmount;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  generatedAt: string;
};

export type PaymentMethodReport = {
  rows: Array<{
    method: string;
    paymentCount: number;
    refundCount: number;
    grossAmount: FinanceMoneyAmount;
    refundedAmount: FinanceMoneyAmount;
    netAmount: FinanceMoneyAmount;
  }>;
  period: {
    fromDate: string;
    toDate: string;
    timeZone: string;
  } | null;
  generatedAt: string;
};

export type DefaulterSummary = {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string | null;
  dueDate: string;
  outstanding: FinanceMoneyAmount;
  daysOverdue: number;
  agingBucket: string;
  reportCardBlocked?: boolean;
  hallTicketBlocked?: boolean;
};

export type DiscountRule = {
  id: string;
  name: string;
  type: string;
  percentOff: string | null;
  amountOff: FinanceMoneyAmount | null;
  isActive: boolean;
};

export type WaiverRecord = {
  id: string;
  studentId: string;
  invoiceId: string | null;
  feeHeadId: string | null;
  amount: FinanceMoneyAmount;
  status: string;
  reason: string;
  approvedAt: string | null;
};

export type ReceiptView = {
  id: string;
  receiptNumber: string;
  fileAssetId: string | null;
  fileStatus: "PENDING" | "AVAILABLE" | "UNAVAILABLE";
  issuedAt: string;
  paymentId?: string;
  amount?: FinanceMoneyAmount;
  refundedAmount?: FinanceMoneyAmount;
  method?: string;
  invoiceNumber?: string;
  student?: {
    id: string;
    name: string;
  };
  reprintCount?: number;
  latestReprint?: {
    reprintedAt: string | Date;
    reason: string;
    format: string;
    delivery: string;
    reprintedBy: {
      id: string;
      email: string | null;
    } | null;
  } | null;
  payment?: {
    id: string;
    amount: FinanceMoneyAmount;
    method: string;
    paidAt: string;
    invoiceId: string;
    studentId: string;
  };
};

export type FinanceApprovalRequestView = {
  id: string;
  type: "REFUND" | "REVERSAL";
  status:
    | "PENDING"
    | "PROCESSING"
    | "APPROVED"
    | "REJECTED"
    | "EXECUTED"
    | "FAILED";
  paymentId: string;
  amount: FinanceMoneyAmount | null;
  reason: string;
  reviewNote: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    id: string;
    action:
      | "REQUESTED"
      | "REVIEW_STARTED"
      | "APPROVED"
      | "REJECTED"
      | "EXECUTED"
      | "EXECUTION_FAILED";
    status: FinanceApprovalRequestView["status"];
    actorUserId: string;
    note: string | null;
    createdAt: string;
  }>;
};

export type FinancePaginatedResponse<T> = Omit<
  PaginatedResponse<T>,
  "page" | "limit" | "hasNextPage"
> & {
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type InvoiceSummaryPage = FinancePaginatedResponse<InvoiceSummary>;
export type FeeBillingRunPage = FinancePaginatedResponse<FeeBillingRun>;
export type DiscountRulePage = FinancePaginatedResponse<DiscountRule>;
export type WaiverRecordPage = FinancePaginatedResponse<WaiverRecord>;
export type ReceiptViewPage = FinancePaginatedResponse<ReceiptView>;
export type FinanceApprovalRequestPage =
  FinancePaginatedResponse<FinanceApprovalRequestView>;
