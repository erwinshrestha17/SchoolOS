"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatBsDate,
  parseBsDateInput,
  toGregorianDateFromBs,
  type SchoolImprovementActionRecord,
  type SchoolImprovementActionStatus,
  type SchoolImprovementPlanRecord,
  type SchoolImprovementPlanStatus,
} from "@schoolos/core";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Plus,
  Target,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { api, type SchoolUserSummary } from "@/lib/api";
import { ModuleHeader } from "@/components/ui/module-header";
import { SummaryCard, SummaryGrid } from "@/components/ui/summary-card";
import { WorkSurface } from "@/components/ui/work-surface";
import { Button } from "@/components/ui/button";
import { BsDateField } from "@/components/ui/bs-date-field";
import { FormField, Input, Select, TextArea } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProtectedFileButton } from "@/components/ui/protected-file";

export function SchoolImprovementWorkspace() {
  const { session, hasPermissions } = useSession();
  const queryClient = useQueryClient();
  const canRead =
    hasPermissions(["reports:read"]) || hasPermissions(["settings:manage"]);
  const canManage = hasPermissions(["settings:manage"]);
  const [page, setPage] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const plansQuery = useQuery({
    queryKey: ["school-improvement-plans", page],
    queryFn: () => api.listSchoolImprovementPlans({ page, limit: 20 }),
    enabled: canRead,
  });
  const selectedPlanQuery = useQuery({
    queryKey: ["school-improvement-plan", selectedPlanId],
    queryFn: () => api.getSchoolImprovementPlan(selectedPlanId!),
    enabled: Boolean(canRead && selectedPlanId),
  });
  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
    enabled: canManage,
  });
  const usersQuery = useQuery({
    queryKey: ["school-users", "improvement-plan-owners"],
    queryFn: api.listUsers,
    enabled: canManage,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["school-improvement-plans"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["school-improvement-plan"],
      }),
    ]);
  };
  const plans = plansQuery.data?.items ?? [];
  const activePlans = plans.filter((plan) => plan.status === "ACTIVE").length;
  const openActions = plans.reduce(
    (total, plan) =>
      total +
      plan.actions.filter((action) =>
        ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"].includes(action.status),
      ).length,
    0,
  );
  const completedActions = plans.reduce(
    (total, plan) =>
      total +
      plan.actions.filter((action) => action.status === "COMPLETED").length,
    0,
  );

  return (
    <div className="space-y-6" data-module="reports">
      <ModuleHeader
        eyebrow="Institutional improvement"
        title="School Improvement Planning"
        description="Turn an agreed school baseline into owned indicators, dated actions, evidence, and monthly reviews."
        primaryAction={
          canManage && !selectedPlanId ? (
            <Button
              type="button"
              onClick={() => setShowCreate((open) => !open)}
            >
              <Plus className="size-4" />
              {showCreate ? "Close form" : "Create plan"}
            </Button>
          ) : undefined
        }
      />

      {!canRead ? (
        <PermissionDenied
          title="School improvement planning is not available for your role"
          description="Ask a school administrator if you need access to school-improvement plans."
          showNavigation={false}
        />
      ) : selectedPlanId ? (
        <PlanDetail
          plan={selectedPlanQuery.data}
          isLoading={selectedPlanQuery.isLoading}
          isError={selectedPlanQuery.isError}
          canManage={canManage}
          onBack={() => setSelectedPlanId(null)}
          onRetry={() => void selectedPlanQuery.refetch()}
          onChanged={refresh}
        />
      ) : (
        <>
          <SummaryGrid>
            <SummaryCard
              label="Plans on this page"
              value={plansQuery.isError ? "Unavailable" : plans.length}
              icon={<ClipboardList />}
              tone="info"
              loading={plansQuery.isLoading}
              description={`${plansQuery.data?.total ?? 0} total plans`}
            />
            <SummaryCard
              label="Active plans"
              value={plansQuery.isError ? "Unavailable" : activePlans}
              icon={<Target />}
              tone="module"
              loading={plansQuery.isLoading}
              description="Visible page only"
            />
            <SummaryCard
              label="Open actions"
              value={plansQuery.isError ? "Unavailable" : openActions}
              icon={<CalendarCheck />}
              tone={openActions > 0 ? "warning" : "success"}
              loading={plansQuery.isLoading}
              description="Visible page only"
            />
            <SummaryCard
              label="Completed actions"
              value={plansQuery.isError ? "Unavailable" : completedActions}
              icon={<CheckCircle2 />}
              tone="success"
              loading={plansQuery.isLoading}
              description="Visible page only"
            />
          </SummaryGrid>

          {showCreate && canManage ? (
            <CreatePlanForm
              academicYears={yearsQuery.data ?? []}
              currentUserId={session?.user.id ?? ""}
              users={(usersQuery.data ?? []).filter(
                (user) => user.status === "ACTIVE",
              )}
              onCreated={async (plan) => {
                setShowCreate(false);
                await refresh();
                setSelectedPlanId(plan.id);
              }}
            />
          ) : null}

          {plansQuery.isLoading ? (
            <LoadingState
              variant="spinner"
              label="Loading school improvement plans…"
            />
          ) : plansQuery.isError ? (
            <ErrorState
              title="Plans unavailable"
              message="School improvement plans could not be loaded."
              onRetry={() => void plansQuery.refetch()}
            />
          ) : plans.length === 0 ? (
            <EmptyState
              title="No school improvement plan"
              description={
                canManage
                  ? "Create the first plan from an agreed baseline and target."
                  : "No school improvement plan is available for this school."
              }
            />
          ) : (
            <WorkSurface
              title="Plans"
              description="Results are paginated by the server. Open a plan to review its indicators, actions, evidence, and monthly reviews."
            >
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[var(--primary)] hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <span>
                      <span className="block font-bold text-slate-950">
                        {plan.title}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {formatBsDate(plan.startsOn)} –{" "}
                        {formatBsDate(plan.endsOn)} • {plan.kpis.length}{" "}
                        indicators • {plan.actions.length} actions
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={plan.status} />
                      <ArrowRight className="size-4 text-slate-500" />
                    </span>
                  </button>
                ))}
              </div>
              {(plansQuery.data?.totalPages ?? 0) > 1 ? (
                <div className="mt-5 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  <p className="text-sm font-semibold text-slate-600">
                    Page {page} of {plansQuery.data?.totalPages}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page >= (plansQuery.data?.totalPages ?? 1)}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </WorkSurface>
          )}
        </>
      )}
    </div>
  );
}

function PlanDetail({
  plan,
  isLoading,
  isError,
  canManage,
  onBack,
  onRetry,
  onChanged,
}: {
  plan: SchoolImprovementPlanRecord | undefined;
  isLoading: boolean;
  isError: boolean;
  canManage: boolean;
  onBack: () => void;
  onRetry: () => void;
  onChanged: () => Promise<void>;
}) {
  if (isLoading) {
    return <LoadingState variant="spinner" label="Loading improvement plan…" />;
  }
  if (isError || !plan) {
    return (
      <ErrorState
        title="Plan unavailable"
        message="This school improvement plan could not be loaded."
        onRetry={onRetry}
      />
    );
  }
  return (
    <div className="space-y-6">
      <Button type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back to plans
      </Button>
      <WorkSurface
        title={plan.title}
        description={`${formatBsDate(plan.startsOn)} – ${formatBsDate(plan.endsOn)}`}
        action={<StatusBadge status={plan.status} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Baseline
            </p>
            <p className="mt-2 text-sm text-slate-800">
              {plan.baselineSummary}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Target
            </p>
            <p className="mt-2 text-sm text-slate-800">{plan.targetSummary}</p>
          </div>
        </div>
        {canManage ? (
          <PlanTransitionForm plan={plan} onChanged={onChanged} />
        ) : null}
      </WorkSurface>

      <WorkSurface
        title="Indicators"
        description="Latest values change only through a recorded plan review."
        action={<BarChart3 className="size-5 text-slate-500" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {plan.kpis.map((kpi) => (
            <div key={kpi.id} className="rounded-xl border p-4">
              <p className="font-bold">{kpi.name}</p>
              <p className="mt-2 text-sm text-slate-600">
                Baseline {kpi.baselineValue} {kpi.unit} • Target{" "}
                {kpi.targetValue} {kpi.unit}
              </p>
              <p className="mt-1 text-sm font-semibold">
                Latest:{" "}
                {kpi.latestValue === null
                  ? "Not reviewed"
                  : `${kpi.latestValue} ${kpi.unit}`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Due {formatBsDate(kpi.dueOn)}
              </p>
            </div>
          ))}
        </div>
      </WorkSurface>

      <WorkSurface
        title="Owned actions"
        description="Every status change requires a reason. Evidence remains protected by authenticated file access."
      >
        <div className="space-y-4">
          {plan.actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              canManage={canManage}
              onChanged={onChanged}
            />
          ))}
        </div>
      </WorkSurface>

      {canManage && plan.status !== "ARCHIVED" ? (
        <ReviewForm plan={plan} onChanged={onChanged} />
      ) : null}

      <WorkSurface
        title="Monthly reviews"
        description="Reviews preserve the dated narrative and indicator snapshot used for the next decision."
      >
        {plan.reviews.length === 0 ? (
          <EmptyState
            title="No monthly review"
            description="The first recorded review will appear here."
          />
        ) : (
          <div className="space-y-3">
            {plan.reviews.map((review) => (
              <article key={review.id} className="rounded-xl border p-4">
                <p className="text-xs font-bold text-slate-500">
                  {formatBsDate(review.reviewedOn)}
                </p>
                <p className="mt-2 font-semibold">{review.summary}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Next: {review.nextActions}
                </p>
              </article>
            ))}
          </div>
        )}
      </WorkSurface>
    </div>
  );
}

function CreatePlanForm({
  academicYears,
  users,
  currentUserId,
  onCreated,
}: {
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  users: SchoolUserSummary[];
  currentUserId: string;
  onCreated: (plan: SchoolImprovementPlanRecord) => Promise<void>;
}) {
  const currentYear =
    academicYears.find((year) => year.isCurrent)?.id ??
    academicYears[0]?.id ??
    "";
  const ownerOptions = useMemo(
    () =>
      users.length > 0
        ? users
        : [
            {
              id: currentUserId,
              email: "Current signed-in school leader",
            } as SchoolUserSummary,
          ],
    [currentUserId, users],
  );
  const [academicYearId, setAcademicYearId] = useState(currentYear);
  const [ownerUserId, setOwnerUserId] = useState(currentUserId);
  const [title, setTitle] = useState("");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [kpiName, setKpiName] = useState("");
  const [kpiUnit, setKpiUnit] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [kpiDueOn, setKpiDueOn] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [actionDueOn, setActionDueOn] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.createSchoolImprovementPlan({
        academicYearId: academicYearId || currentYear,
        ownerUserId,
        title,
        baselineSummary: baseline,
        targetSummary: target,
        startsOn: gregorianDateString(startsOn),
        endsOn: gregorianDateString(endsOn),
        kpis: [
          {
            ownerUserId,
            name: kpiName,
            unit: kpiUnit,
            baselineValue: Number(baselineValue),
            targetValue: Number(targetValue),
            dueOn: gregorianDateString(kpiDueOn),
          },
        ],
        actions: [
          {
            ownerUserId,
            title: actionTitle,
            details: actionDetails,
            dueOn: gregorianDateString(actionDueOn),
          },
        ],
        clientRequestId: crypto.randomUUID(),
      }),
    onSuccess: (plan) => void onCreated(plan),
    onError: () =>
      setError(
        "The plan could not be saved. Check the dates, owners, indicator values, and required details.",
      ),
  });
  return (
    <WorkSurface
      variant="form"
      title="Create school improvement plan"
      description="Start with one measurable indicator and one owned action. More can be added through a later reviewed plan amendment."
    >
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate();
        }}
      >
        <FormField label="Academic year">
          <Select
            required
            value={academicYearId || currentYear}
            onChange={(event) => setAcademicYearId(event.target.value)}
          >
            <option value="">Choose academic year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.isCurrent ? " • Current" : ""}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Plan owner">
          <Select
            required
            value={ownerUserId}
            onChange={(event) => setOwnerUserId(event.target.value)}
          >
            <option value="">Choose owner</option>
            {ownerOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email ?? "School user"}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Plan title">
          <Input
            required
            minLength={4}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
        <FormField label="Agreed baseline">
          <TextArea
            required
            minLength={4}
            value={baseline}
            onChange={(event) => setBaseline(event.target.value)}
          />
        </FormField>
        <FormField label="Target outcome">
          <TextArea
            required
            minLength={4}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </FormField>
        <div />
        <BsDateField
          label="Starts on (BS)"
          value={startsOn}
          onChange={setStartsOn}
          required
        />
        <BsDateField
          label="Ends on (BS)"
          value={endsOn}
          onChange={setEndsOn}
          required
        />
        <div />
        <FormField label="First indicator">
          <Input
            required
            minLength={3}
            value={kpiName}
            onChange={(event) => setKpiName(event.target.value)}
          />
        </FormField>
        <FormField label="Indicator unit">
          <Input
            required
            value={kpiUnit}
            onChange={(event) => setKpiUnit(event.target.value)}
            placeholder="percent, days, learners"
          />
        </FormField>
        <BsDateField
          label="Indicator due date (BS)"
          value={kpiDueOn}
          onChange={setKpiDueOn}
          required
        />
        <FormField label="Baseline value">
          <Input
            required
            type="number"
            step="any"
            value={baselineValue}
            onChange={(event) => setBaselineValue(event.target.value)}
          />
        </FormField>
        <FormField label="Target value">
          <Input
            required
            type="number"
            step="any"
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
          />
        </FormField>
        <div />
        <FormField label="First action">
          <Input
            required
            minLength={4}
            value={actionTitle}
            onChange={(event) => setActionTitle(event.target.value)}
          />
        </FormField>
        <FormField label="Action details">
          <TextArea
            required
            minLength={4}
            value={actionDetails}
            onChange={(event) => setActionDetails(event.target.value)}
          />
        </FormField>
        <BsDateField
          label="Action due date (BS)"
          value={actionDueOn}
          onChange={setActionDueOn}
          required
        />
        {error ? (
          <p className="text-sm font-semibold text-danger-700 lg:col-span-3">
            {error}
          </p>
        ) : null}
        <div className="lg:col-span-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving plan…" : "Save draft plan"}
          </Button>
        </div>
      </form>
    </WorkSurface>
  );
}

function PlanTransitionForm({
  plan,
  onChanged,
}: {
  plan: SchoolImprovementPlanRecord;
  onChanged: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const nextStatus = nextPlanStatus(plan.status);
  const mutation = useMutation({
    mutationFn: () =>
      api.updateSchoolImprovementPlan(plan.id, {
        expectedVersion: plan.version,
        status: nextStatus!,
        reason,
      }),
    onSuccess: () => {
      setReason("");
      void onChanged();
    },
  });
  if (!nextStatus) return null;
  return (
    <form
      className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <FormField label={`Reason to ${planActionLabel(nextStatus)}`}>
        <Input
          required
          minLength={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <Button type="submit" disabled={mutation.isPending || reason.length < 4}>
        {planActionLabel(nextStatus)}
      </Button>
    </form>
  );
}

function ActionCard({
  action,
  canManage,
  onChanged,
}: {
  action: SchoolImprovementActionRecord;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [status, setStatus] = useState<SchoolImprovementActionStatus>(
    action.status,
  );
  const [reason, setReason] = useState("");
  const [progressNote, setProgressNote] = useState(action.progressNote ?? "");
  const [evidenceFileAssetId, setEvidenceFileAssetId] = useState<
    string | undefined
  >(undefined);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.updateSchoolImprovementAction(action.id, {
        expectedVersion: action.version,
        status,
        reason,
        progressNote: progressNote || undefined,
        evidenceFileAssetId,
      }),
    onSuccess: () => {
      setReason("");
      setEvidenceFileAssetId(undefined);
      void onChanged();
    },
    onError: () =>
      setError(
        "The action changed or could not be updated. Refresh the plan and try again.",
      ),
  });
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold">{action.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{action.details}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Due {formatBsDate(action.dueOn)}
          </p>
        </div>
        <StatusBadge status={action.status} />
      </div>
      {action.progressNote ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          {action.progressNote}
        </p>
      ) : null}
      {action.evidenceFileAssetId ? (
        <ProtectedFileButton
          className="mt-3"
          size="sm"
          variant="outline"
          fileAssetId={action.evidenceFileAssetId}
          fileName={`${action.title}-evidence`}
          action="preview"
        >
          View protected evidence
        </ProtectedFileButton>
      ) : null}
      {canManage ? (
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          <FormField label="Action status">
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as SchoolImprovementActionStatus)
              }
            >
              {[
                "NOT_STARTED",
                "IN_PROGRESS",
                "BLOCKED",
                "COMPLETED",
                "CANCELLED",
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Reason for change">
            <Input
              required
              minLength={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <FormField label="Progress note">
            <TextArea
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
            />
          </FormField>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Protected evidence (optional)
            </p>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-700 hover:border-[var(--primary)]">
              <FileUp className="size-4" />
              {uploading
                ? "Uploading…"
                : evidenceFileAssetId
                  ? "Evidence ready to save"
                  : "Choose evidence file"}
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setError("");
                  try {
                    const uploaded = await api.uploadFile(
                      file,
                      "institutional-improvement",
                      action.id,
                    );
                    setEvidenceFileAssetId(uploaded.id);
                  } catch {
                    setError(
                      "The evidence file could not be uploaded. No action change was saved.",
                    );
                  } finally {
                    setUploading(false);
                    event.target.value = "";
                  }
                }}
              />
            </label>
          </div>
          {error ? (
            <p className="text-sm font-semibold text-danger-700 md:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={
                mutation.isPending || uploading || reason.trim().length < 4
              }
            >
              Save action update
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function ReviewForm({
  plan,
  onChanged,
}: {
  plan: SchoolImprovementPlanRecord;
  onChanged: () => Promise<void>;
}) {
  const [reviewedOn, setReviewedOn] = useState("");
  const [summary, setSummary] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.addSchoolImprovementReview(plan.id, {
        reviewedOn: gregorianDateString(reviewedOn),
        summary,
        nextActions,
        kpiSnapshot: plan.kpis.map((kpi) => ({
          kpiId: kpi.id,
          value: Number(values[kpi.id]),
        })),
        clientRequestId: crypto.randomUUID(),
      }),
    onSuccess: () => {
      setReviewedOn("");
      setSummary("");
      setNextActions("");
      setValues({});
      void onChanged();
    },
    onError: () =>
      setError(
        "The review could not be recorded. Enter a value for every indicator and try again.",
      ),
  });
  return (
    <WorkSurface
      variant="form"
      title="Record monthly review"
      description="The review updates the latest indicator values in one audited transaction."
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate();
        }}
      >
        <BsDateField
          label="Reviewed on (BS)"
          value={reviewedOn}
          onChange={setReviewedOn}
          required
        />
        <div />
        <FormField label="Review summary">
          <TextArea
            required
            minLength={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </FormField>
        <FormField label="Next actions">
          <TextArea
            required
            minLength={4}
            value={nextActions}
            onChange={(event) => setNextActions(event.target.value)}
          />
        </FormField>
        {plan.kpis.map((kpi) => (
          <FormField key={kpi.id} label={`${kpi.name} (${kpi.unit})`}>
            <Input
              required
              type="number"
              step="any"
              value={values[kpi.id] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [kpi.id]: event.target.value,
                }))
              }
            />
          </FormField>
        ))}
        {error ? (
          <p className="text-sm font-semibold text-danger-700 md:col-span-2">
            {error}
          </p>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Recording review…" : "Record review"}
          </Button>
        </div>
      </form>
    </WorkSurface>
  );
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, "0")}-${String(gregorian.day).padStart(2, "0")}`;
}

function nextPlanStatus(
  status: SchoolImprovementPlanStatus,
): SchoolImprovementPlanStatus | null {
  if (status === "DRAFT") return "ACTIVE";
  if (status === "ACTIVE") return "COMPLETED";
  if (status === "COMPLETED") return "ARCHIVED";
  return null;
}

function planActionLabel(status: SchoolImprovementPlanStatus) {
  if (status === "ACTIVE") return "Activate plan";
  if (status === "COMPLETED") return "Complete plan";
  return "Archive plan";
}
