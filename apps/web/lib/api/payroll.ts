import type {
  PaginatedResponse,
  PayrollDashboardSummary,
  PayrollPreviewResult,
  PayrollRunSummary,
  PayslipRegenerationJobSummary,
  PayslipSummary,
  RoleSummary,
  SalaryStructureSummary,
  StaffContractSummary,
  StaffDetail,
  StaffSummary,
} from '@schoolos/core';
import {
  API_BASE_URL,
  JsonBody,
  StaffLifecycleHistoryEvent,
  downloadBlob,
  downloadCsv,
  request,
  withQuery,
} from './client';

export type StaffContractExpiryReminder = {
  type: 'CONTRACT_EXPIRY' | 'PROBATION_END';
  staffId: string;
  employeeId: string | null;
  staffName: string;
  department: string | null;
  designation: string | null;
  contractId: string | null;
  contractNumber: string | null;
  position: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
};

export type StaffContractExpiryReminderResponse = {
  windowDays: number;
  from: string;
  to: string;
  total: number;
  items: StaffContractExpiryReminder[];
};

export type LeaveQueueDepthPreview = {
  id: string;
  staffId: string;
  employeeId: string | null;
  staffName: string;
  department: string | null;
  designation: string | null;
  leaveType: string;
  isPaid: boolean;
  startsOn: string;
  endsOn: string;
  days: number;
  createdAt: string;
};

export type LeaveQueueDepth = {
  pending: number;
  staleDays: number;
  stalePending: number;
  oldestPendingAt: string | null;
  byLeaveType: Record<string, number>;
  byDepartment: Record<string, number>;
  preview: LeaveQueueDepthPreview[];
};

export type PayrollReportSummary = {
  runCount: number;
  staffCount: number;
  gross: number | string;
  deductions: number | string;
  netPayable: number | string;
  pf: number | string;
  tds: number | string;
};

type M7ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  month?: number;
  year?: number;
  payrollRunId?: string;
  staffId?: string;
  department?: string;
  designation?: string;
  contractType?: string;
  expiringWithinDays?: number;
  contractWindowDays?: number;
};

function protectedPdfFileName(prefix: string, id: string) {
  const safeId = id.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${prefix}-${safeId || 'file'}.pdf`;
}

export const payrollApi = {
  listStaff: () => request<StaffSummary[]>('/staff'),
  listStaffDirectory: (params?: M7ListParams) =>
    request<PaginatedResponse<StaffSummary>>(
      withQuery('/staff/directory', params ?? {}),
    ),
  getStaffDetail: (staffId: string) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}`),
  listStaffHistory: (staffId: string) =>
    request<StaffLifecycleHistoryEvent[]>(
      `/hr/staff/${encodeURIComponent(staffId)}/history`,
    ),
  updateStaffDetail: (staffId: string, body: JsonBody) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}`, {
      method: 'PATCH',
      json: body,
    }),
  updateStaffLifecycle: (staffId: string, body: JsonBody) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}/lifecycle`, {
      method: 'POST',
      json: body,
    }),
  createStaff: (body: JsonBody) =>
    request<StaffSummary>('/staff', { method: 'POST', json: body }),
  listRoles: () => request<RoleSummary[]>('/roles'),
  listStaffContractsPage: (params?: M7ListParams) =>
    request<PaginatedResponse<StaffContractSummary>>(
      withQuery('/hr/contracts', params ?? {}),
    ),
  listStaffContracts: async () => {
    const page = await payrollApi.listStaffContractsPage();
    return page.items;
  },
  createStaffContract: (body: JsonBody) =>
    request<StaffContractSummary>('/hr/contracts', {
      method: 'POST',
      json: body,
    }),
  listContractExpiryReminders: (params?: { days?: number }) =>
    request<StaffContractExpiryReminderResponse>(
      withQuery('/hr/staff/contract-expiry/reminders', params ?? {}),
    ),
  getLeaveQueueDepth: (params?: { staleDays?: number }) =>
    request<LeaveQueueDepth>(
      withQuery('/hr/leave-queue/depth', params ?? {}),
    ),
  getPayrollDashboardSummary: (params?: M7ListParams) =>
    request<PayrollDashboardSummary>(
      withQuery('/payroll/dashboard-summary', params ?? {}),
    ),
  listPayrollRunsPage: (params?: M7ListParams) =>
    request<PaginatedResponse<PayrollRunSummary>>(
      withQuery('/payroll/runs', params ?? {}),
    ),
  listPayrollRuns: async () => {
    const page = await payrollApi.listPayrollRunsPage();
    return page.items;
  },
  getPayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${encodeURIComponent(id)}`),
  previewPayrollRun: (body: JsonBody) =>
    request<PayrollPreviewResult[]>('/payroll/runs/preview', {
      method: 'POST',
      json: body,
    }),
  createPayrollRun: (body: JsonBody) =>
    request<PayrollRunSummary>('/payroll/runs', { method: 'POST', json: body }),
  reviewPayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/review`, {
      method: 'POST',
      json: {},
    }),
  approvePayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/approve`, {
      method: 'POST',
      json: {},
    }),
  postPayrollRun: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/post`, {
      method: 'POST',
      json: {},
    }),
  submitPayrollRunReview: (id: string) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/submit-review`, {
      method: 'POST',
      json: {},
    }),
  rejectPayrollRun: (id: string, body: JsonBody) =>
    request<PayrollRunSummary>(`/payroll/runs/${id}/reject`, {
      method: 'POST',
      json: body,
    }),
  listSalaryStructuresPage: (params?: M7ListParams) =>
    request<PaginatedResponse<SalaryStructureSummary>>(
      withQuery('/payroll/salary-structures', params ?? {}),
    ),
  listSalaryStructures: async () => {
    const page = await payrollApi.listSalaryStructuresPage();
    return page.items;
  },
  createSalaryStructure: (body: JsonBody) =>
    request<SalaryStructureSummary>('/payroll/salary-structures', {
      method: 'POST',
      json: body,
    }),
  activateSalaryStructure: (id: string) =>
    request<SalaryStructureSummary>(
      `/payroll/salary-structures/${encodeURIComponent(id)}/activate`,
      { method: 'POST', json: {} },
    ),
  archiveSalaryStructure: (id: string) =>
    request<SalaryStructureSummary>(
      `/payroll/salary-structures/${encodeURIComponent(id)}/archive`,
      { method: 'POST', json: {} },
    ),
  getPayrollRegister: (params?: JsonBody) =>
    request<unknown[]>(withQuery('/payroll/reports/register', params ?? {})),
  getPayrollReportSummary: (params?: JsonBody) =>
    request<PayrollReportSummary>(
      withQuery('/payroll/reports/summary', params ?? {}),
    ),
  getPayrollPfSummary: (params?: JsonBody) =>
    request<unknown>(withQuery('/payroll/reports/pf', params ?? {})),
  getPayrollTdsSummary: (params?: JsonBody) =>
    request<unknown>(withQuery('/payroll/reports/tds', params ?? {})),
  getPayrollSalaryComponentSummary: (params?: JsonBody) =>
    request<unknown>(
      withQuery('/payroll/reports/salary-components', params ?? {}),
    ),
  getPayrollLeaveDeductionSummary: (params?: JsonBody) =>
    request<unknown>(
      withQuery('/payroll/reports/leave-deductions', params ?? {}),
    ),
  exportPayrollRegisterCsv: (params?: JsonBody) =>
    downloadCsv(
      withQuery('/payroll/reports/register.csv', params ?? {}),
      `payroll-register-${new Date().toISOString().slice(0, 10)}.csv`,
    ),
  exportPayrollPfCsv: (params?: JsonBody) =>
    downloadCsv(
      withQuery('/payroll/reports/pf/export.csv', params ?? {}),
      `payroll-pf-${new Date().toISOString().slice(0, 10)}.csv`,
    ),
  exportPayrollTdsCsv: (params?: JsonBody) =>
    downloadCsv(
      withQuery('/payroll/reports/tds/export.csv', params ?? {}),
      `payroll-tds-${new Date().toISOString().slice(0, 10)}.csv`,
    ),
  listPayslipsPage: (params?: M7ListParams) =>
    request<PaginatedResponse<PayslipSummary>>(
      withQuery('/payroll/payslips', params ?? {}),
    ),
  listPayslips: async () => {
    const page = await payrollApi.listPayslipsPage();
    return page.items;
  },
  queuePayslipRegeneration: (runId: string, payslipId: string) =>
    request<PayslipRegenerationJobSummary>(
      `/payroll/runs/${encodeURIComponent(runId)}/payslips/${encodeURIComponent(payslipId)}/regeneration-jobs`,
      { method: 'POST', json: {} },
    ),
  getPayslipRegenerationJob: (
    runId: string,
    payslipId: string,
    jobId: string,
  ) =>
    request<PayslipRegenerationJobSummary>(
      `/payroll/runs/${encodeURIComponent(runId)}/payslips/${encodeURIComponent(payslipId)}/regeneration-jobs/${encodeURIComponent(jobId)}`,
    ),
  openPayrollRunStaffPayslipPdf: async (runId: string, staffId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/staff/${encodeURIComponent(staffId)}/payslip.pdf`,
      { credentials: 'include' },
    );

    await downloadBlob(response, protectedPdfFileName('payslip', staffId));
  },
  getPayrollPreview: (params: {
    year: number;
    month: number;
    workingDays?: number;
  }) =>
    request<PayrollPreviewResult[]>(
      withQuery('/payroll/preview', {
        year: String(params.year),
        month: String(params.month),
        workingDays: params.workingDays
          ? String(params.workingDays)
          : undefined,
      }),
    ),
  getMyProfile: () => request<any>('/staff/me'),
  listMyPayslipsPage: (params?: M7ListParams) =>
    request<PaginatedResponse<PayslipSummary>>(
      withQuery('/payroll/me/payslips', params ?? {}),
    ),
  listMyPayslips: async () => {
    const page = await payrollApi.listMyPayslipsPage();
    return page.items;
  },
  openMyPayslipPdf: async (payslipNumber: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/me/payslips/${encodeURIComponent(payslipNumber)}.pdf`,
      {
        credentials: 'include',
      },
    );

    await downloadBlob(response, protectedPdfFileName('payslip', payslipNumber));
  },
  openPayslipPdf: async (payslipNumber: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/payslips/${encodeURIComponent(payslipNumber)}.pdf`,
      {
        credentials: 'include',
      },
    );

    await downloadBlob(response, protectedPdfFileName('payslip', payslipNumber));
  },

  // Accounting Verification
  openApprovedSalarySlipPdf: async (runId: string, lineId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(lineId)}/salary-slip.pdf`,
      { credentials: 'include' },
    );
    await downloadBlob(response, protectedPdfFileName('salary-slip', lineId));
  },

  archiveStaff: (staffId: string, reason?: string) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}/archive`, {
      method: 'POST',
      json: { reason },
    }),
  terminateStaff: (staffId: string, body: JsonBody) =>
    request<StaffDetail>(`/hr/staff/${encodeURIComponent(staffId)}/terminate`, {
      method: 'POST',
      json: body,
    }),
  listStaffDocuments: (staffId: string, params?: { page?: number; limit?: number }) =>
    request<any>(withQuery(`/hr/staff/${encodeURIComponent(staffId)}/documents`, params ?? {})),
  addStaffDocument: (staffId: string, body: JsonBody) =>
    request<any>(`/hr/staff/${encodeURIComponent(staffId)}/documents`, {
      method: 'POST',
      json: body,
    }),
  verifyStaffDocument: (staffId: string, documentId: string, body: JsonBody) =>
    request<any>(`/hr/staff/${encodeURIComponent(staffId)}/documents/${encodeURIComponent(documentId)}/verify`, {
      method: 'POST',
      json: body,
    }),
  updateSalaryStructure: (id: string, body: JsonBody) =>
    request<SalaryStructureSummary>(`/payroll/salary-structures/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  markPayrollRunPaid: (id: string, body: JsonBody) =>
    request<PayrollRunSummary>(`/payroll/runs/${encodeURIComponent(id)}/mark-paid`, {
      method: 'POST',
      json: body,
    }),
  exportPayrollRunRegisterCsv: (id: string) =>
    downloadCsv(
      `/payroll/runs/${encodeURIComponent(id)}/register/export.csv`,
      `payroll-register-${id}-${new Date().toISOString().slice(0, 10)}.csv`,
    ),
  processLeaveAccruals: (body: { year: number; month: number }) =>
    request<any>('/hr/staff/accruals/process', {
      method: 'POST',
      json: body,
    }),
};
