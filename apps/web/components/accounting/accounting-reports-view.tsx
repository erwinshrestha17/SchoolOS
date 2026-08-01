"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  FileText,
  PieChart,
  History,
  Wallet,
  Calculator,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { api } from "../../lib/api";
import { SectionCard } from "../ui/section-card";
import { PageState } from "../ui/page-state";
import { Button } from "@/components/ui/button";
import { LoadingState } from "../ui/loading-state";
import { ErrorState } from "../ui/error-state";
import { cn } from "../../lib/utils";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuditInfo } from "../ui/audit-info";
import { ReportFilters } from "./report-filters";
import { ReportTable, type ReportTableRow } from "./report-table";
import { JournalDetailDialog } from "./journal-detail-dialog";
import { Select } from "../ui/select";

import {
  formatBsDateTime,
  type AccountingBalanceSheetResponse,
  type AccountingCashBookResponse,
  type AccountingGeneralLedgerResponse,
  type AccountingIncomeStatementResponse,
  type AccountingReportFilters,
  type AccountingTrialBalanceResponse,
} from "@schoolos/core";
import type { JournalEntryView } from "@schoolos/core";

type ReportType =
  | "trial-balance"
  | "income-statement"
  | "balance-sheet"
  | "general-ledger"
  | "cash-book"
  | "bank-book"
  | "journal-register"
  | "voucher-register"
  | "failed-unposted"
  | "cash-flow-statement"
  | "budget-vs-actual"
  | "tax-summary";

type JournalRegisterResponse = {
  rows: Array<{
    journalEntryId: string;
    entryNumber: string | null;
    entryDate: string;
    narration: string;
    sourceModule: string | null;
    sourceType: string;
    debitedAccounts: string;
    creditedAccounts: string;
    totalDebit: string;
    totalCredit: string;
    status: string;
    approvalStatus: string;
    reversalStatus: string;
  }>;
};

type BudgetVsActualResponse = {
  budgetName: string;
  rows: Array<{
    accountCode: string;
    accountName: string;
    budgetAmount: string;
    actualAmount: string;
    variance: string;
    variancePercent: string | null;
  }>;
  totalBudget: string;
  totalActual: string;
  totalVariance: string;
};

type CashFlowStatementResponse = {
  sections: Array<{
    section: string;
    lines: Array<{ label: string; amount: string }>;
    subtotal: string;
  }>;
  openingCash: string;
  netChange: string;
  closingCash: string;
  setupWarnings?: string[];
};

type FailedUnpostedResponse = {
  rows: Array<{
    sourceModule: string;
    sourceType: string;
    reference: string;
    amount: string | null;
    issueType: string;
    details: string;
    detectedAt: string;
  }>;
  summary: {
    totalIssues: number;
    approvedUnpostedJournals: number;
    missingGlPostings: number;
    payrollPostingFailures: number;
  };
};

function buildExportParams(
  filters: {
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
    accountId?: string;
  },
  voucherType?: string,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.fiscalYearId) params.fiscalYearId = filters.fiscalYearId;
  if (filters.fiscalPeriodId) params.fiscalPeriodId = filters.fiscalPeriodId;
  if (filters.startDate) params.fromDate = filters.startDate;
  if (filters.endDate) params.toDate = filters.endDate;
  if (filters.accountId) params.accountId = filters.accountId;
  if (voucherType) params.voucherType = voucherType;
  return params;
}

function exportReportSlug(report: ReportType): string {
  if (report === "voucher-register") return "journal-register";
  return report;
}

export function AccountingReportsView({
  initialReport = "trial-balance",
}: {
  initialReport?: ReportType;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reportParam = searchParams.get("report") as ReportType;

  const [activeReport, setActiveReport] = useState<ReportType>(
    reportParam || initialReport,
  );
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
    accountId?: string;
  }>({});
  const [voucherType, setVoucherType] = useState("RECEIPT_VOUCHER");
  const [selectedJournalEntry, setSelectedJournalEntry] =
    useState<JournalEntryView | null>(null);
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);

  useEffect(() => {
    if (reportParam && reportParam !== activeReport) {
      setActiveReport(reportParam);
    }
  }, [reportParam, activeReport]);

  const handleReportChange = (report: ReportType) => {
    setActiveReport(report);
    const params = new URLSearchParams(searchParams.toString());
    params.set("report", report);
    router.push(`?${params.toString()}`);
  };

  const reportQuery = useQuery({
    queryKey: ["accounting-report", activeReport, filters, voucherType],
    queryFn: () => {
      if (activeReport === "failed-unposted") {
        return api.listFailedUnpostedTransactions();
      }
      if (!filters.fiscalYearId) {
        throw new Error("Select a fiscal year to generate this report.");
      }
      const reportFilters: AccountingReportFilters = {
        fiscalYearId: filters.fiscalYearId,
        fiscalPeriodId: filters.fiscalPeriodId,
        fromDate: filters.startDate,
        toDate: filters.endDate,
        accountId: filters.accountId,
      };
      if (activeReport === "trial-balance")
        return api.listTrialBalance(reportFilters);
      if (activeReport === "income-statement")
        return api.listIncomeStatement(reportFilters);
      if (activeReport === "balance-sheet")
        return api.listBalanceSheet(reportFilters);
      if (activeReport === "general-ledger")
        return api.listGeneralLedger(reportFilters);
      if (activeReport === "tax-summary")
        return api.listTaxSummary(reportFilters);
      if (activeReport === "bank-book")
        return api.listBankBook(reportFilters);
      if (activeReport === "journal-register")
        return api.listJournalRegister(reportFilters);
      if (activeReport === "voucher-register")
        return api.listJournalRegister({
          ...reportFilters,
          voucherType,
        });
      if (activeReport === "cash-flow-statement")
        return api.listCashFlowStatement(reportFilters);
      if (activeReport === "budget-vs-actual")
        return api.listBudgetVsActual(reportFilters);
      return api.listCashBook(reportFilters);
    },
    enabled:
      activeReport === "failed-unposted" ||
      (Boolean(filters.fiscalYearId) &&
        (activeReport !== "general-ledger" || Boolean(filters.accountId)) &&
        (activeReport !== "bank-book" || Boolean(filters.accountId))),
  });

  const snapshotsQuery = useQuery({
    queryKey: ["report-snapshots", activeReport],
    queryFn: () => api.listReportSnapshots({ limit: 8 }),
  });

  const exportMutation = useMutation({
    mutationFn: (report: ReportType) =>
      api.exportAccountingCsv(
        exportReportSlug(report),
        buildExportParams(
          filters,
          report === "voucher-register" ? voucherType : undefined,
        ),
      ),
    onSuccess: () => {
      // Success feedback handled by browser download
    },
    onError: (err) => {
      console.error("Export failed:", err);
    },
  });

  const pdfMutation = useMutation({
    mutationFn: (report: ReportType) =>
      api.exportAccountingPdf(
        exportReportSlug(report),
        buildExportParams(
          filters,
          report === "voucher-register" ? voucherType : undefined,
        ),
      ),
    onError: (err) => {
      console.error("PDF export failed:", err);
    },
  });

  const isExportSupported = (report: string) => {
    return [
      "trial-balance",
      "general-ledger",
      "cash-book",
      "bank-book",
      "income-statement",
      "balance-sheet",
      "tax-summary",
      "journal-register",
      "voucher-register",
      "failed-unposted",
      "cash-flow-statement",
      "budget-vs-actual",
    ].includes(report);
  };

  const openJournalDetail = async (journalEntryId: string) => {
    try {
      const entry = await api.getJournalEntry(journalEntryId);
      setSelectedJournalEntry(entry);
      setJournalDialogOpen(true);
    } catch (err) {
      console.error("Failed to load journal entry:", err);
    }
  };

  const snapshotItems = Array.isArray(
    (snapshotsQuery.data as { items?: unknown })?.items,
  )
    ? ((snapshotsQuery.data as { items: Array<Record<string, unknown>> }).items ??
      [])
    : [];

  const renderReportContent = () => {
    if (activeReport !== "failed-unposted" && !filters.fiscalYearId) {
      return (
        <div className="py-10">
          <PageState
            tone="loading"
            title="Loading fiscal year"
            description="The report will load after the active fiscal year is confirmed."
          />
        </div>
      );
    }

    if (activeReport === "general-ledger" && !filters.accountId) {
      return (
        <div className="py-10">
          <PageState
            tone="info"
            title="Select a ledger account"
            description="Choose a tenant-owned active account in Report Filters to generate the General Ledger."
          />
        </div>
      );
    }

    if (activeReport === "bank-book" && !filters.accountId) {
      return (
        <div className="py-10">
          <PageState
            tone="info"
            title="Select a bank account"
            description="Choose a mapped bank account in Report Filters to generate the Bank Book."
          />
        </div>
      );
    }

    if (reportQuery.isLoading) {
      return (
        <LoadingState
          variant="page"
          label="Generating financial report"
          className="min-h-[320px]"
        />
      );
    }

    if (reportQuery.isError) {
      return (
        <ErrorState
          title="Report generation failed"
          message={
            reportQuery.error?.message ??
            "Could not retrieve data from the financial ledger."
          }
          error={reportQuery.error}
          onRetry={() => void reportQuery.refetch()}
        />
      );
    }

    const data = reportQuery.data;

    if (!data) {
      return (
        <div className="py-10">
          <PageState
            tone="info"
            title="No Transactions Found"
            description="There are no ledger entries for the selected report and period."
          />
        </div>
      );
    }

    if (
      activeReport !== "failed-unposted" &&
      activeReport !== "journal-register" &&
      activeReport !== "voucher-register" &&
      activeReport !== "tax-summary" &&
      activeReport !== "trial-balance" &&
      activeReport !== "income-statement" &&
      activeReport !== "balance-sheet" &&
      Array.isArray(data) &&
      data.length === 0
    ) {
      return (
        <div className="py-10">
          <PageState
            tone="info"
            title="No Transactions Found"
            description="There are no ledger entries for the selected report and period."
          />
        </div>
      );
    }

    if (activeReport === "trial-balance") {
      const trialBalance = data as AccountingTrialBalanceResponse;
      return (
        <ReportTable
          columns={[
            { id: "code", label: "Code", width: 120 },
            { id: "account", label: "Account", width: 240 },
            { id: "type", label: "Type" },
            { id: "periodDebit", label: "Period Debit", align: "right" },
            { id: "periodCredit", label: "Period Credit", align: "right" },
            { id: "closingBalance", label: "Closing Balance", align: "right" },
          ]}
          rows={(trialBalance.rows ?? []).map((row) => ({
            id: row.accountId,
            cells: {
              code: { value: row.accountCode, bold: true },
              account: { value: row.accountName },
              type: { value: row.accountType },
              periodDebit: { value: row.periodDebit, type: "currency" },
              periodCredit: { value: row.periodCredit, type: "currency" },
              closingBalance: {
                value: row.netBalance,
                type: "currency",
                bold: true,
              },
            },
          }))}
        />
      );
    }

    if (activeReport === "income-statement") {
      const pnl = data as AccountingIncomeStatementResponse;
      const income = pnl.sections.find((section) => section.section === "INCOME");
      const expenses = pnl.sections.find(
        (section) => section.section === "EXPENSE",
      );

      const rows: ReportTableRow[] = [];

      rows.push({
        id: "rev-header",
        isHeader: true,
        cells: { classification: { value: "REVENUE", bold: true } },
      });
      (income?.accounts ?? []).forEach((r) => {
        rows.push({
          id: r.accountId,
          cells: {
            classification: { value: `${r.accountCode} - ${r.accountName}`, indent: 1 },
            amount: { value: r.amount, type: "currency" },
          },
        });
      });
      rows.push({
        id: "rev-total",
        isFooter: true,
        cells: {
          classification: { value: "Total Revenue" },
          amount: { value: pnl.totalIncome, type: "currency" },
        },
      });

      rows.push({
        id: "exp-header",
        isHeader: true,
        className: "mt-4",
        cells: { classification: { value: "EXPENSES", bold: true } },
      });
      (expenses?.accounts ?? []).forEach((e) => {
        rows.push({
          id: e.accountId,
          cells: {
            classification: { value: `${e.accountCode} - ${e.accountName}`, indent: 1 },
            amount: { value: e.amount, type: "currency" },
          },
        });
      });
      rows.push({
        id: "exp-total",
        isFooter: true,
        cells: {
          classification: { value: "Total Expenses" },
          amount: { value: pnl.totalExpense, type: "currency" },
        },
      });

      rows.push({
        id: "net-total",
        isFooter: true,
        className:
          "bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-text)] hover:bg-[var(--color-mod-accounting-bg)]",
        cells: {
          classification: { value: "NET INCOME", bold: true },
          amount: {
            value: pnl.netSurplusOrDeficit,
            type: "currency",
          },
        },
      });

      return (
        <ReportTable
          columns={[
            { id: "classification", label: "Classification", width: 360 },
            { id: "amount", label: "Amount", align: "right" },
          ]}
          rows={rows}
        />
      );
    }

    if (activeReport === "balance-sheet") {
      const bs = data as AccountingBalanceSheetResponse;
      const assets = bs.sections.find((section) => section.section === "ASSETS");
      const liabilities = bs.sections.find(
        (section) => section.section === "LIABILITIES",
      );
      const equity = bs.sections.find((section) => section.section === "EQUITY");
      const rows: ReportTableRow[] = [];

      rows.push({
        id: "ast-header",
        isHeader: true,
        cells: { account: { value: "ASSETS", bold: true } },
      });
      (assets?.accounts ?? []).forEach((a) => {
        rows.push({
          id: `asset-${a.accountId ?? a.accountCode}`,
          cells: {
            account: { value: `${a.accountCode} - ${a.accountName}`, indent: 1 },
            balance: { value: a.amount, type: "currency" },
          },
        });
      });
      rows.push({
        id: "ast-total",
        isFooter: true,
        cells: {
          account: { value: "Total Assets" },
          balance: { value: bs.totalAssets, type: "currency" },
        },
      });

      rows.push({
        id: "liab-header",
        isHeader: true,
        cells: { account: { value: "LIABILITIES", bold: true } },
      });
      (liabilities?.accounts ?? []).forEach((l) => {
        rows.push({
          id: `liability-${l.accountId ?? l.accountCode}`,
          cells: {
            account: { value: `${l.accountCode} - ${l.accountName}`, indent: 1 },
            balance: { value: l.amount, type: "currency" },
          },
        });
      });
      rows.push({
        id: "liab-total",
        isFooter: true,
        cells: {
          account: { value: "Total Liabilities" },
          balance: {
            value: bs.totalLiabilities,
            type: "currency",
          },
        },
      });

      rows.push({
        id: "eq-header",
        isHeader: true,
        cells: { account: { value: "EQUITY", bold: true } },
      });
      (equity?.accounts ?? []).forEach((e) => {
        rows.push({
          id: `equity-${e.accountId ?? e.accountCode}`,
          cells: {
            account: { value: `${e.accountCode} - ${e.accountName}`, indent: 1 },
            balance: { value: e.amount, type: "currency" },
          },
        });
      });
      rows.push({
        id: "eq-total",
        isFooter: true,
        cells: {
          account: { value: "Total Equity" },
          balance: { value: bs.totalEquity, type: "currency" },
        },
      });

      return (
        <ReportTable
          columns={[
            { id: "account", label: "Account", width: 360 },
            { id: "balance", label: "Balance", align: "right" },
          ]}
          rows={rows}
        />
      );
    }

    if (activeReport === "general-ledger") {
      const ledger = data as AccountingGeneralLedgerResponse;
      return (
        <ReportTable
          columns={[
            { id: "date", label: "Date", width: 150 },
            { id: "journal", label: "Journal", width: 150 },
            { id: "account", label: "Account", width: 240 },
            { id: "debit", label: "Debit", align: "right" },
            { id: "credit", label: "Credit", align: "right" },
            { id: "balance", label: "Balance", align: "right" },
          ]}
          rows={(ledger.rows ?? []).map((row, index) => ({
            id: `${row.journalEntryId}-${index}`,
            cells: {
              date: { value: row.entryDate, type: "date" },
              journal: { value: row.entryNumber ?? "Unnumbered", bold: true },
              account: { value: row.accountName },
              debit: { value: row.debit, type: "currency" },
              credit: { value: row.credit, type: "currency" },
              balance: {
                value: row.runningBalance,
                type: "currency",
                bold: true,
              },
            },
          }))}
        />
      );
    }

    if (activeReport === "cash-book" || activeReport === "bank-book") {
      const cb = data as AccountingCashBookResponse;
      return (
        <ReportTable
          columns={[
            { id: "date", label: "Date", width: 150 },
            { id: "journal", label: "Journal", width: 150 },
            { id: "narration", label: "Narration", width: 280 },
            { id: "receipt", label: "Receipt", align: "right" },
            { id: "payment", label: "Payment", align: "right" },
            { id: "balance", label: "Balance", align: "right" },
          ]}
          rows={(cb.rows ?? []).map((row, index) => ({
            id: `${row.journalEntryId}-${index}`,
            cells: {
              date: { value: row.entryDate, type: "date" },
              journal: { value: row.entryNumber ?? "Unnumbered" },
              narration: { value: row.narration },
              receipt: { value: row.receiptAmount, type: "currency" },
              payment: { value: row.paymentAmount, type: "currency" },
              balance: {
                value: row.runningBalance,
                type: "currency",
                bold: true,
              },
            },
          }))}
        />
      );
    }

    if (activeReport === "tax-summary") {
      const tax = data as {
        vat?: { outputVat: string; inputVat: string; netVat: string };
        tds?: { deductedPayable: string; paid: string; netPayable: string };
        pf?: {
          employeeContribution: string;
          employerContribution: string;
          paid: string;
          netPayable: string;
        };
      };
      const rows = [
        tax.vat && ["VAT", "Net payable/receivable", tax.vat.netVat],
        tax.tds && ["TDS", "Net payable", tax.tds.netPayable],
        tax.pf && ["PF", "Net payable", tax.pf.netPayable],
      ].filter(Boolean) as string[][];
      return (
        <ReportTable
          columns={[
            { id: "type", label: "Type" },
            { id: "summary", label: "Summary", width: 240 },
            { id: "amount", label: "Amount", align: "right" },
          ]}
          rows={rows.map((row, index) => ({
            id: `tax-${index}`,
            cells: {
              type: { value: row[0], bold: true },
              summary: { value: row[1] },
              amount: { value: row[2], type: "currency", bold: true },
            },
          }))}
        />
      );
    }

    if (activeReport === "journal-register" || activeReport === "voucher-register") {
      const register = data as JournalRegisterResponse;
      return (
        <ReportTable
          columns={[
            { id: "date", label: "Date", width: 150 },
            { id: "entryNumber", label: "Entry No", width: 150 },
            { id: "narration", label: "Narration", width: 280 },
            { id: "debited", label: "Debited", width: 220 },
            { id: "credited", label: "Credited", width: 220 },
            { id: "debit", label: "Debit", align: "right" },
            { id: "credit", label: "Credit", align: "right" },
            { id: "status", label: "Status" },
            { id: "approval", label: "Approval" },
            { id: "reversal", label: "Reversal" },
          ]}
          rows={(register.rows ?? []).map((row) => ({
            id: row.journalEntryId,
            accessibleLabel: `Open journal ${row.entryNumber ?? row.journalEntryId}`,
            onActivate: () => openJournalDetail(row.journalEntryId),
            cells: {
              date: { value: row.entryDate, type: "date" },
              entryNumber: {
                value: (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-bold text-[var(--color-mod-accounting-accent)]"
                    onClick={() => openJournalDetail(row.journalEntryId)}
                  >
                    {row.entryNumber ?? "View"}
                  </Button>
                ),
              },
              narration: { value: row.narration },
              debited: { value: row.debitedAccounts },
              credited: { value: row.creditedAccounts },
              debit: { value: row.totalDebit, type: "currency" },
              credit: { value: row.totalCredit, type: "currency" },
              status: { value: row.status },
              approval: { value: row.approvalStatus },
              reversal: { value: row.reversalStatus },
            },
          }))}
        />
      );
    }

    if (activeReport === "cash-flow-statement") {
      const cashFlow = data as CashFlowStatementResponse;
      const rows: ReportTableRow[] = [];
      for (const section of cashFlow.sections ?? []) {
        rows.push({
          id: `${section.section}-header`,
          isHeader: true,
          cells: { lineItem: { value: section.section, bold: true } },
        });
        for (const line of section.lines) {
          rows.push({
            id: `${section.section}-${line.label}`,
            cells: {
              lineItem: { value: line.label, indent: 1 },
              amount: { value: line.amount, type: "currency" },
            },
          });
        }
        rows.push({
          id: `${section.section}-subtotal`,
          isFooter: true,
          cells: {
            lineItem: { value: `Subtotal (${section.section})`, bold: true },
            amount: {
              value: section.subtotal,
              type: "currency",
              bold: true,
            },
          },
        });
      }
      rows.push({
        id: "opening-cash",
        isFooter: true,
        cells: {
          lineItem: { value: "Opening cash", bold: true },
          amount: { value: cashFlow.openingCash, type: "currency" },
        },
      });
      rows.push({
        id: "net-change",
        isFooter: true,
        cells: {
          lineItem: { value: "Net change in cash", bold: true },
          amount: { value: cashFlow.netChange, type: "currency" },
        },
      });
      rows.push({
        id: "closing-cash",
        isFooter: true,
        cells: {
          lineItem: { value: "Closing cash", bold: true },
          amount: {
            value: cashFlow.closingCash,
            type: "currency",
            bold: true,
          },
        },
      });
      return (
        <div className="space-y-4">
          {(cashFlow.setupWarnings ?? []).map((warning) => (
            <p
              key={warning}
              className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              {warning}
            </p>
          ))}
          <ReportTable
            columns={[
              { id: "lineItem", label: "Line item", width: 360 },
              { id: "amount", label: "Amount", align: "right" },
            ]}
            rows={rows}
          />
        </div>
      );
    }

    if (activeReport === "budget-vs-actual") {
      const budgetReport = data as BudgetVsActualResponse;
      return (
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-600">
            Budget: {budgetReport.budgetName}
          </p>
          <ReportTable
            columns={[
              { id: "account", label: "Account", width: 280 },
              { id: "budget", label: "Budget", align: "right" },
              { id: "actual", label: "Actual", align: "right" },
              { id: "variance", label: "Variance", align: "right" },
              { id: "variancePercent", label: "Variance %", align: "right" },
            ]}
            rows={(budgetReport.rows ?? []).map((row) => ({
              id: row.accountCode,
              cells: {
                account: {
                  value: `${row.accountCode} - ${row.accountName}`,
                  bold: true,
                },
                budget: {
                  value: row.budgetAmount,
                  type: "currency",
                },
                actual: {
                  value: row.actualAmount,
                  type: "currency",
                },
                variance: {
                  value: row.variance,
                  type: "currency",
                },
                variancePercent: {
                  value: row.variancePercent
                    ? `${row.variancePercent}%`
                    : "-",
                },
              },
            }))}
          />
        </div>
      );
    }

    if (activeReport === "failed-unposted") {
      const failed = data as FailedUnpostedResponse;
      return (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Total issues" value={failed.summary.totalIssues} />
            <SummaryCard
              label="Approved unposted"
              value={failed.summary.approvedUnpostedJournals}
            />
            <SummaryCard
              label="Missing GL postings"
              value={failed.summary.missingGlPostings}
            />
            <SummaryCard
              label="Payroll posting failures"
              value={failed.summary.payrollPostingFailures}
            />
          </div>
          <ReportTable
            columns={[
              { id: "module", label: "Module" },
              { id: "source", label: "Source" },
              { id: "reference", label: "Reference", width: 180 },
              { id: "amount", label: "Amount", align: "right" },
              { id: "issue", label: "Issue", width: 180 },
              { id: "details", label: "Details", width: 280 },
              { id: "detected", label: "Detected", width: 150 },
            ]}
            rows={(failed.rows ?? []).map((row, index) => ({
              id: `${row.reference}-${index}`,
              cells: {
                module: { value: row.sourceModule, bold: true },
                source: { value: row.sourceType },
                reference: { value: row.reference },
                amount: {
                  value: row.amount ?? "-",
                  type: row.amount ? "currency" : undefined,
                },
                issue: { value: row.issueType },
                details: { value: row.details },
                detected: { value: row.detectedAt, type: "date" },
              },
            }))}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <SectionCard
        title="Accounting Reports"
        description="Comprehensive financial statements and ledger reports generated from real-time accounting data."
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => pdfMutation.mutate(activeReport)}
              disabled={
                pdfMutation.isPending || !isExportSupported(activeReport)
              }
              isLoading={pdfMutation.isPending}
              className="bg-[var(--color-mod-accounting-accent)] hover:bg-[var(--color-mod-accounting-text)]"
              data-testid="accounting-report-pdf-export"
            >
              <FileDown size={18} />
              {pdfMutation.isPending ? "Generating..." : "Download PDF"}
            </Button>
            <Button
              type="button"
              onClick={() => exportMutation.mutate(activeReport)}
              disabled={
                exportMutation.isPending || !isExportSupported(activeReport)
              }
              isLoading={exportMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <FileSpreadsheet size={18} />
              {exportMutation.isPending ? "Generating..." : "Download CSV"}
            </Button>
          </div>
        }
      >
        <AuditInfo>
          Financial truth is derived from the backend ledger. Posted journals are
          immutable; use reversal/correction workflows for any adjustments.
        </AuditInfo>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 space-y-4">
          <SectionCard title="Select Report" className="h-full">
            <div className="flex flex-col gap-2">
              {[
                {
                  id: "trial-balance",
                  label: "Trial Balance",
                  icon: BarChart3,
                  desc: "Balance check for all accounts",
                },
                {
                  id: "income-statement",
                  label: "Income and Expenditure Statement",
                  icon: FileText,
                  desc: "Revenue vs expenses for the period",
                },
                {
                  id: "balance-sheet",
                  label: "Balance Sheet",
                  icon: PieChart,
                  desc: "Assets, Liabilities & Equity",
                },
                {
                  id: "general-ledger",
                  label: "General Ledger",
                  icon: History,
                  desc: "Detailed transaction history",
                },
                {
                  id: "cash-book",
                  label: "Cash Book",
                  icon: Wallet,
                  desc: "Cash movements",
                },
                {
                  id: "bank-book",
                  label: "Bank Book",
                  icon: Wallet,
                  desc: "Per-bank account movements",
                },
                {
                  id: "journal-register",
                  label: "Journal Register",
                  icon: History,
                  desc: "All journal entries for the period",
                },
                {
                  id: "voucher-register",
                  label: "Voucher Register",
                  icon: FileText,
                  desc: "Receipt, payment, expense, and contra vouchers",
                },
                {
                  id: "failed-unposted",
                  label: "Failed / Unposted",
                  icon: Calculator,
                  desc: "Posting gaps and approved unposted journals",
                },
                {
                  id: "cash-flow-statement",
                  label: "Cash Flow Statement",
                  icon: BarChart3,
                  desc: "Operating, investing, and financing cash movement",
                },
                {
                  id: "budget-vs-actual",
                  label: "Budget vs Actual",
                  icon: PieChart,
                  desc: "Approved budget compared to ledger actuals",
                },
                {
                  id: "tax-summary",
                  label: "VAT/TDS/PF",
                  icon: Calculator,
                  desc: "Tax and statutory summaries",
                },
              ].map((report) => (
                <Button
                  key={report.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleReportChange(report.id as ReportType)}
                  className={cn(
                    "h-auto w-full flex-col items-start gap-0.5 rounded-xl px-4 py-3 text-left transition-all",
                    activeReport === report.id
                      ? "border border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-text)] shadow-sm hover:bg-[var(--color-mod-accounting-bg)]"
                      : "border border-slate-100 bg-white text-slate-600 hover:border-[var(--color-mod-accounting-border)] hover:bg-[var(--color-mod-accounting-bg)]",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <report.icon size={16} />
                    {report.label}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      activeReport === report.id
                        ? "text-[var(--color-mod-accounting-text)]/70"
                        : "text-slate-400",
                    )}
                  >
                    {report.desc}
                  </span>
                </Button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <SectionCard>
            {activeReport !== "failed-unposted" && (
              <ReportFilters
                onFilterChange={(f) =>
                  setFilters((prev) => ({ ...prev, ...f }))
                }
              />
            )}
            {activeReport === "voucher-register" && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Voucher type
                </label>
                <Select
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value)}
                  className="w-full max-w-sm"
                >
                  <option value="RECEIPT_VOUCHER">Receipt voucher</option>
                  <option value="PAYMENT_VOUCHER">Payment voucher</option>
                  <option value="EXPENSE_VOUCHER">Expense voucher</option>
                  <option value="CONTRA_VOUCHER">Contra voucher</option>
                </Select>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={activeReport.replace(/-/g, " ")}
            description="Ledger-backed preview"
            headerAction={
              <div className="flex items-center gap-2 rounded-lg bg-[var(--color-mod-accounting-bg)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-mod-accounting-text)]">
                <History size={12} />
                Current ledger data
              </div>
            }
            className="min-h-[400px] shadow-sm"
          >
            <div className="animate-in fade-in duration-700">
              {renderReportContent()}
            </div>
          </SectionCard>

          <SectionCard
            title="Saved Snapshots"
            description="Protected report files generated through File Registry."
          >
            <div
              className="space-y-2"
              data-testid="accounting-report-snapshots"
            >
              {snapshotItems
                .filter((item: any) =>
                  String(item.reportKey ?? "").includes(activeReport),
                )
                .slice(0, 5)
                .map((item: any) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    onClick={() => api.downloadReportSnapshot(item.id)}
                    className="h-auto w-full justify-between rounded-lg px-3 py-2 text-left text-sm font-normal"
                  >
                    <span className="font-bold text-slate-700">
                      {item.reportKey}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {item.format?.toUpperCase()} -{" "}
                      {formatBsDateTime(item.createdAt)}
                    </span>
                  </Button>
                ))}
              {snapshotItems.filter((item) =>
                String(item.reportKey ?? "").includes(activeReport),
              ).length === 0 && (
                <p className="text-sm text-slate-500">
                  No saved snapshots for this report yet.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <JournalDetailDialog
        isOpen={journalDialogOpen}
        onClose={() => {
          setJournalDialogOpen(false);
          setSelectedJournalEntry(null);
        }}
        entry={selectedJournalEntry}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
