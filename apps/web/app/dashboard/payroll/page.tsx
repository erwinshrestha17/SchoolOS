"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Calculator,
  FileText,
  History,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { ModuleHeader } from "../../../components/ui/module-header";
import { DashboardPageShell } from "../../../components/dashboard/dashboard-page-shell";
import { SummaryCard, SummaryGrid } from "../../../components/ui/summary-card";
import { WorkspaceTabs } from "../../../components/ui/module-tabs";
import { WorkSurface } from "../../../components/ui/work-surface";
import { LoadingState } from "../../../components/ui/loading-state";
import { ErrorState } from "../../../components/ui/error-state";
import { EmptyState } from "../../../components/ui/empty-state";

const moneyFormatter = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 0,
});

const moduleTabs = [
  { href: "/dashboard/payroll/runs", label: "Runs", icon: History },
  {
    href: "/dashboard/payroll/salary-structures",
    label: "Salary Structures",
    icon: Calculator,
  },
  {
    href: "/dashboard/payroll/readiness",
    label: "Readiness",
    icon: ShieldCheck,
  },
  { href: "/dashboard/payroll/payslips", label: "Payslips", icon: FileText },
  { href: "/dashboard/payroll/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/hr/staff", label: "Staff", icon: Wallet },
];

function formatMoney(value?: number | string | null) {
  if (value === undefined || value === null) return "Unavailable";
  return moneyFormatter.format(Number(value));
}

export default function PayrollDashboardPage() {
  const router = useRouter();
  const summaryQuery = useQuery({
    queryKey: ["payroll-dashboard-summary"],
    queryFn: () => api.getPayrollDashboardSummary(),
  });

  const summary = summaryQuery.data;
  const selectedRun = summary?.selectedPayrollRun ?? null;
  const latestRun = summary?.latestPayrollRun ?? null;
  const workflowSteps = [
    {
      label: "Draft",
      statuses: ["DRAFT", "GENERATED", "UNDER_REVIEW", "REVIEWED"],
      description: "Generated or under review",
    },
    {
      label: "Approved",
      statuses: ["APPROVED"],
      description: "Ready for posting",
    },
    {
      label: "Posted",
      statuses: ["POSTED"],
      description: "Accrued in accounting",
    },
  ].map((step) => ({
    ...step,
    count: step.statuses.reduce(
      (total, status) => total + (summary?.payrollRunsByStatus?.[status] ?? 0),
      0,
    ),
  }));
  const awaitingAction = workflowSteps
    .filter((step) => step.label !== "Posted")
    .reduce((total, step) => total + step.count, 0);

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M7 Payroll"
        title="Payroll"
        description="Review payroll runs, approve them, post approved runs to accounting, and open protected payslips and statutory reports from backend-owned payroll data."
        primaryAction={
          <Link
            href="/dashboard/payroll/runs"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <History className="h-4 w-4" />
            Open Runs
          </Link>
        }
        moreActionItems={[
          {
            label: "Salary Structures",
            icon: <Calculator className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/payroll/salary-structures"),
          },
          {
            label: "Payslips",
            icon: <FileText className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/payroll/payslips"),
          },
          {
            label: "Reports",
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/payroll/reports"),
          },
        ]}
      />

      <SummaryGrid>
        <SummaryCard
          label="Gross Pay"
          value={formatMoney(selectedRun?.totalGross)}
          icon={<Wallet className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone="neutral"
          description="Selected run backend total"
        />
        <SummaryCard
          label="Deductions"
          value={formatMoney(selectedRun?.totalDeductions)}
          icon={<Calculator className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone="info"
          description="PF, TDS, and other deductions"
        />
        <SummaryCard
          label="Net Payable"
          value={formatMoney(selectedRun?.totalNet)}
          icon={<BadgeCheck className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone="success"
          description="Backend-calculated run total"
        />
        <SummaryCard
          label="Approval Queue"
          value={summaryQuery.isError ? "Unavailable" : awaitingAction}
          icon={<AlertCircle className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone={awaitingAction > 0 ? "warning" : "success"}
          description="Runs awaiting review or posting"
        />
      </SummaryGrid>

      <WorkspaceTabs items={moduleTabs} />

      <WorkSurface
        title="Payroll Workflow"
        description="Current loaded run statuses for review, approval, and accounting posting."
        variant="queue"
        action={
          <Link
            href="/dashboard/payroll/runs"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary-dark)] hover:text-slate-950"
          >
            Open Payroll Runs
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <div>
          {summaryQuery.isLoading ? (
            <LoadingState
              variant="spinner"
              label="Loading payroll workflow..."
            />
          ) : summaryQuery.isError ? (
            <ErrorState
              title="Payroll workflow unavailable"
              message="Payroll run statuses could not be loaded. Check your payroll permission and retry."
              onRetry={() => void summaryQuery.refetch()}
            />
          ) : workflowSteps.some((step) => step.count > 0) ? (
            <div className="grid gap-3 md:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {index + 1}. {step.label}
                    </span>
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold tabular-nums text-slate-700">
                      {step.count}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No payroll runs"
              description="Create a payroll run from the runs workspace when payroll is ready for review."
              icon={<History className="h-7 w-7" />}
            />
          )}
        </div>
      </WorkSurface>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkSurface
          title="Posting Status"
          description="Posted runs are linked to accounting journals; salary disbursement remains outside this workspace."
          variant="monitoring"
        >
          <div className="space-y-3">
            {[
              {
                label: "Latest Run",
                status: latestRun?.status?.replaceAll("_", " ") ?? "No runs",
                tone: latestRun
                  ? "text-[var(--primary-dark)]"
                  : "text-slate-500",
              },
              {
                label: "Selected Run Journal",
                status: selectedRun?.postingReadiness.accountingJournalId
                  ? "Linked"
                  : "Not posted",
                tone: selectedRun?.postingReadiness.accountingJournalId
                  ? "text-success-700"
                  : "text-warning-700",
              },
              {
                label: "Runs Awaiting Review or Posting",
                status: String(awaitingAction),
                tone:
                  awaitingAction > 0 ? "text-warning-700" : "text-success-700",
              },
              {
                label: "Readiness Exceptions",
                status: summaryQuery.isError
                  ? "Unavailable"
                  : String(selectedRun?.validationExceptionCount ?? 0),
                tone:
                  (selectedRun?.validationExceptionsBySeverity.BLOCKING ?? 0) > 0
                    ? "text-danger-700"
                    : (selectedRun?.validationExceptionsBySeverity.WARNING ?? 0) > 0
                      ? "text-warning-700"
                      : "text-success-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <span className="text-sm font-medium text-slate-600">
                  {item.label}
                </span>
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wide",
                    item.tone,
                  )}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </WorkSurface>

        <WorkSurface
          title="Reports and Protected Files"
          description="Payslip PDFs and exports stay behind authenticated payroll helpers."
          variant="grid"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Payslips",
                href: "/dashboard/payroll/payslips",
                icon: FileText,
              },
              {
                label: "Payroll Reports",
                href: "/dashboard/payroll/reports",
                icon: BarChart3,
              },
              {
                label: "Salary Structures",
                href: "/dashboard/payroll/salary-structures",
                icon: Calculator,
              },
              {
                label: "Staff Contracts",
                href: "/dashboard/hr/contracts",
                icon: Wallet,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </WorkSurface>
      </div>

      {summaryQuery.isError ? (
        <ErrorState
          title="Payroll summary unavailable"
          message="Official payroll summary totals could not be loaded. Report totals remain unavailable until the backend returns them."
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}
    </DashboardPageShell>
  );
}
