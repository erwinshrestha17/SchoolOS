"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatBsDate,
  parseBsDateInput,
  toGregorianDateFromBs,
  type StaffLookupOption,
  type TeacherDevelopmentGoalRecord,
  type TeacherObservationRecord,
} from "@schoolos/core";
import {
  Award,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  Plus,
  Target,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/components/session-provider";
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
import { ProtectedFileButton } from "@/components/ui/protected-file";
import { StatusBadge } from "@/components/ui/status-badge";
import { RemoteStaffSelector } from "@/components/staff/remote-staff-selector";

type CreateKind = "observation" | "goal" | "training";

export function TeacherDevelopmentWorkspace() {
  const { hasPermissions } = useSession();
  const queryClient = useQueryClient();
  const canRead = hasPermissions(["hr:read"]) || hasPermissions(["hr:manage"]);
  const canManage = hasPermissions(["hr:manage"]);
  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
    enabled: Boolean(canRead),
  });
  const [academicYearId, setAcademicYearId] = useState("");
  const effectiveYearId =
    academicYearId ||
    yearsQuery.data?.find((year) => year.isCurrent)?.id ||
    yearsQuery.data?.[0]?.id ||
    "";
  const overviewQuery = useQuery({
    queryKey: ["teacher-development-overview", effectiveYearId],
    queryFn: () =>
      api.getTeacherDevelopmentOverview({
        academicYearId: effectiveYearId || undefined,
      }),
    enabled: Boolean(canRead && effectiveYearId),
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["teacher-development-overview"],
    });

  if (!canRead) {
    return (
      <PermissionDenied
        title="Teacher development is not available for your role"
        description="Ask a school administrator if you need access to teacher-development records."
        showNavigation={false}
      />
    );
  }

  const overview = overviewQuery.data;
  return (
    <div className="space-y-6" data-module="hr">
      <ModuleHeader
        eyebrow="M7 • Teacher development"
        title="Teacher Development"
        description="Record classroom observations, agree development goals, assign mentors, and keep a protected training history."
        primaryAction={
          <Select
            aria-label="Academic year"
            value={effectiveYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
            className="min-w-52"
          >
            {(yearsQuery.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.isCurrent ? " • Current" : ""}
              </option>
            ))}
          </Select>
        }
      />

      <SummaryGrid>
        <SummaryCard
          label="Follow-ups due"
          value={overview?.metrics.observationsDue ?? "Unavailable"}
          icon={<CalendarClock />}
          tone={
            (overview?.metrics.observationsDue ?? 0) > 0 ? "warning" : "success"
          }
        />
        <SummaryCard
          label="Active goals"
          value={overview?.metrics.activeGoals ?? "Unavailable"}
          icon={<Target />}
          tone="info"
        />
        <SummaryCard
          label="Overdue goals"
          value={overview?.metrics.overdueGoals ?? "Unavailable"}
          icon={<ClipboardCheck />}
          tone={
            (overview?.metrics.overdueGoals ?? 0) > 0 ? "danger" : "success"
          }
        />
        <SummaryCard
          label="Training completed"
          value={overview?.metrics.completedTraining ?? "Unavailable"}
          icon={<Award />}
          tone="success"
        />
      </SummaryGrid>

      {canManage ? (
        <TeacherDevelopmentCreateForm
          academicYearId={effectiveYearId}
          onCreated={refresh}
        />
      ) : null}

      {overviewQuery.isLoading ? (
        <LoadingState label="Loading teacher development records…" />
      ) : overviewQuery.isError ? (
        <ErrorState
          title="Teacher development could not load"
          message="Refresh the page and try again."
          onRetry={() => overviewQuery.refetch()}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <ObservationList
            items={overview?.observations ?? []}
            canManage={canManage}
            onChanged={refresh}
          />
          <GoalList
            items={overview?.goals ?? []}
            canManage={canManage}
            onChanged={refresh}
          />
          <WorkSurface
            title="Training history"
            description="Courses and completed professional learning."
          >
            {(overview?.training ?? []).length === 0 ? (
              <EmptyState
                title="No training record"
                description="Planned and completed training will appear here."
              />
            ) : (
              <div className="space-y-3">
                {overview?.training.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.teacher.fullName}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatBsDate(item.startsOn)}
                      {item.endsOn ? ` – ${formatBsDate(item.endsOn)}` : ""}
                    </p>
                    {item.learningSummary ? (
                      <p className="mt-2 text-sm">{item.learningSummary}</p>
                    ) : null}
                    {item.certificateFileAssetId ? (
                      <ProtectedFileButton
                        action="download"
                        className="mt-3"
                        fileAssetId={item.certificateFileAssetId}
                        fileName={`${item.title}-certificate`}
                      >
                        Download certificate
                      </ProtectedFileButton>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </WorkSurface>
        </div>
      )}
    </div>
  );
}

function TeacherDevelopmentCreateForm({
  academicYearId,
  onCreated,
}: {
  academicYearId: string;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<CreateKind>("observation");
  const [teacherStaffId, setTeacherStaffId] = useState("");
  const [mentorStaffId, setMentorStaffId] = useState("");
  const [teacherOption, setTeacherOption] =
    useState<StaffLookupOption | null>(null);
  const [mentorOption, setMentorOption] =
    useState<StaffLookupOption | null>(null);
  const [title, setTitle] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [tertiary, setTertiary] = useState("");
  const [startsOnBs, setStartsOnBs] = useState("");
  const [endsOnBs, setEndsOnBs] = useState("");
  const [certificateFileAssetId, setCertificateFileAssetId] = useState("");
  const [certificateFileName, setCertificateFileName] = useState("");
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!academicYearId || !teacherStaffId) {
        throw new Error("Choose an academic year and teacher.");
      }
      if (kind === "observation") {
        return api.createTeacherObservation({
          teacherStaffId,
          academicYearId,
          observedOn: gregorianDateString(startsOnBs),
          strengths: primary,
          developmentFocus: secondary,
          agreedAction: tertiary || undefined,
          followUpOn: endsOnBs ? gregorianDateString(endsOnBs) : undefined,
          clientRequestId: crypto.randomUUID(),
        });
      }
      if (kind === "goal") {
        return api.createTeacherDevelopmentGoal({
          teacherStaffId,
          mentorStaffId: mentorStaffId || undefined,
          academicYearId,
          title,
          baseline: primary,
          target: secondary,
          actionPlan: tertiary,
          startsOn: gregorianDateString(startsOnBs),
          dueOn: gregorianDateString(endsOnBs),
          clientRequestId: crypto.randomUUID(),
        });
      }
      return api.createTeacherTraining({
        teacherStaffId,
        title,
        providerName: primary || undefined,
        startsOn: gregorianDateString(startsOnBs),
        endsOn: endsOnBs ? gregorianDateString(endsOnBs) : undefined,
        status: "PLANNED",
        learningSummary: secondary || undefined,
        certificateFileAssetId: certificateFileAssetId || undefined,
        clientRequestId: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setTitle("");
      setPrimary("");
      setSecondary("");
      setTertiary("");
      setStartsOnBs("");
      setEndsOnBs("");
      setCertificateFileAssetId("");
      setCertificateFileName("");
      setError("");
      onCreated();
    },
    onError: () => {
      setError(
        "The teacher development record could not be saved. Check the required fields and try again.",
      );
    },
  });

  const labels = useMemo(
    () =>
      ({
        observation: {
          primary: "Observed strengths",
          secondary: "Development focus",
          tertiary: "Agreed action (optional)",
          start: "Observed on (BS)",
          end: "Follow-up on (BS, optional)",
        },
        goal: {
          primary: "Baseline",
          secondary: "Target",
          tertiary: "Action plan",
          start: "Starts on (BS)",
          end: "Due on (BS)",
        },
        training: {
          primary: "Provider (optional)",
          secondary: "Learning summary (optional)",
          tertiary: "",
          start: "Starts on (BS)",
          end: "Ends on (BS, optional)",
        },
      })[kind],
    [kind],
  );

  return (
    <WorkSurface
      variant="form"
      title="Add teacher development record"
      description="Writes are tenant-scoped, idempotent, and audited."
      action={<Plus className="size-5 text-muted-foreground" />}
    >
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate();
        }}
      >
        <FormField label="Record type">
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as CreateKind)}
          >
            <option value="observation">Classroom observation</option>
            <option value="goal">Development goal</option>
            <option value="training">Training history</option>
          </Select>
        </FormField>
        <RemoteStaffSelector
          value={teacherStaffId}
          selectedOption={teacherOption}
          onChange={(staffId, option) => {
            setTeacherStaffId(staffId);
            setTeacherOption(option);
          }}
          label="Teacher"
          placeholder="Search teacher"
        />
        {kind === "goal" ? (
          <RemoteStaffSelector
            value={mentorStaffId}
            selectedOption={mentorOption}
            onChange={(staffId, option) => {
              setMentorStaffId(staffId);
              setMentorOption(option);
            }}
            label="Mentor (optional)"
            placeholder="No mentor assigned"
          />
        ) : (
          <div />
        )}
        {kind !== "observation" ? (
          <FormField label={kind === "goal" ? "Goal title" : "Training title"}>
            <Input
              required
              minLength={4}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
        ) : null}
        <FormField label={labels.primary}>
          {kind === "training" ? (
            <Input
              value={primary}
              onChange={(event) => setPrimary(event.target.value)}
            />
          ) : (
            <TextArea
              required
              minLength={4}
              value={primary}
              onChange={(event) => setPrimary(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={labels.secondary}>
          <TextArea
            required={kind !== "training"}
            minLength={kind === "training" ? undefined : 4}
            value={secondary}
            onChange={(event) => setSecondary(event.target.value)}
          />
        </FormField>
        {labels.tertiary ? (
          <FormField label={labels.tertiary}>
            <TextArea
              required={kind === "goal"}
              minLength={kind === "goal" ? 4 : undefined}
              value={tertiary}
              onChange={(event) => setTertiary(event.target.value)}
            />
          </FormField>
        ) : null}
        <BsDateField
          label={labels.start}
          value={startsOnBs}
          onChange={setStartsOnBs}
          required
        />
        <BsDateField
          label={labels.end}
          value={endsOnBs}
          onChange={setEndsOnBs}
          required={kind === "goal"}
        />
        {kind === "training" ? (
          <FormField label="Protected certificate (optional)">
            <label className="flex cursor-pointer items-center rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-[var(--primary)]">
              {uploadingCertificate
                ? "Uploading certificate…"
                : certificateFileName || "Choose certificate file"}
              <input
                type="file"
                className="sr-only"
                disabled={uploadingCertificate}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingCertificate(true);
                  setError("");
                  try {
                    const uploaded = await api.uploadFile(
                      file,
                      "institutional-improvement",
                    );
                    setCertificateFileAssetId(uploaded.id);
                    setCertificateFileName(uploaded.fileName);
                  } catch {
                    setError(
                      "The certificate could not be uploaded. The training record has not been saved.",
                    );
                  } finally {
                    setUploadingCertificate(false);
                    event.target.value = "";
                  }
                }}
              />
            </label>
          </FormField>
        ) : null}
        <div className="flex items-end">
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || uploadingCertificate}
          >
            {mutation.isPending ? "Saving…" : "Save record"}
          </Button>
        </div>
        {error ? (
          <p className="text-sm font-semibold text-danger-700 lg:col-span-3">
            {error}
          </p>
        ) : null}
      </form>
    </WorkSurface>
  );
}

function ObservationList({
  items,
  canManage,
  onChanged,
}: {
  items: TeacherObservationRecord[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: (item: TeacherObservationRecord) =>
      api.updateTeacherObservation(item.id, {
        expectedVersion: item.version,
        status:
          item.status === "DRAFT"
            ? "COMPLETED"
            : item.status === "FOLLOW_UP_DUE"
              ? "CLOSED"
              : "FOLLOW_UP_DUE",
        reason,
      }),
    onSuccess: () => {
      setReason("");
      onChanged();
    },
  });
  return (
    <WorkSurface
      title="Classroom observations"
      description="Strengths, agreed feedback, and follow-up."
    >
      {canManage && items.some((item) => item.status !== "CLOSED") ? (
        <div className="mb-4">
          <FormField label="Reason for the next observation status change">
            <Input
              minLength={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Record what was reviewed or agreed"
            />
          </FormField>
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          title="No observation"
          description="Recorded classroom observations will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.teacher.fullName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatBsDate(item.observedOn)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-3 text-sm">{item.strengths}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Focus: {item.developmentFocus}
              </p>
              {item.followUpOn ? (
                <p className="mt-2 text-xs font-semibold">
                  Follow-up {formatBsDate(item.followUpOn)}
                </p>
              ) : null}
              {canManage && item.status !== "CLOSED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={mutation.isPending || reason.trim().length < 4}
                  onClick={() => mutation.mutate(item)}
                >
                  {item.status === "DRAFT"
                    ? "Complete observation"
                    : item.status === "FOLLOW_UP_DUE"
                      ? "Close follow-up"
                      : "Mark follow-up due"}
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </WorkSurface>
  );
}

function GoalList({
  items,
  canManage,
  onChanged,
}: {
  items: TeacherDevelopmentGoalRecord[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const mutation = useMutation({
    mutationFn: (item: TeacherDevelopmentGoalRecord) =>
      api.updateTeacherDevelopmentGoal(item.id, {
        expectedVersion: item.version,
        status: item.status === "DRAFT" ? "ACTIVE" : "COMPLETED",
        reason,
        progressNote: progressNote || undefined,
      }),
    onSuccess: () => {
      setReason("");
      setProgressNote("");
      onChanged();
    },
  });
  return (
    <WorkSurface
      title="Development goals"
      description="Baselines, targets, mentors, and due dates."
    >
      {canManage &&
      items.some(
        (item) => item.status === "DRAFT" || item.status === "ACTIVE",
      ) ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <FormField label="Reason for the next goal status change">
            <Input
              minLength={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Record what was reviewed or agreed"
            />
          </FormField>
          <FormField label="Progress note (optional)">
            <Input
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
            />
          </FormField>
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          title="No development goal"
          description="Agreed teacher-development goals will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.teacher.fullName}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm">Target: {item.target}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Due {formatBsDate(item.dueOn)}
                {item.mentor ? ` • Mentor ${item.mentor.fullName}` : ""}
              </p>
              {canManage &&
              (item.status === "DRAFT" || item.status === "ACTIVE") ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={mutation.isPending || reason.trim().length < 4}
                  onClick={() => mutation.mutate(item)}
                >
                  {item.status === "DRAFT" ? "Activate goal" : "Complete goal"}
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </WorkSurface>
  );
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, "0")}-${String(gregorian.day).padStart(2, "0")}`;
}
