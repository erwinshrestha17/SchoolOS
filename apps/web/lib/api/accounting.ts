import type {
  AccountingDashboardSummary,
  AccountingBalanceSheetResponse,
  AccountingCashBookResponse,
  AccountingGeneralLedgerResponse,
  AccountingIncomeStatementResponse,
  AccountingReportFilters,
  AccountingTrialBalanceResponse,
  BankReconciliationSuggestion,
  BankReconciliationSummary,
  BankStatementImportLine,
  BankStatementImportPreview,
  BankStatementImportResult,
  BankStatementImportJobQueuedResult,
  BankStatementImportJobStatus,
  BankStatementLineSummary,
  AccountingPeriodSummary,
  AccountingReport,
  AccountingSourceMappingHealth,
  AccountingSourceMappingSummary,
  ChartAccountSummary,
  FiscalPeriodSummary,
  FiscalPeriodCloseReadiness,
  FiscalYearCloseReadiness,
  FiscalYearSummary,
  JournalEntryView,
  PaginatedResult,
} from "@schoolos/core";
import {
  API_BASE_URL,
  JsonBody,
  openPdfBlob,
  parseApiErrorMessage,
  request,
  withQuery,
} from "./client";

export const accountingApi = {
  getAccountingDashboardSummary: () =>
    request<AccountingDashboardSummary>("/accounting/dashboard-summary"),
  listLedgerEntriesPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sourceType?: string;
    entryFrom?: string;
    entryTo?: string;
  }) =>
    request<{
      items: JournalEntryView[];
      total: number;
      page: number;
      limit: number;
      hasNextPage: boolean;
    }>(withQuery("/ledger/entries", params ?? {})),
  listLedgerEntries: async () =>
    (await accountingApi.listLedgerEntriesPage({ limit: 25 })).items,
  listAccountingPeriods: () =>
    request<AccountingPeriodSummary[]>("/accounting/periods"),
  listChartAccounts: () =>
    request<ChartAccountSummary[]>("/accounting/accounts"),
  listChartAccountTree: () =>
    request<ChartAccountSummary[]>("/accounting/accounts/tree"),
  createChartAccount: (body: JsonBody) =>
    request<ChartAccountSummary>("/accounting/accounts", {
      method: "POST",
      json: body,
    }),
  archiveChartAccount: (id: string) =>
    request<ChartAccountSummary>(
      `/accounting/accounts/${encodeURIComponent(id)}/archive`,
      { method: "POST", json: {} },
    ),
  seedDefaultChartAccounts: () =>
    request<ChartAccountSummary[]>("/accounting/accounts/seed-defaults", {
      method: "POST",
      json: {},
    }),
  createAccountingPeriod: (body: JsonBody) =>
    request<AccountingPeriodSummary>("/accounting/periods", {
      method: "POST",
      json: body,
    }),
  createFiscalYear: (body: JsonBody) =>
    request<FiscalYearSummary>("/accounting/fiscal-years", {
      method: "POST",
      json: body,
    }),
  listFiscalYears: () =>
    request<FiscalYearSummary[]>("/accounting/fiscal-years"),
  listFiscalPeriods: (id: string) =>
    request<FiscalPeriodSummary[]>(
      `/accounting/fiscal-years/${encodeURIComponent(id)}/periods`,
    ),
  lockFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/lock`,
      { method: "POST", json: body },
    ),
  unlockFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/unlock`,
      { method: "POST", json: body },
    ),
  getFiscalPeriodCloseReadiness: (id: string) =>
    request<FiscalPeriodCloseReadiness>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/close-readiness`,
    ),
  closeFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/close`,
      { method: "POST", json: body },
    ),
  reopenFiscalPeriod: (id: string, body: JsonBody) =>
    request<FiscalPeriodSummary>(
      `/accounting/fiscal-periods/${encodeURIComponent(id)}/reopen`,
      { method: "POST", json: body },
    ),
  listAccountingReports: (params?: JsonBody) =>
    request<AccountingReport>(withQuery("/accounting/reports", params ?? {})),
  listTrialBalance: (params: AccountingReportFilters) =>
    request<AccountingTrialBalanceResponse>(
      withQuery("/accounting/reports/trial-balance", params ?? {}),
    ),
  listGeneralLedger: (params: AccountingReportFilters) =>
    request<AccountingGeneralLedgerResponse>(
      withQuery("/accounting/reports/general-ledger", params ?? {}),
    ),
  listIncomeStatement: (params: AccountingReportFilters) =>
    request<AccountingIncomeStatementResponse>(
      withQuery("/accounting/reports/income-statement", params ?? {}),
    ),
  listBalanceSheet: (params: AccountingReportFilters) =>
    request<AccountingBalanceSheetResponse>(
      withQuery("/accounting/reports/balance-sheet", {
        fiscalYearId: params.fiscalYearId,
        fiscalPeriodId: params.fiscalPeriodId,
        asOfDate: params.toDate,
      }),
    ),
  listCashBook: (params: AccountingReportFilters) =>
    request<AccountingCashBookResponse>(
      withQuery("/accounting/reports/cash-book", params ?? {}),
    ),
  listTaxSummary: (params: AccountingReportFilters) =>
    request<unknown>(
      withQuery("/accounting/reports/tax-summary", params ?? {}),
    ),
  listTdsSummary: () => request<any>("/accounting/reports/tds-summary"),
  listPfSummary: () => request<any>("/accounting/reports/pf-summary"),
  exportAccountingCsv: async (report: string) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/reports/${encodeURIComponent(report)}/export`,
      { credentials: "include" },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || "Export failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  exportAccountingPdf: async (report: string, params?: JsonBody) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/reports/${report}/export.pdf${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
      { credentials: "include" },
    );

    await openPdfBlob(response);
  },
  exportBankReconciliationPdf: async (accountId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/accounting/reports/bank-reconciliation/${encodeURIComponent(accountId)}/export.pdf`,
      { credentials: "include" },
    );

    await openPdfBlob(response);
  },
  closeAccountingPeriod: (id: string) =>
    request<AccountingPeriodSummary>(`/accounting/closing/${id}`, {
      method: "POST",
      json: {},
    }),
  createOpeningBalance: (body: JsonBody) =>
    request<any>("/accounting/opening-balance", { method: "POST", json: body }),
  getOpeningBalance: (fiscalYearId: string) =>
    request<any>(`/accounting/opening-balance/${fiscalYearId}`),
  createExpenseVoucher: (body: JsonBody) =>
    request<JournalEntryView>("/accounting/vouchers/expense", {
      method: "POST",
      json: body,
    }),
  createPaymentVoucher: (body: JsonBody) =>
    request<JournalEntryView>("/accounting/vouchers/payment", {
      method: "POST",
      json: body,
    }),
  createReceiptVoucher: (body: JsonBody) =>
    request<JournalEntryView>("/accounting/vouchers/receipt", {
      method: "POST",
      json: body,
    }),
  createContraVoucher: (body: JsonBody) =>
    request<JournalEntryView>("/accounting/vouchers/contra", {
      method: "POST",
      json: body,
    }),
  getFiscalYearCloseReadiness: (id: string) =>
    request<FiscalYearCloseReadiness>(
      `/accounting/fiscal-years/${encodeURIComponent(id)}/close-readiness`,
    ),
  closeFiscalYear: (id: string, body: JsonBody) =>
    request<any>(`/accounting/fiscal-years/${id}/close-year`, {
      method: "POST",
      json: body,
    }),
  reopenFiscalYear: (id: string, body: JsonBody) =>
    request<any>(`/accounting/fiscal-years/${id}/reopen-year`, {
      method: "POST",
      json: body,
    }),
  previewBankStatementImport: (
    accountId: string,
    lines: BankStatementImportLine[],
  ) =>
    request<BankStatementImportPreview>(
      `/accounting/bank-reconciliation/${accountId}/import-preview`,
      { method: "POST", json: { lines } },
    ),
  importBankStatement: (
    accountId: string,
    lines: BankStatementImportLine[],
    fingerprint: string,
  ) =>
    request<BankStatementImportResult>(
      `/accounting/bank-reconciliation/${accountId}/import`,
      {
      method: "POST",
        json: { lines, fingerprint },
      },
    ),
  queueBankStatementImport: (
    accountId: string,
    lines: BankStatementImportLine[],
  ) =>
    request<BankStatementImportJobQueuedResult>(
      `/accounting/bank-reconciliation/${accountId}/import-queue`,
      { method: "POST", json: { lines } },
    ),
  listBankImportJobs: (accountId: string) =>
    request<BankStatementImportJobStatus[]>(
      `/accounting/bank-reconciliation/${accountId}/import-jobs`,
    ),
  getBankImportJob: (jobId: string) =>
    request<BankStatementImportJobStatus>(
      `/accounting/bank-reconciliation/import-jobs/${jobId}`,
    ),
  getUnreconciledStatements: (accountId: string) =>
    request<BankStatementLineSummary[]>(
      `/accounting/bank-reconciliation/${accountId}/unreconciled`,
    ),
  suggestReconciliationMatches: (accountId: string) =>
    request<BankReconciliationSuggestion[]>(
      `/accounting/bank-reconciliation/${accountId}/auto-match`,
    ),
  reconcileStatement: (statementId: string, journalLineId: string) =>
    request<BankStatementLineSummary>("/accounting/bank-reconciliation/reconcile", {
      method: "POST",
      json: { statementId, journalLineId },
    }),
  unreconcileStatement: (statementId: string, reason: string) =>
    request<BankStatementLineSummary>(
      "/accounting/bank-reconciliation/unreconcile",
      { method: "POST", json: { statementId, reason } },
    ),
  getReconciliationSummary: (accountId: string) =>
    request<BankReconciliationSummary>(
      `/accounting/bank-reconciliation/${accountId}/summary`,
    ),
  listJournalEntries: () => request<JournalEntryView[]>("/accounting/journals"),
  listAccountingSourceMappings: (params?: {
    page?: number;
    limit?: number;
    sourceModule?: string;
    status?: "ACTIVE" | "ARCHIVED";
    search?: string;
  }) =>
    request<PaginatedResult<AccountingSourceMappingSummary>>(
      withQuery("/accounting/source-mappings", params ?? {}),
    ),
  getAccountingSourceMappingHealth: () =>
    request<AccountingSourceMappingHealth>(
      "/accounting/source-mappings/health",
    ),
  createAccountingSourceMapping: (body: JsonBody) =>
    request<AccountingSourceMappingSummary>("/accounting/source-mappings", {
      method: "POST",
      json: body,
    }),
  archiveAccountingSourceMapping: (id: string, reason: string) =>
    request<AccountingSourceMappingSummary>(
      `/accounting/source-mappings/${encodeURIComponent(id)}/archive`,
      { method: "POST", json: { reason } },
    ),
  createManualJournal: (body: JsonBody) =>
    request<JournalEntryView>("/accounting/journals", {
      method: "POST",
      json: body,
    }),
  submitJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/submit`,
      {
        method: "POST",
        json: body,
      },
    ),
  approveJournal: (id: string, body: JsonBody = {}) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        json: body,
      },
    ),
  postJournal: (id: string) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/post`,
      {
        method: "POST",
        json: {},
      },
    ),
  reverseJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/reverse`,
      {
        method: "POST",
        json: body,
      },
    ),
  correctJournal: (id: string, body: JsonBody) =>
    request<JournalEntryView>(
      `/accounting/journals/${encodeURIComponent(id)}/correct`,
      {
        method: "POST",
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
      withQuery("/accounting/reports/audit-trail", {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getJournalEntry: (id: string) =>
    request<JournalEntryView>(`/accounting/journals/${encodeURIComponent(id)}`),

  // Notification Center
};
