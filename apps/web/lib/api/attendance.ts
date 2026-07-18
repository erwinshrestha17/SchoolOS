import type {
  AttendanceAnalytics,
  AttendanceConflict,
  AttendanceConflictReviewResult,
  AttendanceCorrectionRequest,
  AttendanceOperationalSummary,
  AttendanceRoster,
  AttendanceSyncSubmission,
  PaginatedResponse,
  StaffAttendanceMonthlySummary,
  StaffLeaveBalanceSummary,
  StaffLeaveRequestSummary,
  StaffLeaveReviewResult,
  StudentAttendanceMonthlyRegister,
} from "@schoolos/core";
import {
  API_BASE_URL,
  JsonBody,
  parseApiErrorMessage,
  request,
  withQuery,
} from "./client";

export type StaffSelfAttendanceRecord = {
  id: string;
  attendanceDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
};

export type StaffSelfLeaveRequest = {
  id: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  days: number | string;
  status: string;
  reviewNote: string | null;
};

export const attendanceApi = {
  getAttendanceRoster: (params: {
    /** Omitted = the backend resolves the tenant's current academic year. */
    academicYearId?: string;
    classId: string;
    sectionId?: string | null;
    attendanceDate?: string | null;
  }) => request<AttendanceRoster>(withQuery("/attendance/rosters", params)),
  listAttendanceAnalytics: () =>
    request<AttendanceAnalytics>("/attendance/analytics"),
  listAttendanceAnomalies: () =>
    request<AttendanceAnomalies>("/attendance/anomalies"),
  getAttendanceSummary: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    attendanceDate?: string | null;
    studentId?: string | null;
    month?: number | null;
    year?: number | null;
  }) =>
    request<AttendanceOperationalSummary>(
      withQuery("/attendance/summary", {
        ...params,
        month: params.month ? String(params.month) : null,
        year: params.year ? String(params.year) : null,
      }),
    ),
  getAttendanceRegister: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    month?: number;
    year?: number;
    bsMonth?: number;
    bsYear?: number;
  }) =>
    request<AttendanceMonthlyRegister>(
      withQuery("/attendance/register", {
        ...params,
        month: params.month ? String(params.month) : undefined,
        year: params.year ? String(params.year) : undefined,
        bsMonth: params.bsMonth ? String(params.bsMonth) : undefined,
        bsYear: params.bsYear ? String(params.bsYear) : undefined,
      }),
    ),
  listAttendanceRegisterExports: (params?: {
    page?: number | null;
    limit?: number | null;
  }) =>
    request<AttendanceRegisterExportPage>(
      withQuery("/attendance/register/exports", {
        page: params?.page ? String(params.page) : undefined,
        limit: params?.limit ? String(params.limit) : undefined,
      }),
    ),
  listAttendanceDrafts: () =>
    request<AttendanceDraftSummary[]>("/attendance/drafts"),
  getAttendanceCorrection: (id: string) =>
    request<AttendanceCorrectionDetail>(
      `/attendance/corrections/${encodeURIComponent(id)}`,
    ),
  getAttendanceStudentHistory: (
    studentId: string,
    params?: { startDate?: string | null; endDate?: string | null },
  ) =>
    request<AttendanceStudentHistoryItem[]>(
      withQuery(
        `/attendance/students/${encodeURIComponent(studentId)}/history`,
        params ?? {},
      ),
    ),
  getStudentAttendanceMonthlyRegister: (
    studentId: string,
    params?: { academicYearId?: string | null; month?: string | null },
  ) =>
    request<StudentAttendanceMonthlyRegister>(
      withQuery(
        `/attendance/students/${encodeURIComponent(studentId)}/monthly-register`,
        {
          academicYearId: params?.academicYearId,
          month: params?.month,
        },
      ),
    ),
  getAttendanceStudentSummary: (
    studentId: string,
    params?: { month?: number | null; year?: number | null },
  ) =>
    request<AttendanceStudentSummary>(
      withQuery(
        `/attendance/students/${encodeURIComponent(studentId)}/summary`,
        {
          month: params?.month ? String(params.month) : undefined,
          year: params?.year ? String(params.year) : undefined,
        },
      ),
    ),
  getM2Policy: () =>
    request<M2AttendancePolicyResponse>("/attendance/m2/policy"),
  updateM2Policy: (body: JsonBody) =>
    request<M2AttendancePolicyResponse>("/attendance/m2/policy", {
      method: "PATCH",
      json: body,
    }),
  getM2States: () =>
    request<M2AttendanceStatesResponse>("/attendance/m2/states"),
  listM2HardenedAnomalies: (params?: M2WindowParams) =>
    request<M2HardenedAnomalyResponse>(
      withQuery("/attendance/m2/anomalies/hardened", params ?? {}),
    ),
  listM2CorrectionAudit: (params?: M2WindowParams) =>
    request<M2CorrectionAuditResponse>(
      withQuery("/attendance/m2/corrections/audit", params ?? {}),
    ),
  listM2CalendarPolicy: (params?: M2WindowParams) =>
    request<M2CalendarPolicyResponse>(
      withQuery("/attendance/m2/calendar-policy", params ?? {}),
    ),
  listM2FollowUps: (params?: M2WindowParams & { threshold?: number | null }) =>
    request<M2FollowUpQueue>(
      withQuery("/attendance/m2/follow-ups/queue", {
        ...(params ?? {}),
        threshold: params?.threshold ? String(params.threshold) : undefined,
      }),
    ),
  runM2FollowUps: (body: JsonBody) =>
    request<M2FollowUpRunResult>("/attendance/m2/follow-ups/run", {
      method: "POST",
      json: body,
    }),
  listM2OfflineConflicts: (
    params?: M2WindowParams & { status?: string | null; limit?: number | null },
  ) =>
    request<M2OfflineConflictResponse>(
      withQuery("/attendance/m2/offline-sync/conflicts", {
        ...(params ?? {}),
        limit: params?.limit ? String(params.limit) : undefined,
      }),
    ),
  exportAttendanceRegister: async (
    params: {
      academicYearId: string;
      classId: string;
      sectionId?: string | null;
      bsMonth: number;
      bsYear: number;
    },
    format: "csv" | "pdf",
  ) => {
    const response = await fetch(
      `${API_BASE_URL}${withQuery("/attendance/register/export", {
        ...params,
        sectionId: params.sectionId ?? undefined,
        format,
      })}`,
      { credentials: "include" },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || "Attendance export failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-register-bs-${params.bsYear}-${String(
      params.bsMonth,
    ).padStart(2, "0")}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  exportRoster: async (params?: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
  }) => {
    const response = await fetch(
      `${API_BASE_URL}${withQuery("/students/roster/export", params ?? {})}`,
      {
        credentials: "include",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || "Export failed");
    }

    const text = await response.text();
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `class-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  listAttendanceConflicts: () =>
    request<AttendanceConflict[]>("/attendance/conflicts"),
  listAttendanceCorrections: (params?: {
    status?: string | null;
    studentId?: string | null;
    requestedById?: string | null;
    page?: number | null;
    limit?: number | null;
  }) =>
    request<PaginatedResponse<AttendanceCorrectionRequest>>(
      withQuery("/attendance/corrections", params ?? {}),
    ),
  submitAttendance: (body: JsonBody) =>
    request("/attendance/sessions", { method: "POST", json: body }),
  syncAttendance: (body: JsonBody) =>
    request<AttendanceSyncSubmission>("/attendance/sync", {
      method: "POST",
      json: body,
    }),
  saveAttendanceDraft: (body: JsonBody) =>
    request("/attendance/drafts", { method: "POST", json: body }),
  reviewAttendanceConflict: (id: string, body: JsonBody) =>
    request<AttendanceConflictReviewResult>(
      `/attendance/conflicts/${id}/review`,
      {
        method: "PATCH",
        json: body,
      },
    ),
  approveAttendanceCorrection: (id: string, body: JsonBody) =>
    request<AttendanceCorrectionRequest>(
      `/attendance/corrections/${encodeURIComponent(id)}/approve`,
      {
        method: "PATCH",
        json: body,
      },
    ),
  rejectAttendanceCorrection: (id: string, body: JsonBody) =>
    request<AttendanceCorrectionRequest>(
      `/attendance/corrections/${encodeURIComponent(id)}/reject`,
      {
        method: "PATCH",
        json: body,
      },
    ),
  listStaffAttendanceSummary: (params: { month?: number; year?: number }) =>
    request<StaffAttendanceMonthlySummary>(
      withQuery("/hr/staff-attendance/summary", {
        month: params.month ? String(params.month) : undefined,
        year: params.year ? String(params.year) : undefined,
      }),
    ),
  listStaffAttendance: (staffId: string) =>
    request<unknown[]>(`/hr/staff/${encodeURIComponent(staffId)}/attendance`),
  listLeaveRequests: () =>
    request<StaffLeaveRequestSummary[]>("/hr/leave-requests"),
  createLeaveRequest: (body: JsonBody) =>
    request<StaffLeaveRequestSummary>("/hr/leave-requests", {
      method: "POST",
      json: body,
    }),
  approveLeaveRequest: (id: string, body: JsonBody) =>
    request<StaffLeaveReviewResult>(
      `/hr/leaves/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        json: body,
      },
    ),
  rejectLeaveRequest: (id: string, body: JsonBody) =>
    request<StaffLeaveReviewResult>(
      `/hr/leaves/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
        json: body,
      },
    ),
  listStaffLeaveBalances: (staffId: string) =>
    request<StaffLeaveBalanceSummary[]>(
      `/hr/staff/${encodeURIComponent(staffId)}/leave-balances`,
    ),
  listAllLeaveBalances: () =>
    request<StaffLeaveBalanceSummary[]>("/hr/leave-balances"),
  listMyAttendance: () =>
    request<StaffSelfAttendanceRecord[]>("/hr/me/attendance"),
  listMyLeaveRequests: () =>
    request<StaffSelfLeaveRequest[]>("/hr/me/leave-requests"),
  createMyLeaveRequest: (body: {
    leaveType: string;
    startsOn: string;
    endsOn: string;
    reason: string;
  }) =>
    request<StaffSelfLeaveRequest>("/hr/me/leave-requests", {
      method: "POST",
      json: body,
    }),

  submitStaffAttendance: (body: JsonBody) =>
    request<unknown>("/hr/staff-attendance", {
      method: "POST",
      json: body,
    }),
  correctStaffAttendance: (id: string, body: JsonBody) =>
    request<unknown>(`/hr/staff-attendance/${encodeURIComponent(id)}/correct`, {
      method: "PATCH",
      json: body,
    }),
  reviewLeaveRequest: (id: string, body: JsonBody) =>
    request<unknown>(`/hr/leave-requests/${encodeURIComponent(id)}/review`, {
      method: "PATCH",
      json: body,
    }),
  adjustLeaveBalance: (body: JsonBody) =>
    request<unknown>("/hr/leave-balances/adjust", {
      method: "POST",
      json: body,
    }),
  getStaffAttendanceHistory: (staffId: string) =>
    request<unknown[]>(
      `/hr/staff/${encodeURIComponent(staffId)}/attendance-history`,
    ),
};

export type AttendanceAnomalies = {
  absenceStreaks: Array<{
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string | null;
    streakCount: number;
  }>;
  repeatedLates: Array<{
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string | null;
    lateCount: number;
  }>;
  anomalies: {
    rosterDivergences: Array<{
      sessionId: string;
      attendanceDate: string;
      className: string;
      sectionName: string | null;
      expectedCount: number;
      actualCount: number;
      missing: string[];
      unexpected: string[];
    }>;
    lateSubmissions: Array<{
      sessionId: string;
      attendanceDate: string;
      className: string;
      sectionName: string | null;
      submittedAt: string;
      submittedBy: string;
      delayHours: number;
    }>;
    attendanceDrops: Array<{
      classId: string;
      sectionId: string | null;
      className: string;
      sectionName: string | null;
      attendanceDate: string;
      previousAverage: number;
      currentRate: number;
      dropPercentage: number;
    }>;
    unsubmittedWorkingDays: Array<{
      attendanceDate: string;
      classId: string;
      sectionId: string | null;
      className: string;
      sectionName: string | null;
    }>;
  };
};

export type AttendanceMonthlyRegister = {
  calendar: "BS" | "AD";
  month: number;
  year: number;
  periodLabel: string;
  className: string;
  sectionName: string | null;
  daysCount: number;
  days: Array<{
    day: number;
    date: string;
    isWorkingDay: boolean;
    label: string | null;
    holidayType: string | null;
  }>;
  summary: {
    totalStudents: number;
    workingDays: number;
    holidayDays: number;
    submittedDays: number;
    draftDays: number;
    notMarkedDays: number;
    totals: {
      present: number;
      absent: number;
      late: number;
      leave: number;
    };
    attendancePercentage: number | null;
  };
  matrix: Array<{
    studentId: string;
    rollNumber: string | null;
    name: string;
    attendance: Array<{ day: number; status: string }>;
    totals: {
      PRESENT: number;
      ABSENT: number;
      LATE: number;
      LEAVE: number;
      HOLIDAY: number;
      NOT_MARKED: number;
      totalDays: number;
      workingDays: number;
      markedDays: number;
      percentage: number | null;
    };
  }>;
};

export type AttendanceRegisterExportPage = {
  items: AttendanceRegisterExportSummary[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type AttendanceRegisterExportSummary = {
  id: string;
  reportKey: "attendance_monthly_register";
  format: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  filters: Record<string, unknown> | null;
  requestedBy: string | null;
  createdAt: string;
  completedAt: string | null;
  errorSummary: string | null;
  file: {
    fileAssetId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
  } | null;
};

export type AttendanceDraftSummary = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  attendanceDate: string;
  payload: unknown;
  serverVersion: number;
  payloadHash: string | null;
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
};

export type AttendanceCorrectionDetail = AttendanceCorrectionRequest & {
  lockState:
    | "OPEN"
    | "LOCKED"
    | "OVERRIDE_REQUIRED"
    | "CORRECTION_WINDOW"
    | "EXPIRED";
  lockPolicy: {
    requiresReasonForDecision: boolean;
    explanation: string;
  };
  comparison: {
    original: {
      attendanceStatus: string | null;
      checkInTime: string | null;
      remarks: string | null;
      markedBy: string | null;
      markedOn: string | null;
    };
    requested: {
      attendanceStatus: string;
      checkInTime: string | null;
      remarks: string;
      requestedBy: string | null;
      requestedOn: string;
    };
  };
  evidence: {
    supported: boolean;
    items: Array<{
      fileId: string;
      fileName: string;
      contentType: string | null;
      sizeBytes: number | null;
    }>;
    message: string;
  };
  discussionSupported: boolean;
  student?: AttendanceCorrectionRequest["student"] & {
    class?: { id: string; name: string } | null;
    sectionRef?: { id: string; name: string } | null;
  };
};

export type AttendanceStudentHistoryItem = {
  date: string;
  status: string;
  remark: string | null;
  lateAt: string | null;
  markedBy: string;
  sessionId: string;
};

export type AttendanceStudentSummary = {
  studentId: string;
  today: { status: string; label: string; remark: string | null } | null;
  month: number;
  year: number;
  percentage: number;
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
  recentHistory: Array<{
    date: string;
    status: string;
    label: string;
    remark: string | null;
  }>;
};

export type M2WindowParams = {
  fromDate?: string | null;
  toDate?: string | null;
  classId?: string | null;
  sectionId?: string | null;
};

export type M2AttendancePolicyResponse = {
  key: string;
  policy: {
    lockOverrideMinReasonLength: number;
    correctionReviewMinReasonLength: number;
    repeatedAbsenceThreshold: number;
    lateFollowUpThreshold: number;
    cutoffHour: number;
    cutoffMinute: number;
    parentNotificationChannels: string[];
    notifyParentsForLate: boolean;
    notifyParentsForAbsence: boolean;
    absenceMessageTemplate: string;
    lateMessageTemplate: string;
  };
  hardening?: Record<string, boolean>;
};

export type M2AttendanceStatesResponse = {
  persisted: Array<{ code: string; label: string; persisted: boolean }>;
  virtual: Array<{ code: string; label: string; persisted: boolean }>;
  supportPolicy: string;
};

export type M2HardenedAnomalyResponse = {
  fromDate: string;
  toDate: string;
  total: number;
  anomalies: Array<{
    code?: string;
    title?: string;
    description?: string;
    severity?: string;
    attendanceSessionId?: string;
    attendanceDate?: string;
    className?: string;
    sectionName?: string | null;
    recommendedAction?: string;
    [key: string]: unknown;
  }>;
};

export type M2CorrectionAuditResponse = {
  total: number;
  items: Array<{
    id: string;
    status: string;
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    attendanceDate: string;
    previousStatus: string | null;
    requestedStatus: string;
    reviewedAt: string | null;
    auditFlags: {
      hasBeforeStatus: boolean;
      hasReviewReason: boolean;
      sessionLocked: boolean | null;
      pending: boolean;
    };
  }>;
};

export type M2CalendarPolicyResponse = {
  fromDate: string;
  toDate: string;
  items: Array<{
    date: string;
    isWorkingDay: boolean;
    label: string | null;
    holidayType: string | null;
    isExamDay: boolean;
    isSchoolEvent: boolean;
    source: string;
    policy: string;
  }>;
};

export type M2FollowUpQueue = {
  fromDate: string;
  toDate: string;
  threshold: number;
  total: number;
  items: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
    guardianCount: number;
    absences: number;
    lates: number;
    consecutiveAbsences: number;
    threshold: number;
    needsFollowUp: boolean;
    recommendedChannels: string[];
  }>;
};

export type M2FollowUpRunResult = M2FollowUpQueue & {
  dryRun: boolean;
  deliveryCount: number;
};

export type M2OfflineConflictResponse = {
  total: number;
  rules: Record<string, string>;
  items: Array<{
    id: string;
    clientSubmissionId: string;
    attendanceSessionId: string | null;
    conflictId: string | null;
    syncStatus: string;
    rejectionReason: string | null;
    syncAttemptCount: number;
    deviceId: string | null;
    deviceLabel: string | null;
    attendanceDate: string;
    serverReceivedAt: string;
  }>;
};
