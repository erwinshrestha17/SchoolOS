import type {
  AcademicYearSummary,
  ClassSummary,
  SectionSummary,
} from "./academic.js";
import type {
  AttendanceRosterStudent,
  AttendanceCorrectionStatus,
} from "./common.js";

/**
 * Canonical attendance-session lifecycle (P0.11).
 *
 * Every attendance surface -- Overview, session history, Monthly Register,
 * offline drafts, the conflict queue -- must render from this one
 * backend-owned value rather than each re-deriving state from whichever
 * subset of `submittedAt` / `lockAt` / `conflictStatus` it happens to have
 * fetched. That re-derivation is what let the Overview report every session as
 * "Draft" (its payload carried no `submittedAt` at all) while the register
 * showed the same days fully marked.
 *
 * Ordering is the real progression: NOT_STARTED -> DRAFT -> SUBMITTED ->
 * LOCKED, with CONFLICT as an orthogonal flag that outranks the rest because
 * it is the state that needs a human.
 */
export type AttendanceSessionState =
  | "NOT_STARTED"
  | "DRAFT"
  | "SUBMITTED"
  | "LOCKED"
  | "CONFLICT";

export const ATTENDANCE_SESSION_STATE_LABELS: Record<
  AttendanceSessionState,
  string
> = {
  NOT_STARTED: "Not marked",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  LOCKED: "Locked",
  CONFLICT: "Needs review",
};

/**
 * The single derivation. Backend services call this when building a session
 * payload; the web renders `state` and never recomputes it.
 */
export function resolveAttendanceSessionState(
  session: {
    submittedAt?: string | Date | null;
    lockAt?: string | Date | null;
    conflictStatus?: string | null;
    hasRecords?: boolean;
  },
  now: Date = new Date(),
): AttendanceSessionState {
  if (session.conflictStatus === "FLAGGED") return "CONFLICT";

  const lockAt = session.lockAt ? new Date(session.lockAt).getTime() : null;
  const isLocked =
    lockAt !== null && Number.isFinite(lockAt) && lockAt <= now.getTime();

  if (session.submittedAt) return isLocked ? "LOCKED" : "SUBMITTED";
  if (session.hasRecords) return "DRAFT";
  return "NOT_STARTED";
}

export type AttendanceSummary = {
  sessionId: string;
  attendanceDate: string;
  className: string;
  sectionName: string | null;
  submittedAt: string | null;
  lockAt: string;
  totals: {
    totalStudents: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    sickLeave: number;
    excusedLeave: number;
    unexcusedLeave: number;
    earlyAuthorizedDeparture?: number;
    unauthorizedDeparture?: number;
    periodAbsent?: number;
  };
};

export type AttendanceRoster = {
  academicYear: AcademicYearSummary;
  class: ClassSummary;
  section: SectionSummary | null;
  attendanceDate: string;
  /** Opaque server snapshot used to fence offline attendance submissions. */
  rosterVersion: string;
  calendarDay: AttendanceCalendarDayView;
  attendanceState: {
    submittedAt: string | null;
    lockAt: string | null;
    isSubmitted: boolean;
    isLocked: boolean;
    conflictStatus: string;
  };
  existingSession: {
    id: string;
    submittedAt: string | null;
    lockAt: string;
    conflictStatus: string;
  } | null;
  students: AttendanceRosterStudent[];
};

export type AttendanceAnalytics = {
  sessionsReviewed: number;
  todaySummary: {
    date: string;
    sessionCount: number;
    submittedSessionCount: number;
    draftSessionCount: number;
    notMarkedSessionCount: number;
    totals: AttendanceSummary["totals"];
  };
  monthlyAttendance: {
    month: number;
    year: number;
    attendancePercent: number;
  };
  annualAttendance: {
    year: number;
    attendancePercent: number;
  };
  latestSessions: Array<
    AttendanceSummary & {
      conflictStatus: string;
      /** Canonical backend-owned lifecycle state -- render this, not a
       *  locally re-derived label. */
      state: AttendanceSessionState;
      calendarDay?: AttendanceCalendarDayView;
    }
  >;
  classHeatmap: Array<{
    attendanceDate: string;
    className: string;
    sectionName: string | null;
    attendancePercent: number;
  }>;
  absenceHotlist: Array<{
    studentId: string;
    absenceCount: number;
  }>;
  consecutiveAbsences?: Array<{
    studentId: string;
    consecutiveAbsences: number;
  }>;
  below80Warnings?: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    attendancePercent: number;
  }>;
};

export type AttendanceConflict = {
  id: string;
  attendanceSessionId: string;
  status: string;
  decision?: string | null;
  submittedById: string | null;
  reviewedById: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  resolutionNote?: string | null;
  attendanceDate?: string;
  className?: string;
  sectionName?: string | null;
};

export type AttendanceSyncStatus =
  | 'PROCESSING'
  | 'SYNCED'
  | 'CONFLICTED'
  | 'REJECTED'
  | 'DUPLICATE'
  | 'ACCEPTED';

export type AttendanceSyncResult = {
  id: string;
  clientSubmissionId: string;
  attendanceSessionId: string | null;
  conflictId: string | null;
  syncStatus: AttendanceSyncStatus;
  attendanceDate: string;
  deviceId: string | null;
  deviceLabel: string | null;
  deviceTimestamp: string | null;
  sessionFingerprint: string | null;
  syncAttemptCount: number;
  serverReceivedAt: string;
  replayed: boolean;
  rejectionReason: string | null;
  createdAt: string;
};

export type AttendanceCorrectionRequest = {
  id: string;
  tenantId?: string;
  attendanceRecordId: string | null;
  attendanceSessionId: string | null;
  studentId: string;
  attendanceDate: string;
  requestedStatus: string;
  previousStatus: string | null;
  reason: string;
  status: AttendanceCorrectionStatus;
  requestedById: string;
  requestedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    studentSystemId: string;
    firstNameEn: string | null;
    lastNameEn: string | null;
    rollNumber?: string | null;
  } | null;
  requestedBy?: {
    id: string;
    email: string | null;
  } | null;
  reviewedBy?: {
    id: string;
    email: string | null;
  } | null;
};

export type AttendanceCalendarDayView = {
  calendarDate: string;
  isWorkingDay: boolean;
  label: string | null;
  holidayType: string | null;
  source: "explicit" | "weekday_fallback";
};

export type SchoolCalendarDaySummary = {
  id: string;
  calendarDate: string;
  isWorkingDay: boolean;
  label: string | null;
  holidayType: string | null;
};

export type AttendanceEscalationWarning = {
  type: "consecutive_absence" | "below_threshold";
  sourceType: string;
  sourceId: string;
  studentId: string;
  studentSystemId: string;
  fullNameEn: string;
  className: string;
  sectionName: string | null;
  warningDate: string;
  consecutiveAbsences?: number;
  attendancePercent?: number;
  deliveryCount: number;
};

export type StaffAttendanceMonthlySummary = {
  month: number;
  year: number;
  items: Array<{
    staffId: string;
    employeeId: string;
    fullName: string;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    leaveDays: number;
    approvedLeaveDays: number;
    unresolvedOverlapAnomalies: number;
  }>;
};

export type StudentAttendanceMonthState =
  | "COMPLETED"
  | "CURRENT"
  | "UPCOMING"
  | "NO_DATA"
  | "PARTIAL";

export type StudentAttendanceDataState = "COMPLETE" | "PARTIAL" | "EMPTY";

export type StudentAttendanceAcademicYearOption = {
  id: string;
  name: string;
  startsOnBs: string;
  endsOnBs: string;
  isCurrent: boolean;
};

export type StudentAttendanceMonthOption = {
  key: string;
  label: string;
  bsMonth: number;
  bsYear: number;
  isCurrent: boolean;
  isAvailable: boolean;
};

export type StudentAttendanceTotals = {
  totalSchoolDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  recordedDays: number;
  attendancePercentage: number | null;
};

export type StudentAttendanceMonthSummary = StudentAttendanceTotals & {
  key: string;
  bsMonth: number;
  bsYear: number;
  label: string;
  startsOnBs: string;
  endsOnBs: string;
  state: StudentAttendanceMonthState;
  registerDays: number;
};

export type StudentAttendanceMonthlyRegisterDay = {
  dateBs: string;
  dateLabel: string;
  dayLabel: string;
  weekday: number;
  dayType: "SCHOOL_DAY" | "HOLIDAY" | "WEEKEND" | "EXAM_DAY";
  calendarLabel: string | null;
  holidayName: string | null;
  registerState: "SUBMITTED" | "DRAFT" | "NOT_CREATED";
  attendanceStatus:
    | "PRESENT"
    | "ABSENT"
    | "LATE"
    | "LEAVE"
    | "SICK_LEAVE"
    | "EXCUSED_LEAVE"
    | "UNEXCUSED_LEAVE"
    | "ON_LEAVE"
    | "HALF_DAY"
    | "HOLIDAY"
    | "EARLY_AUTHORIZED_DEPARTURE"
    | "UNAUTHORIZED_DEPARTURE"
    | "PERIOD_ABSENT"
    | "NOT_MARKED"
    | null;
  isToday: boolean;
  isFuture: boolean;
  arrivalAt: string | null;
  remark: string | null;
};

export type StudentAttendanceMonthlyRegister = {
  studentId: string;
  academicYears: StudentAttendanceAcademicYearOption[];
  selectedAcademicYear: StudentAttendanceAcademicYearOption | null;
  months: StudentAttendanceMonthOption[];
  currentMonthKey: string | null;
  previousMonthKey: string | null;
  nextMonthKey: string | null;
  calendarState: "AVAILABLE" | "UNAVAILABLE";
  dataState: StudentAttendanceDataState;
  month: StudentAttendanceMonthSummary | null;
  leaveSupported: boolean;
  lastUpdatedAt: string | null;
  days: StudentAttendanceMonthlyRegisterDay[];
};
