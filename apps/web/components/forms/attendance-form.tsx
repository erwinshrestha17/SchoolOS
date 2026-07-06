"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatNepalTime, toBsDateFromGregorian } from "@schoolos/core";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiRequestError } from "@/lib/api/client";
import {
  clearAttendanceDraft,
  readAttendanceDraft,
  storeAttendanceDraft,
  type AttendanceDraftStorageValue,
} from "@/lib/session";
import { useSession } from "@/components/session-provider";
import { SectionCard } from "@/components/ui/section-card";
import { ActionMenu } from "@/components/ui/action-menu";
import { AttendanceHeader } from "@/components/attendance/attendance-header";
import { AttendanceRosterItem } from "@/components/attendance/attendance-roster-item";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingState } from "@/components/ui/loading-state";
import {
  CheckCircle2,
  AlertCircle,
  Save,
  Download,
  Eraser,
  CheckSquare,
  Loader2,
  Info,
  WifiOff,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const today = new Date().toISOString().slice(0, 10);

type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "SICK_LEAVE"
  | "EXCUSED_LEAVE"
  | "UNEXCUSED_LEAVE";
type DraftSyncState =
  | "idle"
  | "saved_local"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

const statusCycle: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "SICK_LEAVE",
  "EXCUSED_LEAVE",
  "UNEXCUSED_LEAVE",
];

export function AttendanceForm() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<"ALL" | AttendanceStatus>(
    "ALL",
  );
  const [exceptions, setExceptions] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState("");
  const [draftSyncState, setDraftSyncState] = useState<DraftSyncState>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState("");
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });
  // Teachers may not hold academic_years:read; the roster API resolves the
  // tenant's current academic year server-side when the param is omitted.
  const yearListUnavailable = academicYearsQuery.isError;
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: api.listSections,
  });

  const rosterQuery = useQuery({
    queryKey: [
      "attendance-roster",
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
    ],
    queryFn: () =>
      api.getAttendanceRoster({
        academicYearId: academicYearId || undefined,
        classId,
        sectionId: sectionId || null,
        attendanceDate: new Date(attendanceDate).toISOString(),
      }),
    enabled: Boolean(
      (academicYearId || yearListUnavailable) &&
        classId &&
        !isFutureDate(attendanceDate),
    ),
  });

  const draftKey = useMemo(() => {
    if (
      !session?.tenant?.id ||
      !session.user.id ||
      !academicYearId ||
      !classId
    ) {
      return null;
    }

    return [
      "schoolos.attendance-draft",
      session.tenant.id,
      session.user.id,
      academicYearId,
      classId,
      sectionId || "all",
      attendanceDate,
    ].join(":");
  }, [academicYearId, attendanceDate, classId, sectionId, session]);

  const availableSections = (sectionsQuery.data ?? []).filter(
    (s) => !classId || (s.classId ?? s.class?.id) === classId,
  );
  const roster = useMemo(
    () => rosterQuery.data?.students ?? [],
    [rosterQuery.data?.students],
  );
  const visibleRoster = useMemo(() => {
    if (statusFilter === "ALL") return roster;
    return roster.filter(
      (student) => (exceptions[student.id] ?? "PRESENT") === statusFilter,
    );
  }, [exceptions, roster, statusFilter]);

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find(
      (year) => year.isCurrent,
    );
    if (currentAcademicYear && !academicYearId) {
      setAcademicYearId(currentAcademicYear.id);
    }
  }, [academicYearsQuery.data, academicYearId]);

  // When the year list is unreadable, the roster API resolves the current
  // year server-side; adopt its id so drafts and submissions stay scoped.
  useEffect(() => {
    const resolvedYearId = rosterQuery.data?.academicYear?.id;
    if (resolvedYearId && !academicYearId) {
      setAcademicYearId(resolvedYearId);
    }
  }, [rosterQuery.data?.academicYear?.id, academicYearId]);

  useEffect(() => {
    if (classId) return;

    // A teacher lands on a section they can actually mark (class-teacher
    // section first, then subject-teaching section); everyone else starts
    // on the first class so the roster area is never blank without context.
    const mySection =
      sectionsQuery.data?.find((section) => section.isAssignedClassTeacher) ??
      sectionsQuery.data?.find((section) => section.isAssignedSubjectTeacher);
    if (mySection) {
      const myClassId = mySection.classId ?? mySection.class?.id;
      if (myClassId) {
        setClassId(myClassId);
        setSectionId(mySection.id);
        return;
      }
    }

    if (
      (sectionsQuery.isSuccess || sectionsQuery.isError) &&
      classesQuery.data?.[0]
    ) {
      setClassId(classesQuery.data[0].id);
    }
  }, [
    classesQuery.data,
    classId,
    sectionsQuery.data,
    sectionsQuery.isSuccess,
    sectionsQuery.isError,
  ]);

  useEffect(() => {
    if (!rosterQuery.data) return;
    let cancelled = false;

    async function loadDraftOrRoster() {
      const localDraft = await readAttendanceDraft(draftKey);
      if (cancelled) return;

      if (localDraft) {
        setExceptions(
          localDraft.exceptions as Record<string, AttendanceStatus>,
        );
        setRemarks(localDraft.remarks);
        setDraftSavedAt(localDraft.savedAt);
        setDraftSyncState("saved_local");
        setHasDraftChanges(true);
        setSubmitMessage("Recovered a locally saved attendance draft.");
        return;
      }

      const nextExceptions: Record<string, AttendanceStatus> = {};
      const nextRemarks: Record<string, string> = {};
      rosterQuery.data?.students.forEach((student) => {
        const normalized = normalizeStatus(student.status);
        if (normalized !== "PRESENT") nextExceptions[student.id] = normalized;
        if (student.remark) nextRemarks[student.id] = student.remark;
      });
      setExceptions(nextExceptions);
      setRemarks(nextRemarks);
      setHasDraftChanges(false);
      setSubmitMessage("");
      setConflictMessage("");
    }

    void loadDraftOrRoster();

    return () => {
      cancelled = true;
    };
  }, [draftKey, rosterQuery.data]);

  useEffect(() => {
    if (
      !draftKey ||
      !academicYearId ||
      !classId ||
      roster.length === 0 ||
      !hasDraftChanges ||
      rosterQuery.data?.existingSession?.submittedAt
    ) {
      return;
    }

    const savedAt = new Date().toISOString();
    const draft: AttendanceDraftStorageValue = {
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
      exceptions,
      remarks,
      savedAt,
      serverSessionId: rosterQuery.data?.existingSession?.id ?? null,
      serverSubmittedAt: rosterQuery.data?.existingSession?.submittedAt ?? null,
    };

    void storeAttendanceDraft(draftKey, draft);
    setDraftSavedAt(savedAt);
    if (draftSyncState !== "conflict") {
      setDraftSyncState("saved_local");
    }
  }, [
    academicYearId,
    attendanceDate,
    classId,
    draftKey,
    draftSyncState,
    exceptions,
    hasDraftChanges,
    remarks,
    roster.length,
    rosterQuery.data?.existingSession?.id,
    rosterQuery.data?.existingSession?.submittedAt,
    sectionId,
  ]);

  useEffect(() => {
    function handleOnline() {
      void saveDraftToServer();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  });

  const mutation = useMutation({
    mutationFn: api.submitAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });
      void clearAttendanceDraft(draftKey);
      setDraftSyncState("synced");
      setHasDraftChanges(false);
      setSubmitMessage(
        `Attendance submitted successfully at ${formatNepalTime(new Date())}.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: api.saveAttendanceDraft,
    onSuccess: () => {
      setDraftSyncState("synced");
      setHasDraftChanges(false);
      setSubmitMessage(`Draft saved at ${formatNepalTime(new Date())}.`);
    },
    onError: () => {
      setDraftSyncState("failed");
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.syncAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["attendance-analytics"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["attendance-conflicts"],
      });
      void clearAttendanceDraft(draftKey);
      setDraftSyncState("synced");
      setHasDraftChanges(false);
      setSubmitMessage(
        `Offline draft synchronized successfully at ${formatNepalTime(new Date())}.`,
      );
    },
    onError: () => {
      setDraftSyncState("failed");
    },
  });

  const futureDateBlocked = isFutureDate(attendanceDate);

  const totals = useMemo(() => {
    return roster.reduce(
      (acc, s) => {
        const status = exceptions[s.id] ?? "PRESENT";
        acc.total++;
        if (status === "PRESENT") acc.present++;
        else if (status === "ABSENT") acc.absent++;
        else if (status === "LATE") acc.late++;
        else acc.leave++;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, leave: 0 },
    );
  }, [roster, exceptions]);

  const presentPercent =
    totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
  const attendanceState = rosterQuery.data?.attendanceState;
  const isLocked = attendanceState?.isLocked ?? false;
  const hasConflict = Boolean(
    attendanceState?.conflictStatus &&
      attendanceState.conflictStatus !== "NONE",
  );
  const submissionStatus = hasConflict
    ? "CONFLICT"
    : isLocked
      ? "LOCKED"
      : attendanceState?.isSubmitted
        ? "SUBMITTED"
        : "NOT_STARTED";

  const markAllPresent = () => {
    setExceptions({});
    setHasDraftChanges(true);
  };

  const clearAll = () => {
    setExceptions({});
    setRemarks({});
    setHasDraftChanges(true);
  };

  const buildDraftPayload = () => ({
    academicYearId,
    classId,
    sectionId: sectionId || null,
    attendanceDate: new Date(attendanceDate).toISOString(),
    payload: {
      exceptions: Object.entries(exceptions).map(([studentId, status]) => ({
        studentId,
        status,
        remark: remarks[studentId]?.trim() || null,
      })),
      savedAt: draftSavedAt ?? new Date().toISOString(),
      rosterCount: roster.length,
    },
  });

  const saveDraftToServer = async () => {
    if (!academicYearId || !classId || roster.length === 0) return;
    if (hasReconnectConflict(rosterQuery.data?.existingSession, draftSavedAt)) {
      setDraftSyncState("conflict");
      setConflictMessage(
        "Server attendance was submitted after this local draft. Review before syncing.",
      );
      return;
    }

    setDraftSyncState("syncing");
    await saveDraftMutation.mutateAsync(buildDraftPayload());
  };

  const syncDraftSubmission = async () => {
    if (!academicYearId || !classId || roster.length === 0) return;
    if (hasReconnectConflict(rosterQuery.data?.existingSession, draftSavedAt)) {
      setDraftSyncState("conflict");
      setConflictMessage(
        "Server attendance was submitted after this local draft. Review before syncing.",
      );
      return;
    }

    setDraftSyncState("syncing");
    await syncMutation.mutateAsync({
      clientSubmissionId: `web-draft-${draftKey ?? createDraftFallbackId()}`,
      deviceTimestamp: new Date().toISOString(),
      academicYearId,
      classId,
      sectionId: sectionId || null,
      attendanceDate: new Date(attendanceDate).toISOString(),
      exceptions: Object.entries(exceptions).map(([studentId, status]) => ({
        studentId,
        status,
        remark: remarks[studentId]?.trim() || null,
      })),
    });
  };

  const keepServerVersion = () => {
    void clearAttendanceDraft(draftKey);
    setDraftSyncState("synced");
    setConflictMessage("");
    void queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {submitMessage && (
        <div className="animate-in slide-in-from-top-4 flex items-center gap-4 rounded-xl border border-success-100 bg-success-50 p-4 text-sm font-bold text-success-800 duration-500">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-500 text-white shadow-lg shadow-success-500/20">
            <CheckCircle2 size={20} />
          </div>
          {submitMessage}
        </div>
      )}

      {draftSyncState !== "idle" && (
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-sm font-bold",
            draftSyncState === "conflict"
              ? "border-warning-200 bg-warning-50 text-warning-900"
              : draftSyncState === "failed"
                ? "border-danger-100 bg-danger-50 text-danger-800"
                : "border-info-100 bg-info-50 text-info-800",
          )}
        >
          <div className="flex items-center gap-3">
            <WifiOff size={18} />
            <span>
              {getDraftSyncLabel(draftSyncState, draftSavedAt, conflictMessage)}
            </span>
          </div>
          {draftSyncState === "conflict" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={keepServerVersion}
                className="rounded-xl border border-warning-200 bg-white px-3 py-2 text-xs"
              >
                Keep server version
              </button>
              <button
                type="button"
                onClick={() =>
                  setConflictMessage(
                    "Review the local draft below, then request correction if attendance is submitted or locked.",
                  )
                }
                className="rounded-xl bg-warning-600 px-3 py-2 text-xs text-white"
              >
                Review local draft
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void syncDraftSubmission()}
              className="rounded-xl border border-info-100 bg-white px-3 py-2 text-xs"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {/* Roster state strip appears only once a real roster is loaded;
          rendering zeros before class selection reads as fake data. */}
      {roster.length > 0 ? (
        <AttendanceHeader
          total={totals.total}
          presentPercent={presentPercent}
          exceptions={totals.absent + totals.late + totals.leave}
        />
      ) : null}

      <FilterBar
        label="Attendance Filters"
        description="Choose the school date and assigned class context before marking attendance."
      >
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Academic Year
            </label>
            {yearListUnavailable ? (
              <input
                type="text"
                readOnly
                value={
                  rosterQuery.data?.academicYear?.name ??
                  "Current academic year"
                }
                title="Attendance is marked in the school's current academic year."
                className="premium-input bg-slate-50 text-slate-600"
                aria-label="Academic Year (current year, set by the school)"
              />
            ) : (
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="premium-input bg-white focus:border-[var(--color-mod-attendance-accent)] focus:ring-[var(--color-mod-attendance-border)]"
                aria-label="Academic Year"
              >
                <option value="">Select Year</option>
                {academicYearsQuery.data?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.isCurrent ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
              }}
              className="premium-input bg-white focus:border-[var(--color-mod-attendance-accent)] focus:ring-[var(--color-mod-attendance-border)]"
              aria-label="Class"
            >
              <option value="">Select Class</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Section
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="premium-input bg-white focus:border-[var(--color-mod-attendance-accent)] focus:ring-[var(--color-mod-attendance-border)]"
              aria-label="Section"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Date
            </label>
            <input
              type="date"
              value={attendanceDate}
              max={today}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="premium-input bg-white focus:border-[var(--color-mod-attendance-accent)] focus:ring-[var(--color-mod-attendance-border)]"
              aria-label="Date"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | AttendanceStatus)
              }
              className="premium-input bg-white focus:border-[var(--color-mod-attendance-accent)] focus:ring-[var(--color-mod-attendance-border)]"
              aria-label="Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="SICK_LEAVE">Sick Leave</option>
              <option value="EXCUSED_LEAVE">Excused Leave</option>
              <option value="UNEXCUSED_LEAVE">Unexcused Leave</option>
            </select>
          </div>
        </div>
      </FilterBar>

      <SectionCard
        title="Attendance Roster"
        description="Mark student attendance states. Present is the default; record exceptions with remarks."
        headerAction={
          <div className="flex items-center gap-3">
            <div className="mr-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2">
              <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">
                Status:
              </span>
              <StatusBadge status={submissionStatus} className="h-6" />
            </div>
            {roster.length > 0 && (
              <ActionMenu
                label="Open attendance roster actions"
                items={[
                  {
                    label: "Mark all present",
                    icon: <CheckSquare size={16} />,
                    onClick: markAllPresent,
                  },
                  {
                    label: "Clear exceptions",
                    icon: <Eraser size={16} />,
                    onClick: clearAll,
                  },
                ]}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <MoreHorizontal size={14} />
                    More Actions
                  </button>
                }
              />
            )}
          </div>
        }
      >
        {rosterQuery.isLoading ? (
          <LoadingState label="Loading roster..." />
        ) : rosterQuery.isError ? (
          rosterQuery.error instanceof ApiRequestError &&
          rosterQuery.error.statusCode === 403 ? (
            <PermissionDenied
              title="This roster is not available to your account"
              description={
                rosterQuery.error.message ||
                "Attendance marking is limited to assigned class teachers. Ask a school administrator if you believe you should have access."
              }
              resource="Attendance roster"
              showNavigation={false}
            />
          ) : (
            <ErrorState
              title="Attendance roster could not load"
              error={rosterQuery.error}
              onRetry={() => void rosterQuery.refetch()}
            />
          )
        ) : futureDateBlocked ? (
          <EmptyState
            title="Date Not Allowed"
            description="Please select a date that is not in the future."
            icon={<AlertCircle size={32} />}
          />
        ) : roster.length === 0 ? (
          <EmptyState
            title="No Students Found"
            description={
              classId
                ? "The selected class/section appears to be empty."
                : "Please select a class to view the roster."
            }
            action={
              !classId ? undefined : (
                <Link
                  href="/dashboard/students"
                  className="text-sm font-bold text-[var(--color-mod-attendance-text)] hover:underline"
                >
                  Manage Student Roster
                </Link>
              )
            }
          />
        ) : visibleRoster.length === 0 ? (
          <EmptyState
            title="No students match this status"
            description="Adjust the status filter to continue marking this roster."
            icon={<AlertCircle size={32} />}
          />
        ) : (
          <div className="space-y-6">
            <div
              className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"
              data-testid="attendance-count-summary"
            >
              <SummaryPill
                label="Present"
                value={totals.present}
                className="text-success-700"
              />
              <SummaryPill
                label="Absent"
                value={totals.absent}
                className="text-danger-700"
              />
              <SummaryPill
                label="Late"
                value={totals.late}
                className="text-warning-700"
              />
              <SummaryPill
                label="Leave / Other"
                value={totals.leave}
                className="text-info-700"
              />
            </div>

            {isLocked ? (
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                <AlertCircle size={20} className="shrink-0 text-slate-500" />
                <span>
                  This day is locked and can no longer be edited or
                  resubmitted here.{" "}
                  <Link
                    href="/dashboard/attendance/corrections"
                    className="underline hover:no-underline"
                  >
                    Request a correction
                  </Link>{" "}
                  if this record needs to change.
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-info-100 bg-info-50 px-4 py-3 text-sm text-info-800">
                Everyone is present by default. Mark exceptions only when a
                student is absent, late, sick leave, excused leave, or
                unexcused leave.
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRoster.map((student) => (
                <AttendanceRosterItem
                  key={student.id}
                  student={student}
                  status={exceptions[student.id] ?? "PRESENT"}
                  remark={remarks[student.id] ?? ""}
                  disabled={isLocked}
                  onStatusChange={(status) => {
                    setHasDraftChanges(true);
                    setExceptions((current) => {
                      const next = { ...current };
                      if (status === "PRESENT") {
                        delete next[student.id];
                      } else {
                        next[student.id] = status;
                      }
                      return next;
                    });
                  }}
                  onRemarkChange={(remark) => {
                    setHasDraftChanges(true);
                    setRemarks((current) => ({
                      ...current,
                      [student.id]: remark,
                    }));
                  }}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <strong>Offline sync:</strong> Sync offline draft changes and
              review conflicts before final submission.
            </div>
          </div>
        )}
      </SectionCard>

      {/* Summary Floating Bar */}
      {roster.length > 0 && (
        <div className="animate-in slide-in-from-bottom-8 fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-8 rounded-xl border border-white/10 bg-[var(--color-mod-attendance-text)]/95 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.28)] backdrop-blur-xl duration-700">
          <div className="flex items-center gap-8 px-4">
            <SummaryStat
              label="Present"
              value={totals.present}
              color="text-success-400"
            />
            <SummaryStat
              label="Absent"
              value={totals.absent}
              color="text-danger-400"
            />
            <SummaryStat
              label="Late"
              value={totals.late}
              color="text-warning-400"
            />
            <div className="h-10 w-px bg-white/10 mx-2" />
            <div className="flex flex-col">
              <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.2em]">
                Completion
              </span>
              <span className="text-xl font-black">{presentPercent}%</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={
              mutation.isPending ||
              roster.length === 0 ||
              futureDateBlocked ||
              isLocked
            }
            className="flex items-center gap-3 rounded-xl bg-[var(--color-mod-attendance-accent)] px-10 py-4 text-sm font-black text-white shadow-lg shadow-[var(--color-mod-attendance-border)]/40 transition-all hover:scale-105 hover:bg-[var(--color-mod-attendance-text)] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {mutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isLocked ? "Day Locked" : "Submit Attendance"}
          </button>
        </div>
      )}

      {mutation.isError && (
        <div className="animate-fade-in flex items-center gap-4 rounded-xl border border-danger-100 bg-danger-50 p-6 text-sm font-bold text-danger-800 shadow-lg">
          <AlertCircle size={24} className="text-danger-500" />
          <div className="flex flex-col">
            <span className="text-[0.65rem] uppercase tracking-widest text-danger-600 mb-1">
              Submission Error
            </span>
            Attendance could not be submitted. Check the selected class, date,
            and attendance status, then try again.
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <div className="flex items-center gap-4 text-slate-600">
          <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
            <Download size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Offline sync</p>
            <p className="text-[0.65rem] mt-0.5">
              Sync offline draft and review conflicts before final submission.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void saveDraftToServer()}
            disabled={saveDraftMutation.isPending || roster.length === 0}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-mod-attendance-border)] bg-white px-4 py-2 text-xs font-bold text-[var(--color-mod-attendance-text)] transition-colors hover:bg-[var(--color-mod-attendance-soft)] disabled:opacity-50"
          >
            <Save size={14} />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => void syncDraftSubmission()}
            disabled={syncMutation.isPending || roster.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            Sync Draft
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 text-slate-500">
          <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center">
            <Info size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Attendance Policy
            </p>
            <p className="text-[0.65rem] mt-0.5">
              Final submission locks records for the day. Corrections require
              administrative approval.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const bsDate = toBsDateFromGregorian(attendanceDate);
            void api.exportAttendanceRegister(
              {
                academicYearId,
                classId,
                sectionId: sectionId || null,
                bsMonth: bsDate.month,
                bsYear: bsDate.year,
              },
              "csv",
            );
          }}
          disabled={!academicYearId || !classId}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirm Attendance Submission"
        description={`Are you sure you want to submit attendance for Class ${classesQuery.data?.find((c) => c.id === classId)?.name ?? ""}? This will lock today's records.`}
        confirmLabel={mutation.isPending ? "Submitting..." : "Submit"}
        cancelLabel="Review"
        isConfirming={mutation.isPending}
        onConfirm={() => {
          mutation.mutate({
            academicYearId,
            classId,
            sectionId: sectionId || null,
            attendanceDate: new Date(attendanceDate).toISOString(),
            exceptions: Object.entries(exceptions).map(
              ([studentId, status]) => ({
                studentId,
                status,
                remark: remarks[studentId]?.trim() || null,
              }),
            ),
          });
          setIsConfirmOpen(false);
        }}
        onClose={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-[0.2em]">
        {label}
      </span>
      <span className={cn("text-xl font-black", color)}>{value}</span>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-white bg-white px-4 py-3 shadow-sm">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-black tracking-tight", className)}>
        {value}
      </p>
    </div>
  );
}

function normalizeStatus(status: string | null | undefined): AttendanceStatus {
  if (status && statusCycle.includes(status as AttendanceStatus))
    return status as AttendanceStatus;
  if (status === "A" || status === "ABSENT") return "ABSENT";
  if (status === "L" || status === "LATE") return "LATE";
  if (status === "LS" || status === "SICK_LEAVE") return "SICK_LEAVE";
  if (status === "LE" || status === "EXCUSED_LEAVE") return "EXCUSED_LEAVE";
  if (status === "LU" || status === "UNEXCUSED_LEAVE") return "UNEXCUSED_LEAVE";
  return "PRESENT";
}

function isFutureDate(value: string) {
  return value > today;
}

function createDraftFallbackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasReconnectConflict(
  existingSession: { submittedAt: string | null } | null | undefined,
  localSavedAt: string | null,
) {
  if (!existingSession?.submittedAt || !localSavedAt) return false;
  return (
    new Date(existingSession.submittedAt).getTime() >
    new Date(localSavedAt).getTime()
  );
}

function getDraftSyncLabel(
  state: DraftSyncState,
  savedAt: string | null,
  conflictMessage: string,
) {
  if (state === "syncing") return "Syncing attendance draft...";
  if (state === "synced") return "Draft synced with SchoolOS.";
  if (state === "conflict")
    return conflictMessage || "Conflict found. Review before syncing.";
  if (state === "failed") return "Sync failed. Draft is still saved locally.";
  if (!savedAt) return "Draft saved locally.";

  return `Saved locally at ${formatNepalTime(savedAt)}.`;
}
