"use client";

import {
  AlertTriangle,
  ArrowRight,
  History,
  Receipt,
  RefreshCcw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  formatBsDate,
  formatBsDateTime,
  getNepalSchoolDay,
  NEPAL_TIME_ZONE,
} from "@schoolos/core";
import { useSession } from "@/components/session-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SummaryCard, SummaryGrid } from "@/components/ui/summary-card";
import { SectionCard } from "@/components/ui/section-card";
import { WorkSurface } from "@/components/ui/work-surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";

const formatCurrency = (amount: number | string) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

const closeStateLabel: Record<string, string> = {
  NOT_STARTED: "Not started",
  OPEN: "Open",
  CLOSED: "Closed",
};

export function FeeOverview() {
  const { hasPermissions } = useSession();
  const canCollect = hasPermissions(["payments:collect"]);
  const canManage = hasPermissions(["fees:manage"]);
  const canReadReceipts = hasPermissions(["receipts:read"]);
  const canClose = hasPermissions(["payments:close"]);
  const canReviewAdjustments =
    hasPermissions(["payments:refund"]) ||
    hasPermissions(["payments:reverse"]);
  const schoolDay = getNepalSchoolDay();

  const summaryQuery = useQuery({
    queryKey: ["finance-dashboard-summary", schoolDay.gregorianDate],
    queryFn: () =>
      api.getFinanceDashboardSummary({
        date: schoolDay.gregorianDate,
        timeZone: NEPAL_TIME_ZONE,
      }),
  });
  const receiptsQuery = useQuery({
    queryKey: ["receipts", "overview"],
    queryFn: () =>
      api.listReceiptsPage({
        page: 1,
        limit: 5,
        issuedFrom: schoolDay.startUtc.toISOString(),
        issuedTo: schoolDay.endExclusiveUtc.toISOString(),
      }),
    enabled: canReadReceipts,
  });
  const overdueQuery = useQuery({
    queryKey: ["defaulters", "overview"],
    queryFn: () =>
      api.listDefaulters({
        page: 1,
        limit: 5,
        sortBy: "dueDate",
        sortDirection: "asc",
      }),
    enabled: canManage,
  });

  const summary = summaryQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <SummaryGrid>
        <SummaryCard
          label="Collected today"
          value={
            summary
              ? formatCurrency(summary.collectedToday.netAmount)
              : summaryQuery.isError
                ? "Unavailable"
                : "Loading"
          }
          loading={summaryQuery.isLoading}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          href={canCollect ? "/dashboard/fees/collect" : undefined}
          description="Net confirmed collection."
        />
        <SummaryCard
          label="Total outstanding"
          value={
            summary
              ? formatCurrency(summary.outstanding.amount)
              : summaryQuery.isError
                ? "Unavailable"
                : "Loading"
          }
          loading={summaryQuery.isLoading}
          icon={<Wallet className="h-5 w-5" />}
          tone="module"
          href={canManage ? "/dashboard/fees/invoices?outstanding=true" : undefined}
          description="Backend-owned balance."
        />
        <SummaryCard
          label="Overdue"
          value={
            !canManage
              ? "Restricted"
              : summary
                ? formatCurrency(summary.overdue.amount)
                : summaryQuery.isError
                  ? "Unavailable"
                  : "Loading"
          }
          loading={canManage && summaryQuery.isLoading}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={summary?.overdue.studentCount ? "warning" : "module"}
          href={canManage ? "/dashboard/fees/reports?agingBucket=all" : undefined}
          description={
            summary ? `${summary.overdue.studentCount} students.` : "Aging summary."
          }
        />
        <SummaryCard
          label="Cashier close"
          value={
            !canClose
              ? "Restricted"
              : summary
                ? closeStateLabel[summary.cashierClose.state] ??
                  summary.cashierClose.state
                : summaryQuery.isError
                  ? "Unavailable"
                  : "Loading"
          }
          loading={canClose && summaryQuery.isLoading}
          icon={<History className="h-5 w-5" />}
          tone={summary?.cashierClose.state === "OPEN" ? "warning" : "module"}
          href={canClose ? "/dashboard/fees/cashier-close" : undefined}
          description="School-day close state."
        />
      </SummaryGrid>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>
          {summary
            ? `As of ${formatBsDateTime(summary.generatedAt)}`
            : `School day ${formatBsDate(schoolDay.startUtc)}`}
        </span>
        <button
          type="button"
          onClick={() => void summaryQuery.refetch()}
          disabled={summaryQuery.isFetching}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 font-semibold text-[var(--color-mod-fees-text)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)] disabled:opacity-50"
        >
          <RefreshCcw
            className={`h-4 w-4 ${summaryQuery.isFetching ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </button>
      </div>

      {summaryQuery.isError ? (
        <ErrorState
          title="Fees overview could not refresh"
          message="No finance value has been replaced with zero. Retry to load the latest backend summary."
          onRetry={() => void summaryQuery.refetch()}
          className="min-h-48"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <WorkSurface
            title="Today's collection activity"
            description="Confirmed backend totals for the current Nepal school day."
            action={
              canCollect ? (
                <Link
                  href="/dashboard/fees/collect"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--color-mod-fees-text)] hover:bg-[var(--color-mod-fees-bg)]"
                >
                  Collect payment <ArrowRight className="h-4 w-4" />
                </Link>
              ) : undefined
            }
            variant="transaction"
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Activity</th>
                    <th className="px-5 py-3 text-right">Amount (NPR)</th>
                    <th className="px-5 py-3 text-right">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  <ActivityRow
                    label="Gross confirmed collections"
                    amount={summary ? formatCurrency(summary.collectedToday.grossAmount) : "Unavailable"}
                    context={summary ? `${summary.receiptsIssued} receipts issued` : "Backend summary"}
                  />
                  <ActivityRow
                    label="Confirmed refunds"
                    amount={summary ? formatCurrency(summary.collectedToday.refundedAmount) : "Unavailable"}
                    context="Included in net collection"
                  />
                  <ActivityRow
                    label="Net confirmed collection"
                    amount={summary ? formatCurrency(summary.collectedToday.netAmount) : "Unavailable"}
                    context="Official school-day position"
                    emphasized
                  />
                </tbody>
              </table>
            </div>
          </WorkSurface>

          <SectionCard
            title="Overdue follow-up"
            description="Highest-age invoices from the server-paginated defaulter queue."
            headerAction={
              canManage ? (
                <Link
                  href="/dashboard/fees/reports?agingBucket=all"
                  className="text-sm font-semibold text-[var(--color-mod-fees-text)] hover:underline"
                >
                  View overdue queue
                </Link>
              ) : undefined
            }
            noPadding
          >
            {!canManage ? (
              <p className="p-6 text-sm text-slate-600">
                Overdue student details are restricted for this role.
              </p>
            ) : overdueQuery.isError ? (
              <ErrorState
                title="Overdue follow-up is unavailable"
                message="Retry to load the current server-filtered queue."
                onRetry={() => void overdueQuery.refetch()}
                className="m-5 min-h-44"
              />
            ) : overdueQuery.isLoading ? (
              <p className="p-6 text-sm font-semibold text-slate-500">Loading overdue invoices…</p>
            ) : overdueQuery.data?.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Invoice</th>
                      <th className="px-5 py-3">Due date</th>
                      <th className="px-5 py-3 text-right">Days overdue</th>
                      <th className="px-5 py-3 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {overdueQuery.data.items.map((item) => (
                      <tr key={item.invoiceId} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {item.studentName}
                          <span className="block text-xs font-normal text-slate-500">
                            {[item.className, item.sectionName].filter(Boolean).join(" · ")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">{item.invoiceNumber}</td>
                        <td className="px-5 py-3.5 text-slate-600">{formatBsDate(item.dueDate)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-700">{item.daysOverdue}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                          {formatCurrency(item.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No overdue invoices"
                description="The backend did not return any overdue invoices for the current queue."
                className="m-5 min-h-48"
              />
            )}
          </SectionCard>

          <SectionCard
            title="Recent receipts"
            description="Confirmed receipts for the current school day."
            headerAction={
              canReadReceipts ? (
                <Link
                  href="/dashboard/fees/receipts"
                  className="text-sm font-semibold text-[var(--color-mod-fees-text)] hover:underline"
                >
                  View receipts
                </Link>
              ) : undefined
            }
            noPadding
          >
            {!canReadReceipts ? (
              <p className="p-6 text-sm text-slate-600">Receipt details are restricted for this role.</p>
            ) : receiptsQuery.isError ? (
              <ErrorState
                title="Recent receipts are unavailable"
                message="No receipt has been replaced with a placeholder. Retry to load the protected receipt list."
                onRetry={() => void receiptsQuery.refetch()}
                className="m-5 min-h-44"
              />
            ) : receiptsQuery.isLoading ? (
              <p className="p-6 text-sm font-semibold text-slate-500">Loading protected receipts…</p>
            ) : receiptsQuery.data?.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Receipt</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Invoice</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3">Method</th>
                      <th className="px-5 py-3">Issued</th>
                      <th className="px-5 py-3">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {receiptsQuery.data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">{item.receiptNumber}</td>
                        <td className="px-5 py-3.5 text-slate-700">{item.student?.name ?? "Student unavailable"}</td>
                        <td className="px-5 py-3.5 text-slate-600">{item.invoiceNumber ?? "Unavailable"}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                          {typeof item.amount === "number" ? formatCurrency(item.amount) : "Unavailable"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{item.method ?? "Unavailable"}</td>
                        <td className="px-5 py-3.5 text-slate-600">{formatBsDateTime(item.issuedAt)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={item.fileStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No receipts issued today"
                description="Confirmed receipts will appear here after a payment succeeds."
                icon={<Receipt className="h-7 w-7" />}
                className="m-5 min-h-48"
              />
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Attention required" description="Permission-safe finance work that needs a decision.">
            <div className="divide-y divide-slate-100">
              <AttentionRow
                label="Overdue students"
                value={canManage && summary ? String(summary.overdue.studentCount) : canManage ? "Unavailable" : "Restricted"}
                href={canManage ? "/dashboard/fees/reports?agingBucket=all" : undefined}
                tone={summary?.overdue.studentCount ? "warning" : "neutral"}
              />
              <AttentionRow
                label="Pending adjustments"
                value={canReviewAdjustments && summary ? String(summary.pendingApprovalCount) : canReviewAdjustments ? "Unavailable" : "Restricted"}
                href={canReviewAdjustments ? "/dashboard/fees/adjustments?status=PENDING" : undefined}
                tone={summary?.pendingApprovalCount ? "warning" : "neutral"}
              />
              <AttentionRow
                label="Unclosed payments"
                value={canClose && summary ? String(summary.cashierClose.unclosedPaymentCount) : canClose ? "Unavailable" : "Restricted"}
                href={canClose ? "/dashboard/fees/cashier-close" : undefined}
                tone={summary?.cashierClose.unclosedPaymentCount ? "warning" : "neutral"}
              />
            </div>
          </SectionCard>

          <SectionCard title="Cashier activity" description="Backend-owned close state for this school day.">
            {!canClose ? (
              <p className="text-sm text-slate-600">Cashier close details are restricted for this role.</p>
            ) : summary ? (
              <dl className="space-y-3 text-sm">
                <OverviewFact label="Status" value={closeStateLabel[summary.cashierClose.state] ?? summary.cashierClose.state} />
                <OverviewFact label="Unclosed payments" value={String(summary.cashierClose.unclosedPaymentCount)} />
                <OverviewFact label="Latest close" value={summary.cashierClose.latestCloseNumber ?? "Not closed yet"} />
                <OverviewFact
                  label="Closed at"
                  value={
                    summary.cashierClose.latestClosedAt
                      ? formatBsDateTime(summary.cashierClose.latestClosedAt)
                      : "Not available"
                  }
                />
                <Link
                  href="/dashboard/fees/cashier-close"
                  className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--color-mod-fees-text)] hover:underline"
                >
                  Open cashier close <ArrowRight className="h-4 w-4" />
                </Link>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">Cashier close status is unavailable.</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  label,
  amount,
  context,
  emphasized = false,
}: {
  label: string;
  amount: string;
  context: string;
  emphasized?: boolean;
}) {
  return (
    <tr className={emphasized ? "bg-slate-50" : undefined}>
      <td className={`px-5 py-4 ${emphasized ? "font-semibold text-slate-950" : "text-slate-700"}`}>{label}</td>
      <td className={`px-5 py-4 text-right ${emphasized ? "font-bold text-slate-950" : "font-semibold text-slate-900"}`}>{amount}</td>
      <td className="px-5 py-4 text-right text-xs text-slate-500">{context}</td>
    </tr>
  );
}

function AttentionRow({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone: "warning" | "neutral";
}) {
  const content = (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${tone === "warning" ? "text-warning-700" : "text-slate-700"}`}>{value}</span>
    </div>
  );
  return href ? <Link href={href} className="block hover:bg-slate-50">{content}</Link> : content;
}

function OverviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}
