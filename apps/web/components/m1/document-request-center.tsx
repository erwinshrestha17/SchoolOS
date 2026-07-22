"use client";

import type {
  AdmissionDocumentReminderBatchResult,
  AdmissionDocumentReminderSkipReason,
  AdmissionDocumentRequestItem,
  AdmissionDocumentTiming,
} from "@schoolos/core";
import { formatBsDate } from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  Phone,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { admissionCasesApi } from "../../lib/api/admission-cases";
import { admissionPoliciesApi } from "../../lib/api/admission-policies";
import {
  classOptionLabel,
  educationProgramLabel,
} from "../../lib/education-program";
import { api } from "../../lib/api";
import { useUrlFilters } from "../../lib/hooks/use-url-filters";
import { ApiRequestError } from "../../lib/api/client";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { KpiCard, KpiGrid } from "../ui/kpi-card";
import { ModuleLockedState } from "../ui/module-locked-state";
import { PageState } from "../ui/page-state";
import { StatusBadge } from "../ui/status-badge";
import { useSession } from "../session-provider";

const DOCUMENT_KIND_OPTIONS = [
  "BIRTH_CERTIFICATE",
  "TRANSFER_CERTIFICATE",
  "PRIOR_MARKSHEET",
  "PREVIOUS_REPORT_CARD",
  "CITIZENSHIP",
  "MEDICAL_REPORT",
  "PHOTO",
  "OTHER",
];

const PENDING_DAY_OPTIONS = [0, 3, 7, 14, 30];

const REMINDER_SKIP_COPY: Record<AdmissionDocumentReminderSkipReason, string> =
  {
    CASE_UNAVAILABLE: "Case unavailable",
    CASE_CLOSED: "Case closed",
    NO_GUARDIAN_PHONE: "No guardian phone",
    NO_LONGER_MISSING: "Documents already complete",
    DELIVERY_UNAVAILABLE: "Delivery unavailable",
  };

export function DocumentRequestCenter() {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const [filters, setFilters] = useUrlFilters({
    policyId: "",
    classId: "",
    documentKind: "",
    timing: "",
    minDaysPending: 0,
    page: 1,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderResult, setReminderResult] =
    useState<AdmissionDocumentReminderBatchResult | null>(null);

  const requestQuery = useQuery({
    queryKey: ["admission-document-requests", filters],
    queryFn: () =>
      admissionCasesApi.listDocumentRequests({
        policyId: filters.policyId || undefined,
        classId: filters.classId || undefined,
        documentKind: filters.documentKind || undefined,
        timing: filters.timing as AdmissionDocumentTiming | "",
        minDaysPending:
          filters.minDaysPending > 0 ? filters.minDaysPending : undefined,
        page: filters.page,
        limit: 25,
      }),
  });
  const policiesQuery = useQuery({
    queryKey: ["admission-policies"],
    queryFn: admissionPoliciesApi.list,
  });
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });

  const rows = useMemo(
    () => requestQuery.data?.items ?? [],
    [requestQuery.data?.items],
  );
  const allPageRowsSelected =
    rows.length > 0 &&
    rows.every((row) => selectedIds.has(row.admissionCaseId));
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.admissionCaseId)),
    [rows, selectedIds],
  );
  const selectedWithPhones = selectedRows.filter((row) => row.guardianPhone);
  const canQueueReminders = hasPermissions([
    "students:manage_lifecycle",
    "guardians:read",
  ]);

  useEffect(() => {
    setSelectedIds(new Set());
    setReminderResult(null);
  }, [
    filters.classId,
    filters.documentKind,
    filters.minDaysPending,
    filters.page,
    filters.policyId,
    filters.timing,
  ]);

  const reminderMutation = useMutation({
    mutationFn: (admissionCaseIds: string[]) =>
      admissionCasesApi.requestDocumentReminders(admissionCaseIds),
    onSuccess: async (result) => {
      setReminderDialogOpen(false);
      setReminderResult(result);
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({
        queryKey: ["admission-document-requests"],
      });
    },
    onError: () => setReminderResult(null),
  });

  function updateSelected(caseId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(caseId);
      else next.delete(caseId);
      return next;
    });
  }

  function togglePageRows(selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of rows) {
        if (selected) next.add(row.admissionCaseId);
        else next.delete(row.admissionCaseId);
      }
      return next;
    });
  }

  if (requestQuery.isError) {
    return (
      <DocumentRequestFailure
        error={requestQuery.error}
        onRetry={() => void requestQuery.refetch()}
      />
    );
  }

  const summary = requestQuery.data?.summary;

  return (
    <section className="space-y-5">
      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Cases"
          loading={requestQuery.isLoading}
          value={summary?.casesWithRequests ?? "Unavailable"}
          icon={<FileWarning size={18} />}
          tone={(summary?.casesWithRequests ?? 0) > 0 ? "warning" : "neutral"}
          description="Cases with at least one missing required document."
        />
        <KpiCard
          title="Missing Documents"
          loading={requestQuery.isLoading}
          value={summary?.totalMissingDocuments ?? "Unavailable"}
          icon={<FileWarning size={18} />}
          tone={
            (summary?.totalMissingDocuments ?? 0) > 0 ? "warning" : "neutral"
          }
          description="Backend-counted missing requirements in the current filter."
        />
        <KpiCard
          title="Before Review"
          loading={requestQuery.isLoading}
          value={summary?.beforeReviewDocuments ?? "Unavailable"}
          icon={<FileWarning size={18} />}
          tone={
            (summary?.beforeReviewDocuments ?? 0) > 0 ? "danger" : "neutral"
          }
          description="Requirements due before review."
        />
        <KpiCard
          title="Oldest Pending"
          loading={requestQuery.isLoading}
          value={
            summary
              ? `${summary.oldestDaysPending} day${summary.oldestDaysPending === 1 ? "" : "s"}`
              : "Unavailable"
          }
          icon={<RefreshCw size={18} />}
          tone={(summary?.oldestDaysPending ?? 0) >= 7 ? "warning" : "neutral"}
          description="Age of the oldest matching document request."
        />
        <KpiCard
          title="No Phone"
          loading={requestQuery.isLoading}
          value={summary?.casesWithoutGuardianPhone ?? "Unavailable"}
          icon={<Phone size={18} />}
          tone={
            (summary?.casesWithoutGuardianPhone ?? 0) > 0
              ? "warning"
              : "neutral"
          }
          description="Cases without a guardian phone for reminder follow-up."
        />
      </KpiGrid>

      {requestQuery.data && !requestQuery.data.scanComplete ? (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm font-semibold text-warning-900">
          More than 500 open/admitted cases matched the scan. Totals are a lower
          bound; narrow the filters before using this as a full reminder list.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_180px_160px]">
          <label className="block text-sm font-bold text-slate-700">
            Policy
            <select
              value={filters.policyId}
              onChange={(event) =>
                setFilters(
                  { policyId: event.target.value },
                  { resetPage: true },
                )
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All policies</option>
              {(policiesQuery.data?.policies ?? []).map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Class
            <select
              value={filters.classId}
              onChange={(event) =>
                setFilters({ classId: event.target.value }, { resetPage: true })
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All classes</option>
              {(classesQuery.data ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {classOptionLabel(schoolClass)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Document
            <select
              value={filters.documentKind}
              onChange={(event) =>
                setFilters(
                  { documentKind: event.target.value },
                  { resetPage: true },
                )
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All documents</option>
              {DOCUMENT_KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {humanize(kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Timing
            <select
              value={filters.timing}
              onChange={(event) =>
                setFilters({ timing: event.target.value }, { resetPage: true })
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Any timing</option>
              <option value="BEFORE_REVIEW">Before review</option>
              <option value="BEFORE_ENROLLMENT">Before enrollment</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Pending
            <select
              value={filters.minDaysPending}
              onChange={(event) =>
                setFilters(
                  { minDaysPending: Number(event.target.value) },
                  { resetPage: true },
                )
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {PENDING_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days === 0 ? "Any age" : `${days}+ days`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-black text-slate-950">
            Missing document requests
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {selectedRows.length
              ? `${selectedRows.length} selected; ${selectedWithPhones.length} have guardian phones.`
              : "Select cases for reminder follow-up."}
          </p>
          {!canQueueReminders ? (
            <p
              id="reminder-permission-note"
              className="mt-1 text-xs font-semibold text-slate-500"
            >
              You do not have permission to queue guardian reminders.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!rows.length}
            onClick={() => togglePageRows(!allPageRowsSelected)}
          >
            {allPageRowsSelected ? "Clear page" : "Select page"}
          </Button>
          <Button
            type="button"
            disabled={
              !canQueueReminders ||
              selectedRows.length === 0 ||
              reminderMutation.isPending
            }
            aria-describedby={
              canQueueReminders ? undefined : "reminder-permission-note"
            }
            onClick={() => {
              reminderMutation.reset();
              setReminderDialogOpen(true);
            }}
          >
            {reminderMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Queue reminders
          </Button>
        </div>
      </div>

      {reminderResult ? <ReminderBatchResult result={reminderResult} /> : null}

      {reminderMutation.isError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-900"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Reminders were not queued.</p>
            <p className="mt-1">
              {reminderErrorMessage(reminderMutation.error)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {requestQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading document requests...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No missing documents match these filters"
            description="Change the filters or return to the admission queue."
            action={
              <Link
                href="/dashboard/admissions"
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white"
              >
                Admissions queue
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Policy / Class</th>
                  <th className="px-4 py-3">Missing Documents</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <DocumentRequestRow
                    key={row.admissionCaseId}
                    row={row}
                    selected={selectedIds.has(row.admissionCaseId)}
                    onSelectedChange={(selected) =>
                      updateSelected(row.admissionCaseId, selected)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {requestQuery.data &&
      (requestQuery.data.total > requestQuery.data.limit ||
        filters.page > 1) ? (
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {requestQuery.data.total} case
            {requestQuery.data.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={filters.page <= 1 || requestQuery.isFetching}
              onClick={() => setFilters({ page: filters.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !requestQuery.data.hasNextPage || requestQuery.isFetching
              }
              onClick={() => setFilters({ page: filters.page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={reminderDialogOpen}
        title="Queue guardian reminders?"
        description={`SchoolOS will re-check all ${selectedRows.length} selected cases before queueing one SMS reminder per eligible guardian.`}
        confirmLabel="Queue reminders"
        isConfirming={reminderMutation.isPending}
        preventCloseWhileConfirming
        confirmDisabled={selectedRows.length === 0 || !canQueueReminders}
        onClose={() => {
          if (!reminderMutation.isPending) setReminderDialogOpen(false);
        }}
        onConfirm={() =>
          reminderMutation.mutate(
            selectedRows.map((row) => row.admissionCaseId),
          )
        }
      >
        <div className="rounded-xl border border-info-200 bg-info-50 p-3 text-sm text-info-900">
          <p className="font-bold">
            {selectedWithPhones.length} of {selectedRows.length} selected cases
            currently have a guardian phone.
          </p>
          <p className="mt-1 text-info-800">
            Closed cases, completed document requests, changed contacts, and
            unavailable delivery channels will be safely skipped. Queued does
            not mean delivered.
          </p>
        </div>
      </ConfirmDialog>
    </section>
  );
}

function ReminderBatchResult({
  result,
}: {
  result: AdmissionDocumentReminderBatchResult;
}) {
  const skipCounts = result.results.reduce<
    Partial<Record<AdmissionDocumentReminderSkipReason, number>>
  >((counts, item) => {
    if (item.state === "SKIPPED" && item.reason) {
      counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    }
    return counts;
  }, {});
  const skippedReasons = Object.entries(skipCounts) as Array<
    [AdmissionDocumentReminderSkipReason, number]
  >;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-success-200 bg-success-50 p-4 text-success-900"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold">Reminder requests checked</p>
          <p className="mt-1 text-sm text-success-800">
            {result.queued} queued · {result.alreadyQueued} already queued ·{" "}
            {result.skipped} skipped out of {result.requested} selected.
          </p>
          {skippedReasons.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-success-900">
              {skippedReasons.map(([reason, count]) => (
                <li
                  key={reason}
                  className="rounded-full border border-success-200 bg-white/70 px-2.5 py-1"
                >
                  {REMINDER_SKIP_COPY[reason]}: {count}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DocumentRequestRow({
  row,
  selected,
  onSelectedChange,
}: {
  row: AdmissionDocumentRequestItem;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  return (
    <tr className={selected ? "bg-blue-50/70" : "hover:bg-slate-50"}>
      <td className="px-4 py-4 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
          aria-label={`Select ${row.applicantName}`}
          className="h-4 w-4 rounded border-slate-300"
        />
      </td>
      <td className="px-4 py-4 align-top">
        <p className="font-bold text-slate-950">{row.applicantName}</p>
        <p className="mt-1 text-xs text-slate-500">
          {row.guardianFullName ?? "Guardian not recorded"}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          {row.guardianPhone ?? "No guardian phone"}
        </p>
      </td>
      <td className="px-4 py-4 align-top">
        <p className="font-semibold text-slate-800">
          {row.policyName ?? "No matched policy"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {row.className ?? "Class not selected"} ·{" "}
          {educationProgramLabel(row.program)}
        </p>
        <div className="mt-2">
          <StatusBadge status={row.displayStatus} />
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex max-w-xl flex-wrap gap-2">
          {row.missingDocuments.map((document) => (
            <span
              key={`${row.admissionCaseId}-${document.documentKind}`}
              className="inline-flex items-center gap-1 rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-xs font-bold text-warning-800"
            >
              {document.label || humanize(document.documentKind)}
              <span className="text-warning-700/80">
                {document.timing === "BEFORE_REVIEW"
                  ? "before review"
                  : "before enrollment"}
              </span>
            </span>
          ))}
        </div>
        {row.missingDocuments.some((document) => document.canBeWaived) ? (
          <p className="mt-2 text-xs font-semibold text-info-700">
            One or more documents can be waived from the case detail.
          </p>
        ) : null}
      </td>
      <td className="px-4 py-4 align-top">
        <p className="font-bold text-slate-900">
          {row.daysPending} day{row.daysPending === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Opened {formatBsDate(row.createdAt)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Updated {formatBsDate(row.updatedAt)}
        </p>
      </td>
      <td className="px-4 py-4 text-right align-top">
        <Link
          href={`/dashboard/admissions/cases/${row.admissionCaseId}`}
          className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Open case
        </Link>
      </td>
    </tr>
  );
}

function DocumentRequestFailure({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const returnAction = (
    <Link
      href="/dashboard/admissions"
      className="inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      Return to admissions
    </Link>
  );

  if (isModuleLockedError(error)) {
    return (
      <ModuleLockedState
        moduleName="Admissions"
        description="Admissions is not enabled for this school. No admission or document records were changed."
        secondaryAction={returnAction}
      />
    );
  }

  if (error instanceof ApiRequestError && error.statusCode === 403) {
    return (
      <PageState
        tone="permission"
        title="You do not have permission to view document requests."
        description="Ask a school administrator for admission document access. No admission or document records were changed."
        secondaryAction={returnAction}
      />
    );
  }

  return (
    <PageState
      tone="danger"
      title="We could not load document requests right now."
      description="Your admission records have not been changed. Try again, or return to the admission queue."
      actionLabel="Try again"
      onAction={onRetry}
      secondaryAction={returnAction}
    />
  );
}

function isModuleLockedError(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.statusCode !== 403)
    return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("subscription plan") ||
    message.includes("not enabled") ||
    message.includes("module.students")
  );
}

function reminderErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.statusCode === 403) {
      return "You do not have permission to queue these reminders, or Admissions is not enabled for this school.";
    }
    if (error.statusCode === 409) {
      return "The selected cases changed before the reminders could be queued. Refresh the list and try again.";
    }
  }
  return "Your admission cases were not changed. Check your connection and try again.";
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
