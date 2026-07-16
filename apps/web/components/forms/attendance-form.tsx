"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatNepalTime,
  getNepalNow,
  toBsDateFromGregorian,
} from "@schoolos/core";
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiRequestError } from "@/lib/api/client";
import {
  clearAttendanceDraft,
  createAttendanceDraftSubmissionId,
  readAttendanceDraft,
  storeAttendanceDraft,
  type AttendanceDraftStorageValue,
} from "@/lib/session";
import { useSession } from "@/components/session-provider";
import {
  canRestoreEditableAttendanceDraftAfterSyncError,
  shouldClearLocalAttendanceDraft,
} from "@/lib/offline-policy";
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

const nepalNow = getNepalNow();
const today = `${nepalNow.year}-${String(nepalNow.month).padStart(2, "0")}-${String(nepalNow.day).padStart(2, "0")}`;

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
  | "retrying"
  | "synced"
  | "conflict"
  | "recorded_conflict"
  | "rejected"
  | "server_check"
  | "failed";

type AttendanceStatusFilter = "ALL" | "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

const persistedAttendanceStatuses: AttendanceStatus[] = [
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
  const [statusFilter, setStatusFilter] =
    useState<AttendanceStatusFilter>("ALL");
  const [exceptions, setExceptions] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState("");
  const [draftSyncState, setDraftSyncState] = useState<DraftSyncState>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftClientSubmissionId, setDraftClientSubmissionId] = useState<
    string | null
  >(null);
  const [conflictMessage, setConflictMessage] = useState("");
  const [syncResultMessage, setSyncResultMessage] = useState("");
  const [lastServerSyncStatus, setLastServerSyncStatus] = useState<
    string | null
  >(null);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReceiptSyncPending, setIsReceiptSyncPending] = useState(false);
  const receiptSyncInFlightRef = useRef(false);

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
  const isTeacherPersona = Boolean(
    session?.user.roles.some((role) =>
      ["teacher", "subject_teacher"].includes(role),
    ) &&
    !session?.user.roles.some((role) => ["admin", "principal"].includes(role)),
  );
  const assignedSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter(
        (section) =>
          section.isAssignedClassTeacher || section.isAssignedSubjectTeacher,
      ),
    [sectionsQuery.data],
  );
  const assignedClassIds = useMemo(
    () =>
      new Set(
        assignedSections
          .map((section) => section.classId ?? section.class?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    [assignedSections],
  );
  const availableClasses = useMemo(
    () =>
      isTeacherPersona
        ? (classesQuery.data ?? []).filter((item) =>
            assignedClassIds.has(item.id),
          )
        : (classesQuery.data ?? []),
    [assignedClassIds, classesQuery.data, isTeacherPersona],
  );

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
  const hasPendingLocalDraft = Boolean(
    draftKey && draftClientSubmissionId && draftSavedAt,
  );

  const availableSections = useMemo(
    () =>
      (isTeacherPersona ? assignedSections : (sectionsQuery.data ?? [])).filter(
        (section) =>
          !classId ||
          (section.classId ?? section.class?.id) === classId,
      ),
    [assignedSections, classId, isTeacherPersona, sectionsQuery.data],
  );
  const roster = useMemo(
    () => rosterQuery.data?.students ?? [],
    [rosterQuery.data?.students],
  );
  const visibleRoster = useMemo(() => {
    if (statusFilter === "ALL") return roster;
    return roster.filter((student) => {
      const status = exceptions[student.id] ?? "PRESENT";
      return statusFilter === "LEAVE"
        ? ["SICK_LEAVE", "EXCUSED_LEAVE", "UNEXCUSED_LEAVE"].includes(status)
        : status === statusFilter;
    });
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
      availableClasses[0]
    ) {
      setClassId(availableClasses[0].id);
    }
  }, [
    availableClasses,
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
        setDraftClientSubmissionId(localDraft.clientSubmissionId);
        setExceptions(
          localDraft.exceptions as Record<string, AttendanceStatus>,
        );
        setRemarks(localDraft.remarks);
        setDraftSavedAt(localDraft.savedAt);
        const storedSyncStatus = String(
          localDraft.lastSyncStatus ?? "",
        ).toUpperCase();
        setLastServerSyncStatus(storedSyncStatus || null);
        if (storedSyncStatus === "REJECTED") {
          setDraftSyncState("rejected");
          setSyncResultMessage(
            "SchoolOS did not accept this attendance. Review and change the local draft before sending a revised submission.",
          );
        } else if (
          storedSyncStatus &&
          !shouldClearLocalAttendanceDraft(storedSyncStatus)
        ) {
          setDraftSyncState("server_check");
          setSyncResultMessage(
            "SchoolOS has not confirmed this attendance yet. Keep the draft and check the official roster before trying again.",
          );
        } else {
          setDraftSyncState("saved_local");
          setSyncResultMessage("");
        }
        setHasDraftChanges(true);
        setSubmitMessage("Recovered a locally saved attendance draft.");
        return;
      }

      setDraftClientSubmissionId(createAttendanceDraftSubmissionId());
      setDraftSavedAt(null);
      setDraftSyncState("idle");
      setSyncResultMessage("");
      setLastServerSyncStatus(null);

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
      !draftClientSubmissionId ||
      roster.length === 0 ||
      !hasDraftChanges ||
      rosterQuery.data?.existingSession?.submittedAt
    ) {
      return;
    }

    const savedAt = new Date().toISOString();
    const draft: AttendanceDraftStorageValue = {
      clientSubmissionId: draftClientSubmissionId,
      academicYearId,
      academicYearLabel:
        academicYearsQuery.data?.find((year) => year.id === academicYearId)
          ?.name ?? rosterQuery.data?.academicYear?.name,
      classId,
      classLabel:
        availableClasses.find((item) => item.id === classId)?.name ??
        rosterQuery.data?.class?.name,
      sectionId,
      sectionLabel:
        availableSections.find((item) => item.id === sectionId)?.name ??
        rosterQuery.data?.section?.name ??
        undefined,
      attendanceDate,
      exceptions,
      remarks,
      savedAt,
      serverSessionId: rosterQuery.data?.existingSession?.id ?? null,
      serverSubmittedAt: rosterQuery.data?.existingSession?.submittedAt ?? null,
      lastSyncStatus: lastServerSyncStatus ?? undefined,
    };

    let cancelled = false;
    void storeAttendanceDraft(draftKey, draft)
      .then(() => {
        if (cancelled) return;
        setDraftSavedAt(savedAt);
        if (
          ![
            "conflict",
            "recorded_conflict",
            "rejected",
            "server_check",
            "failed",
            "syncing",
            "retrying",
          ].includes(draftSyncState)
        ) {
          setDraftSyncState("saved_local");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDraftSyncState("failed");
        setSyncResultMessage(
          "This attendance draft could not be saved safely on this browser.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    academicYearId,
    academicYearsQuery.data,
    attendanceDate,
    availableClasses,
    availableSections,
    classId,
    draftKey,
    draftClientSubmissionId,
    draftSyncState,
    exceptions,
    hasDraftChanges,
    lastServerSyncStatus,
    remarks,
    roster.length,
    rosterQuery.data?.academicYear?.name,
    rosterQuery.data?.class?.name,
    rosterQuery.data?.existingSession?.id,
    rosterQuery.data?.existingSession?.submittedAt,
    rosterQuery.data?.section?.name,
    sectionId,
  ]);

  useEffect(() => {
    function handleOnline() {
      void saveDraftToServer();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
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
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["attendance-analytics"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["attendance-conflicts"],
      });
      void queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });

      const syncStatus = String(result?.syncStatus ?? "").toUpperCase();
      if (shouldClearLocalAttendanceDraft(syncStatus)) {
        void clearAttendanceDraft(draftKey);
        setDraftClientSubmissionId(null);
        setDraftSavedAt(null);
        setHasDraftChanges(false);
        setSyncResultMessage("");
        setLastServerSyncStatus(null);

        if (syncStatus === "CONFLICTED") {
          setDraftSyncState("recorded_conflict");
          setSubmitMessage("");
          setSyncResultMessage(
            "SchoolOS received this attendance and recorded a conflict for office review.",
          );
          return;
        }

        setDraftSyncState("synced");
        setSubmitMessage(
          `Attendance submitted and confirmed at ${formatNepalTime(new Date())}.`,
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setHasDraftChanges(true);
      setSubmitMessage("");
      setLastServerSyncStatus(syncStatus || "UNKNOWN");
      if (syncStatus === "REJECTED") {
        setDraftSyncState("rejected");
        setSyncResultMessage(
          "SchoolOS did not accept this attendance. Review and change the local draft before sending a revised submission.",
        );
        return;
      }

      setDraftSyncState("server_check");
      setSyncResultMessage(
        "SchoolOS has not confirmed this attendance yet. Keep the draft and check the official roster before trying again.",
      );
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
  const isSubmitted = attendanceState?.isSubmitted ?? false;
  const hasConflict = Boolean(
    attendanceState?.conflictStatus &&
    attendanceState.conflictStatus !== "NONE",
  );
  const submissionStatus = hasConflict
    ? "NEEDS_CORRECTION"
    : isLocked
      ? "LOCKED"
      : attendanceState?.isSubmitted
        ? "SUBMITTED"
        : hasDraftChanges || draftSyncState === "saved_local"
          ? "DRAFT"
          : "NOT_MARKED";
  const submissionStatusTone =
    submissionStatus === "NEEDS_CORRECTION"
      ? "conflict"
      : submissionStatus === "NOT_MARKED"
        ? "inactive"
        : undefined;

  const awaitingServerReceipt = draftSyncState === "server_check";

  const beginDraftEdit = () => {
    if (draftSyncState === "rejected") {
      setDraftClientSubmissionId(createAttendanceDraftSubmissionId());
      setDraftSyncState("saved_local");
      setSyncResultMessage("");
      setLastServerSyncStatus(null);
    }
    setHasDraftChanges(true);
  };

  const markAllPresent = () => {
    setExceptions({});
    beginDraftEdit();
  };

  const clearAll = () => {
    setExceptions({});
    setRemarks({});
    beginDraftEdit();
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
    if (
      !academicYearId ||
      !classId ||
      !draftClientSubmissionId ||
      !draftSavedAt ||
      roster.length === 0
    )
      return;
    if (hasReconnectConflict(rosterQuery.data?.existingSession, draftSavedAt)) {
      setDraftSyncState("conflict");
      setConflictMessage(
        "Server attendance was submitted after this local draft. Review before syncing.",
      );
      return;
    }

    setDraftSyncState(draftSyncState === "failed" ? "retrying" : "syncing");
    await saveDraftMutation.mutateAsync(buildDraftPayload());
  };

  const syncDraftSubmission = async () => {
    if (
      receiptSyncInFlightRef.current ||
      !draftKey ||
      !academicYearId ||
      !classId ||
      !draftClientSubmissionId ||
      roster.length === 0
    )
      return;
    if (hasReconnectConflict(rosterQuery.data?.existingSession, draftSavedAt)) {
      setDraftSyncState("conflict");
      setConflictMessage(
        "Server attendance was submitted after this local draft. Review before syncing.",
      );
      return;
    }

    receiptSyncInFlightRef.current = true;
    setIsReceiptSyncPending(true);

    const previousDraftSyncState = draftSyncState;
    const previousLastServerSyncStatus = lastServerSyncStatus;
    const receiptSavedAt = draftSavedAt ?? new Date().toISOString();
    const receiptProtectedDraft: AttendanceDraftStorageValue = {
      clientSubmissionId: draftClientSubmissionId,
      academicYearId,
      academicYearLabel:
        academicYearsQuery.data?.find((year) => year.id === academicYearId)
          ?.name ?? rosterQuery.data?.academicYear?.name,
      classId,
      classLabel:
        availableClasses.find((item) => item.id === classId)?.name ??
        rosterQuery.data?.class?.name,
      sectionId,
      sectionLabel:
        availableSections.find((item) => item.id === sectionId)?.name ??
        rosterQuery.data?.section?.name ??
        undefined,
      attendanceDate,
      exceptions,
      remarks,
      savedAt: receiptSavedAt,
      serverSessionId: rosterQuery.data?.existingSession?.id ?? null,
      serverSubmittedAt:
        rosterQuery.data?.existingSession?.submittedAt ?? null,
      lastSyncStatus: "PROCESSING",
    };

    try {
      // The receipt marker must commit before the POST. If browser storage is
      // unavailable, nothing is sent and the roster remains editable.
      await storeAttendanceDraft(draftKey, receiptProtectedDraft);
    } catch {
      setDraftSyncState("failed");
      setSyncResultMessage(
        "This attendance could not be protected on this browser, so nothing was sent. Free browser storage and try again.",
      );
      receiptSyncInFlightRef.current = false;
      setIsReceiptSyncPending(false);
      return;
    }

    setDraftSavedAt(receiptSavedAt);
    setHasDraftChanges(true);
    setLastServerSyncStatus("PROCESSING");
    setDraftSyncState("server_check");
    setSubmitMessage("");
    setSyncResultMessage(
      "SchoolOS is checking this attendance under its saved submission ID.",
    );

    try {
      await syncMutation.mutateAsync({
        clientSubmissionId: draftClientSubmissionId,
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
    } catch (error) {
      // A final 401 triggers the SessionProvider's real teardown. Do not race
      // that cleanup by recreating this account-scoped draft here.
      if (error instanceof ApiRequestError && error.statusCode === 401) {
        return;
      }

      if (canRestoreEditableAttendanceDraftAfterSyncError(error)) {
        const restoredDraft = {
          ...receiptProtectedDraft,
          lastSyncStatus: previousLastServerSyncStatus ?? undefined,
        };

        try {
          await storeAttendanceDraft(draftKey, restoredDraft);
        } catch {
          setLastServerSyncStatus("PROCESSING");
          setDraftSyncState("server_check");
          setSyncResultMessage(
            "SchoolOS did not receive this check, but the browser could not safely restore the earlier draft marker. Keep the same submission and check again.",
          );
          return;
        }

        setLastServerSyncStatus(previousLastServerSyncStatus);
        setDraftSyncState(
          previousDraftSyncState === "idle"
            ? "saved_local"
            : previousDraftSyncState,
        );
        setSyncResultMessage(
          "SchoolOS did not receive this submission. The local draft is still editable and nothing was queued.",
        );
        return;
      }

      const ambiguousDraft = {
        ...receiptProtectedDraft,
        lastSyncStatus: "TRANSPORT_AMBIGUOUS",
      };

      try {
        await storeAttendanceDraft(draftKey, ambiguousDraft);
        setLastServerSyncStatus("TRANSPORT_AMBIGUOUS");
      } catch {
        // The already committed PROCESSING marker remains the durable fallback.
        setLastServerSyncStatus("PROCESSING");
      }

      setDraftSyncState("server_check");
      setSyncResultMessage(
        "SchoolOS may have received this attendance, but the receipt did not return. Keep the same submission ID and check the server again before editing.",
      );
    } finally {
      receiptSyncInFlightRef.current = false;
      setIsReceiptSyncPending(false);
    }
  };

  const keepServerVersion = () => {
    void clearAttendanceDraft(draftKey);
    setDraftClientSubmissionId(null);
    setDraftSavedAt(null);
    setLastServerSyncStatus(null);
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
            ["conflict", "recorded_conflict", "server_check"].includes(
              draftSyncState,
            )
              ? "border-warning-200 bg-warning-50 text-warning-900"
              : ["failed", "rejected"].includes(draftSyncState)
                ? "border-danger-100 bg-danger-50 text-danger-800"
                : "border-info-100 bg-info-50 text-info-800",
          )}
        >
          <div className="flex items-center gap-3">
            <WifiOff size={18} />
            <span>
              {getDraftSyncLabel(
                draftSyncState,
                draftSavedAt,
                conflictMessage,
                syncResultMessage,
              )}
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
          ) : draftSyncState === "rejected" ? (
            <span className="max-w-xs text-right text-xs font-semibold">
              Change the draft below to prepare a new submission.
            </span>
          ) : hasPendingLocalDraft ? (
            <button
              type="button"
              onClick={() => void syncDraftSubmission()}
              disabled={syncMutation.isPending}
              className="rounded-xl border border-info-100 bg-white px-3 py-2 text-xs"
            >
              {draftSyncState === "server_check"
                ? "Check server again"
                : "Sync now"}
            </button>
          ) : null}
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
              {availableClasses.map((c) => (
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
                setStatusFilter(e.target.value as AttendanceStatusFilter)
              }
              className="premium-input bg-white focus:border-[var(--color-mod-attendance-accent)] focus:ring-[var(--color-mod-attendance-border)]"
              aria-label="Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="LEAVE">Leave / Excused</option>
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
              <StatusBadge
                status={submissionStatus}
                tone={submissionStatusTone}
                className="h-6"
              />
            </div>
            {roster.length > 0 && !awaitingServerReceipt && (
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
                label="Leave / Excused"
                value={totals.leave}
                className="text-info-700"
              />
            </div>

            {isLocked || isSubmitted ? (
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                <AlertCircle size={20} className="shrink-0 text-slate-500" />
                <span>
                  {isLocked ? "This day is locked" : "Attendance is submitted"}{" "}
                  and can no longer be edited or resubmitted here.{" "}
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
                student is absent, late, or on leave/excused.
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRoster.map((student) => (
                <AttendanceRosterItem
                  key={student.id}
                  student={student}
                  status={exceptions[student.id] ?? "PRESENT"}
                  remark={remarks[student.id] ?? ""}
                  disabled={isLocked || isSubmitted || awaitingServerReceipt}
                  onStatusChange={(status) => {
                    beginDraftEdit();
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
                    beginDraftEdit();
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
              isLocked ||
              isSubmitted ||
              awaitingServerReceipt ||
              draftSyncState === "rejected"
            }
            className="flex items-center gap-3 rounded-xl bg-[var(--color-mod-attendance-accent)] px-10 py-4 text-sm font-black text-white shadow-lg shadow-[var(--color-mod-attendance-border)]/40 transition-all hover:scale-105 hover:bg-[var(--color-mod-attendance-text)] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {mutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isLocked
              ? "Day Locked"
              : isSubmitted
                ? "Attendance Submitted"
                : "Submit Attendance"}
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
            disabled={
              saveDraftMutation.isPending ||
              roster.length === 0 ||
              !hasPendingLocalDraft ||
              awaitingServerReceipt ||
              draftSyncState === "rejected"
            }
            className="flex items-center gap-2 rounded-xl border border-[var(--color-mod-attendance-border)] bg-white px-4 py-2 text-xs font-bold text-[var(--color-mod-attendance-text)] transition-colors hover:bg-[var(--color-mod-attendance-soft)] disabled:opacity-50"
          >
            <Save size={14} />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => void syncDraftSubmission()}
            disabled={
              syncMutation.isPending ||
              roster.length === 0 ||
              !hasPendingLocalDraft ||
              draftSyncState === "rejected"
            }
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {awaitingServerReceipt ? "Check Server" : "Sync Draft"}
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
        description={`Are you sure you want to submit attendance for Class ${availableClasses.find((c) => c.id === classId)?.name ?? ""}? This will lock today's records.`}
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
  if (
    status &&
    persistedAttendanceStatuses.includes(status as AttendanceStatus)
  )
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
  syncResultMessage: string,
) {
  if (state === "syncing") return "Syncing attendance draft...";
  if (state === "retrying") return "Retrying attendance sync...";
  if (state === "synced") return "Draft synced with SchoolOS.";
  if (state === "recorded_conflict")
    return (
      syncResultMessage ||
      "SchoolOS recorded this attendance for office conflict review."
    );
  if (state === "rejected")
    return (
      syncResultMessage ||
      "SchoolOS did not accept this attendance. Review the local draft."
    );
  if (state === "server_check")
    return (
      syncResultMessage ||
      "SchoolOS has not confirmed this attendance. Keep the local draft."
    );
  if (state === "conflict")
    return conflictMessage || "Conflict found. Review before syncing.";
  if (state === "failed")
    return syncResultMessage || "Sync failed. Draft is still saved locally.";
  if (!savedAt) return "Not synced. Draft saved locally.";

  return `Not synced. Draft saved locally at ${formatNepalTime(savedAt)}.`;
}
