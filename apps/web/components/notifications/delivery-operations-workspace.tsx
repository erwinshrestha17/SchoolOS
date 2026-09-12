"use client";

import { formatBsDateTime } from "@schoolos/core";
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
  const { session, hasPermissions } = useSession();
  const isSupportOverride = session?.user.isSupportOverride === true;
  // Alias-aware, matching the guard: delivery diagnostics is also satisfied
  // by `communications:read_deliveries`, and retry by
  // `communications:retry_deliveries`.
  const canView = hasPermissions(["notifications:view_delivery_diagnostics"]);
  const canRetry =
    !isSupportOverride && hasPermissions(["notifications:retry_deliveries"]);
  const view = (searchParams.get("view") ?? initialView) as "logs" | "failures";
  const page = positiveNumber(searchParams.get("page"), 1);
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const sourceType = searchParams.get("sourceType") ?? "";
  const effectiveSourceType = isSupportOverride ? "" : sourceType;
  const [retryId, setRetryId] = useState<string | null>(null);
  const [retryReason, setRetryReason] = useState("");
  const [retryTarget, setRetryTarget] = useState("");

  const diagnostics = useQuery({
    queryKey: ["communications-provider-diagnostics"],
    queryFn: communicationsApi.getCommunicationsProviderDiagnostics,
    enabled: canView,
  });
  const logs = useQuery({
    queryKey: [
      "notification-deliveries",
      { page, status, channel, sourceType: effectiveSourceType },
    ],
    queryFn: () =>
      communicationsApi.listNotificationDeliveryOperationPage({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        channel: channel || undefined,
        sourceType: effectiveSourceType || undefined,
      }),
    enabled: canView && view === "logs",
  });
  const failures = useQuery({
    queryKey: [
      "notification-delivery-failures",
      { page, status, channel, sourceType: effectiveSourceType },
    ],
    queryFn: () =>
      communicationsApi.listNotificationDeliveryFailurePage({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        channel: channel || undefined,
        sourceType: effectiveSourceType || undefined,
      }),
    enabled: canView && view === "failures",
  });
  const retry = useMutation({
    mutationFn: ({
      deliveryId,
      reason,
    }: {
      deliveryId: string;
      reason: string;
    }) => communicationsApi.retryNotificationDelivery(deliveryId, { reason }),
    // A timeout can follow a committed retry. Refresh after every outcome;
    // never infer that an error means no state changed or resend automatically.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notification-deliveries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notification-delivery-failures"],
        }),
      ]),
  });
  const selectedFailure = failures.data?.items.find(
    (item) => item.id === retryId,
  );
  const canSubmitRetry =
    canRetry &&
    !retry.isSuccess &&
    !failures.isFetching &&
    !failures.isError &&
    selectedFailure?.retryStatus === "retryable";

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
        eyebrow="Notifications"
        title={view === "logs" ? "Delivery logs" : "Failure and retry center"}
        description={
          isSupportOverride
            ? "Read-only masked delivery diagnostics. Message content, full destinations, retry actions, and provider credentials remain protected."
            : "Review delivery status and retry eligible failures. Message content and contact details remain protected."
        }
        secondaryActions={
          <div className="flex gap-2">
            <Link
              href="/dashboard/notifications/deliveries"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
            >
              Delivery logs
            </Link>
            <Link
              href="/dashboard/notifications/failures"
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
            {!isSupportOverride ? (
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
            ) : null}
          </>
        }
      />

      {!canView ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Your role cannot view delivery diagnostics.
        </p>
      ) : isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading delivery records…
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
                        onClick={() => {
                          retry.reset();
                          setRetryReason("");
                          setRetryTarget(
                            `${label(item.channel)} · ${item.recipientSummary.destinationMasked ?? "Recipient unavailable"}`,
                          );
                          setRetryId(item.id);
                        }}
                        disabled={retry.isPending || failures.isFetching}
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

      {retryId === null && retry.isSuccess ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
        >
          {retryTarget}:{" "}
          {retryResultMessage(
            retry.data.status,
            Boolean(retry.data.errorMessage),
          )}
        </p>
      ) : null}

      <ConfirmDialog
        isOpen={retryId !== null}
        title="Retry this delivery?"
        description="School access, recipient policy, and retry eligibility will be checked again before this delivery is queued."
        confirmLabel="Queue retry"
        confirmDisabled={!retryReason.trim() || !canSubmitRetry}
        isConfirming={retry.isPending}
        preventCloseWhileConfirming
        cancelLabel={retry.isSuccess ? "Close" : "Cancel"}
        onClose={() => {
          if (!retry.isPending) {
            setRetryId(null);
            setRetryReason("");
          }
        }}
        onConfirm={() => {
          if (retryId && canSubmitRetry && retryReason.trim()) {
            retry.mutate({ deliveryId: retryId, reason: retryReason.trim() });
          }
        }}
      >
        <div className="space-y-3 p-6">
          <p className="text-sm font-semibold text-slate-700">{retryTarget}</p>
          {retry.isError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertTriangle size={16} className="mr-2 inline" aria-hidden />
              The retry outcome could not be confirmed. The delivery may already
              have changed. Your reason is preserved; check the refreshed status
              before retrying.
            </p>
          ) : retry.isSuccess ? (
            <p
              role="status"
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            >
              {retryResultMessage(
                retry.data.status,
                Boolean(retry.data.errorMessage),
              )}{" "}
              Your reason is preserved until you close this review. Review the
              refreshed delivery record before starting another retry.
            </p>
          ) : null}
          {(retry.isError || retry.isSuccess) && !retry.isPending ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                {failures.isError
                  ? "Current retry eligibility is unavailable. Refresh before taking further action."
                  : selectedFailure
                    ? `Current state: ${label(selectedFailure.status)} · ${label(selectedFailure.retryStatus)}.`
                    : "This delivery is no longer in the current failure page. Check delivery logs for its current state."}
              </p>
              <button
                type="button"
                disabled={failures.isFetching}
                onClick={() => void failures.refetch()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50"
              >
                <RefreshCcw size={15} aria-hidden /> Refresh delivery status
              </button>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Reason
            <textarea
              value={retryReason}
              disabled={retry.isPending}
              readOnly={retry.isSuccess}
              onChange={(event) => setRetryReason(event.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
              placeholder="Record why a manual retry is appropriate"
            />
          </label>
        </div>
      </ConfirmDialog>
    </DashboardPageShell>
  );
}

function retryResultMessage(status: string, hasDiagnostic: boolean) {
  if (["QUEUED", "RETRY_PENDING", "RETRYING", "PENDING"].includes(status)) {
    if (hasDiagnostic) {
      return "The saved delivery is pending, but queue handoff or processing needs review. Do not assume this retry reached the provider.";
    }
    return "The saved delivery is pending. This does not confirm delivery to the recipient.";
  }
  if (status === "DELIVERED") return "The saved delivery status is Delivered.";
  if (status === "SENT") {
    return "The saved delivery status is Sent, not confirmation that the recipient received or read it.";
  }
  if (status === "FAILED")
    return "The delivery is still failed and needs review.";
  if (status === "CANCELLED")
    return "The delivery is cancelled. No new retry is confirmed.";
  if (status === "SKIPPED")
    return "The delivery was skipped. No successful delivery is confirmed.";
  return "The response did not confirm a recognized delivery outcome. Check delivery logs before retrying.";
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
  if (filterLabel === "Status") return "All statuses";
  return `All ${filterLabel.toLowerCase()}s`;
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
