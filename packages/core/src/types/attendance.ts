import type {
  AcademicYearSummary,
  ClassSummary,
  SectionSummary,
} from "./academic.js";
import type {
  AttendanceRosterStudent,
  AttendanceCorrectionStatus,
} from "./common.js";

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
  };
};

export type AttendanceRoster = {
  academicYear: AcademicYearSummary;
  class: ClassSummary;
  section: SectionSummary | null;
  attendanceDate: string;
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

export type AttendanceSyncResult = {
  id: string;
  clientSubmissionId: string;
  attendanceSessionId: string | null;
  conflictId: string | null;
  syncStatus: string;
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
