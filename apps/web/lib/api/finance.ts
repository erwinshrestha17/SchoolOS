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
    request<any>(withQuery('/reports/export-history', params ?? {})),
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
