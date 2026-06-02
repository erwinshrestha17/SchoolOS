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
} from '@schoolos/core';
import {
  API_BASE_URL,
  JsonBody,
  parseApiErrorMessage,
  request,
  withQuery,
} from './client';

export const attendanceApi = {
  getAttendanceRoster: (params: {
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    attendanceDate?: string | null;
  }) => request<AttendanceRoster>(withQuery('/attendance/rosters', params)),
  listAttendanceAnalytics: () =>
    request<AttendanceAnalytics>('/attendance/analytics'),
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
      withQuery('/attendance/summary', {
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
  }) =>
    request<any>(
      withQuery('/attendance/register', {
        ...params,
        month: params.month ? String(params.month) : undefined,
        year: params.year ? String(params.year) : undefined,
      }),
    ),
  exportAttendanceRegister: async (
    params: {
      academicYearId: string;
      classId: string;
      sectionId?: string | null;
      month: number;
      year: number;
    },
    format: 'csv' | 'pdf',
  ) => {
    const response = await fetch(
      `${API_BASE_URL}${withQuery('/attendance/register/export', {
        ...params,
        sectionId: params.sectionId ?? undefined,
        format,
      })}`,
      { credentials: 'include' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Attendance export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-register-${params.year}-${String(
      params.month,
    ).padStart(2, '0')}.${format}`;
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
      `${API_BASE_URL}${withQuery('/students/roster/export', params ?? {})}`,
      {
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseApiErrorMessage(text) || 'Export failed');
    }

    const text = await response.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  listAttendanceConflicts: () =>
    request<AttendanceConflict[]>('/attendance/conflicts'),
  listAttendanceCorrections: (params?: {
    status?: string | null;
    studentId?: string | null;
    requestedById?: string | null;
    page?: number | null;
    limit?: number | null;
  }) =>
    request<PaginatedResponse<AttendanceCorrectionRequest>>(
      withQuery('/attendance/corrections', params ?? {}),
    ),
  submitAttendance: (body: JsonBody) =>
    request('/attendance/sessions', { method: 'POST', json: body }),
  syncAttendance: (body: JsonBody) =>
    request<AttendanceSyncSubmission>('/attendance/sync', {
      method: 'POST',
      json: body,
    }),
  saveAttendanceDraft: (body: JsonBody) =>
    request('/attendance/drafts', { method: 'POST', json: body }),
  reviewAttendanceConflict: (id: string, body: JsonBody) =>
    request<AttendanceConflictReviewResult>(
      `/attendance/conflicts/${id}/review`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  approveAttendanceCorrection: (id: string, body: JsonBody) =>
    request<AttendanceCorrectionRequest>(
      `/attendance/corrections/${encodeURIComponent(id)}/approve`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  rejectAttendanceCorrection: (id: string, body: JsonBody) =>
    request<AttendanceCorrectionRequest>(
      `/attendance/corrections/${encodeURIComponent(id)}/reject`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  listStaffAttendanceSummary: (params: { month?: number; year?: number }) =>
    request<StaffAttendanceMonthlySummary>(
      withQuery('/hr/staff-attendance/summary', {
        month: params.month ? String(params.month) : undefined,
        year: params.year ? String(params.year) : undefined,
      }),
    ),
  listStaffAttendance: (staffId: string) =>
    request<any[]>(`/hr/staff/${encodeURIComponent(staffId)}/attendance`),
  listLeaveRequests: () =>
    request<StaffLeaveRequestSummary[]>('/hr/leave-requests'),
  createLeaveRequest: (body: JsonBody) =>
    request<StaffLeaveRequestSummary>('/hr/leave-requests', {
      method: 'POST',
      json: body,
    }),
  approveLeaveRequest: (id: string, body: JsonBody) =>
    request<StaffLeaveReviewResult>(
      `/hr/leaves/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        json: body,
      },
    ),
  rejectLeaveRequest: (id: string, body: JsonBody) =>
    request<StaffLeaveReviewResult>(
      `/hr/leaves/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        json: body,
      },
    ),
  listStaffLeaveBalances: (staffId: string) =>
    request<StaffLeaveBalanceSummary[]>(
      `/hr/staff/${encodeURIComponent(staffId)}/leave-balances`,
    ),
  listAllLeaveBalances: () =>
    request<StaffLeaveBalanceSummary[]>('/hr/leave-balances'),
  listMyAttendance: () => request<any[]>('/attendance/me/attendance'),
  listMyLeaveRequests: () => request<any[]>('/attendance/me/leave-requests'),
};
