import type {
  AccountingPeriodSummary,
  AccountingReport,
  ChartAccountSummary,
  FiscalPeriodSummary,
  FiscalYearSummary,
  JournalEntryView,
  PaginatedResult,
} from '@schoolos/core';
import {
  API_BASE_URL,
  JsonBody,
  openPdfBlob,
  parseApiErrorMessage,
  request,
  withQuery,
} from './client';

export const accountingApi = {
  listLedgerEntries: () => request<JournalEntryView[]>('/ledger/entries'),
  listAccountingPeriods: () =>
    request<AccountingPeriodSummary[]>('/accounting/periods'),
  listChartAccounts: () =>
    request<ChartAccountSummary[]>('/accounting/accounts'),
  listChartAccountTree: () =>
    request<ChartAccountSummary[]>('/accounting/accounts/tree'),
  createChartAccount: (body: JsonBody) =>
    request<ChartAccountSummary>('/accounting/accounts', {
      method: 'POST',
      json: body,
    }),
  archiveChartAccount: (id: string) =>
    request<ChartAccountSummary>(
      `/accounting/accounts/${encodeURIComponent(id)}/archive`,
      { method: 'POST', json: {} },
    ),
  seedDefaultChartAccounts: () =>
    request<ChartAccountSummary[]>('/accounting/accounts/seed-defaults', {
      method: 'POST',
      json: {},
    }),
  createAccountingPeriod: (body: JsonBody) =>
    request<AccountingPeriodSummary>('/accounting/periods', {
      method: 'POST',
      json: body,
    }),
  createFiscalYear: (body: JsonBody) =>
    request<FiscalYearSummary>('/accounting/fiscal-years', {
      method: 'POST',
      json: body,
    }),
  listFiscalYears: () =>
    request<FiscalYearSummary[]>('/accounting/fiscal-years'),
  listFiscalPeriods: (id: string) =>
    request<FiscalPeriodSummary[]>(
      `/accounting/fiscal-years/${encodeURIComponent(id)}/periods`,
    ),
  lockFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/lock`,
      { method: 'POST', json: body },
    ),
  closeFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/close`,
      { method: 'POST', json: body },
    ),
  reopenFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/reopen`,
      { method: 'POST', json: body },
    ),
  listAccountingReports: (params?: JsonBody) =>
    request<AccountingReport>(withQuery('/accounting/reports', params ?? {})),
  listTrialBalance: (params?: JsonBody) =>
    request<AccountingReport['trialBalance']>(
      withQuery('/accounting/reports/trial-balance', params ?? {}),
    ),
  listGeneralLedger: (params?: JsonBody) =>
    request<unknown[]>(
      withQuery('/accounting/reports/general-ledger', params ?? {}),
    ),
  listIncomeStatement: (params?: JsonBody) =>
    request<AccountingReport['incomeStatement']>(
      withQuery('/accounting/reports/income-statement', params ?? {}),
    ),
  listBalanceSheet: (params?: JsonBody) =>
    request<AccountingReport['balanceSheet']>(
      withQuery('/accounting/reports/balance-sheet', params ?? {}),
    ),
  listCashBook: (params?: JsonBody) =>
    request<unknown>(withQuery('/accounting/reports/cash-book', params ?? {})),
  listVatSummary: () => request<any>('/accounting/reports/vat-summary'),
  listTdsSummary: () => request<any>('/accounting/reports/tds-summary'),
  listPfSummary: () => request<any>('/accounting/reports/pf-summary'),
  exportAccountingCsv: async (report: string) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/reports/${encodeURIComponent(report)}/export`,
      { credentials: 'include' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  exportAccountingPdf: async (report: string, params?: JsonBody) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/reports/${report}/export.pdf${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ''}`,
      { credentials: 'include' },
    );

    await openPdfBlob(response);
  },
  exportBankReconciliationPdf: async (accountId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/reports/bank-reconciliation/${encodeURIComponent(accountId)}/export.pdf`,
      { credentials: 'include' },
    );

    await openPdfBlob(response);
  },
  closeAccountingPeriod: (id: string) =>
    request<AccountingPeriodSummary>(`/accounting/closing/${id}`, {
      method: 'POST',
      json: {},
    }),
  createOpeningBalance: (body: JsonBody) =>
    request<any>('/accounting/opening-balance', { method: 'POST', json: body }),
  getOpeningBalance: (fiscalYearId: string) =>
    request<any>(`/accounting/opening-balance/${fiscalYearId}`),
  createExpenseVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/expense', {
      method: 'POST',
      json: body,
    }),
  createPaymentVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/payment', {
      method: 'POST',
      json: body,
    }),
  createReceiptVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/receipt', {
      method: 'POST',
      json: body,
    }),
  createContraVoucher: (body: JsonBody) =>
    request<any>('/accounting/vouchers/contra', { method: 'POST', json: body }),
  closeFiscalYear: (id: string) =>
    request<any>(`/accounting/fiscal-years/${id}/close`, { method: 'POST' }),
  reopenFiscalYear: (id: string, body: JsonBody) =>
    request<any>(`/accounting/fiscal-years/${id}/reopen`, {
      method: 'POST',
      json: body,
    }),
  importBankStatement: (accountId: string, lines: any[]) =>
    request<any>(`/accounting/bank-reconciliation/${accountId}/import`, {
      method: 'POST',
      json: { lines },
    }),
  getUnreconciledStatements: (accountId: string) =>
    request<any[]>(`/accounting/bank-reconciliation/${accountId}/unreconciled`),
  suggestReconciliationMatches: (accountId: string) =>
    request<any[]>(`/accounting/bank-reconciliation/${accountId}/auto-match`),
  reconcileStatement: (statementId: string, journalLineId: string) =>
    request<any>('/accounting/bank-reconciliation/reconcile', {
      method: 'POST',
      json: { statementId, journalLineId },
    }),
  getReconciliationSummary: (accountId: string) =>
    request<any>(`/accounting/bank-reconciliation/${accountId}/summary`),
  listJournalEntries: () => request<JournalEntryView[]>('/accounting/journals'),
  createManualJournal: (body: JsonBody) =>
    request<JournalEntryView>('/accounting/journals', {
      method: 'POST',
      json: body,
    }),
  submitJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/submit`,
      {
        method: 'POST',
        json: body,
      },
    ),
  postJournal: (id: string) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/post`,
      {
        method: 'POST',
      },
    ),
  reverseJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/reverse`,
      {
        method: 'POST',
        json: body,
      },
    ),
  correctJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/correct`,
      {
        method: 'POST',
        json: body,
      },
    ),
  getAccountingAuditTrail: (params?: {
    resource?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) =>
    request<PaginatedResult<any>>(
      withQuery('/accounting/reports/audit-trail', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getJournalEntry: (id: string) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}`),

  // Notification Center
};
