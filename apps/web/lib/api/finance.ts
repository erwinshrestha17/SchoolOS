import type {
  CashierClosePreview,
  CashierCloseSummary,
  DefaulterReminderResult,
  DefaulterSummary,
  DiscountRule,
  FeeBillingRun,
  FeeHeadSummary,
  FeePlanSummary,
  InvoiceDetail,
  InvoiceSummary,
  PaymentGatewayReadiness,
  PaymentRefundPayload,
  PaymentRefundSummary,
  ReceiptView,
  ReportDefinition,
  ReportExportRequest,
  StudentFeeLedger,
  WaiverRecord,
} from '@schoolos/core';
import {
  API_BASE_URL,
  JsonBody,
  downloadReport,
  openPdfBlob,
  parseApiErrorMessage,
  request,
  withQuery,
} from './client';

export type ReportSnapshot = {
  id: string;
  reportKey: string;
  format: string;
  filters: Record<string, unknown>;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
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
  status: 'VALID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'REVERSED';
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

export const financeApi = {
  listFeeHeads: () => request<FeeHeadSummary[]>('/fees/heads'),
  listFeePlans: () => request<FeePlanSummary[]>('/fees/plans'),
  listInvoices: () => request<InvoiceSummary[]>('/fees/invoices'),
  getInvoiceDetail: (invoiceId: string) =>
    request<InvoiceDetail>(`/fees/invoices/${encodeURIComponent(invoiceId)}`),
  getStudentFeeLedger: (studentId: string) =>
    request<StudentFeeLedger>(
      `/fees/students/${encodeURIComponent(studentId)}/ledger`,
    ),
  listBillingRuns: () => request<FeeBillingRun[]>('/fees/billing-runs'),
  generateBillingRun: (body: JsonBody) =>
    request('/fees/billing-runs', { method: 'POST', json: body }),
  listDefaulters: (params?: {
    classId?: string | null;
    feeHeadId?: string | null;
  }) =>
    request<DefaulterSummary[]>(withQuery('/fees/defaulters', params ?? {})),
  sendDefaulterReminders: (body: JsonBody) =>
    request<DefaulterReminderResult>('/fees/defaulters/reminders', {
      method: 'POST',
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
      withQuery('/fees/reports/dues', {
        ...params,
        month: params?.month ? String(params.month) : undefined,
        year: params?.year ? String(params.year) : undefined,
      }),
    ),
  listDiscounts: () => request<DiscountRule[]>('/fees/discounts'),
  listWaivers: () => request<WaiverRecord[]>('/fees/waivers'),
  createDiscount: (body: JsonBody) =>
    request<DiscountRule>('/fees/discounts', { method: 'POST', json: body }),
  createWaiver: (body: JsonBody) =>
    request<WaiverRecord>('/fees/waivers', { method: 'POST', json: body }),
  createFeeHead: (body: JsonBody) =>
    request('/fees/heads', { method: 'POST', json: body }),
  createFeePlan: (body: JsonBody) =>
    request('/fees/plans', { method: 'POST', json: body }),
  collectPayment: (body: JsonBody) =>
    request('/payments', { method: 'POST', json: body }),
  getPaymentGatewayReadiness: () =>
    request<PaymentGatewayReadiness>('/payments/gateway-readiness'),
  refundPayment: (paymentId: string, body: PaymentRefundPayload) =>
    request<PaymentRefundSummary>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: 'POST',
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
      withQuery('/payments/cashier-close/preview', params),
    ),
  listCashierCloses: (params?: {
    openedFrom?: string | null;
    closedTo?: string | null;
    collectorUserId?: string | null;
    paymentMethod?: string | null;
  }) =>
    request<CashierCloseSummary[]>(
      withQuery('/payments/cashier-close', params ?? {}),
    ),
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
    request<CashierCloseSummary>('/payments/cashier-close', {
      method: 'POST',
      json: body as JsonBody,
    }),
  reversePayment: (paymentId: string, body: { reason: string }) =>
    request<{ success: true }>(
      `/payments/${encodeURIComponent(paymentId)}/reverse`,
      {
        method: 'POST',
        json: body as JsonBody,
      },
    ),
  listReceipts: () => request<ReceiptView[]>('/receipts'),
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
        credentials: 'include',
      },
    );

    await openPdfBlob(response);
  },
  reprintReceipt: async (receiptId: string, reason: string) => {
    const response = await fetch(
      `${API_BASE_URL}/receipts/${encodeURIComponent(receiptId)}/reprint`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    );

    await openPdfBlob(response);
  },
  listReports: () => request<ReportDefinition[]>('/reports'),
  exportReport: (reportKey: string, payload: ReportExportRequest) =>
    downloadReport(reportKey, payload),
  listReportSnapshots: (params?: { page?: number; limit?: number }) =>
    request<ReportSnapshotsPage>(
      withQuery('/reports/export-history', params ?? {}),
    ),
  retryReportSnapshot: (id: string) =>
    request<{ id: string; status: 'QUEUED'; jobId?: string | number }>(
      `/reports/export-history/${encodeURIComponent(id)}/retry`,
      { method: 'POST' },
    ),
  downloadReportSnapshot: async (id: string) => {
    const response = await fetch(
      `${API_BASE_URL}/reports/export-history/${encodeURIComponent(id)}/download`,
      { credentials: 'include' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Download failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  // Staff Self-Service
};
