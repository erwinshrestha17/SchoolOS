"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Wallet,
  Landmark,
  BarChart3,
  FileText,
  PieChart,
  History,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Settings,
  Clock,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import { SectionCard } from "../ui/section-card";
import { KpiCard, KpiGrid } from "../ui/kpi-card";
import { ModuleHeader } from "../ui/module-header";
import { ModuleTabs } from "../ui/module-tabs";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { PageState } from "../ui/page-state";
import { AuditInfo } from "../ui/audit-info";
import { ReportTable } from "./report-table";
import { VoucherDialog, type VoucherType } from "./voucher-dialog";
import { useSession } from "../session-provider";

const nprFormatter = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 2,
});

function formatMoney(amount?: string | number | null) {
  if (amount === undefined || amount === null) return "Unavailable";
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(numericAmount)
    ? nprFormatter.format(numericAmount)
    : "Unavailable";
}

export function AccountingDashboardView() {
  const router = useRouter();
  const { hasPermissions } = useSession();
  const canCreateJournal = hasPermissions(["accounting:journals:create"]);
  const summaryQuery = useQuery({
    queryKey: ["accounting-dashboard-summary"],
    queryFn: () => api.getAccountingDashboardSummary(),
    staleTime: 60_000,
  });

  const [voucherType, setVoucherType] = useState<VoucherType | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["chart-accounts"],
    queryFn: () => api.listChartAccounts(),
    enabled: voucherType !== null,
  });

  const activeFiscalYear = summaryQuery.data?.activeFiscalYear;
  const activePeriod = summaryQuery.data?.activePeriod;

  const noFiscalYear = summaryQuery.isSuccess && !activeFiscalYear;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <ModuleHeader
        title="Accounting & Finance"
        description="Manage journals, ledgers, reconciliation, fiscal controls, and financial reports."
        primaryAction={
          canCreateJournal ? (
            <button
              type="button"
              onClick={() => router.push("/dashboard/accounting/journals")}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-accounting-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-accounting-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-accounting-border)] focus:ring-offset-2"
            >
              <FileText className="h-4 w-4" />
              New Journal Entry
            </button>
          ) : undefined
        }
        moreActionItems={[
          {
            label: "Chart of Accounts",
            icon: <Calculator className="h-4 w-4" />,
            onClick: () =>
              router.push("/dashboard/accounting/chart-of-accounts"),
          },
          {
            label: "Bank Reconciliation",
            icon: <Landmark className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/accounting/reconciliation"),
          },
          {
            label: "Financial Reports",
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/accounting/reports"),
          },
          {
            label: "Period Close",
            icon: <Clock className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/accounting/fiscal-periods"),
          },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            title="Fiscal Year Status"
            loading={summaryQuery.isLoading}
            value={activeFiscalYear?.status ?? "Unavailable"}
            icon={<Clock size={20} />}
            tone={activeFiscalYear?.status === "OPEN" ? "success" : "neutral"}
            description={
              activeFiscalYear?.name ?? "Fiscal year is not configured."
            }
            href="/dashboard/accounting/fiscal-periods"
          />
          <KpiCard
            title="Pending Approvals"
            loading={summaryQuery.isLoading}
            value={summaryQuery.data?.pendingJournalApprovals ?? "Unavailable"}
            icon={<FileText size={20} />}
            tone={
              (summaryQuery.data?.pendingJournalApprovals ?? 0) > 0
                ? "warning"
                : "success"
            }
            description="Submitted journals awaiting approval."
            href="/dashboard/accounting/journals?status=SUBMITTED"
          />
          <KpiCard
            title="Unreconciled Items"
            loading={summaryQuery.isLoading}
            value={summaryQuery.data?.unreconciledBankItems ?? "Unavailable"}
            icon={<Landmark size={20} />}
            tone={
              (summaryQuery.data?.unreconciledBankItems ?? 0) > 0
                ? "warning"
                : "success"
            }
            description="Bank statement rows awaiting review."
            href="/dashboard/accounting/reconciliation"
          />
          <KpiCard
            title="Mapping Issues"
            loading={summaryQuery.isLoading}
            value={summaryQuery.data?.sourceMappingIssueCount ?? "Unavailable"}
            icon={<AlertCircle size={20} />}
            tone={
              (summaryQuery.data?.sourceMappingIssueCount ?? 0) > 0
                ? "danger"
                : "success"
            }
            description="Missing source references or active source mappings."
            href="/dashboard/accounting/source-mappings"
          />
          <KpiCard
            title="Active Export Jobs"
            loading={summaryQuery.isLoading}
            value={summaryQuery.data?.activeExportJobs ?? "Unavailable"}
            icon={<History size={20} />}
            tone={
              (summaryQuery.data?.failedExportJobs ?? 0) > 0
                ? "danger"
                : "neutral"
            }
            description={
              summaryQuery.data?.failedExportJobs
                ? `${summaryQuery.data.failedExportJobs} failed export job(s).`
                : "Queued and processing accounting exports."
            }
            href="/dashboard/accounting/reports"
          />
          <KpiCard
            title="Trial Balance Readiness"
            loading={summaryQuery.isLoading}
            value={
              summaryQuery.data
                ? summaryQuery.data.trialBalance.balanced
                  ? "Ready"
                  : "Needs review"
                : "Unavailable"
            }
            icon={<CheckCircle2 size={20} />}
            tone={
              summaryQuery.data?.trialBalance.balanced ? "success" : "warning"
            }
            description="Backend Decimal totals across posted journals."
            href="/dashboard/accounting/reports?report=trial-balance"
          />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          {
            href: "/dashboard/accounting",
            label: "Dashboard",
            icon: BarChart3,
          },
          {
            href: "/dashboard/accounting/chart-of-accounts",
            label: "Chart of Accounts",
            icon: Calculator,
          },
          {
            href: "/dashboard/accounting/journals",
            label: "Journals",
            icon: FileText,
          },
          {
            href: "/dashboard/accounting/accounts",
            label: "Ledger",
            icon: History,
          },
          {
            href: "/dashboard/accounting/reports",
            label: "Reports",
            icon: PieChart,
          },
          {
            href: "/dashboard/accounting/reconciliation",
            label: "Reconciliation",
            icon: Landmark,
          },
          {
            href: "/dashboard/accounting/fiscal-periods",
            label: "Period Close",
            icon: Clock,
          },
        ]}
        accentColor="emerald"
        variant="light"
      />

      {summaryQuery.isError ? (
        <PageState
          tone="danger"
          title="Unable to load the accounting operating summary"
          description={
            summaryQuery.error?.message ??
            "The bounded M11 summary could not be loaded."
          }
          actionLabel="Retry summary"
          onAction={() => void summaryQuery.refetch()}
        />
      ) : null}

      {noFiscalYear && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm animate-in slide-in-from-top-4">
          <div className="flex gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30">
              <AlertCircle size={30} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight">
                No Fiscal Configuration Found
              </h3>
              <p className="mt-1 text-sm font-medium leading-relaxed text-rose-700/80 max-w-2xl">
                Accounting operations require an active fiscal year. Please
                initialize your chart of accounts and set up your first fiscal
                period in management.
              </p>
              <Link
                href="/dashboard/accounting/management"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-900 px-5 py-2 text-xs font-black text-white hover:bg-rose-950 transition-all"
              >
                Go to Fiscal Management
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {canCreateJournal ? (
            <SectionCard
              title="Operational Quick Actions"
              description="Execute standard financial transactions and vouchers."
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  {
                    label: "Journal Voucher",
                    desc: "Balanced multi-line draft",
                    icon: FileText,
                    color: "bg-[var(--color-mod-accounting-accent)]",
                    action: () => setVoucherType("JOURNAL"),
                  },
                  {
                    label: "Expense Voucher",
                    desc: "Direct school expenses",
                    icon: Calculator,
                    color: "bg-rose-600",
                    action: () => setVoucherType("EXPENSE"),
                  },
                  {
                    label: "Payment Voucher",
                    desc: "Vendor or staff payment",
                    icon: Wallet,
                    color: "bg-[var(--color-mod-accounting-accent)]",
                    action: () => setVoucherType("PAYMENT"),
                  },
                  {
                    label: "Receipt Voucher",
                    desc: "Inward cash or bank receipt",
                    icon: CheckCircle2,
                    color: "bg-emerald-600",
                    action: () => setVoucherType("RECEIPT"),
                  },
                  {
                    label: "Contra Voucher",
                    desc: "Cash and bank transfer",
                    icon: ArrowRight,
                    color: "bg-cyan-600",
                    action: () => setVoucherType("CONTRA"),
                  },
                ].map((action, idx) => (
                  <button
                    key={idx}
                    onClick={action.action}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-center transition hover:border-[var(--color-mod-accounting-border)] hover:bg-[var(--color-mod-accounting-bg)]"
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition group-hover:scale-110",
                        action.color,
                      )}
                    >
                      <action.icon size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-[var(--color-mod-accounting-text)]">
                        {action.label}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {action.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Financial Reporting Hub"
            description="Access real-time verified accounting reports."
          >
            <div className="space-y-4">
              <AuditInfo>
                Ledger records are immutable. All calculated balances are
                verified against backend double-entry constraints.
              </AuditInfo>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    href: "/dashboard/accounting/reports?report=trial-balance",
                    label: "Trial Balance",
                    desc: "Summary of all ledger balances.",
                    icon: BarChart3,
                    color: "bg-[var(--color-mod-accounting-accent)]",
                  },
                  {
                    href: "/dashboard/accounting/reports?report=income-statement",
                    label: "Income Statement",
                    desc: "Profit and loss for the period.",
                    icon: FileText,
                    color: "bg-emerald-500",
                  },
                  {
                    href: "/dashboard/accounting/reports?report=balance-sheet",
                    label: "Balance Sheet",
                    desc: "Financial position of the school.",
                    icon: PieChart,
                    color: "bg-secondary-500",
                  },
                  {
                    href: "/dashboard/accounting/reports?report=general-ledger",
                    label: "General Ledger",
                    desc: "Detailed transaction history.",
                    icon: History,
                    color: "bg-amber-500",
                  },
                  {
                    href: "/dashboard/accounting/reports?report=cash-book",
                    label: "Cash Book",
                    desc: "Real-time cash and bank flow.",
                    icon: Wallet,
                    color: "bg-cyan-500",
                  },
                  {
                    href: "/dashboard/accounting/reconciliation",
                    label: "Bank Reconciliation",
                    desc: "Verify bank statements.",
                    icon: Landmark,
                    color: "bg-[var(--color-mod-accounting-accent)]",
                  },
                ].map((report) => (
                  <Link
                    key={report.href}
                    href={report.href}
                    className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-[var(--color-mod-accounting-border)] hover:bg-[var(--color-mod-accounting-bg)]"
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg transition group-hover:scale-110",
                        report.color,
                      )}
                    >
                      <report.icon size={22} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 group-hover:text-[var(--color-mod-accounting-text)]">
                        {report.label}
                      </p>
                      <p className="text-xs text-slate-500">{report.desc}</p>
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[var(--color-mod-accounting-text)]"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Ledger Postings"
            description="Latest validated transactions across all journals."
            headerAction={
              <Link
                href="/dashboard/accounting/journals"
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
              >
                View All Journals
              </Link>
            }
          >
            {summaryQuery.isLoading ? (
              <PageState
                tone="loading"
                title="Loading journal entries"
                description="Fetching recent ledger postings from the backend."
              />
            ) : summaryQuery.isError ? (
              <PageState
                tone="danger"
                title="Unable to load journal entries"
                description={
                  summaryQuery.error?.message ??
                  "Recent ledger postings could not be loaded."
                }
              />
            ) : (
              <ReportTable
                headers={["Date", "Number", "Narration", "Amount"]}
                rows={(summaryQuery.data?.recentJournals ?? []).map(
                  (entry) => ({
                    id: entry.id,
                    cells: [
                      { value: entry.entryDate, type: "date" },
                      { value: entry.entryNumber, bold: true },
                      { value: entry.narration },
                      { value: entry.totalDebit, type: "currency" },
                    ],
                  }),
                )}
              />
            )}
          </SectionCard>
        </div>

        <div className="space-y-8">
          <SectionCard title="Fiscal Status">
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)] p-5 text-[var(--color-mod-accounting-text)] shadow-sm">
                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--color-mod-accounting-text)]/70">
                  Current Fiscal Year
                </p>
                <h4 className="mt-1 text-xl font-black">
                  {activeFiscalYear?.name ?? "Fiscal year not set"}
                </h4>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--color-mod-accounting-border)] pt-4">
                  <span className="text-xs font-bold text-[var(--color-mod-accounting-text)]/80">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    <CheckCircle2 size={10} />
                    {activeFiscalYear?.status}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-text)]">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {activePeriod?.label ?? "No Active Period"}
                      </p>
                      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                        Current Period
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      activePeriod?.status === "OPEN"
                        ? "success"
                        : activePeriod?.status === "LOCKED"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {activePeriod?.status ?? "CLOSED"}
                  </Badge>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle size={18} className="text-amber-600" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-800">
                        Period Closing Reminder
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-amber-700/80">
                        Please ensure all bank reconciliations are completed
                        before locking the current period.
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/dashboard/accounting/management"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 p-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings size={14} />
                  Manage Fiscal Settings
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Double-Entry Guard">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-600">
                  Ledger Balanced
                </span>
                {summaryQuery.data?.trialBalance.balanced ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : (
                  <XCircle size={18} className="text-rose-500" />
                )}
              </div>
              <div className="p-4 rounded-xl border border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-text)]">
                <div className="flex items-center justify-between text-[0.65rem] font-black uppercase tracking-widest text-[var(--color-mod-accounting-text)]/70">
                  <span>Trial Balance</span>
                  <span>Check</span>
                </div>
                <div className="mt-3 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-[var(--color-mod-accounting-text)]/70 uppercase font-bold">
                      Debit
                    </p>
                    <p className="text-sm font-bold">
                      {formatMoney(summaryQuery.data?.trialBalance.totalDebit)}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-[var(--color-mod-accounting-border)]" />
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--color-mod-accounting-text)]/70 uppercase font-bold">
                      Credit
                    </p>
                    <p className="text-sm font-bold">
                      {formatMoney(summaryQuery.data?.trialBalance.totalCredit)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <VoucherDialog
        isOpen={voucherType !== null}
        onClose={() => setVoucherType(null)}
        accounts={accountsQuery.data ?? []}
        voucherType={voucherType ?? "EXPENSE"}
      />
    </div>
  );
}
