"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import {
  formatBsDate,
  type AcademicYearSummary,
  type ClassSummary,
  type SectionSummary,
  type StaffSummary,
  type SubjectSummary,
  type TimetableSlotSummary,
  type TimetableValidationResult,
  type TimetableVersionSummary,
} from "@schoolos/core";
import { cn } from "../../../lib/utils";
import { SectionCard } from "../../ui/section-card";
import { StatCard } from "../../ui/stat-card";
import { Badge } from "../../ui/badge";
import { EmptyState } from "../../ui/empty-state";
import { LoadingState } from "../../ui/loading-state";
import { FilterBar } from "../../ui/filter-bar";
import { PageState } from "../../ui/page-state";
import { AuditInfo } from "../../ui/audit-info";
import { ConfirmDialog } from "../../ui/confirm-dialog";
import { FormField, Input, Select } from "../../ui/form-field";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Lock,
  Archive,
  Zap,
  Clock,
} from "lucide-react";

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  subjects: SubjectSummary[];
  staff: StaffSummary[];
  timetable: TimetableSlotSummary[];
  isLoadingTimetable: boolean;
  classId: string;
  setClassId: (id: string) => void;
};

type VersionAction = "publish" | "lock" | "archive";

const daysOfWeek = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

function formatTimetableDate(
  value: string | null | undefined,
  fallback = "Date not set",
) {
  if (!value) return fallback;
  try {
    return formatBsDate(value);
  } catch {
    return "Date unavailable";
  }
}

function formatSlotTeacher(slot: TimetableSlotSummary) {
  return (
    [slot.staff?.firstName, slot.staff?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") || "Teacher not assigned"
  );
}

export function TimetableBuilderTab({
  academicYears,
  classes,
  allSections,
  subjects,
  staff,
  timetable,
  isLoadingTimetable,
  classId,
  setClassId,
}: Props) {
  const queryClient = useQueryClient();
  const currentYear =
    academicYears.find((year) => year.isCurrent) ?? academicYears[0];
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [validationResult, setValidationResult] =
    useState<TimetableValidationResult | null>(null);
  const [confirmAction, setConfirmAction] = useState<VersionAction | null>(
    null,
  );

  const [slot, setSlot] = useState({
    academicYearId: currentYear?.id ?? "",
    sectionId: "",
    subjectId: "",
    staffId: "",
    dayOfWeek: 1,
    startsAt: "09:00",
    endsAt: "09:45",
    room: "",
  });

  const slotMut = useMutation({
    mutationFn: api.createTimetableSlot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["timetable", classId] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-workload"] });
      setSlot((c) => ({
        ...c,
        subjectId: "",
        startsAt: c.endsAt,
        endsAt: calculateNextEnd(c.endsAt),
      }));
      // Keep the conflict panel current after every edit — it must stay
      // visible while editing, not only after an explicit "Validate" click.
      if (activeVersionId) validateVersionMut.mutate(activeVersionId);
    },
  });

  const periodsQuery = useQuery({
    queryKey: ["timetable-periods", currentYear?.id],
    queryFn: () =>
      api.listTimetablePeriods({ academicYearId: currentYear?.id }),
    enabled: Boolean(currentYear?.id),
  });

  const roomsQuery = useQuery({
    queryKey: ["timetable-rooms"],
    queryFn: api.listRooms,
  });

  const versionsQuery = useQuery({
    queryKey: ["timetable-versions", currentYear?.id, classId],
    queryFn: () =>
      api.listTimetableVersions({
        academicYearId: currentYear?.id,
        classId,
      }),
    enabled: Boolean(currentYear?.id && classId),
  });

  const substitutionsQuery = useQuery({
    queryKey: ["timetable-substitutions", classId],
    queryFn: () => api.listSubstitutions({ classId }),
    enabled: Boolean(classId),
  });

  const createVersionMut = useMutation({
    mutationFn: () =>
      api.createTimetableVersion({
        academicYearId: currentYear?.id ?? "",
        classId,
        versionName: `Draft timetable ${formatBsDate(new Date())}`,
        effectiveFrom: currentYear?.startsOn ?? new Date().toISOString(),
      }),
    onSuccess: (version: TimetableVersionSummary) => {
      setSelectedVersionId(version.id);
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
  });

  const validateVersionMut = useMutation({
    mutationFn: api.validateTimetableVersion,
    onSuccess: setValidationResult,
  });

  const publishVersionMut = useMutation({
    mutationFn: api.publishTimetableVersion,
    onSuccess: () => {
      setConfirmAction(null);
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
  });

  const lockVersionMut = useMutation({
    mutationFn: api.lockTimetableVersion,
    onSuccess: () => {
      setConfirmAction(null);
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
  });

  const archiveVersionMut = useMutation({
    mutationFn: api.archiveTimetableVersion,
    onSuccess: () => {
      setConfirmAction(null);
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
  });

  const calculateNextEnd = (time: string) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + 45, 0, 0);
    return date.toTimeString().slice(0, 5);
  };

  const sectionsForClass = allSections.filter(
    (section) => section.classId === classId,
  );
  const rooms = roomsQuery.data ?? [];
  const versions = versionsQuery.data?.items ?? [];
  const activeVersionId = selectedVersionId || versions[0]?.id || "";
  const activeVersion = versions.find(
    (version) => version.id === activeVersionId,
  );
  const versionActionError =
    publishVersionMut.error?.message ||
    lockVersionMut.error?.message ||
    archiveVersionMut.error?.message ||
    createVersionMut.error?.message ||
    validateVersionMut.error?.message;

  // The conflict panel must stay visible while editing, not only after an
  // explicit "Validate" click — auto-check as soon as a version is active.
  // Clear stale results first so switching versions never shows the
  // previous version's conflicts while the new check is in flight.
  useEffect(() => {
    if (!activeVersionId) return;
    setValidationResult(null);
    validateVersionMut.mutate(activeVersionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersionId]);

  const gridByDay = daysOfWeek.reduce(
    (acc, day) => {
      acc[day.value] = timetable
        .filter((entry) => entry.dayOfWeek === day.value)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return acc;
    },
    {} as Record<number, TimetableSlotSummary[]>,
  );

  const confirmCopy = {
    publish: {
      title: "Publish timetable version?",
      description:
        "Publishing makes this timetable active for school operations. Backend validation remains the source of truth and will reject blocking conflicts.",
      confirmLabel: "Publish",
      variant: "default" as const,
    },
    lock: {
      title: "Lock timetable version?",
      description:
        "Locked timetable versions cannot be edited through normal workflows. Continue only after review is complete.",
      confirmLabel: "Lock Version",
      variant: "warning" as const,
    },
    archive: {
      title: "Archive timetable version?",
      description:
        "Archived versions are removed from normal active workflows. This action should be used for obsolete drafts or superseded versions.",
      confirmLabel: "Archive",
      variant: "destructive" as const,
    },
  };

  function runConfirmedAction() {
    if (!activeVersionId || !confirmAction) return;
    if (confirmAction === "publish") publishVersionMut.mutate(activeVersionId);
    if (confirmAction === "lock") lockVersionMut.mutate(activeVersionId);
    if (confirmAction === "archive") archiveVersionMut.mutate(activeVersionId);
  }

  return (
    <div className="space-y-8">
      <FilterBar
        label="Timetable Context"
        description="Select the class and academic year context before building or validating schedules."
        className="bg-white/90"
        actions={
          <Badge
            variant="outline"
            className="py-1.5 text-[10px] font-black uppercase tracking-widest"
          >
            {currentYear?.name ?? "No active year"}
          </Badge>
        }
      >
        <FormField
          label="Target Class"
          className="min-w-[260px] flex-1 max-w-md"
        >
          <Select
            value={classId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setClassId(e.target.value)
            }
          >
            <option value="">Choose a class to view/build timetable</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      </FilterBar>

      {!classId && (
        <PageState
          tone="info"
          title="Choose a class to start"
          description="Timetable builder, version workflow, conflict validation, and substitution records will appear after selecting a class."
        />
      )}

      {classId && (
        <div className="space-y-6">
          <AuditInfo>
            Timetable conflicts, publish eligibility, and lock/archive rules are
            validated by the backend. Frontend warnings are only a productivity
            aid.
          </AuditInfo>

          {versionActionError && (
            <PageState
              tone="danger"
              title="Timetable action failed"
              description={versionActionError}
              className="min-h-0 py-5"
            />
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Periods"
              value={periodsQuery.data?.length ?? 0}
              icon={<Clock className="h-5 w-5" />}
              loading={periodsQuery.isLoading}
            />
            <StatCard
              title="Rooms"
              value={rooms.length}
              icon={<CheckCircle2 className="h-5 w-5" />}
              loading={roomsQuery.isLoading}
            />

            <SectionCard title="Version Workflow" className="lg:col-span-2">
              <div className="space-y-4">
                {versionsQuery.isError ? (
                  <PageState
                    tone="danger"
                    title="Unable to load versions"
                    description={
                      versionsQuery.error?.message ??
                      "Timetable versions could not be loaded."
                    }
                    className="min-h-0 py-5"
                  />
                ) : (
                  <Select
                    value={activeVersionId}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                      setSelectedVersionId(event.target.value)
                    }
                  >
                    <option value="">Select version</option>
                    {versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.versionName} · {version.status}
                      </option>
                    ))}
                  </Select>
                )}

                {activeVersion && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-black uppercase tracking-widest"
                  >
                    Current: {activeVersion.status}
                  </Badge>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-full bg-slate-100 px-4 text-[10px] font-black uppercase tracking-widest text-slate-900 transition-colors hover:bg-slate-200"
                    onClick={() => createVersionMut.mutate()}
                    disabled={createVersionMut.isPending || !currentYear?.id}
                  >
                    <Plus className="h-3 w-3" />
                    New Draft
                  </button>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-full border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] px-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-homework-text)] transition-colors hover:bg-white"
                    onClick={() =>
                      activeVersionId &&
                      validateVersionMut.mutate(activeVersionId)
                    }
                    disabled={!activeVersionId || validateVersionMut.isPending}
                  >
                    <Zap className="h-3 w-3" />
                    Validate
                  </button>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-full bg-emerald-50 px-4 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100"
                    onClick={() => setConfirmAction("publish")}
                    disabled={!activeVersionId || publishVersionMut.isPending}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Publish
                  </button>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-full bg-slate-100 px-4 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-200"
                    onClick={() => setConfirmAction("lock")}
                    disabled={!activeVersionId || lockVersionMut.isPending}
                  >
                    <Lock className="h-3 w-3" />
                    Lock
                  </button>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-full bg-red-50 px-4 text-[10px] font-black uppercase tracking-widest text-red-700 transition-colors hover:bg-red-100"
                    onClick={() => setConfirmAction("archive")}
                    disabled={!activeVersionId || archiveVersionMut.isPending}
                  >
                    <Archive className="h-3 w-3" />
                    Archive
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {activeVersionId && (
            <SectionCard
              title="Conflict Validation"
              description="Stays current automatically as you add slots — no manual re-check needed."
              className={cn(
                "border-2",
                !validationResult
                  ? "border-slate-100"
                  : validationResult.valid
                    ? "border-emerald-100"
                    : "border-red-100",
              )}
            >
              {!validationResult ? (
                <LoadingState label="Checking for conflicts..." />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <p
                      className={cn(
                        "text-sm font-black uppercase tracking-widest",
                        validationResult.valid
                          ? "text-emerald-700"
                          : "text-red-700",
                      )}
                    >
                      {validationResult.valid
                        ? "No blocking conflicts"
                        : `${validationResult.errors.length} conflict(s) found`}
                    </p>
                  </div>
                  {!validationResult.valid && (
                    <div className="grid gap-2">
                      {validationResult.errors.slice(0, 3).map((issue) => (
                        <div
                          key={`${issue.type}-${issue.conflictingSlotId ?? issue.message}`}
                          className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-xs font-medium text-red-700"
                        >
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          <SectionCard
            title="Absent Teacher Substitution Management"
            description="Manage substitutions for missing teachers."
            headerAction={
              <Badge
                variant="secondary"
                className="text-[10px] font-black uppercase tracking-widest"
              >
                {substitutionsQuery.data?.meta.total ?? 0} Records
              </Badge>
            }
          >
            {substitutionsQuery.isLoading ? (
              <LoadingState />
            ) : substitutionsQuery.isError ? (
              <PageState
                tone="danger"
                title="Unable to load substitutions"
                description={
                  substitutionsQuery.error?.message ??
                  "Substitution records could not be loaded."
                }
              />
            ) : substitutionsQuery.data?.items.length ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {substitutionsQuery.data.items.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
                  >
                    <p className="text-xs font-black uppercase tracking-tight text-slate-900">
                      {item.status}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {formatTimetableDate(item.date)} ·{" "}
                      {item.reason?.trim() || "Reason not set"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No substitutions"
                description="No teacher substitutions recorded for this class."
                className="bg-slate-50/50"
              />
            )}
          </SectionCard>

          <div className="grid gap-8 lg:grid-cols-3">
            <SectionCard title="Add Schedule Slot" className="lg:col-span-1">
              <div className="space-y-6">
                <FormField label="Academic Year">
                  <Select
                    value={slot.academicYearId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSlot((c) => ({ ...c, academicYearId: e.target.value }))
                    }
                  >
                    <option value="">Select Year</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Section (Optional)">
                  <Select
                    value={slot.sectionId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSlot((c) => ({ ...c, sectionId: e.target.value }))
                    }
                  >
                    <option value="">Whole Class</option>
                    {sectionsForClass.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Subject">
                  <Select
                    value={slot.subjectId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSlot((c) => ({ ...c, subjectId: e.target.value }))
                    }
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code} - {subject.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Teacher">
                  <Select
                    value={slot.staffId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSlot((c) => ({ ...c, staffId: e.target.value }))
                    }
                  >
                    <option value="">Select Staff</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Day of Week">
                  <Select
                    value={slot.dayOfWeek}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setSlot((c) => ({
                        ...c,
                        dayOfWeek: Number(e.target.value),
                      }))
                    }
                  >
                    {daysOfWeek.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Starts At">
                    <Input
                      type="time"
                      value={slot.startsAt}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSlot((c) => ({ ...c, startsAt: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Ends At">
                    <Input
                      type="time"
                      value={slot.endsAt}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSlot((c) => ({ ...c, endsAt: e.target.value }))
                      }
                    />
                  </FormField>
                </div>

                <FormField label="Room">
                  <div className="space-y-3">
                    <Input
                      type="text"
                      placeholder="Custom room name"
                      value={slot.room}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSlot((c) => ({ ...c, room: e.target.value }))
                      }
                    />
                    <Select
                      value=""
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setSlot((c) => ({
                          ...c,
                          room:
                            rooms.find((room) => room.id === e.target.value)
                              ?.name ?? c.room,
                        }))
                      }
                    >
                      <option value="">Or use room record</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </FormField>

                {slotMut.isError && (
                  <PageState
                    tone="danger"
                    title="Slot could not be saved"
                    description={slotMut.error.message}
                    className="min-h-0 py-5"
                  />
                )}

                <button
                  type="button"
                  className="h-14 w-full rounded-2xl bg-[var(--color-mod-homework-accent)] text-xs font-black uppercase tracking-[0.2em] text-white shadow-sm transition-colors hover:bg-[var(--color-mod-homework-text)] disabled:opacity-50"
                  disabled={
                    !slot.academicYearId ||
                    !slot.subjectId ||
                    !slot.staffId ||
                    slot.startsAt >= slot.endsAt ||
                    slotMut.isPending
                  }
                  onClick={() =>
                    slotMut.mutate({
                      ...slot,
                      room: slot.room.trim(),
                      classId,
                      sectionId: slot.sectionId || null,
                    })
                  }
                >
                  {slotMut.isPending ? "Saving..." : "Add Slot to Schedule"}
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="Weekly Grid Visualization"
              className="lg:col-span-2"
            >
              {isLoadingTimetable ? (
                <LoadingState />
              ) : timetable.length === 0 ? (
                <EmptyState
                  title="No schedule created"
                  description="Start by adding slots using the form on the left."
                  className="bg-slate-50/50"
                />
              ) : (
                <div className="grid gap-6">
                  {daysOfWeek.map((day) => {
                    const daySlots = gridByDay[day.value];
                    if (!daySlots || daySlots.length === 0) return null;

                    return (
                      <div
                        key={day.value}
                        className="flex gap-6 border-b border-slate-100 pb-6 last:border-0 last:pb-0"
                      >
                        <div className="w-28 shrink-0 pt-1">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            {day.label}
                          </p>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-3">
                          {daySlots.map((s) => {
                            const hasConflict = validationResult?.errors.some(
                              (e) =>
                                e.conflictingSlotId === s.id ||
                                (e.affectedPeriodIds ?? []).includes(s.id),
                            );
                            return (
                              <div
                                key={s.id}
                                className={cn(
                                  "w-48 flex-shrink-0 space-y-2 rounded-2xl border p-4 transition-colors",
                                  hasConflict
                                    ? "border-red-200 bg-red-50 hover:bg-red-100/50"
                                    : "border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] hover:bg-white",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <p
                                      className={cn(
                                        "text-xs font-black uppercase leading-tight tracking-tight",
                                        hasConflict
                                          ? "text-red-900"
                                          : "text-[var(--color-mod-homework-text)]",
                                      )}
                                    >
                                      {s.subject?.code?.trim() ||
                                        "Code not set"}
                                    </p>
                                    {hasConflict && (
                                      <AlertCircle className="h-3 w-3 text-red-500" />
                                    )}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "px-1 py-0 text-[8px] font-black uppercase",
                                      hasConflict
                                        ? "border-red-200 text-red-400"
                                        : "border-[var(--color-mod-homework-border)] text-[var(--color-mod-homework-text)]",
                                    )}
                                  >
                                    {s.startsAt}
                                  </Badge>
                                </div>
                                <p
                                  className={cn(
                                    "truncate text-[10px] font-bold uppercase tracking-widest",
                                    hasConflict
                                      ? "text-red-700"
                                      : "text-slate-500",
                                  )}
                                >
                                  {formatSlotTeacher(s)}
                                </p>
                                {(s.section?.name || s.room) && (
                                  <div
                                    className={cn(
                                      "flex gap-2 text-[9px] font-black uppercase tracking-widest",
                                      hasConflict
                                        ? "text-red-300"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {s.section?.name && (
                                      <span>Sec {s.section.name}</span>
                                    )}
                                    {s.room && <span>• {s.room}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          isOpen={Boolean(confirmAction)}
          title={confirmCopy[confirmAction].title}
          description={confirmCopy[confirmAction].description}
          confirmLabel={confirmCopy[confirmAction].confirmLabel}
          variant={confirmCopy[confirmAction].variant}
          destructive={confirmAction === "archive"}
          isConfirming={
            publishVersionMut.isPending ||
            lockVersionMut.isPending ||
            archiveVersionMut.isPending
          }
          onConfirm={runConfirmedAction}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
