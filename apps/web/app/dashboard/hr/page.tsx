"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatBsDate } from "@schoolos/core";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileText,
  History,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { ModuleHeader } from "../../../components/ui/module-header";
import { KpiCard, KpiGrid } from "../../../components/ui/kpi-card";
import { ModuleTabs } from "../../../components/dashboard/module-tabs";
import { StatusBadge } from "../../../components/ui/status-badge";
import { LoadingState } from "../../../components/ui/loading-state";
import { EmptyState } from "../../../components/ui/empty-state";
import { ErrorState } from "../../../components/ui/error-state";

const moduleTabs = [
  { href: "/dashboard/hr/staff", label: "Staff", icon: Users },
  { href: "/dashboard/hr/contracts", label: "Contracts", icon: Briefcase },
  { href: "/dashboard/hr/leave", label: "Leave", icon: CalendarDays },
  {
    href: "/dashboard/hr/attendance",
    label: "Attendance",
    icon: ClipboardCheck,
  },
  { href: "/dashboard/payroll/runs", label: "Payroll", icon: History },
  {
    href: "/dashboard/payroll/readiness",
    label: "Readiness",
    icon: ShieldCheck,
  },
  { href: "/dashboard/payroll/payslips", label: "Payslips", icon: FileText },
  { href: "/dashboard/payroll/reports", label: "Reports", icon: BadgeCheck },
];

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return formatBsDate(value);
}

function unavailable(isError: boolean, value?: number | null) {
  if (isError) return "Unavailable";
  return value ?? 0;
}

export default function HRDashboardPage() {
  const router = useRouter();
  const leaveQueueQuery = useQuery({
    queryKey: ["hr-leave-queue-depth", 7],
    queryFn: () => api.getLeaveQueueDepth({ staleDays: 7 }),
  });
  const contractRemindersQuery = useQuery({
    queryKey: ["hr-contract-expiry-reminders", 30],
    queryFn: () => api.listContractExpiryReminders({ days: 30 }),
  });
  const payrollSummaryQuery = useQuery({
    queryKey: ["payroll-dashboard-summary", "hr-page"],
    queryFn: () => api.getPayrollDashboardSummary({ contractWindowDays: 30 }),
  });

  const leaveQueue = leaveQueueQuery.data;
  const reminders = contractRemindersQuery.data;
  const payrollSummary = payrollSummaryQuery.data;
  const postingBacklog = [
    "GENERATED",
    "UNDER_REVIEW",
    "REVIEWED",
    "APPROVED",
  ].reduce(
    (total, status) =>
      total + (payrollSummary?.payrollRunsByStatus?.[status] ?? 0),
    0,
  );
  const latestRun = payrollSummary?.latestPayrollRun ?? null;
  const selectedRun = payrollSummary?.selectedPayrollRun ?? null;
  const remainingIssues = [
    "Payroll posting creates accounting accrual journals only; bank settlement remains intentionally unsupported.",
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ModuleHeader
        title="HR & Payroll"
        description="Manage staff records, leave, attendance, payroll runs, and payslips."
        primaryAction={
          <Link
            href="/dashboard/hr/staff"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <Users className="h-4 w-4" />
            Add Staff
          </Link>
        }
        moreActionItems={[
          {
            label: "Leave Queue",
            icon: <CalendarDays className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/hr/leave"),
          },
          {
            label: "Payroll Runs",
            icon: <History className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/payroll/runs"),
          },
          {
            label: "Payslips",
            icon: <FileText className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/payroll/payslips"),
          },
          {
            label: "Payroll Reports",
            icon: <BadgeCheck className="h-4 w-4" />,
            onClick: () => router.push("/dashboard/payroll/reports"),
          },
        ]}
      >
        <ModuleTabs items={moduleTabs} accentColor="purple" variant="light" />
      </ModuleHeader>

      <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Active Staff"
          value={
            payrollSummaryQuery.isError
              ? "Unavailable"
              : (payrollSummary?.activeStaffCount ?? 0)
          }
          icon={<Users className="h-5 w-5" />}
          loading={payrollSummaryQuery.isLoading}
          tone="neutral"
          description="Backend-owned staff count"
        />
        <KpiCard
          title="On Leave Today"
          value={
            payrollSummaryQuery.isError
              ? "Unavailable"
              : (payrollSummary?.onLeaveTodayCount ?? 0)
          }
          icon={<ClipboardCheck className="h-5 w-5" />}
          loading={payrollSummaryQuery.isLoading}
          tone="neutral"
          description="Approved leave scoped to today"
        />
        <KpiCard
          title="Pending Leave"
          value={unavailable(leaveQueueQuery.isError, leaveQueue?.pending)}
          icon={<AlertCircle className="h-5 w-5" />}
          loading={leaveQueueQuery.isLoading}
          href="/dashboard/hr/leave"
          tone={(leaveQueue?.pending ?? 0) > 0 ? "warning" : "success"}
          description={`${leaveQueue?.stalePending ?? 0} stale beyond ${leaveQueue?.staleDays ?? 7} days`}
        />
        <KpiCard
          title="Contract Expiring"
          value={unavailable(contractRemindersQuery.isError, reminders?.total)}
          icon={<Briefcase className="h-5 w-5" />}
          loading={contractRemindersQuery.isLoading}
          href="/dashboard/hr/contracts"
          tone={(reminders?.total ?? 0) > 0 ? "warning" : "success"}
          description={`Next ${reminders?.windowDays ?? 30} days`}
        />
        <KpiCard
          title="Payroll Exceptions"
          value={
            payrollSummaryQuery.isError
              ? "Unavailable"
              : (selectedRun?.validationExceptionCount ?? 0)
          }
          icon={<BadgeCheck className="h-5 w-5" />}
          loading={payrollSummaryQuery.isLoading}
          href="/dashboard/payroll/readiness"
          tone={
            (selectedRun?.validationExceptionsBySeverity.BLOCKING ?? 0) > 0
              ? "danger"
              : (selectedRun?.validationExceptionsBySeverity.WARNING ?? 0) > 0
                ? "warning"
                : "success"
          }
          description="Backend-owned readiness queue"
        />
        <KpiCard
          title="Payslips Generated"
          value={
            payrollSummaryQuery.isError
              ? "Unavailable"
              : selectedRun
                ? `${selectedRun.payslipGeneration.total}/${selectedRun.payslipGeneration.expected}`
                : "Unavailable"
          }
          icon={<FileText className="h-5 w-5" />}
          loading={payrollSummaryQuery.isLoading}
          tone="neutral"
          description="Selected payroll run"
        />
      </KpiGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="shell-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Leave Approval Queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pending leave requests from the approval queue endpoint.
              </p>
            </div>
            <Link
              href="/dashboard/hr/leave"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary-dark)] hover:text-slate-950"
            >
              Review Leave
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5">
            {leaveQueueQuery.isLoading ? (
              <LoadingState variant="spinner" label="Loading leave queue..." />
            ) : leaveQueueQuery.isError ? (
              <ErrorState
                title="Leave queue unavailable"
                message="The approval queue could not be loaded. Check your leave approval permission and retry."
                onRetry={() => void leaveQueueQuery.refetch()}
              />
            ) : leaveQueue?.preview?.length ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">Leave</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveQueue.preview.slice(0, 6).map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            {request.staffName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {request.employeeId ?? "No employee ID"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={request.leaveType}
                            tone={request.isPaid ? "info" : "partial"}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(request.startsOn)} -{" "}
                          {formatDate(request.endsOn)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                          {request.days}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Leave queue clear"
                description="There are no pending leave requests in the approval queue."
                icon={<CalendarDays className="h-7 w-7" />}
              />
            )}
          </div>
        </section>

        <section className="shell-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Contract Reminders
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Active contract and probation reminders for the next 30 days.
              </p>
            </div>
            <Link
              href="/dashboard/hr/contracts"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary-dark)] hover:text-slate-950"
            >
              Manage Contracts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5">
            {contractRemindersQuery.isLoading ? (
              <LoadingState
                variant="spinner"
                label="Loading contract reminders..."
              />
            ) : contractRemindersQuery.isError ? (
              <ErrorState
                title="Contract reminders unavailable"
                message="Contract reminders could not be loaded. Check your HR staff permission and retry."
                onRetry={() => void contractRemindersQuery.refetch()}
              />
            ) : reminders?.items?.length ? (
              <div className="space-y-3">
                {reminders.items.slice(0, 6).map((item) => (
                  <div
                    key={`${item.type}-${item.staffId}-${item.contractId ?? "probation"}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {item.staffName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.employeeId ?? "No employee ID"} ·{" "}
                          {item.position ?? "No position"}
                        </p>
                      </div>
                      <StatusBadge
                        status={item.type}
                        label={
                          item.type === "PROBATION_END"
                            ? "Probation"
                            : "Contract"
                        }
                        tone={
                          item.daysRemaining !== null && item.daysRemaining <= 7
                            ? "conflict"
                            : "pending"
                        }
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">
                        {formatDate(item.expiresAt)}
                      </span>
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          item.daysRemaining !== null && item.daysRemaining <= 7
                            ? "text-danger-700"
                            : "text-warning-700",
                        )}
                      >
                        {item.daysRemaining ?? "No"} days remaining
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No contract reminders"
                description="No active contracts or probation periods expire inside the configured reminder window."
                icon={<Briefcase className="h-7 w-7" />}
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <section className="shell-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Payroll Posting Boundary
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review, approve, and post payroll runs to accounting.
                Disbursement is not exposed here.
              </p>
            </div>
            <Link
              href="/dashboard/payroll/runs"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary-dark)] hover:text-slate-950"
            >
              Open Runs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {payrollSummaryQuery.isLoading ? (
              <LoadingState variant="spinner" label="Loading payroll runs..." />
            ) : payrollSummaryQuery.isError ? (
              <ErrorState
                title="Payroll runs unavailable"
                message="Payroll run statuses could not be loaded. Check your payroll permission and retry."
                onRetry={() => void payrollSummaryQuery.refetch()}
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Latest Run
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-900">
                        {latestRun
                          ? `${latestRun.periodMonth}/${latestRun.periodYear}`
                          : "No runs"}
                      </span>
                      <StatusBadge
                        status={latestRun?.status ?? "DRAFT"}
                        tone={latestRun ? undefined : "inactive"}
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Awaiting Action
                    </p>
                    <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">
                      {postingBacklog}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Review, approval, or posting statuses
                    </p>
                  </div>
                </div>
                {selectedRun ? (
                  <div className="rounded-2xl border border-slate-200">
                    <div className="divide-y divide-slate-100">
                      {[selectedRun].map((run) => (
                        <div
                          key={run.id}
                          className="flex flex-wrap items-center justify-between gap-3 p-4"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              {run.periodMonth}/{run.periodYear}
                            </p>
                            <p className="text-xs text-slate-500">
                              {run.postingReadiness.accountingJournalId
                                ? "Accounting journal linked"
                                : "No accounting journal linked"}
                            </p>
                          </div>
                          <StatusBadge status={run.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="shell-card p-6">
          <h2 className="text-lg font-black text-slate-950">Known Boundary</h2>
          <p className="mt-1 text-sm text-slate-500">
            Payroll settlement remains separate from the verified
            accrual-posting workflow.
          </p>
          <div className="mt-5 space-y-3">
            {remainingIssues.map((issue) => (
              <div
                key={issue}
                className="flex gap-3 rounded-2xl border border-warning-100 bg-warning-50 p-4 text-sm text-warning-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
