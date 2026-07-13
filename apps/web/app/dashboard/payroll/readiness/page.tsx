"use client";

import type {
  PayrollExceptionSeverity,
  PayrollExceptionStatus,
  PayrollExceptionSummary,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  Info,
  RefreshCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSession } from "../../../../components/session-provider";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { EmptyState } from "../../../../components/ui/empty-state";
import { ErrorState } from "../../../../components/ui/error-state";
import { Input } from "../../../../components/ui/input";
import { KpiCard, KpiGrid } from "../../../../components/ui/kpi-card";
import { LoadingState } from "../../../../components/ui/loading-state";
import { Select } from "../../../../components/ui/select";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { TablePagination } from "../../../../components/ui/table-pagination";
import { api } from "../../../../lib/api";

const PAGE_SIZE = 25;

const severityTone: Record<
  PayrollExceptionSeverity,
  "rejected" | "partial" | "info"
> = {
  BLOCKING: "rejected",
  WARNING: "partial",
  INFO: "info",
};

export default function PayrollReadinessPage() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<PayrollExceptionSeverity | "">("");
  const [status, setStatus] = useState<PayrollExceptionStatus | "">("");
  const [acknowledging, setAcknowledging] =
    useState<PayrollExceptionSummary | null>(null);
  const [reason, setReason] = useState("");

  const params = {
    year,
    month,
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    severity: severity || undefined,
    status: status || undefined,
  };
  const query = useQuery({
    queryKey: ["payroll-exceptions", params],
    queryFn: () => api.listPayrollExceptions(params),
  });
  const canReview =
    session?.user.permissions.includes("payroll:run:review") ?? false;
  const recheckMutation = useMutation({
    mutationFn: () => api.recheckPayrollReadiness({ year, month }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payroll-exceptions"] });
      await queryClient.invalidateQueries({
        queryKey: ["payroll-dashboard-summary"],
      });
    },
  });
  const acknowledgeMutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      api.acknowledgePayrollException(input.id, input.reason),
    onSuccess: async () => {
      setAcknowledging(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["payroll-exceptions"] });
      await queryClient.invalidateQueries({
        queryKey: ["payroll-dashboard-summary"],
      });
    },
  });
  const readiness = query.data?.readiness;

  function applyPeriod(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void query.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary-dark)]">
            Backend-owned readiness
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">
            Payroll readiness and exceptions
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Resolve blocking source-data issues before payroll moves forward.
            Warnings require an audited acknowledgement; resolved items stay in
            history.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!canReview}
          isLoading={recheckMutation.isPending}
          onClick={() => recheckMutation.mutate()}
        >
          <RefreshCcw className="h-4 w-4" />
          Recheck source data
        </Button>
      </div>

      <form
        onSubmit={applyPeriod}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[130px_150px_minmax(220px,1fr)_170px_170px_auto]"
      >
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Year
          <Input
            className="mt-1"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Month
          <Select
            className="mt-1"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </Select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Search
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Staff, employee ID, or issue"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Severity
          <Select
            className="mt-1"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value as PayrollExceptionSeverity | "");
              setPage(1);
            }}
          >
            <option value="">All severities</option>
            <option value="BLOCKING">Blocking</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Information</option>
          </Select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Status
          <Select
            className="mt-1"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PayrollExceptionStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </label>
        <Button type="submit" className="self-end">
          Apply period
        </Button>
      </form>

      {recheckMutation.isError ? (
        <ErrorState
          className="min-h-40"
          title="Readiness could not be rechecked"
          message="Check your payroll review permission and try again. Existing results remain unchanged."
        />
      ) : null}

      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Readiness"
          value={
            query.isError
              ? "Unavailable"
              : (readiness?.readinessStatus.replaceAll("_", " ") ?? "Loading")
          }
          icon={<BadgeCheck className="h-5 w-5" />}
          loading={query.isLoading}
          tone={readiness?.readinessStatus === "READY" ? "success" : "warning"}
          description={
            readiness?.stale
              ? "Source data needs recheck"
              : "Calculated by the backend"
          }
        />
        <KpiCard
          title="Staff considered"
          value={
            query.isError ? "Unavailable" : (readiness?.staffConsidered ?? 0)
          }
          icon={<BadgeCheck className="h-5 w-5" />}
          loading={query.isLoading}
          tone="neutral"
          description={`${readiness?.staffExcluded ?? 0} excluded from the selected run`}
        />
        <KpiCard
          title="Blocking"
          value={
            query.isError
              ? "Unavailable"
              : (readiness?.blockingExceptionCount ?? 0)
          }
          icon={<CircleAlert className="h-5 w-5" />}
          loading={query.isLoading}
          tone={
            (readiness?.blockingExceptionCount ?? 0) > 0 ? "danger" : "success"
          }
          description="Must be fixed at the source"
        />
        <KpiCard
          title="Warnings"
          value={query.isError ? "Unavailable" : (readiness?.warningCount ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          loading={query.isLoading}
          tone={(readiness?.warningCount ?? 0) > 0 ? "warning" : "success"}
          description="Open warnings need acknowledgement"
        />
        <KpiCard
          title="Information"
          value={
            query.isError ? "Unavailable" : (readiness?.informationalCount ?? 0)
          }
          icon={<Info className="h-5 w-5" />}
          loading={query.isLoading}
          tone="info"
          description={`Next action: ${readiness?.allowedNextAction?.replaceAll("_", " ") ?? "Resolve blockers"}`}
        />
      </KpiGrid>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-950">
            Exception queue and history
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Each active issue links to the workspace that owns its source data.
          </p>
        </div>
        {query.isLoading ? (
          <LoadingState
            variant="spinner"
            label="Checking payroll source data..."
          />
        ) : query.isError ? (
          <ErrorState
            title="Payroll readiness unavailable"
            message="The backend-owned exception queue could not be loaded. Check your payroll permission and retry."
            onRetry={() => void query.refetch()}
          />
        ) : query.data?.items.length ? (
          <>
            <div className="divide-y divide-slate-100">
              {query.data.items.map((exception) => (
                <article
                  key={exception.id}
                  className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={exception.severity}
                        tone={severityTone[exception.severity]}
                      />
                      <StatusBadge status={exception.status} />
                      <span className="text-xs font-bold text-slate-400">
                        {exception.code.replaceAll("_", " ")}
                      </span>
                    </div>
                    <h3 className="mt-3 font-black text-slate-950">
                      {exception.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {exception.safeMessage}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span>
                        Staff: {exception.staffName ?? "Run-level issue"}
                        {exception.employeeId
                          ? ` (${exception.employeeId})`
                          : ""}
                      </span>
                      <span>
                        Department: {exception.department ?? "Not assigned"}
                      </span>
                      <span>
                        Blocks:{" "}
                        {exception.blockedActions.length
                          ? exception.blockedActions
                              .join(", ")
                              .replaceAll("_", " ")
                          : "No workflow action"}
                      </span>
                    </div>
                    {exception.resolutionReason ? (
                      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Audit note: {exception.resolutionReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {exception.resolutionRoute &&
                    exception.status !== "RESOLVED" ? (
                      <Link
                        href={exception.resolutionRoute}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                      >
                        Resolve at source
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    ) : null}
                    {exception.severity === "WARNING" &&
                    exception.status === "OPEN" &&
                    canReview ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setAcknowledging(exception)}
                      >
                        Acknowledge warning
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <TablePagination
              page={query.data.page}
              pageSize={query.data.limit}
              total={query.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            title="No exceptions match these filters"
            description="The selected payroll period has no matching open or historical exception records."
            icon={<BadgeCheck className="h-7 w-7" />}
          />
        )}
      </section>

      <Dialog
        open={Boolean(acknowledging)}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setAcknowledging(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge payroll warning</DialogTitle>
            <DialogDescription className="mt-2">
              This does not resolve the source condition. The reason and user
              are recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <label className="text-sm font-bold text-slate-700">
              Acknowledgement reason
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                minLength={10}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why payroll may continue with this warning."
              />
            </label>
            {acknowledgeMutation.isError ? (
              <p
                role="alert"
                className="mt-3 text-sm font-medium text-danger-700"
              >
                The warning could not be acknowledged. Check the reason and your
                payroll review permission.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAcknowledging(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={reason.trim().length < 10 || !acknowledging}
              isLoading={acknowledgeMutation.isPending}
              onClick={() => {
                if (acknowledging) {
                  acknowledgeMutation.mutate({
                    id: acknowledging.id,
                    reason: reason.trim(),
                  });
                }
              }}
            >
              Confirm acknowledgement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
