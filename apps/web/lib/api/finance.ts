import type {
  CashierClosePreview,
  CashierCloseSummary,
  CollectionStudentSearchResponse,
  DefaulterReminderResult,
  DefaulterSummary,
  DiscountRule,
  FeeBillingRun,
  FeeBillingRunPage,
  FeeCollectionReport,
  FinanceApprovalRequestPage,
  FinanceDashboardSummary,
  FeeHeadSummary,
  FeePlanSummary,
  InvoiceDetail,
  InvoiceSummary,
  InvoiceSummaryPage,
  LedgerStudentSearchResponse,
  PaymentGatewayReadiness,
  PaymentMethodReport,
  PaymentRefundPayload,
  PaymentRefundSummary,
  ReceiptView,
  ReceiptViewPage,
  ReportDefinition,
  ReportExportRequest,
  StudentCollectionContext,
  StudentFeeLedgerPage,
  WaiverRecord,
  DiscountRulePage,
  WaiverRecordPage,
} from "@schoolos/core";
import {
  API_BASE_URL,
  JsonBody,
  downloadReport,
  openPdfBlob,
  parseApiErrorMessage,
  request,
  withQuery,
} from "./client";

export type ReportSnapshot = {
  id: string;
  reportKey: string;
  format: string;
  filters: Record<string, unknown>;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  fileAssetId?: string | null;
  requestedBy?: string | null;
  errorSummary?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type ReportSnapshotsPage = {
  items: ReportSnapshot[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type ReceiptReprintHistory = {
  receiptId: string;
  receiptNumber: string;
  items: Array<{
    id: string;
    paymentId: string | null;
    studentId: string | null;
    fileAssetId: string | null;
    reprintedAt: string;
    reason: string;
    format: string;
    delivery: string | null;
    reprintedBy: {
      id: string;
      email: string | null;
    } | null;
  }>;
};

export type ReceiptVerificationResult = {
  verified: true;
  status: "VALID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "REVERSED";
  warnings: string[];
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
    fiscalYear: string | null;
    schoolPan: string | null;
  };
  school: {
    name: string;
    panNumber: string | null;
  };
  student: {
    id: string;
    studentSystemId: string;
    name: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  };
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    refundedAmount: number;
    netAmount: number;
    paidAt: string;
    referenceNumber: string | null;
    reversedAt: string | null;
    reversalReason: string | null;
    collectedBy: {
      id: string;
      email: string | null;
    } | null;
  };
};

export type CollectedPaymentResult = {
  paymentId: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
  disposition: "SUCCEEDED" | "REPLAYED";
  receiptNumber: string | null;
  receiptFileAssetId: string | null;
  receiptFileStatus: "PENDING" | "AVAILABLE" | "UNAVAILABLE";
};

export type DefaultersResponse = {
  filters: {
    classId: string | null;
    feeHeadId: string | null;
    agingBucket: string | null;
    minDaysOverdue: number | null;
    maxDaysOverdue: number | null;
  };
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  totalOutstanding: number;
  segments: Array<{
    agingBucket: string;
    count: number;
    outstanding: number;
  }>;
  items: DefaulterSummary[];
};

export type FinancePaymentListItem = {
  id: string;
  amount: number;
  refundedAmount: number;
  refundableAmount: number;
  method: string;
  paidAt: string;
  student: {
    id: string;
    name: string;
  };
  receiptNumber: string | null;
};

export const financeApi = {
  getFinanceDashboardSummary: (params: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    timeZone?: string;
  }) =>
    request<FinanceDashboardSummary>(
      withQuery("/fees/dashboard-summary", params),
    ),
  listFeeHeads: () => request<FeeHeadSummary[]>("/fees/heads"),
  listFeePlans: () => request<FeePlanSummary[]>("/fees/plans"),
  listInvoicesPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    academicYearId?: string;
    classId?: string;
    dueFrom?: string;
    dueTo?: string;
    outstandingOnly?: boolean;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }) => request<InvoiceSummaryPage>(withQuery("/fees/invoices", params ?? {})),
  listInvoices: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    outstandingOnly?: boolean;
  }) => (await financeApi.listInvoicesPage(params)).items,
  getInvoiceDetail: (invoiceId: string) =>
    request<InvoiceDetail>(`/fees/invoices/${encodeURIComponent(invoiceId)}`),
  getStudentFeeLedger: (studentId: string) =>
    request<StudentFeeLedgerPage>(
      `/fees/students/${encodeURIComponent(studentId)}/ledger`,
    ),
  getStudentFeeLedgerPage: (
    studentId: string,
    params?: {
      page?: number;
      limit?: number;
      fromDate?: string;
      toDate?: string;
      academicYearId?: string;
      invoiceStatus?: string;
      transactionType?: string;
      sortDirection?: "asc" | "desc";
    },
  ) =>
    request<StudentFeeLedgerPage>(
      withQuery(
        `/fees/students/${encodeURIComponent(studentId)}/ledger`,
        params ?? {},
      ),
    ),
  searchCollectionStudents: (q: string) =>
    request<CollectionStudentSearchResponse>(
      withQuery("/fees/collection-students", { q }),
    ),
  searchLedgerStudents: (q: string) =>
    request<LedgerStudentSearchResponse>(
      withQuery("/fees/ledger-students", { q }),
    ),
  getStudentCollectionContext: (studentId: string) =>
    request<StudentCollectionContext>(
      `/fees/students/${encodeURIComponent(studentId)}/collection-context`,
    ),
  listBillingRunsPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    academicYearId?: string;
    feePlanId?: string;
    status?: string;
    runYear?: number;
    runMonth?: number;
  }) =>
    request<FeeBillingRunPage>(withQuery("/fees/billing-runs", params ?? {})),
  listBillingRuns: async () =>
    (await financeApi.listBillingRunsPage({ limit: 25 })).items,
  generateBillingRun: (body: JsonBody) =>
    request("/fees/billing-runs", { method: "POST", json: body }),
  listDefaulters: (params?: {
    classId?: string | null;
    feeHeadId?: string | null;
    search?: string | null;
    page?: number;
    limit?: number;
    agingBucket?: string | null;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }) =>
    request<DefaultersResponse>(withQuery("/fees/defaulters", params ?? {})),
  sendDefaulterReminders: (body: JsonBody) =>
    request<DefaulterReminderResult>("/fees/defaulters/reminders", {
      method: "POST",
      json: body,
    }),
  downloadReport: (reportKey: string, payload: ReportExportRequest) =>
    downloadReport(reportKey, payload),
  getDuesTableReport: (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    feeHeadId?: string;
    studentId?: string;
    month?: number;
    year?: number;
  }) =>
    request<{ rows: any[]; summary: any }>(
      withQuery("/fees/reports/dues", {
        ...params,
        month: params?.month ? String(params.month) : undefined,
        year: params?.year ? String(params.year) : undefined,
      }),
    ),
  getCollectionReport: (params?: { fromDate?: string; toDate?: string }) =>
    request<FeeCollectionReport>(
      withQuery("/fees/reports/collections", params ?? {}),
    ),
  getPaymentMethodReport: (params?: { fromDate?: string; toDate?: string }) =>
    request<PaymentMethodReport>(
      withQuery("/fees/reports/payment-methods", params ?? {}),
    ),
  listDiscountsPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) => request<DiscountRulePage>(withQuery("/fees/discounts", params ?? {})),
  listDiscounts: async () =>
    (await financeApi.listDiscountsPage({ limit: 25 })).items,
  listWaiversPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    studentId?: string;
    invoiceId?: string;
  }) => request<WaiverRecordPage>(withQuery("/fees/waivers", params ?? {})),
  listWaivers: async () =>
    (await financeApi.listWaiversPage({ limit: 25 })).items,
  createDiscount: (body: JsonBody) =>
    request<DiscountRule>("/fees/discounts", { method: "POST", json: body }),
  createWaiver: (body: JsonBody) =>
    request<WaiverRecord>("/fees/waivers", { method: "POST", json: body }),
  createFeeHead: (body: JsonBody) =>
    request("/fees/heads", { method: "POST", json: body }),
  createFeePlan: (body: JsonBody) =>
    request("/fees/plans", { method: "POST", json: body }),
  collectPayment: (body: JsonBody) =>
    request<CollectedPaymentResult>("/payments", {
      method: "POST",
      json: body,
    }),
  listPaymentsPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    method?: string;
    studentId?: string;
    paidFrom?: string;
    paidTo?: string;
  }) =>
    request<{
      items: FinancePaymentListItem[];
      total: number;
      page: number;
      limit: number;
      hasNextPage: boolean;
    }>(withQuery("/payments", params ?? {})),
  getPaymentGatewayReadiness: () =>
    request<PaymentGatewayReadiness>("/payments/gateway-readiness"),
  refundPayment: (paymentId: string, body: PaymentRefundPayload) =>
    request<PaymentRefundSummary>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        json: body as JsonBody,
      },
    ),
  previewCashierClose: (params: {
    openedAt: string;
    closedAt: string;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
  }) =>
    request<CashierClosePreview>(
      withQuery("/payments/cashier-close/preview", params),
    ),
  listCashierClosesPage: (params?: {
    page?: number;
    limit?: number;
    openedFrom?: string | null;
    closedTo?: string | null;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
  }) =>
    request<{
      items: CashierCloseSummary[];
      total: number;
      page: number;
      limit: number;
      hasNextPage: boolean;
    }>(withQuery("/payments/cashier-close", params ?? {})),
  listCashierCloses: async (params?: {
    openedFrom?: string | null;
    closedTo?: string | null;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
  }) =>
    (await financeApi.listCashierClosesPage({ ...params, limit: 25 })).items,
  finalizeCashierClose: (body: {
    openedAt: string;
    closedAt: string;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
    actualCashAmount?: number | null;
    varianceReason?: string | null;
    denominationBreakdown?: Record<string, unknown> | null;
    notes?: string | null;
  }) =>
    request<CashierCloseSummary>("/payments/cashier-close", {
      method: "POST",
      json: body as JsonBody,
    }),
  reversePayment: (
    paymentId: string,
    body: { reason: string; idempotencyKey: string },
  ) =>
    request<{ disposition: "SUCCEEDED" | "REPLAYED" }>(
      `/payments/${encodeURIComponent(paymentId)}/reverse`,
      {
        method: "POST",
        json: body as JsonBody,
      },
    ),
  listReceiptsPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    studentId?: string;
    issuedFrom?: string;
    issuedTo?: string;
  }) => request<ReceiptViewPage>(withQuery("/receipts", params ?? {})),
  listReceipts: async () =>
    (await financeApi.listReceiptsPage({ limit: 25 })).items,
  listFinanceApprovalRequests: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: "REFUND" | "REVERSAL";
    status?: string;
  }) =>
    request<FinanceApprovalRequestPage>(
      withQuery("/payments/requests", params ?? {}),
    ),
  requestPaymentRefund: (
    paymentId: string,
    body: {
      amount?: number;
      reason: string;
      idempotencyKey: string;
    },
  ) =>
    request(`/payments/${encodeURIComponent(paymentId)}/refund/request`, {
      method: "POST",
      json: body,
    }),
  requestPaymentReversal: (
    paymentId: string,
    body: { reason: string; idempotencyKey: string },
  ) =>
    request(`/payments/${encodeURIComponent(paymentId)}/reverse/request`, {
      method: "POST",
      json: body,
    }),
  reviewFinanceApprovalRequest: (
    requestId: string,
    body: { status: "APPROVED" | "REJECTED"; reviewNote?: string },
  ) =>
    request(`/payments/requests/${encodeURIComponent(requestId)}/review`, {
      method: "POST",
      json: body,
    }),
  getReceiptReprintHistory: (receiptId: string) =>
    request<ReceiptReprintHistory>(
      `/receipts/${encodeURIComponent(receiptId)}/reprint-history`,
    ),
  verifyReceipt: (receiptNumber: string) =>
    request<ReceiptVerificationResult>(
      `/receipts/verify/${encodeURIComponent(receiptNumber)}`,
    ),
  openReceiptPdf: async (receiptNumber: string) => {
    const response = await fetch(
      `${API_BASE_URL}/receipts/${encodeURIComponent(receiptNumber)}.pdf`,
      {
        credentials: "include",
      },
    );

    await openPdfBlob(response);
  },
  reprintReceipt: (
    receiptId: string,
    body: { reason: string; idempotencyKey: string },
  ) =>
    request<{
      receiptId: string;
      reprintHistoryId: string;
      fileAssetId: string;
      fileName: string;
      disposition: "SUCCEEDED" | "REPLAYED";
    }>(`/receipts/${encodeURIComponent(receiptId)}/reprint`, {
      method: "POST",
      json: body,
    }),
  listReports: () => request<ReportDefinition[]>("/reports"),
  exportReport: (reportKey: string, payload: ReportExportRequest) =>
    downloadReport(reportKey, payload),
  listReportSnapshots: (params?: { page?: number; limit?: number }) =>
    request<ReportSnapshotsPage>(
      withQuery("/reports/export-history", params ?? {}),
    ),
  retryReportSnapshot: (id: string) =>
    request<{ id: string; status: "QUEUED"; jobId?: string | number }>(
      `/reports/export-history/${encodeURIComponent(id)}/retry`,
      { method: "POST" },
    ),
  downloadReportSnapshot: async (id: string) => {
    const response = await fetch(
      `${API_BASE_URL}/reports/export-history/${encodeURIComponent(id)}/download`,
      { credentials: "include" },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || "Download failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finance-report-${id}`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  },

  // Staff Self-Service
};
