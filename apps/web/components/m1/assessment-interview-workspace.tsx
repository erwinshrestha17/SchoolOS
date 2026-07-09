"use client";

import type {
  AdmissionAssessmentMode,
  AdmissionAssessmentResult,
  AdmissionAssessmentSessionSummary,
  AdmissionAssessmentTab,
} from "@schoolos/core";
import {
  formatBsDateForInput,
  formatBsDateTime,
  formatNepalTime,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { ApiRequestError } from "../../lib/api/client";
import { admissionCasesApi } from "../../lib/api/admission-cases";
import { admissionPoliciesApi } from "../../lib/api/admission-policies";
import { useUrlFilters } from "../../lib/hooks/use-url-filters";
import { useSession } from "../session-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { KpiCard, KpiGrid } from "../ui/kpi-card";
import { ModuleLockedState } from "../ui/module-locked-state";
import { PageState } from "../ui/page-state";
import { StatusBadge } from "../ui/status-badge";

const TABS: Array<{ id: AdmissionAssessmentTab; label: string }> = [
  { id: "TODAY", label: "Today" },
  { id: "UPCOMING", label: "Upcoming" },
  { id: "AWAITING_RESULTS", label: "Awaiting Results" },
];

const MODES: Array<{ id: AdmissionAssessmentMode; label: string }> = [
  { id: "IN_PERSON", label: "In person" },
  { id: "PHONE", label: "Phone" },
  { id: "ONLINE", label: "Online" },
  { id: "WRITTEN", label: "Written" },
];

const RESULTS: Array<{ id: AdmissionAssessmentResult; label: string }> = [
  { id: "PASSED", label: "Passed" },
  { id: "NEEDS_FOLLOW_UP", label: "Needs follow-up" },
  { id: "FAILED", label: "Failed" },
  { id: "NO_SHOW", label: "No-show" },
];

export function AssessmentInterviewWorkspace() {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(["students:manage_lifecycle"]);
  const [filters, setFilters] = useUrlFilters<{
    tab: AdmissionAssessmentTab;
    policyId: string;
    classId: string;
    page: number;
  }>({
    tab: "TODAY",
    policyId: "",
    classId: "",
    page: 1,
  });
  const tab = TABS.some((item) => item.id === filters.tab)
    ? filters.tab
    : "TODAY";
  const [scheduleForm, setScheduleForm] = useState({
    admissionCaseId: "",
    bsDate: formatBsDateForInput(new Date()),
    startTime: "10:00",
    durationMinutes: 30,
    mode: "IN_PERSON" as AdmissionAssessmentMode,
    location: "",
    notes: "",
  });
  const [resultForm, setResultForm] = useState<{
    session: AdmissionAssessmentSessionSummary | null;
    result: AdmissionAssessmentResult;
    score: string;
    notes: string;
  }>({
    session: null,
    result: "PASSED",
    score: "",
    notes: "",
  });

  const sessionsQuery = useQuery({
    queryKey: [
      "admission-assessment-sessions",
      tab,
      filters.policyId,
      filters.classId,
      filters.page,
    ],
    queryFn: () =>
      admissionCasesApi.listAssessmentSessions({
        tab,
        policyId: filters.policyId || undefined,
        classId: filters.classId || undefined,
        page: filters.page,
        limit: 25,
      }),
  });
  const candidatesQuery = useQuery({
    queryKey: [
      "admission-assessment-candidates",
      filters.policyId,
      filters.classId,
    ],
    queryFn: () =>
      admissionCasesApi.listAssessmentCandidates({
        policyId: filters.policyId || undefined,
        classId: filters.classId || undefined,
        page: 1,
        limit: 50,
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
    () => sessionsQuery.data?.items ?? [],
    [sessionsQuery.data?.items],
  );
  const selectedCandidate = candidatesQuery.data?.items.find(
    (candidate) => candidate.admissionCaseId === scheduleForm.admissionCaseId,
  );

  const scheduleMutation = useMutation({
    mutationFn: () =>
      admissionCasesApi.scheduleAssessmentSession(
        scheduleForm.admissionCaseId,
        {
          bsDate: scheduleForm.bsDate,
          startTime: scheduleForm.startTime,
          durationMinutes: scheduleForm.durationMinutes,
          mode: scheduleForm.mode,
          location: scheduleForm.location.trim() || undefined,
          notes: scheduleForm.notes.trim() || undefined,
        },
      ),
    onSuccess: async () => {
      setScheduleForm((current) => ({
        ...current,
        admissionCaseId: "",
        notes: "",
      }));
      await refreshAssessmentQueries(queryClient);
    },
  });
  const resultMutation = useMutation({
    mutationFn: () => {
      if (!resultForm.session) {
        throw new Error("Choose an assessment or interview session.");
      }
      const score = resultForm.score.trim()
        ? Number(resultForm.score.trim())
        : undefined;
      return admissionCasesApi.recordAssessmentResult(resultForm.session.id, {
        result: resultForm.result,
        score,
        notes: resultForm.notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setResultForm({
        session: null,
        result: "PASSED",
        score: "",
        notes: "",
      });
      await refreshAssessmentQueries(queryClient);
    },
  });

  if (sessionsQuery.isError) {
    return (
      <AssessmentFailure
        error={sessionsQuery.error}
        onRetry={() => void sessionsQuery.refetch()}
      />
    );
  }

  const summary = sessionsQuery.data?.summary;
  const mutationError =
    readError(scheduleMutation.error) || readError(resultMutation.error);

  return (
    <section className="space-y-5">
      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Today"
          loading={sessionsQuery.isLoading}
          value={summary?.today ?? "Unavailable"}
          icon={<CalendarClock size={18} />}
          tone={(summary?.today ?? 0) > 0 ? "warning" : "neutral"}
          description="Scheduled assessment and interview sessions due today."
        />
        <KpiCard
          title="Upcoming"
          loading={sessionsQuery.isLoading}
          value={summary?.upcoming ?? "Unavailable"}
          icon={<RefreshCw size={18} />}
          tone="neutral"
          description="Future sessions already scheduled."
        />
        <KpiCard
          title="Awaiting Results"
          loading={sessionsQuery.isLoading}
          value={summary?.awaitingResults ?? "Unavailable"}
          icon={<ClipboardCheck size={18} />}
          tone={(summary?.awaitingResults ?? 0) > 0 ? "danger" : "neutral"}
          description="Scheduled sessions whose result has not been recorded."
        />
        <KpiCard
          title="Needs Scheduling"
          loading={sessionsQuery.isLoading || candidatesQuery.isLoading}
          value={summary?.needsScheduling ?? "Unavailable"}
          icon={<UserRoundCheck size={18} />}
          tone={(summary?.needsScheduling ?? 0) > 0 ? "warning" : "neutral"}
          description="Open cases matched to a policy that requires an interview."
        />
      </KpiGrid>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            disabled={sessionsQuery.isFetching}
            onClick={() => void sessionsQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-950">
              Schedule assessment/interview
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {selectedCandidate
                ? `${selectedCandidate.applicantName} · ${selectedCandidate.className ?? "Class not selected"}`
                : "Choose an interview-required admission case."}
            </p>
          </div>
          {!canManage ? (
            <span className="rounded-full bg-warning-50 px-3 py-1.5 text-xs font-bold text-warning-800">
              Permission required
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_150px_120px_120px_140px]">
          <label className="block text-sm font-bold text-slate-700">
            Case
            <select
              value={scheduleForm.admissionCaseId}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  admissionCaseId: event.target.value,
                }))
              }
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Select case</option>
              {(candidatesQuery.data?.items ?? []).map((candidate) => (
                <option
                  key={candidate.admissionCaseId}
                  value={candidate.admissionCaseId}
                >
                  {candidate.applicantName} ·{" "}
                  {candidate.className ?? "No class"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            BS date
            <input
              value={scheduleForm.bsDate}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  bsDate: event.target.value,
                }))
              }
              placeholder="2083-04-01"
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            NPT time
            <input
              value={scheduleForm.startTime}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  startTime: event.target.value,
                }))
              }
              placeholder="10:00"
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Minutes
            <input
              type="number"
              min={15}
              max={240}
              step={15}
              value={scheduleForm.durationMinutes}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  durationMinutes: Number(event.target.value),
                }))
              }
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Mode
            <select
              value={scheduleForm.mode}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  mode: event.target.value as AdmissionAssessmentMode,
                }))
              }
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
          <label className="block text-sm font-bold text-slate-700">
            Location
            <input
              value={scheduleForm.location}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Notes
            <input
              value={scheduleForm.notes}
              onChange={(event) =>
                setScheduleForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              disabled={!canManage}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <Button
            type="button"
            className="self-end"
            disabled={
              !canManage ||
              !scheduleForm.admissionCaseId ||
              scheduleMutation.isPending
            }
            onClick={() => scheduleMutation.mutate()}
          >
            {scheduleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}
            Schedule
          </Button>
        </div>
      </div>

      {mutationError ? (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm font-semibold text-danger-800">
          {mutationError}
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Assessment tabs"
      >
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilters({ tab: item.id, page: 1 })}
              className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold transition ${
                selected
                  ? "border-[var(--color-mod-admissions-accent)] bg-blue-50 text-slate-950"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {sessionsQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading scheduled sessions...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No sessions match this tab"
            description="Use the schedule panel for interview-required cases, or switch tabs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Schedule</th>
                  <th className="px-5 py-3">Policy / Class</th>
                  <th className="px-5 py-3">Result</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <AssessmentRow
                    key={row.id}
                    row={row}
                    canManage={canManage}
                    onRecord={() =>
                      setResultForm({
                        session: row,
                        result: "PASSED",
                        score: "",
                        notes: "",
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sessionsQuery.data &&
      (sessionsQuery.data.total > sessionsQuery.data.limit ||
        filters.page > 1) ? (
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {sessionsQuery.data.total} session
            {sessionsQuery.data.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={filters.page <= 1 || sessionsQuery.isFetching}
              onClick={() => setFilters({ page: filters.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !sessionsQuery.data.hasNextPage || sessionsQuery.isFetching
              }
              onClick={() => setFilters({ page: filters.page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {resultForm.session ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Record result
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {resultForm.session.applicantName} ·{" "}
                {formatBsDateTime(resultForm.session.scheduledAt)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setResultForm({
                  session: null,
                  result: "PASSED",
                  score: "",
                  notes: "",
                })
              }
            >
              Cancel
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_140px_minmax(0,1fr)_auto]">
            <label className="block text-sm font-bold text-slate-700">
              Result
              <select
                value={resultForm.result}
                onChange={(event) =>
                  setResultForm((current) => ({
                    ...current,
                    result: event.target.value as AdmissionAssessmentResult,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {RESULTS.map((result) => (
                  <option key={result.id} value={result.id}>
                    {result.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Score
              <input
                type="number"
                min={0}
                max={100}
                value={resultForm.score}
                onChange={(event) =>
                  setResultForm((current) => ({
                    ...current,
                    score: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Notes
              <input
                value={resultForm.notes}
                onChange={(event) =>
                  setResultForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <Button
              type="button"
              className="self-end"
              disabled={resultMutation.isPending}
              onClick={() => resultMutation.mutate()}
            >
              {resultMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save result
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssessmentRow({
  row,
  canManage,
  onRecord,
}: {
  row: AdmissionAssessmentSessionSummary;
  canManage: boolean;
  onRecord: () => void;
}) {
  const scheduledForFuture = new Date(row.scheduledAt).getTime() > Date.now();
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-4 align-top">
        <p className="font-bold text-slate-950">{row.applicantName}</p>
        <p className="mt-1 text-xs text-slate-500">
          {row.guardianFullName ?? "Guardian not recorded"}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          {row.guardianPhone ?? "No guardian phone"}
        </p>
      </td>
      <td className="px-5 py-4 align-top">
        <p className="font-bold text-slate-950">
          {formatBsDateTime(row.scheduledAt)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {row.durationMinutes} min · {modeLabel(row.mode)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {row.location || "Location not set"}
        </p>
      </td>
      <td className="px-5 py-4 align-top">
        <p className="font-semibold text-slate-800">
          {row.policyName ?? "No matched policy"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {row.className ?? "Class not selected"}
        </p>
        <div className="mt-2">
          <StatusBadge status={row.displayStatus} />
        </div>
      </td>
      <td className="px-5 py-4 align-top">
        {row.result ? (
          <>
            <p className="font-bold text-slate-900">
              {resultLabel(row.result)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {row.resultScore === null ? "No score" : `${row.resultScore}/100`}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-warning-800">Pending</p>
            <p className="mt-1 text-xs text-slate-500">
              {scheduledForFuture
                ? `Starts ${formatNepalTime(row.scheduledAt)}`
                : "Ready for result entry"}
            </p>
          </>
        )}
      </td>
      <td className="px-5 py-4 text-right align-top">
        <div className="flex justify-end gap-2">
          <Link
            href={`/dashboard/admissions/cases/${row.admissionCaseId}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Open case
          </Link>
          <Button
            type="button"
            variant="outline"
            disabled={!canManage || Boolean(row.result) || scheduledForFuture}
            onClick={onRecord}
          >
            Record result
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AssessmentFailure({
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
        description="Admissions is not enabled for this school. No assessment or interview records were changed."
        secondaryAction={returnAction}
      />
    );
  }

  if (error instanceof ApiRequestError && error.statusCode === 403) {
    return (
      <PageState
        tone="permission"
        title="You do not have permission to view assessment and interview sessions."
        description="Ask a school administrator for admission review access. No assessment or interview records were changed."
        secondaryAction={returnAction}
      />
    );
  }

  return (
    <PageState
      tone="danger"
      title="Assessment and interview sessions could not load."
      description="Your admission records have not been changed. Try again, or return to the admission queue."
      actionLabel="Try again"
      onAction={onRetry}
      secondaryAction={returnAction}
    />
  );
}

async function refreshAssessmentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["admission-assessment-sessions"],
    }),
    queryClient.invalidateQueries({
      queryKey: ["admission-assessment-candidates"],
    }),
    queryClient.invalidateQueries({ queryKey: ["admission-case-queues"] }),
    queryClient.invalidateQueries({ queryKey: ["admission-case"] }),
  ]);
}

function readError(error: unknown) {
  if (!error) return "";
  return error instanceof Error
    ? error.message
    : "The action could not be saved.";
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

function modeLabel(mode: AdmissionAssessmentMode) {
  return MODES.find((item) => item.id === mode)?.label ?? humanize(mode);
}

function resultLabel(result: AdmissionAssessmentResult) {
  return RESULTS.find((item) => item.id === result)?.label ?? humanize(result);
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
