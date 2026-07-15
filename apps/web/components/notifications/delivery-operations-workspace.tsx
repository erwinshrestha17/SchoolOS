"use client";

import { formatBsDateTime, type PermissionKey } from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { communicationsApi } from "@/lib/api/communications";
import { useSession } from "@/components/session-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { ModuleHeader } from "@/components/ui/module-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TablePagination } from "@/components/ui/table-pagination";

const PAGE_SIZE = 25;

export function DeliveryOperationsWorkspace({
  initialView = "logs",
}: {
  initialView?: "logs" | "failures";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const permissions = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canView = permissions.has("notifications:view_delivery_diagnostics");
  const canRetry = permissions.has("notifications:retry_deliveries");
  const view = (searchParams.get("view") ?? initialView) as "logs" | "failures";
  const page = positiveNumber(searchParams.get("page"), 1);
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const sourceType = searchParams.get("sourceType") ?? "";
  const [retryId, setRetryId] = useState<string | null>(null);
  const [retryReason, setRetryReason] = useState("");

  const diagnostics = useQuery({
    queryKey: ["communications-provider-diagnostics"],
    queryFn: communicationsApi.getCommunicationsProviderDiagnostics,
    enabled: canView,
  });
  const logs = useQuery({
    queryKey: [
      "notification-deliveries",
      { page, status, channel, sourceType },
    ],
    queryFn: () =>
      communicationsApi.listNotificationDeliveryOperationPage({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        channel: channel || undefined,
        sourceType: sourceType || undefined,
      }),
    enabled: canView && view === "logs",
  });
  const failures = useQuery({
    queryKey: [
      "notification-delivery-failures",
      { page, status, channel, sourceType },
    ],
    queryFn: () =>
      communicationsApi.listNotificationDeliveryFailurePage({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        channel: channel || undefined,
        sourceType: sourceType || undefined,
      }),
    enabled: canView && view === "failures",
  });
  const retry = useMutation({
    mutationFn: () =>
      communicationsApi.retryNotificationDelivery(retryId!, {
        reason: retryReason.trim(),
      }),
    onSuccess: async () => {
      setRetryId(null);
      setRetryReason("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notification-deliveries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notification-delivery-failures"],
        }),
      ]);
    },
  });

  function setFilters(next: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" || value === 1) params.delete(key);
      else params.set(key, String(value));
    }
    router.replace(
      `${pathname}${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
  }

  const currentPage = view === "logs" ? logs.data : failures.data;
  const isLoading = view === "logs" ? logs.isLoading : failures.isLoading;
  const isError = view === "logs" ? logs.isError : failures.isError;

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M12 Notifications and Delivery"
        title={view === "logs" ? "Delivery logs" : "Failure and retry center"}
        description="Investigate bounded delivery metadata without exposing message bodies, destinations, provider payloads, credentials, tokens, or stack traces."
        secondaryActions={
          <div className="flex gap-2">
            <Link
              href="/dashboard/notices/deliveries"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
            >
              Delivery logs
            </Link>
            <Link
              href="/dashboard/notices/failures"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
            >
              Retry center
            </Link>
          </div>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">
            Provider mode: {diagnostics.data?.overallMode ?? "unavailable"}
          </p>
          <p className="mt-1">
            Mocked or disabled providers are never presented as confirmed
            external delivery.
          </p>
        </div>
      </div>

      <FilterBar
        label="Delivery filters"
        description="The server applies these filters to tenant-scoped delivery records. Provider and date-range filters are not offered because the current contract does not support them."
        filterSlot={
          <>
            <FilterSelect
              label="Status"
              value={status}
              options={[
                "",
                "QUEUED",
                "SENT",
                "DELIVERED",
                "FAILED",
                "RETRY_PENDING",
                "CANCELLED",
                "SKIPPED",
              ]}
              onChange={(value) => setFilters({ status: value, page: null })}
            />
            <FilterSelect
              label="Channel"
              value={channel}
              options={["", "IN_APP", "PUSH", "SMS", "EMAIL"]}
              onChange={(value) => setFilters({ channel: value, page: null })}
            />
            <FilterSelect
              label="Source"
              value={sourceType}
              options={[
                "",
                "notice",
                "notice_acknowledgement_follow_up",
                "event",
                "activity_post",
              ]}
              onChange={(value) =>
                setFilters({ sourceType: value, page: null })
              }
            />
          </>
        }
      />

      {!canView ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Your role cannot view delivery diagnostics.
        </p>
      ) : isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading server-paginated delivery records…
        </p>
      ) : isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          Delivery records could not be loaded. Current filters are preserved.
        </p>
      ) : currentPage?.items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No delivery records match these filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {view === "logs"
              ? logs.data!.items.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          status={item.status}
                          label={label(item.status)}
                        />
                        <StatusBadge
                          status={item.channel}
                          label={label(item.channel)}
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {label(item.sourceType)} delivery
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Queued {formatBsDateTime(item.queuedAt)}
                        {item.attemptedAt
                          ? ` · attempted ${formatBsDateTime(item.attemptedAt)}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {label(item.recipientType)} · {item.recipientLabel} ·{" "}
                      {item.retryCount} retries
                    </p>
                  </article>
                ))
              : failures.data!.items.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          status={item.status}
                          label={label(item.status)}
                        />
                        <StatusBadge
                          status={item.channel}
                          label={label(item.channel)}
                        />
                        <StatusBadge
                          status={item.retryStatus}
                          label={label(item.retryStatus)}
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {item.recipientSummary.destinationMasked ??
                          "Recipient unavailable"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.lastFailureReason ??
                          "No safe failure reason available."}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.retryCount} retries · failed{" "}
                        {item.failedAt
                          ? formatBsDateTime(item.failedAt)
                          : "time unavailable"}
                      </p>
                    </div>
                    {canRetry && item.retryStatus === "retryable" ? (
                      <button
                        type="button"
                        onClick={() => setRetryId(item.id)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold"
                      >
                        <RefreshCcw size={15} /> Retry
                      </button>
                    ) : null}
                  </article>
                ))}
          </div>
          <TablePagination
            page={currentPage?.page ?? page}
            pageSize={currentPage?.limit ?? PAGE_SIZE}
            total={currentPage?.total ?? 0}
            onPageChange={(nextPage) => setFilters({ page: nextPage })}
          />
        </div>
      )}

      {retry.isError ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle size={16} /> Retry was rejected or could not be queued.
          The delivery state was not changed in the browser.
        </p>
      ) : null}

      <ConfirmDialog
        isOpen={retryId !== null}
        title="Retry this delivery?"
        description="The backend will re-check tenant state, recipient policy, and retry eligibility before queueing."
        confirmLabel="Queue retry"
        confirmDisabled={!retryReason.trim()}
        isConfirming={retry.isPending}
        onClose={() => {
          if (!retry.isPending) {
            setRetryId(null);
            setRetryReason("");
          }
        }}
        onConfirm={() => retry.mutate()}
      >
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Reason
          <textarea
            value={retryReason}
            onChange={(event) => setRetryReason(event.target.value)}
            maxLength={500}
            rows={3}
            className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
            placeholder="Record why a manual retry is appropriate"
          />
        </label>
      </ConfirmDialog>
    </DashboardPageShell>
  );
}

function FilterSelect({
  label: filterLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {filterLabel}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 min-w-36"
      >
        {options.map((option) => (
          <option key={option || "ALL"} value={option}>
            {option ? label(option) : allFilterLabel(filterLabel)}
          </option>
        ))}
      </select>
    </label>
  );
}

function positiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function allFilterLabel(filterLabel: string) {
  if (filterLabel === 'Status') return 'All statuses';
  return `All ${filterLabel.toLowerCase()}s`;
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
