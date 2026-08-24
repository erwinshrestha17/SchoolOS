"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatNepalTime,
  getNepalNow,
  toBsDateFromGregorian,
} from "@schoolos/core";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ApiRequestError } from "@/lib/api/client";
import {
  captureAttendanceDraftStorageTicket,
  clearAttendanceDraft,
  createAttendanceDraftSubmissionId,
  isAttendanceDraftReceiptBarrierStorageEvent,
  isAttendanceDraftStorageTicketCurrent,
  readAttendanceDraft,
  sanitizeAttendanceDraftForAccessRevocation,
  storeAttendanceDraft,
  type AttendanceDraftStorageTicket,
  type AttendanceDraftStorageValue,
} from "@/lib/session";
import { useSession } from "@/components/session-provider";
import { useTeacherAccess } from "@/lib/teacher-access";
import { useAttendanceCapabilities } from "@/lib/permissions-ui";
import { LockedRecordBanner } from "@/components/ui/locked-record-banner";
import { formatSchoolDate } from "@/lib/date-utils";
import {
  canRestoreEditableAttendanceDraftAfterSyncError,
  OfflineMutationError,
  shouldClearLocalAttendanceDraft,
} from "@/lib/offline-policy";
import {
  createAccessRevocationReceipt,
  createPurposeLimitedAttendanceReceipt,
} from "@/lib/attendance-draft-access-revocation";
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
import { Button } from "@/components/ui/button";

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
  | "queued"
  | "syncing"
  | "retrying"
  | "synced"
  | "accepted"
  | "conflict"
  | "recorded_conflict"
  | "rejected"
  | "authorization_denied"
  | "access_revoked"
  | "storage_unavailable"
  | "server_check"
  | "failed";

type AttendanceStatusFilter = "ALL" | "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

export interface AttendanceDraftRecoveryScope {
  academicYearId: string;
  classId: string;
  sectionId?: string;
  attendanceDate: string;
}

const persistedAttendanceStatuses: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "SICK_LEAVE",
  "EXCUSED_LEAVE",
  "UNEXCUSED_LEAVE",
];

const receiptProtectedFinalSubmissionStatuses = [
  "QUEUED",
  "PROCESSING",
  "TRANSPORT_AMBIGUOUS",
] as const;

export function AttendanceForm({
  initialDraftScope,
}: {
  initialDraftScope?: AttendanceDraftRecoveryScope;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const [academicYearId, setAcademicYearId] = useState(
    () => normalizeDraftScopeId(initialDraftScope?.academicYearId) ?? "",
  );
  const [classId, setClassId] = useState(
    () => normalizeDraftScopeId(initialDraftScope?.classId) ?? "",
  );
  const [sectionId, setSectionId] = useState(
    () => normalizeDraftScopeId(initialDraftScope?.sectionId) ?? "",
  );
  const [attendanceDate, setAttendanceDate] = useState(() =>
    normalizeDraftRecoveryDate(initialDraftScope?.attendanceDate),
  );
  const [statusFilter, setStatusFilter] =
    useState<AttendanceStatusFilter>("ALL");
  const [exceptions, setExceptions] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState("");
  // Explicit acknowledgement for the one submission that is indistinguishable
  // from an untouched form: zero exceptions on a default-present roster.
  const [allPresentAcknowledged, setAllPresentAcknowledged] = useState(false);
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
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const [draftHydrationAttempt, setDraftHydrationAttempt] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isOverrideConfirmOpen, setIsOverrideConfirmOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [baselineExceptions, setBaselineExceptions] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [baselineRemarks, setBaselineRemarks] = useState<
    Record<string, string>
  >({});
  const [isReceiptSyncPending, setIsReceiptSyncPending] = useState(false);
  const [isKeepingServerVersion, setIsKeepingServerVersion] = useState(false);
  const [
    shouldReplayRecoveredFinalSubmission,
    setShouldReplayRecoveredFinalSubmission,
  ] = useState(false);
  const receiptSyncInFlightRef = useRef(false);
  const serverDraftSaveInFlightRef = useRef(false);
  const keepServerVersionInFlightRef = useRef(false);
  const rosterAccessDeniedHandledKeyRef = useRef<string | null>(null);
  const reconnectActionRef = useRef<() => void>(() => undefined);
  const submissionFeedbackRef = useRef<HTMLDivElement>(null);
  const activeDraftKeyRef = useRef<string | null>(null);
  const componentMountedRef = useRef(false);
  const sessionIdentityKey = session
    ? `${session.tenant.id}:${session.user.id}`
    : "anonymous";
  const draftStorageAuthorityRef = useRef<{
    identityKey: string;
    ticket: AttendanceDraftStorageTicket;
  } | null>(null);
  if (
    !draftStorageAuthorityRef.current ||
    draftStorageAuthorityRef.current.identityKey !== sessionIdentityKey
  ) {
    draftStorageAuthorityRef.current = {
      identityKey: sessionIdentityKey,
      ticket: captureAttendanceDraftStorageTicket(),
    };
  }

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
  const { isTeacherPersona } = useTeacherAccess();
  const { canOverrideLock } = useAttendanceCapabilities();
  const policyQuery = useQuery({
    queryKey: ["attendance-m2-policy"],
    queryFn: api.getM2Policy,
  });
  const lockOverrideMinReasonLength =
    policyQuery.data?.policy.lockOverrideMinReasonLength ?? 8;
  const assignedSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter(
        (section) => section.isAssignedClassTeacher,
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
  activeDraftKeyRef.current = draftKey;
  const draftScopeHydrated = Boolean(draftKey && hydratedDraftKey === draftKey);
  const hasPendingLocalDraft = Boolean(
    draftScopeHydrated && draftKey && draftClientSubmissionId && draftSavedAt,
  );
  const rosterAccessDenied =
    rosterQuery.error instanceof ApiRequestError &&
    rosterQuery.error.statusCode === 403;
  const routeScopeDisclosureBlocked = Boolean(
    rosterAccessDenied ||
      (draftScopeHydrated &&
        ["authorization_denied", "access_revoked"].includes(draftSyncState)),
  );

  const availableSections = useMemo(
    () =>
      (isTeacherPersona ? assignedSections : (sectionsQuery.data ?? [])).filter(
        (section) =>
          !classId || (section.classId ?? section.class?.id) === classId,
      ),
    [assignedSections, classId, isTeacherPersona, sectionsQuery.data],
  );
  const roster = useMemo(
    () => rosterQuery.data?.students ?? [],
    [rosterQuery.data?.students],
  );
  const purgeRevokedRosterData = useCallback(() => {
    setExceptions({});
    setRemarks({});
    setBaselineExceptions({});
    setBaselineRemarks({});
    setHasDraftChanges(false);
    setAllPresentAcknowledged(false);
    setOverrideReason("");
    queryClient.removeQueries({ queryKey: ["attendance-roster"] });
  }, [queryClient]);
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
    if (routeScopeDisclosureBlocked) {
      if (`${window.location.pathname}${window.location.search}` !== pathname) {
        router.replace(pathname, { scroll: false });
      }
      return;
    }
    if (!academicYearId || !classId) return;

    const search = new URLSearchParams({
      academicYearId,
      classId,
      attendanceDate,
    });
    if (sectionId) search.set("sectionId", sectionId);
    const nextHref = `${pathname}?${search.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== nextHref) {
      router.replace(nextHref, { scroll: false });
    }
  }, [
    academicYearId,
    attendanceDate,
    classId,
    pathname,
    routeScopeDisclosureBlocked,
    router,
    sectionId,
  ]);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      activeDraftKeyRef.current = null;
    };
  }, []);

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
    if (!draftKey) return;
    let cancelled = false;

    async function loadDraftOrRoster() {
      const storageTicket = draftStorageAuthorityRef.current!.ticket;
      const draftRead = await readAttendanceDraft(draftKey, {
        ticket: storageTicket,
      });
      if (cancelled) return;

      if (draftRead.status === "unavailable") {
        if (
          !isAttendanceDraftStorageTicketCurrent(storageTicket) ||
          draftStorageAuthorityRef.current?.ticket !== storageTicket
        ) {
          return;
        }

        setDraftClientSubmissionId(null);
        setExceptions({});
        setRemarks({});
        setBaselineExceptions({});
        setBaselineRemarks({});
        setDraftSavedAt(null);
        setLastServerSyncStatus(null);
        setShouldReplayRecoveredFinalSubmission(false);
        setDraftSyncState("storage_unavailable");
        setSyncResultMessage(
          "SchoolOS could not read this browser's saved attendance state. The roster stays hidden because an unconfirmed receipt may be stored here.",
        );
        setHasDraftChanges(false);
        setSubmitMessage("");
        setConflictMessage("");
        setHydratedDraftKey(draftKey);
        return;
      }

      const localDraft = draftRead.status === "found" ? draftRead.draft : null;

      if (localDraft) {
        const storedSyncStatus = String(
          localDraft.lastSyncStatus ?? "",
        ).toUpperCase();
        const accessRevocationStatus =
          storedSyncStatus === "AUTHORIZATION_DENIED"
            ? "AUTHORIZATION_DENIED"
            : storedSyncStatus === "ACCESS_REVALIDATION_REQUIRED"
              ? "ACCESS_REVALIDATION_REQUIRED"
              : null;
        if (accessRevocationStatus) {
          let sanitizedReceipt = createAccessRevocationReceipt(
            localDraft,
            accessRevocationStatus,
          );
          try {
            sanitizedReceipt = await sanitizeAttendanceDraftForAccessRevocation(
              draftKey,
              sanitizedReceipt,
              accessRevocationStatus,
              { ticket: storageTicket },
            );
          } catch {
            // Keep the roster hidden even when this browser cannot rewrite an
            // older denial record. A later read will attempt sanitization again.
          }
          if (cancelled) return;
          setDraftClientSubmissionId(sanitizedReceipt.clientSubmissionId);
          setExceptions({});
          setRemarks({});
          setBaselineExceptions({});
          setBaselineRemarks({});
          setDraftSavedAt(sanitizedReceipt.savedAt);
          setLastServerSyncStatus(storedSyncStatus);
          setShouldReplayRecoveredFinalSubmission(false);
          setDraftSyncState(
            storedSyncStatus === "AUTHORIZATION_DENIED"
              ? "authorization_denied"
              : "access_revoked",
          );
          setSyncResultMessage(
            storedSyncStatus === "AUTHORIZATION_DENIED"
              ? "SchoolOS denied this final submission. No attendance was accepted, and student details were cleared from this browser. Ask a school administrator to restore attendance access before starting again."
              : "SchoolOS denied saving this attendance draft. Student details were cleared from this browser while attendance access is revalidated.",
          );
          setHasDraftChanges(false);
          setSubmitMessage("");
          setConflictMessage("");
          setHydratedDraftKey(draftKey);
          return;
        }

        if (["ACCEPTED", "SYNCED", "CONFLICTED"].includes(storedSyncStatus)) {
          setDraftClientSubmissionId(null);
          setExceptions({});
          setRemarks({});
          setBaselineExceptions({});
          setBaselineRemarks({});
          setDraftSavedAt(null);
          setLastServerSyncStatus(storedSyncStatus);
          setShouldReplayRecoveredFinalSubmission(false);
          setDraftSyncState(
            storedSyncStatus === "CONFLICTED"
              ? "recorded_conflict"
              : "accepted",
          );
          setSyncResultMessage(
            storedSyncStatus === "CONFLICTED"
              ? "SchoolOS recorded this submission as a conflict for office review. The local roster is no longer editable."
              : "SchoolOS already accepted this attendance. The local final-intent receipt is retained to prevent stale-tab resubmission.",
          );
          setHasDraftChanges(false);
          setSubmitMessage("");
          setConflictMessage("");
          setHydratedDraftKey(draftKey);
          return;
        }

        setDraftClientSubmissionId(localDraft.clientSubmissionId);
        setExceptions(
          localDraft.exceptions as Record<string, AttendanceStatus>,
        );
        setRemarks(localDraft.remarks);
        setDraftSavedAt(localDraft.savedAt);
        setLastServerSyncStatus(storedSyncStatus || null);
        setShouldReplayRecoveredFinalSubmission(
          isReceiptProtectedFinalSubmissionStatus(storedSyncStatus) &&
            navigator.onLine !== false,
        );
        if (storedSyncStatus === "REJECTED") {
          setDraftSyncState("rejected");
          setSyncResultMessage(
            "SchoolOS did not accept this attendance. Review and change the local draft before sending a revised submission.",
          );
        } else if (storedSyncStatus === "QUEUED") {
          setDraftSyncState("queued");
          setSyncResultMessage(
            "Final submission queued on this browser. It is not submitted yet. Keep this class and date open for automatic retry, or return to this saved draft later.",
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
        setHydratedDraftKey(draftKey);
        return;
      }

      if (!rosterQuery.data) {
        if (rosterQuery.isError) {
          setHydratedDraftKey(draftKey);
        }
        return;
      }

      setDraftClientSubmissionId(createAttendanceDraftSubmissionId());
      setDraftSavedAt(null);
      setDraftSyncState("idle");
      setSyncResultMessage("");
      setLastServerSyncStatus(null);
      setShouldReplayRecoveredFinalSubmission(false);

      const nextExceptions: Record<string, AttendanceStatus> = {};
      const nextRemarks: Record<string, string> = {};
      rosterQuery.data?.students.forEach((student) => {
        const normalized = normalizeStatus(student.status);
        if (normalized !== "PRESENT") nextExceptions[student.id] = normalized;
        if (student.remark) nextRemarks[student.id] = student.remark;
      });
      setExceptions(nextExceptions);
      setRemarks(nextRemarks);
      setBaselineExceptions(nextExceptions);
      setBaselineRemarks(nextRemarks);
      setOverrideReason("");
      setHasDraftChanges(false);
      setSubmitMessage("");
      setConflictMessage("");
      setHydratedDraftKey(draftKey);
    }

    void loadDraftOrRoster();

    return () => {
      cancelled = true;
    };
  }, [
    draftHydrationAttempt,
    draftKey,
    rosterQuery.data,
    rosterQuery.isError,
  ]);

  useEffect(() => {
    if (!draftKey) return;

    const handleReceiptBarrier = (event: StorageEvent) => {
      if (!isAttendanceDraftReceiptBarrierStorageEvent(event, draftKey)) {
        return;
      }

      purgeRevokedRosterData();
      setDraftClientSubmissionId(null);
      setDraftSavedAt(null);
      setLastServerSyncStatus(null);
      setShouldReplayRecoveredFinalSubmission(false);
      setDraftSyncState("storage_unavailable");
      setSyncResultMessage(
        "Attendance state changed in another tab. SchoolOS is rechecking the protected receipt before showing this roster.",
      );
      setHydratedDraftKey(null);
      setDraftHydrationAttempt((attempt) => attempt + 1);
    };

    window.addEventListener("storage", handleReceiptBarrier);
    return () => window.removeEventListener("storage", handleReceiptBarrier);
  }, [draftKey, purgeRevokedRosterData]);

  useEffect(() => {
    if (!rosterAccessDenied || !draftKey) return;
    if (rosterAccessDeniedHandledKeyRef.current === draftKey) return;
    rosterAccessDeniedHandledKeyRef.current = draftKey;

    const storageTicket = draftStorageAuthorityRef.current!.ticket;
    const fallbackDraft: AttendanceDraftStorageValue = {
      clientSubmissionId:
        draftClientSubmissionId ?? createAttendanceDraftSubmissionId(),
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
      exceptions,
      remarks,
      savedAt: draftSavedAt ?? new Date().toISOString(),
      serverSessionId: rosterQuery.data?.existingSession?.id ?? null,
      serverSubmittedAt:
        rosterQuery.data?.existingSession?.submittedAt ?? null,
      lastSyncStatus: "ACCESS_REVALIDATION_REQUIRED",
    };

    setLastServerSyncStatus("ACCESS_REVALIDATION_REQUIRED");
    setDraftSyncState("access_revoked");
    setSubmitMessage("");
    setSyncResultMessage(
      "SchoolOS denied access to this roster. Student details were cleared from this tab while a purpose-limited access marker is retained.",
    );
    setShouldReplayRecoveredFinalSubmission(false);
    setHydratedDraftKey(draftKey);
    purgeRevokedRosterData();

    void sanitizeAttendanceDraftForAccessRevocation(
      draftKey,
      fallbackDraft,
      "ACCESS_REVALIDATION_REQUIRED",
      { ticket: storageTicket },
    )
      .then((storedReceipt) => {
        if (
          activeDraftKeyRef.current !== draftKey ||
          draftStorageAuthorityRef.current?.ticket !== storageTicket ||
          !isAttendanceDraftStorageTicketCurrent(storageTicket)
        ) {
          return;
        }
        setDraftClientSubmissionId(storedReceipt.clientSubmissionId);
        setDraftSavedAt(storedReceipt.savedAt);
      })
      .catch(() => {
        if (activeDraftKeyRef.current !== draftKey) return;
        setSyncResultMessage(
          "SchoolOS denied access to this roster. This tab remains locked because browser storage could not finish sanitizing the saved record; sign out to clear private browser state.",
        );
      });
  }, [
    academicYearId,
    attendanceDate,
    classId,
    draftClientSubmissionId,
    draftKey,
    draftSavedAt,
    exceptions,
    purgeRevokedRosterData,
    remarks,
    rosterAccessDenied,
    rosterQuery.data?.existingSession?.id,
    rosterQuery.data?.existingSession?.submittedAt,
    sectionId,
  ]);

  useEffect(() => {
    if (
      !draftKey ||
      !draftScopeHydrated ||
      serverDraftSaveInFlightRef.current ||
      isReceiptSyncPending ||
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
    const storageTicket = draftStorageAuthorityRef.current!.ticket;
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
    void storeAttendanceDraft(draftKey, draft, { ticket: storageTicket })
      .then(() => {
        if (
          cancelled ||
          !isAttendanceDraftStorageTicketCurrent(storageTicket) ||
          draftStorageAuthorityRef.current?.ticket !== storageTicket
        )
          return;
        setDraftSavedAt(savedAt);
        if (
          ![
            "conflict",
            "recorded_conflict",
            "rejected",
            "authorization_denied",
            "access_revoked",
            "storage_unavailable",
            "server_check",
            "failed",
            "queued",
            "syncing",
            "retrying",
          ].includes(draftSyncState)
        ) {
          setDraftSyncState("saved_local");
        }
      })
      .catch(() => {
        if (
          cancelled ||
          !isAttendanceDraftStorageTicketCurrent(storageTicket) ||
          draftStorageAuthorityRef.current?.ticket !== storageTicket
        )
          return;
        if (
          ["authorization_denied", "access_revoked"].includes(draftSyncState)
        ) {
          setSyncResultMessage(
            "Attendance access remains locked, but this browser could not update its saved access marker. Do not edit or resubmit this roster.",
          );
          return;
        }
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
    draftScopeHydrated,
    draftSyncState,
    exceptions,
    hasDraftChanges,
    isReceiptSyncPending,
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

  const overrideMutation = useMutation({
    mutationFn: ({
      sessionId,
      exceptions: overrideExceptions,
      reason,
    }: {
      sessionId: string;
      exceptions: Array<{
        studentId: string;
        status: AttendanceStatus;
        remark: string | null;
      }>;
      reason: string;
    }) =>
      api.overrideLockedAttendanceSession(sessionId, {
        exceptions: overrideExceptions,
        reason,
        source: "manual_override",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });
      void queryClient.invalidateQueries({
        queryKey: ["attendance-analytics"],
      });
      setOverrideReason("");
      setSubmitMessage(
        `Locked attendance updated at ${formatNepalTime(new Date())}. Records remain locked under school policy.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: api.saveAttendanceDraft,
  });

  const syncMutation = useMutation({
    mutationFn: api.syncAttendance,
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
  // Zero exceptions on a default-present roster: the submission a teacher can
  // make by never touching the form (P1.4).
  const isAllPresentSubmission =
    roster.length > 0 && Object.keys(exceptions).length === 0;
  const className =
    availableClasses.find((item) => item.id === classId)?.name ?? "this class";
  const attendanceState = rosterQuery.data?.attendanceState;
  const existingSessionId = rosterQuery.data?.existingSession?.id ?? null;
  const isLocked = attendanceState?.isLocked ?? false;
  const isSubmitted = attendanceState?.isSubmitted ?? false;
  const isOverrideMode =
    canOverrideLock &&
    Boolean(existingSessionId) &&
    (isLocked || isSubmitted) &&
    !hasPendingLocalDraft;
  const visibleDraftSyncState: DraftSyncState = draftScopeHydrated
    ? draftSyncState
    : "idle";
  const rosterDisclosureBlocked = Boolean(
    rosterAccessDenied ||
      (draftKey &&
        [
          "authorization_denied",
          "access_revoked",
          "storage_unavailable",
        ].includes(draftSyncState)),
  );
  const awaitingServerReceipt =
    isReceiptSyncPending ||
    [
      "queued",
      "server_check",
      "authorization_denied",
      "access_revoked",
      "storage_unavailable",
    ].includes(visibleDraftSyncState);
  const unresolvedFinalizationReadOnly = [
    "queued",
    "server_check",
    "authorization_denied",
    "access_revoked",
    "storage_unavailable",
  ].includes(visibleDraftSyncState);
  const finalizationReadOnly =
    isReceiptSyncPending ||
    unresolvedFinalizationReadOnly ||
    ["accepted", "recorded_conflict"].includes(visibleDraftSyncState);
  const scopeSelectionDisabled =
    isReceiptSyncPending ||
    syncMutation.isPending ||
    saveDraftMutation.isPending ||
    unresolvedFinalizationReadOnly;
  const overrideChanges = useMemo(
    () =>
      isOverrideMode
        ? computeOverrideChanges(
            roster,
            exceptions,
            remarks,
            baselineExceptions,
            baselineRemarks,
          )
        : [],
    [
      baselineExceptions,
      baselineRemarks,
      exceptions,
      isOverrideMode,
      remarks,
      roster,
    ],
  );
  const rosterEditingDisabled =
    (!isOverrideMode && (isLocked || isSubmitted)) ||
    finalizationReadOnly ||
    saveDraftMutation.isPending;
  const hasConflict = Boolean(
    attendanceState?.conflictStatus &&
    attendanceState.conflictStatus !== "NONE",
  );
  const submissionStatus = hasConflict
    ? "NEEDS_CORRECTION"
    : visibleDraftSyncState === "recorded_conflict"
      ? "NEEDS_CORRECTION"
      : isLocked
        ? "LOCKED"
        : attendanceState?.isSubmitted || visibleDraftSyncState === "accepted"
          ? "SUBMITTED"
          : visibleDraftSyncState === "authorization_denied"
            ? "ACCESS_DENIED"
            : visibleDraftSyncState === "access_revoked"
              ? "ACCESS_REVOKED"
              : visibleDraftSyncState === "storage_unavailable"
                ? "LOCAL_DRAFT_UNAVAILABLE"
                : visibleDraftSyncState === "queued"
                  ? "QUEUED"
                  : visibleDraftSyncState === "server_check"
                    ? "PENDING_CONFIRMATION"
                    : hasDraftChanges || visibleDraftSyncState === "saved_local"
                      ? "DRAFT"
                      : "NOT_MARKED";
  const submissionStatusTone =
    submissionStatus === "NEEDS_CORRECTION"
      ? "conflict"
      : submissionStatus === "NOT_MARKED"
        ? "inactive"
        : undefined;
  const submissionFeedbackIsAlert =
    [
      "failed",
      "rejected",
      "authorization_denied",
      "access_revoked",
      "storage_unavailable",
      "conflict",
      "recorded_conflict",
    ].includes(visibleDraftSyncState) ||
    (visibleDraftSyncState === "server_check" &&
      !isReceiptSyncPending &&
      !syncMutation.isPending);

  useEffect(() => {
    if (!submissionFeedbackIsAlert) return;
    submissionFeedbackRef.current?.focus();
  }, [
    conflictMessage,
    visibleDraftSyncState,
    submissionFeedbackIsAlert,
    syncResultMessage,
  ]);

  const beginDraftEdit = () => {
    if (serverDraftSaveInFlightRef.current || finalizationReadOnly) {
      return false;
    }
    if (draftSyncState === "rejected") {
      setDraftClientSubmissionId(createAttendanceDraftSubmissionId());
      setDraftSyncState("saved_local");
      setSyncResultMessage("");
      setLastServerSyncStatus(null);
    }
    setHasDraftChanges(true);
    return true;
  };

  const markAllPresent = () => {
    if (!beginDraftEdit()) return;
    setExceptions({});
  };

  const clearAll = () => {
    if (!beginDraftEdit()) return;
    setExceptions({});
    setRemarks({});
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
      serverDraftSaveInFlightRef.current ||
      receiptSyncInFlightRef.current ||
      !draftScopeHydrated ||
      !draftKey ||
      !academicYearId ||
      !classId ||
      !draftClientSubmissionId ||
      !draftSavedAt ||
      roster.length === 0 ||
      finalizationReadOnly
    )
      return;
    const serverDraftKey = draftKey;
    const serverDraftStorageTicket = draftStorageAuthorityRef.current!.ticket;
    const isServerDraftScopeCurrent = () =>
      componentMountedRef.current &&
      !receiptSyncInFlightRef.current &&
      activeDraftKeyRef.current === serverDraftKey &&
      draftStorageAuthorityRef.current?.ticket === serverDraftStorageTicket &&
      isAttendanceDraftStorageTicketCurrent(serverDraftStorageTicket);
    if (hasReconnectConflict(rosterQuery.data?.existingSession, draftSavedAt)) {
      setDraftSyncState("conflict");
      setConflictMessage(
        "Server attendance was submitted after this local draft. Review before syncing.",
      );
      return;
    }

    serverDraftSaveInFlightRef.current = true;
    setDraftSyncState(draftSyncState === "failed" ? "retrying" : "syncing");
    try {
      await saveDraftMutation.mutateAsync(buildDraftPayload());
      if (!isServerDraftScopeCurrent()) return;
      setDraftSyncState("synced");
      setHasDraftChanges(false);
      setSubmitMessage(`Draft saved at ${formatNepalTime(new Date())}.`);
    } catch (error) {
      if (!isServerDraftScopeCurrent()) return;
      if (error instanceof ApiRequestError && error.statusCode === 401) {
        return;
      }
      if (error instanceof ApiRequestError && error.statusCode === 403) {
        const accessDeniedDraft = createAccessRevocationReceipt(
          {
            clientSubmissionId: draftClientSubmissionId,
            academicYearId,
            classId,
            sectionId,
            attendanceDate,
            exceptions: {},
            remarks: {},
            savedAt: draftSavedAt,
            serverSessionId: null,
            serverSubmittedAt: null,
          },
          "ACCESS_REVALIDATION_REQUIRED",
        );
        setLastServerSyncStatus("ACCESS_REVALIDATION_REQUIRED");
        setDraftSyncState("access_revoked");
        setSubmitMessage("");
        setSyncResultMessage(
          "SchoolOS denied saving this attendance draft. Student details were cleared from this browser while attendance access is revalidated.",
        );
        purgeRevokedRosterData();

        try {
          const storedAccessDeniedDraft =
            await sanitizeAttendanceDraftForAccessRevocation(
              serverDraftKey,
              accessDeniedDraft,
              "ACCESS_REVALIDATION_REQUIRED",
              { ticket: serverDraftStorageTicket },
            );
          if (!isServerDraftScopeCurrent()) return;
          setDraftClientSubmissionId(
            storedAccessDeniedDraft.clientSubmissionId,
          );
          setDraftSavedAt(storedAccessDeniedDraft.savedAt);
        } catch {
          if (isServerDraftScopeCurrent()) {
            setSyncResultMessage(
              "SchoolOS denied saving this attendance draft, and the browser could not update its saved access marker. Do not edit or resubmit this roster.",
            );
          }
        }
        return;
      }
      setDraftSyncState("failed");
      setSyncResultMessage(
        "SchoolOS could not save this draft. The browser copy remains available.",
      );
    } finally {
      serverDraftSaveInFlightRef.current = false;
    }
  };

  const syncDraftSubmission = async () => {
    if (
      receiptSyncInFlightRef.current ||
      serverDraftSaveInFlightRef.current ||
      !draftScopeHydrated ||
      !draftKey ||
      !academicYearId ||
      !classId ||
      !draftClientSubmissionId ||
      roster.length === 0
    )
      return;
    const submissionDraftKey = draftKey;
    const submissionStorageTicket = draftStorageAuthorityRef.current!.ticket;
    const isSubmissionScopeCurrent = () =>
      componentMountedRef.current &&
      activeDraftKeyRef.current === submissionDraftKey &&
      draftStorageAuthorityRef.current?.ticket === submissionStorageTicket &&
      isAttendanceDraftStorageTicketCurrent(submissionStorageTicket);
    const previousLastServerSyncStatus = lastServerSyncStatus;
    const isReceiptReplay = isReceiptProtectedFinalSubmissionStatus(
      previousLastServerSyncStatus,
    );
    if (
      !isReceiptReplay &&
      hasReconnectConflict(rosterQuery.data?.existingSession, draftSavedAt)
    ) {
      setDraftSyncState("conflict");
      setConflictMessage(
        "Server attendance was submitted after this local draft. Review before syncing.",
      );
      return;
    }

    receiptSyncInFlightRef.current = true;
    setIsReceiptSyncPending(true);

    const hadUnresolvedReceipt = ["PROCESSING", "TRANSPORT_AMBIGUOUS"].includes(
      previousLastServerSyncStatus ?? "",
    );
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
      serverSubmittedAt: rosterQuery.data?.existingSession?.submittedAt ?? null,
      lastSyncStatus: "PROCESSING",
    };

    const persistQueuedFinalSubmission = async () => {
      if (!isSubmissionScopeCurrent()) return false;
      try {
        await storeAttendanceDraft(
          submissionDraftKey,
          {
            ...receiptProtectedDraft,
            lastSyncStatus: "QUEUED",
          },
          { ticket: submissionStorageTicket },
        );
      } catch {
        if (isSubmissionScopeCurrent()) {
          setDraftSyncState("failed");
          setSyncResultMessage(
            "This attendance could not be queued safely on this browser, so nothing was sent. Free browser storage and try again.",
          );
        }
        return false;
      }

      if (!isSubmissionScopeCurrent()) return true;
      setDraftSavedAt(receiptSavedAt);
      setHasDraftChanges(true);
      setLastServerSyncStatus("QUEUED");
      setDraftSyncState("queued");
      setSubmitMessage("");
      setSyncResultMessage(
        "Final submission queued on this browser. It is not submitted yet. Keep this class and date open for automatic retry, or return to this saved draft later.",
      );
      return true;
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (hadUnresolvedReceipt) {
        setLastServerSyncStatus(previousLastServerSyncStatus);
        setDraftSyncState("server_check");
        setSyncResultMessage(
          "The earlier attendance receipt is still unconfirmed. Reconnect and check the same submission ID before editing.",
        );
      } else {
        await persistQueuedFinalSubmission();
      }
      receiptSyncInFlightRef.current = false;
      setIsReceiptSyncPending(false);
      return;
    }

    try {
      // The receipt marker must commit before the POST. If browser storage is
      // unavailable, nothing is sent and the roster remains editable.
      await storeAttendanceDraft(submissionDraftKey, receiptProtectedDraft, {
        ticket: submissionStorageTicket,
      });
    } catch {
      if (isSubmissionScopeCurrent()) {
        setDraftSyncState("failed");
        setSyncResultMessage(
          "This attendance could not be protected on this browser, so nothing was sent. Free browser storage and try again.",
        );
      }
      receiptSyncInFlightRef.current = false;
      setIsReceiptSyncPending(false);
      return;
    }

    if (!isSubmissionScopeCurrent()) {
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
      const result = await syncMutation.mutateAsync({
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

      const syncStatus = String(result?.syncStatus ?? "").toUpperCase();
      if (shouldClearLocalAttendanceDraft(syncStatus)) {
        if (!isSubmissionScopeCurrent()) return;
        let terminalReceiptPersisted = true;
        try {
          const terminalReceipt = createPurposeLimitedAttendanceReceipt(
            receiptProtectedDraft,
            syncStatus as "ACCEPTED" | "SYNCED" | "CONFLICTED",
          );
          await storeAttendanceDraft(submissionDraftKey, terminalReceipt, {
            ticket: submissionStorageTicket,
            authoritativeReceipt: {
              clientSubmissionId: draftClientSubmissionId,
              syncStatus,
            },
          });
        } catch {
          terminalReceiptPersisted = false;
        }

        if (!isSubmissionScopeCurrent()) return;
        setDraftClientSubmissionId(null);
        setDraftSavedAt(null);
        setHasDraftChanges(false);
        setLastServerSyncStatus(syncStatus);
        setSubmitMessage("");

        if (syncStatus === "CONFLICTED") {
          setDraftSyncState("recorded_conflict");
          setSyncResultMessage(
            `SchoolOS received this attendance at ${formatNepalTime(result.serverReceivedAt)} and recorded a conflict for office review. The official record was not overwritten.${terminalReceiptPersisted ? "" : " Browser receipt storage still needs rechecking before this scope can be reused."}`,
          );
        } else {
          setDraftSyncState("accepted");
          setSyncResultMessage(
            `Attendance accepted by SchoolOS at ${formatNepalTime(result.serverReceivedAt)}.${terminalReceiptPersisted ? "" : " Browser receipt storage still needs rechecking before this scope can be reused."}`,
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        const retainedDraft = {
          ...receiptProtectedDraft,
          lastSyncStatus: syncStatus || "UNKNOWN",
        };

        if (!isSubmissionScopeCurrent()) return;
        try {
          await storeAttendanceDraft(submissionDraftKey, retainedDraft, {
            ticket: submissionStorageTicket,
            ...(syncStatus === "REJECTED"
              ? {
                  authoritativeReceipt: {
                    clientSubmissionId: draftClientSubmissionId,
                    syncStatus,
                  },
                }
              : {}),
          });
        } catch {
          // PROCESSING was committed before the request, so failure to update
          // the local marker still fails closed on the next load.
        }

        if (!isSubmissionScopeCurrent()) return;
        setHasDraftChanges(true);
        setSubmitMessage("");
        setLastServerSyncStatus(syncStatus || "UNKNOWN");
        if (syncStatus === "REJECTED") {
          setDraftSyncState("rejected");
          setSyncResultMessage(
            "SchoolOS rejected this final submission. No authoritative attendance was accepted. Review and change the local draft before sending a revised submission.",
          );
        } else {
          setDraftSyncState("server_check");
          setSyncResultMessage(
            `SchoolOS received this submission at ${formatNepalTime(result.serverReceivedAt)} but has not confirmed final acceptance. Keep the same submission ID and check again.`,
          );
        }
      }

      void queryClient.invalidateQueries({
        queryKey: ["attendance-analytics"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["attendance-conflicts"],
      });
      void queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });
    } catch (error) {
      // A final 401 triggers the SessionProvider's real teardown. Do not race
      // that cleanup by recreating this account-scoped draft here.
      if (error instanceof ApiRequestError && error.statusCode === 401) {
        return;
      }

      if (error instanceof OfflineMutationError) {
        if (hadUnresolvedReceipt) {
          if (isSubmissionScopeCurrent()) {
            setLastServerSyncStatus(previousLastServerSyncStatus);
            setDraftSyncState("server_check");
            setSyncResultMessage(
              "The earlier attendance receipt is still unconfirmed. Reconnect and check the same submission ID before editing.",
            );
          }
          return;
        }

        await persistQueuedFinalSubmission();
        return;
      }

      if (error instanceof ApiRequestError && error.statusCode === 403) {
        if (!isSubmissionScopeCurrent()) return;
        const deniedDraft = createAccessRevocationReceipt(
          receiptProtectedDraft,
          "AUTHORIZATION_DENIED",
        );
        setLastServerSyncStatus("AUTHORIZATION_DENIED");
        setDraftSyncState("authorization_denied");
        setSyncResultMessage(
          "SchoolOS denied this final submission. No attendance was accepted. Student details were cleared while the browser saves a purpose-limited denial receipt.",
        );
        purgeRevokedRosterData();

        try {
          const storedDeniedDraft =
            await sanitizeAttendanceDraftForAccessRevocation(
              submissionDraftKey,
              deniedDraft,
              "AUTHORIZATION_DENIED",
              { ticket: submissionStorageTicket },
            );
          if (!isSubmissionScopeCurrent()) return;
          setDraftClientSubmissionId(storedDeniedDraft.clientSubmissionId);
          setDraftSavedAt(storedDeniedDraft.savedAt);
        } catch {
          if (isSubmissionScopeCurrent()) {
            setLastServerSyncStatus("AUTHORIZATION_DENIED");
            setDraftSyncState("authorization_denied");
            setSyncResultMessage(
              "SchoolOS denied this final submission. No attendance was accepted, but the browser could not safely retain the purpose-limited denial receipt. Do not edit or resubmit this roster.",
            );
          }
          return;
        }

        if (!isSubmissionScopeCurrent()) return;
        setHasDraftChanges(false);
        setSubmitMessage("");
        setLastServerSyncStatus("AUTHORIZATION_DENIED");
        setDraftSyncState("authorization_denied");
        setSyncResultMessage(
          "SchoolOS denied this final submission. No attendance was accepted, and student details were cleared from this browser. Ask a school administrator to restore attendance access before starting again.",
        );
        return;
      }

      if (canRestoreEditableAttendanceDraftAfterSyncError(error)) {
        const restoredDraft = {
          ...receiptProtectedDraft,
          lastSyncStatus: hadUnresolvedReceipt
            ? (previousLastServerSyncStatus ?? undefined)
            : undefined,
        };

        if (!isSubmissionScopeCurrent()) return;
        try {
          await storeAttendanceDraft(submissionDraftKey, restoredDraft, {
            ticket: submissionStorageTicket,
          });
        } catch {
          if (isSubmissionScopeCurrent()) {
            setLastServerSyncStatus("PROCESSING");
            setDraftSyncState("server_check");
            setSyncResultMessage(
              "SchoolOS did not receive this check, but the browser could not safely restore the earlier draft marker. Keep the same submission and check again.",
            );
          }
          return;
        }

        if (!isSubmissionScopeCurrent()) return;
        if (hadUnresolvedReceipt) {
          setLastServerSyncStatus(previousLastServerSyncStatus);
          setDraftSyncState("server_check");
          setSyncResultMessage(
            "SchoolOS could not complete this receipt check. The earlier submission remains unconfirmed; keep the same submission ID and check again.",
          );
        } else {
          setLastServerSyncStatus(null);
          setDraftSyncState("failed");
          setSyncResultMessage(
            error instanceof ApiRequestError
              ? `${error.message} The local draft remains editable and was not queued.`
              : "SchoolOS rejected this request before final acceptance. The local draft remains editable and was not queued.",
          );
        }
        return;
      }

      const ambiguousDraft = {
        ...receiptProtectedDraft,
        lastSyncStatus: "TRANSPORT_AMBIGUOUS",
      };

      let persistedAmbiguousStatus = "PROCESSING";
      if (!isSubmissionScopeCurrent()) return;
      try {
        await storeAttendanceDraft(submissionDraftKey, ambiguousDraft, {
          ticket: submissionStorageTicket,
        });
        persistedAmbiguousStatus = "TRANSPORT_AMBIGUOUS";
      } catch {
        // The already committed PROCESSING marker remains the durable fallback.
      }

      if (!isSubmissionScopeCurrent()) return;
      setLastServerSyncStatus(persistedAmbiguousStatus);
      setDraftSyncState("server_check");
      setSyncResultMessage(
        "SchoolOS may have received this attendance, but the receipt did not return. Keep the same submission ID and check the server again before editing.",
      );
    } finally {
      receiptSyncInFlightRef.current = false;
      setIsReceiptSyncPending(false);
    }
  };

  const keepServerVersion = async () => {
    if (keepServerVersionInFlightRef.current) return;
    keepServerVersionInFlightRef.current = true;
    setIsKeepingServerVersion(true);
    try {
      await clearAttendanceDraft(draftKey, {
        ticket: draftStorageAuthorityRef.current!.ticket,
      });
      await queryClient.invalidateQueries({
        queryKey: ["attendance-roster"],
      });
      setDraftClientSubmissionId(null);
      setDraftSavedAt(null);
      setLastServerSyncStatus(null);
      setDraftSyncState("synced");
      setConflictMessage("");
    } catch {
      setDraftSyncState("conflict");
      setConflictMessage(
        "The local draft could not be discarded safely. It remains on this browser; retry before treating the server version as selected.",
      );
    } finally {
      keepServerVersionInFlightRef.current = false;
      setIsKeepingServerVersion(false);
    }
  };

  const requestFinalSubmission = () => {
    if (serverDraftSaveInFlightRef.current || !draftScopeHydrated) return;
    if (
      rosterQuery.isLoading ||
      rosterQuery.isError ||
      roster.length === 0 ||
      futureDateBlocked
    ) {
      setSyncResultMessage(
        "Reload a current, non-empty assigned roster before final submission.",
      );
      return;
    }
    if (
      ["queued", "server_check", "authorization_denied"].includes(
        visibleDraftSyncState,
      )
    ) {
      void syncDraftSubmission();
      return;
    }

    setAllPresentAcknowledged(false);
    setIsConfirmOpen(true);
  };

  reconnectActionRef.current = () => {
    if (
      isReceiptProtectedFinalSubmissionStatus(lastServerSyncStatus) &&
      hasPendingLocalDraft
    ) {
      void syncDraftSubmission();
      return;
    }

    void saveDraftToServer().catch(() => undefined);
  };

  useEffect(() => {
    const handleOnline = () => reconnectActionRef.current();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    if (
      !shouldReplayRecoveredFinalSubmission ||
      !hasPendingLocalDraft ||
      navigator.onLine === false
    ) {
      return;
    }

    setShouldReplayRecoveredFinalSubmission(false);
    reconnectActionRef.current();
  }, [hasPendingLocalDraft, shouldReplayRecoveredFinalSubmission]);

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {draftScopeHydrated && submitMessage && (
        <div
          className="animate-in slide-in-from-top-4 flex items-center gap-4 rounded-xl border border-success-100 bg-success-50 p-4 text-sm font-bold text-success-800 duration-500"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-500 text-white shadow-lg shadow-success-500/20">
            <CheckCircle2 size={20} />
          </div>
          {submitMessage}
        </div>
      )}

      {visibleDraftSyncState !== "idle" && (
        <div
          ref={submissionFeedbackRef}
          role={submissionFeedbackIsAlert ? "alert" : "status"}
          aria-live={submissionFeedbackIsAlert ? "assertive" : "polite"}
          aria-atomic="true"
          tabIndex={submissionFeedbackIsAlert ? -1 : undefined}
          className={cn(
            "flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-sm font-bold",
            [
              "conflict",
              "recorded_conflict",
              "server_check",
              "queued",
            ].includes(visibleDraftSyncState)
              ? "border-warning-200 bg-warning-50 text-warning-900"
              : [
                    "failed",
                    "rejected",
                    "authorization_denied",
                    "access_revoked",
                    "storage_unavailable",
                  ].includes(visibleDraftSyncState)
                ? "border-danger-100 bg-danger-50 text-danger-800"
                : visibleDraftSyncState === "accepted"
                  ? "border-success-100 bg-success-50 text-success-800"
                  : "border-info-100 bg-info-50 text-info-800",
          )}
        >
          <div className="flex items-center gap-3">
            {visibleDraftSyncState === "accepted" ? (
              <CheckCircle2 size={18} aria-hidden />
            ) : submissionFeedbackIsAlert ? (
              <AlertCircle size={18} aria-hidden />
            ) : (
              <WifiOff size={18} aria-hidden />
            )}
            <div>
              <p className="text-xs font-black uppercase tracking-wide">
                {getDraftSyncHeading(visibleDraftSyncState)}
              </p>
              <p className="mt-0.5 font-semibold">
                {getDraftSyncLabel(
                  visibleDraftSyncState,
                  draftSavedAt,
                  conflictMessage,
                  syncResultMessage,
                )}
              </p>
            </div>
          </div>
          {visibleDraftSyncState === "conflict" ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void keepServerVersion()}
                disabled={isKeepingServerVersion}
              >
                {isKeepingServerVersion ? "Discarding local draft…" : "Keep server version"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-warning-600 text-white hover:bg-warning-700"
                onClick={() =>
                  setConflictMessage(
                    "Review the local draft below, then request correction if attendance is submitted or locked.",
                  )
                }
              >
                Review local draft
              </Button>
            </div>
          ) : visibleDraftSyncState === "rejected" ? (
            <span className="max-w-xs text-right text-xs font-semibold">
              Change the draft below to prepare a new submission.
            </span>
          ) : rosterDisclosureBlocked ? (
            <span className="max-w-xs text-right text-xs font-semibold">
              Roster actions are unavailable in this state.
            </span>
          ) : hasPendingLocalDraft ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestFinalSubmission}
              disabled={
                syncMutation.isPending ||
                isReceiptSyncPending ||
                saveDraftMutation.isPending ||
                rosterQuery.isLoading ||
                rosterQuery.isError ||
                roster.length === 0 ||
                futureDateBlocked
              }
            >
              {visibleDraftSyncState === "authorization_denied"
                ? "Retry after access is restored"
                : visibleDraftSyncState === "server_check"
                  ? "Check server again"
                  : visibleDraftSyncState === "queued"
                    ? "Try queued submission"
                    : "Sync now"}
            </Button>
          ) : null}
        </div>
      )}

      {/* Roster state strip appears only once a real roster is loaded;
          rendering zeros before class selection reads as fake data. */}
      {roster.length > 0 && draftScopeHydrated && !rosterDisclosureBlocked ? (
        <AttendanceHeader
          total={totals.total}
          presentPercent={presentPercent}
          exceptions={totals.absent + totals.late + totals.leave}
        />
      ) : null}

      {!rosterDisclosureBlocked ? (
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
                  disabled={scopeSelectionDisabled}
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
                  disabled={scopeSelectionDisabled}
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
                disabled={scopeSelectionDisabled}
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
                disabled={scopeSelectionDisabled}
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
                disabled={scopeSelectionDisabled}
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
      ) : null}

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
            {roster.length > 0 &&
              !awaitingServerReceipt &&
              !saveDraftMutation.isPending && (
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
        {visibleDraftSyncState === "storage_unavailable" ? (
          <ErrorState
            title="Saved attendance state is unavailable"
            message="SchoolOS could not read the saved browser state for this scope. The roster stays hidden because an unconfirmed final receipt may be stored here."
            onRetry={() => {
              setHydratedDraftKey(null);
              setDraftHydrationAttempt((attempt) => attempt + 1);
            }}
            retryLabel="Retry browser storage"
          />
        ) : visibleDraftSyncState === "access_revoked" ? (
          <PermissionDenied
            title="Attendance access must be revalidated"
            description="SchoolOS denied saving this attendance draft. Student details were cleared from this browser. Ask a school administrator to restore attendance access before starting again."
            resource="Attendance roster"
            showNavigation={false}
          />
        ) : visibleDraftSyncState === "authorization_denied" ? (
          <PermissionDenied
            title="Final attendance submission denied"
            description="SchoolOS did not accept this attendance. Student details were cleared from this browser. Ask a school administrator to restore the required attendance access before starting again."
            resource="Attendance submission"
            showNavigation={false}
          />
        ) : rosterQuery.isLoading ||
          (Boolean(draftKey) && hydratedDraftKey !== draftKey) ? (
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

            {isOverrideMode ? (
              <div className="space-y-4">
                <LockedRecordBanner
                  label="Locked session — override authority"
                  reason="You can apply audited changes to this locked day. Records stay locked after override; teachers should use the correction queue when they cannot override."
                />
                <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                  Override reason
                </label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-attendance-border)]"
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="Required audit reason for this locked-session change..."
                />
                <p className="text-xs font-semibold text-slate-500">
                  Minimum {lockOverrideMinReasonLength} characters.{" "}
                  {overrideChanges.length > 0
                    ? `${overrideChanges.length} student change${overrideChanges.length === 1 ? "" : "s"} pending.`
                    : "Adjust roster entries below to apply an override."}
                </p>
              </div>
            ) : isLocked || isSubmitted ? (
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
                  disabled={rosterEditingDisabled}
                  onStatusChange={(status) => {
                    if (!beginDraftEdit()) return;
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
                    if (!beginDraftEdit()) return;
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
      {roster.length > 0 && draftScopeHydrated && !rosterDisclosureBlocked && (
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

          <Button
            type="button"
            size="lg"
            className="gap-3 bg-[var(--color-mod-attendance-accent)] px-10 shadow-lg shadow-[var(--color-mod-attendance-border)]/40 hover:bg-[var(--color-mod-attendance-text)] hover:scale-105 active:scale-95 disabled:hover:scale-100"
            onClick={() => {
              if (isOverrideMode) {
                setIsOverrideConfirmOpen(true);
                return;
              }
              requestFinalSubmission();
            }}
            disabled={
              syncMutation.isPending ||
              isReceiptSyncPending ||
              saveDraftMutation.isPending ||
              overrideMutation.isPending ||
              roster.length === 0 ||
              futureDateBlocked ||
              (isOverrideMode
                ? overrideChanges.length === 0 ||
                  overrideReason.trim().length < lockOverrideMinReasonLength
                : isLocked || isSubmitted) ||
              finalizationReadOnly ||
              visibleDraftSyncState === "rejected"
            }
            isLoading={
              syncMutation.isPending ||
              isReceiptSyncPending ||
              saveDraftMutation.isPending ||
              overrideMutation.isPending
            }
          >
            {!syncMutation.isPending &&
            !isReceiptSyncPending &&
            !saveDraftMutation.isPending &&
            !overrideMutation.isPending ? (
              <Save size={20} />
            ) : null}
            {isOverrideMode
              ? "Apply Override"
              : isLocked
                ? "Day Locked"
                : isSubmitted || visibleDraftSyncState === "accepted"
                  ? "Attendance Submitted"
                  : visibleDraftSyncState === "recorded_conflict"
                    ? "Conflict Recorded"
                    : visibleDraftSyncState === "queued"
                      ? "Submission Queued"
                      : visibleDraftSyncState === "server_check"
                        ? "Checking Server"
                        : "Submit Attendance"}
          </Button>
        </div>
      )}

      {overrideMutation.isError ? (
        <div
          className="animate-fade-in flex items-center gap-4 rounded-xl border border-danger-100 bg-danger-50 p-6 text-sm font-bold text-danger-800 shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle size={24} className="text-danger-500" />
          <div className="flex flex-col">
            <span className="text-[0.65rem] uppercase tracking-widest text-danger-600 mb-1">
              Override Error
            </span>
            Locked attendance could not be overridden. Check your reason length,
            changed students, and permissions, then try again.
          </div>
        </div>
      ) : null}

      {!rosterDisclosureBlocked ? (
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void saveDraftToServer()}
              disabled={
                saveDraftMutation.isPending ||
                roster.length === 0 ||
                !hasPendingLocalDraft ||
                awaitingServerReceipt ||
                visibleDraftSyncState === "rejected"
              }
            >
              <Save size={14} />
              Save Draft
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestFinalSubmission}
              disabled={
                syncMutation.isPending ||
                isReceiptSyncPending ||
                saveDraftMutation.isPending ||
                roster.length === 0 ||
                !hasPendingLocalDraft ||
                visibleDraftSyncState === "rejected"
              }
            >
              <CheckCircle2 size={14} />
              {visibleDraftSyncState === "authorization_denied"
                ? "Retry After Access Is Restored"
                : visibleDraftSyncState === "queued"
                  ? "Try Queued Submission"
                  : awaitingServerReceipt
                    ? "Check Server"
                    : "Submit Saved Draft"}
            </Button>
          </div>
        </div>
      ) : null}

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
              {isOverrideMode
                ? "Overrides are audited and records remain locked after save."
                : "Final submission locks records for the day. Corrections require administrative approval."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
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
          disabled={
            !academicYearId || !classId || unresolvedFinalizationReadOnly
          }
        >
          <Download size={14} />
          Export CSV
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={
          isAllPresentSubmission
            ? "Submit everyone as present?"
            : "Confirm Attendance Submission"
        }
        description={
          isAllPresentSubmission
            ? // The roster defaults every student to Present, so an
              // untouched form and a genuinely full class are
              // indistinguishable at submit time. This is the one case that
              // needs the teacher to say they actually looked (P1.4).
              `No exceptions were marked, so all ${roster.length} student${roster.length === 1 ? "" : "s"} in ${className} will be recorded present for ${formatSchoolDate(attendanceDate)}. This becomes the official record.`
            : `Submitting attendance for ${className}: ${totals.absent} absent, ${totals.late} late, ${totals.leave} on leave, ${totals.present} present. This becomes the official record for ${formatSchoolDate(attendanceDate)}.`
        }
        confirmLabel={isReceiptSyncPending ? "Submitting..." : "Submit"}
        cancelLabel="Review roster"
        variant={isAllPresentSubmission ? "warning" : "default"}
        isConfirming={isReceiptSyncPending}
        confirmDisabled={
          saveDraftMutation.isPending ||
          (isAllPresentSubmission && !allPresentAcknowledged)
        }
        onConfirm={() => {
          if (serverDraftSaveInFlightRef.current) return;
          setIsConfirmOpen(false);
          void syncDraftSubmission();
        }}
        onClose={() => {
          setIsConfirmOpen(false);
          setAllPresentAcknowledged(false);
        }}
      >
        {isAllPresentSubmission ? (
          <label className="flex items-start gap-2.5 rounded-xl border border-warning-100 bg-warning-50 p-3 text-sm font-semibold text-warning-900">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-warning-300"
              checked={allPresentAcknowledged}
              onChange={(event) =>
                setAllPresentAcknowledged(event.target.checked)
              }
            />
            I have checked the roster and every student is present.
          </label>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isOverrideConfirmOpen}
        title="Apply locked-session override?"
        description={`Apply ${overrideChanges.length} audited change${overrideChanges.length === 1 ? "" : "s"} to locked attendance for ${formatSchoolDate(attendanceDate)}. Records remain locked under school policy after this override.`}
        confirmLabel={
          overrideMutation.isPending ? "Applying..." : "Apply & re-lock"
        }
        cancelLabel="Review changes"
        variant="warning"
        isConfirming={overrideMutation.isPending}
        onConfirm={() => {
          if (!existingSessionId) return;
          overrideMutation.mutate({
            sessionId: existingSessionId,
            exceptions: overrideChanges,
            reason: overrideReason.trim(),
          });
          setIsOverrideConfirmOpen(false);
        }}
        onClose={() => setIsOverrideConfirmOpen(false)}
      />
    </div>
  );
}

function computeOverrideChanges(
  roster: Array<{ id: string }>,
  exceptions: Record<string, AttendanceStatus>,
  remarks: Record<string, string>,
  baselineExceptions: Record<string, AttendanceStatus>,
  baselineRemarks: Record<string, string>,
) {
  const changes: Array<{
    studentId: string;
    status: AttendanceStatus;
    remark: string | null;
  }> = [];

  for (const student of roster) {
    const currentStatus = exceptions[student.id] ?? "PRESENT";
    const baselineStatus = baselineExceptions[student.id] ?? "PRESENT";
    const currentRemark = remarks[student.id]?.trim() || null;
    const baselineRemark = baselineRemarks[student.id]?.trim() || null;

    if (currentStatus !== baselineStatus || currentRemark !== baselineRemark) {
      changes.push({
        studentId: student.id,
        status: currentStatus,
        remark: currentRemark,
      });
    }
  }

  return changes;
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

function normalizeDraftScopeId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length <= 128 ? normalized : null;
}

function normalizeDraftRecoveryDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) {
    return today;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : today;
}

function isFutureDate(value: string) {
  return value > today;
}

function isReceiptProtectedFinalSubmissionStatus(status: string | null) {
  return receiptProtectedFinalSubmissionStatuses.includes(
    status as (typeof receiptProtectedFinalSubmissionStatuses)[number],
  );
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
  if (state === "queued")
    return (
      syncResultMessage ||
      "Final submission queued on this browser. It is not submitted yet."
    );
  if (state === "syncing") return "Syncing attendance draft...";
  if (state === "retrying") return "Retrying attendance sync...";
  if (state === "synced") return "Draft synced with SchoolOS.";
  if (state === "accepted")
    return syncResultMessage || "Attendance accepted by SchoolOS.";
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
  if (state === "authorization_denied")
    return (
      syncResultMessage ||
      "SchoolOS denied this final submission. Student details were cleared from this browser."
    );
  if (state === "access_revoked")
    return (
      syncResultMessage ||
      "Attendance access must be revalidated. Student details were cleared from this browser."
    );
  if (state === "storage_unavailable")
    return (
      syncResultMessage ||
      "The saved browser state is unavailable. The roster remains hidden."
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

function getDraftSyncHeading(state: DraftSyncState) {
  if (state === "accepted") return "Attendance submitted";
  if (state === "queued") return "Queued on this browser";
  if (state === "server_check") return "Server confirmation required";
  if (state === "recorded_conflict" || state === "conflict")
    return "Attendance conflict";
  if (state === "rejected") return "Submission rejected";
  if (state === "authorization_denied") return "Attendance access denied";
  if (state === "access_revoked") return "Attendance access revalidation";
  if (state === "storage_unavailable") return "Browser state unavailable";
  if (state === "failed") return "Attendance sync failed";
  if (state === "syncing" || state === "retrying") return "Sync in progress";
  if (state === "synced") return "Draft saved to SchoolOS";
  return "Local attendance draft";
}
