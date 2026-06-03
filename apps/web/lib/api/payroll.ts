import type {
  PayrollPreviewResult,
  PayrollRunSummary,
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
  downloadCsv,
  openPdfBlob,
  request,
  withQuery,
} from './client';

export const payrollApi = {
  listStaff: () => request<StaffSummary[]>('/staff'),
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
  listStaffContracts: () => request<StaffContractSummary[]>('/hr/contracts'),
  createStaffContract: (body: JsonBody) =>
    request<StaffContractSummary>('/hr/contracts', {
      method: 'POST',
      json: body,
    }),
  listPayrollRuns: () => request<PayrollRunSummary[]>('/payroll/runs'),
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
  listSalaryStructures: () =>
    request<SalaryStructureSummary[]>('/payroll/salary-structures'),
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
    request<unknown>(withQuery('/payroll/reports/summary', params ?? {})),
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
  listPayslips: () => request<PayslipSummary[]>('/payroll/payslips'),
  openPayrollRunStaffPayslipPdf: async (runId: string, staffId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/staff/${encodeURIComponent(staffId)}/payslip.pdf`,
      { credentials: 'include' },
    );

    await openPdfBlob(response);
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
  listMyPayslips: () => request<any[]>('/payroll/me/payslips'),
  openPayslipPdf: async (payslipNumber: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/payslips/${encodeURIComponent(payslipNumber)}.pdf`,
      {
        credentials: 'include',
      },
    );

    await openPdfBlob(response);
  },

  // Accounting Verification
  openApprovedSalarySlipPdf: async (runId: string, lineId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/payroll/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(lineId)}/salary-slip.pdf`,
      { credentials: 'include' },
    );
    await openPdfBlob(response);
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
