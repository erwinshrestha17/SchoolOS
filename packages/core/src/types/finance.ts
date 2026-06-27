import type { PaginatedResponse } from "./common.js";

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
  totalAmount: number;
  studentId?: string;
  paidAmount?: number;
  outstandingAmount?: number;
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
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  }>;
};

export type InvoiceDetailLine = {
  id: string;
  feeHeadId: string;
  feeHeadCode: string;
  feeHeadName: string;
  description: string;
  periodLabel: string;
  quantity: number;
  unitAmount: number;
  baseAmount: number;
  discountAmount: number;
  waiverAmount: number;
  lateFeeAmount: number;
  vatAmount: number;
  totalAmount: number;
  netAmount: number;
};

export type InvoiceDetailPayment = {
  id: string;
  amount: number;
  refundedAmount: number;
  netAmount: number;
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
    amount: number;
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
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  totalWaivedAmount: number;
  lines: InvoiceDetailLine[];
  waivers: Array<{
    id: string;
    feeHeadId: string | null;
    feeHeadName: string | null;
    amount: number;
    reason: string;
    status: string;
    approvedAt: string | null;
    approvedBy: {
      id: string;
      email: string | null;
    } | null;
  }>;
  payments: InvoiceDetailPayment[];
  source: {
    billingRunId: string | null;
    enrollmentId: string | null;
  };
};

export type StudentFeeLedgerRow = {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT" | "WAIVER" | "REFUND";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  affectsBalance: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentId: string | null;
  receiptNumber: string | null;
  status: string | null;
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
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  totalWaived: number;
  totalRefunded: number;
  outstandingBalance: number;
  rows: StudentFeeLedgerRow[];
};

export type PaymentReceipt = {
  paymentId: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
};

export type PaymentRefundSummary = {
  refundId: string;
  refundNumber: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  refundDate: string;
  journalEntryNumber: string;
  remainingRefundableAmount: number;
  invoiceStatus: string;
};

export type PaymentRefundPayload = {
  idempotencyKey: string;
  amount?: number;
  reason: string;
  refundDate?: string;
  referenceNumber?: string;
  narration?: string;
};

export type CashierCloseMethodBreakdown = {
  method: string;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  paymentCount: number;
  refundCount: number;
};

export type CashierClosePreview = {
  openedAt: string | Date;
  closedAt: string | Date;
  collectorUserId: string | null;
  paymentMethod: string | null;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  expectedCashAmount: number;
  actualCashAmount?: number | null;
  varianceAmount?: number | null;
  varianceReason?: string | null;
  denominationBreakdown?: Record<string, unknown> | null;
  methodBreakdown: CashierCloseMethodBreakdown[];
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
  totalCollected?: number;
  transactionCount?: number;
  byMethod?: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  byUser?: Array<{
    userId: string;
    userName: string;
    amount: number;
  }>;
};

export type CashierCloseSummary = {
  id: string;
  closeNumber: string;
  openedAt: string | Date;
  closedAt: string | Date;
  collectorUser?: {
    id: string;
    email: string | null;
  } | null;
  paymentMethod?: string | null;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  expectedCashAmount: number;
  actualCashAmount?: number | null;
  varianceAmount?: number | null;
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
  grossAmount: number;
  refundedAmount: number;
  netAmount: number;
  journalEntryNumber: string | null;
  refundJournalEntryNumbers: string[];
  statusMarkers: string[];
};

export type ReconciliationSummary = {
  openedAt: string;
  closedAt: string;
  totalRows: number;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  rows: ReconciliationRow[];
};

export type FeeHeadSummary = {
  id: string;
  code: string;
  name: string;
  frequency: string;
  defaultAmount: number;
  vatApplicable: boolean;
};

export type FeePlanSummary = {
  id: string;
  code: string;
  name: string;
  academicYearId: string;
  classId: string | null;
  isActive: boolean;
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
};

export type DefaulterSummary = {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string | null;
  dueDate: string;
  outstanding: number;
  daysOverdue: number;
  agingBucket: string;
  reportCardBlocked?: boolean;
  hallTicketBlocked?: boolean;
};

export type DiscountRule = {
  id: string;
  name: string;
  type: string;
  percentOff: number | null;
  amountOff: number | null;
  isActive: boolean;
};

export type WaiverRecord = {
  id: string;
  studentId: string;
  invoiceId: string | null;
  feeHeadId: string | null;
  amount: number;
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
  amount?: number;
  refundedAmount?: number;
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
    amount: number;
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
  amount: number | null;
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
