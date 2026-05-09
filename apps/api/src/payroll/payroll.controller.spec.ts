import type { AuthContext } from '../auth/auth.types';
import { PayrollController } from './payroll.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'payroll@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const payrollService = {
    getPayrollPreview: jest.fn(),
    listPayrollRuns: jest.fn(),
    getPayrollRun: jest.fn(),
    createPayrollRun: jest.fn(),
    approvePayrollRun: jest.fn(),
    reviewPayrollRun: jest.fn(),
    rejectPayrollRun: jest.fn(),
    postPayrollRun: jest.fn(),
    markPayrollRunPaid: jest.fn(),
    listPayslips: jest.fn(),
    listMyPayslips: jest.fn(),
    getPayslipPdf: jest.fn(),
    getPayslipPdfForRunStaff: jest.fn(),
    listStatutoryDeductions: jest.fn(),
    createSalaryStructure: jest.fn(),
    listSalaryStructures: jest.fn(),
    getActiveSalaryStructure: jest.fn(),
    updateSalaryStructure: jest.fn(),
    activateSalaryStructure: jest.fn(),
    archiveSalaryStructure: jest.fn(),
    getPayrollRegister: jest.fn(),
    getPayrollSummary: jest.fn(),
    exportPayrollRegisterCsv: jest.fn(),
  };
  const salarySlipService = {
    getApprovedSalarySlipPdf: jest.fn(),
  };

  return {
    controller: new PayrollController(
      payrollService as never,
      salarySlipService as never,
    ),
    payrollService,
    salarySlipService,
  };
}

describe('PayrollController M7 contracts', () => {
  it('delegates payroll preview without mutating run data', () => {
    const { controller, payrollService } = createController();
    const query = { year: 2026, month: 5, workingDays: 26 };
    payrollService.getPayrollPreview.mockReturnValue([{ staffId: 'staff-1' }]);

    const result = controller.getPreview(query as never, actor);

    expect(payrollService.getPayrollPreview).toHaveBeenCalledWith(query, actor);
    expect(payrollService.createPayrollRun).not.toHaveBeenCalled();
    expect(result).toEqual([{ staffId: 'staff-1' }]);
  });

  it('delegates create run and preview-to-draft through createPayrollRun', () => {
    const { controller, payrollService } = createController();
    const dto = { periodYear: 2026, periodMonth: 5, workingDays: 26 };
    payrollService.createPayrollRun.mockReturnValue({ id: 'run-1' });

    expect(controller.createRun(dto as never, actor)).toEqual({ id: 'run-1' });
    expect(controller.createDraftFromPreview(dto as never, actor)).toEqual({
      id: 'run-1',
    });
    expect(payrollService.createPayrollRun).toHaveBeenNthCalledWith(
      1,
      dto,
      actor,
    );
    expect(payrollService.createPayrollRun).toHaveBeenNthCalledWith(
      2,
      dto,
      actor,
    );
  });

  it('delegates strict payroll run lifecycle actions', () => {
    const { controller, payrollService } = createController();
    const actionDto = { reason: 'Ready', paymentAccountCode: 'BANK-001' };
    payrollService.reviewPayrollRun.mockReturnValue({ status: 'UNDER_REVIEW' });
    payrollService.approvePayrollRun.mockReturnValue({ status: 'APPROVED' });
    payrollService.postPayrollRun.mockReturnValue({ status: 'POSTED' });
    payrollService.markPayrollRunPaid.mockReturnValue({ status: 'PAID' });
    payrollService.rejectPayrollRun.mockReturnValue({ status: 'CANCELLED' });

    expect(controller.reviewRun('run-1', actor)).toEqual({
      status: 'UNDER_REVIEW',
    });
    expect(controller.approveRun('run-1', actor)).toEqual({
      status: 'APPROVED',
    });
    expect(controller.postRun('run-1', actor)).toEqual({ status: 'POSTED' });
    expect(controller.postRunToAccounting('run-1', actor)).toEqual({
      status: 'POSTED',
    });
    expect(controller.markPaid('run-1', actionDto as never, actor)).toEqual({
      status: 'PAID',
    });
    expect(controller.rejectRun('run-1', actionDto as never, actor)).toEqual({
      status: 'CANCELLED',
    });
    expect(payrollService.reviewPayrollRun).toHaveBeenCalledWith(
      'run-1',
      actor,
    );
    expect(payrollService.approvePayrollRun).toHaveBeenCalledWith(
      'run-1',
      actor,
    );
    expect(payrollService.postPayrollRun).toHaveBeenCalledWith('run-1', actor);
    expect(payrollService.markPayrollRunPaid).toHaveBeenCalledWith(
      'run-1',
      actionDto,
      actor,
    );
    expect(payrollService.rejectPayrollRun).toHaveBeenCalledWith(
      'run-1',
      actionDto,
      actor,
    );
  });

  it('delegates salary structure lifecycle commands', () => {
    const { controller, payrollService } = createController();
    const dto = {
      staffId: 'staff-1',
      effectiveFrom: '2026-05-01',
      basicSalary: 50000,
      components: [{ name: 'Basic', componentType: 'EARNING', amount: 50000 }],
    };
    payrollService.createSalaryStructure.mockReturnValue({ id: 'salary-1' });
    payrollService.updateSalaryStructure.mockReturnValue({ id: 'salary-1' });
    payrollService.activateSalaryStructure.mockReturnValue({
      status: 'ACTIVE',
    });
    payrollService.archiveSalaryStructure.mockReturnValue({
      status: 'ARCHIVED',
    });
    payrollService.getActiveSalaryStructure.mockReturnValue({ id: 'salary-1' });

    expect(controller.createSalaryStructure(dto as never, actor)).toEqual({
      id: 'salary-1',
    });
    expect(
      controller.updateSalaryStructure('salary-1', dto as never, actor),
    ).toEqual({ id: 'salary-1' });
    expect(controller.activateSalaryStructure('salary-1', actor)).toEqual({
      status: 'ACTIVE',
    });
    expect(controller.archiveSalaryStructure('salary-1', actor)).toEqual({
      status: 'ARCHIVED',
    });
    expect(controller.getSalaryStructure('staff-1', actor)).toEqual({
      id: 'salary-1',
    });
    expect(payrollService.createSalaryStructure).toHaveBeenCalledWith(
      dto,
      actor,
    );
    expect(payrollService.updateSalaryStructure).toHaveBeenCalledWith(
      'salary-1',
      dto,
      actor,
    );
    expect(payrollService.activateSalaryStructure).toHaveBeenCalledWith(
      'salary-1',
      actor,
    );
    expect(payrollService.archiveSalaryStructure).toHaveBeenCalledWith(
      'salary-1',
      actor,
    );
    expect(payrollService.getActiveSalaryStructure).toHaveBeenCalledWith(
      'staff-1',
      actor,
    );
  });

  it('delegates payslip access through staff/HR scoped service methods', () => {
    const { controller, payrollService, salarySlipService } =
      createController();
    const pdf = Buffer.from('%PDF-1.4');
    payrollService.listPayslips.mockReturnValue([{ id: 'payslip-1' }]);
    payrollService.listMyPayslips.mockReturnValue([{ id: 'my-payslip-1' }]);
    payrollService.getPayslipPdf.mockReturnValue(pdf);
    payrollService.getPayslipPdfForRunStaff.mockReturnValue(pdf);
    salarySlipService.getApprovedSalarySlipPdf.mockReturnValue(pdf);

    expect(controller.listPayslips(actor)).toEqual([{ id: 'payslip-1' }]);
    expect(controller.listMyPayslips(actor)).toEqual([{ id: 'my-payslip-1' }]);
    expect(controller.getPayslipPdf('PS-001', actor)).toBe(pdf);
    expect(controller.getStaffPayslipPdf('run-1', 'staff-1', actor)).toBe(pdf);
    expect(controller.getApprovedSalarySlipPdf('run-1', 'line-1', actor)).toBe(
      pdf,
    );
    expect(payrollService.getPayslipPdf).toHaveBeenCalledWith('PS-001', actor);
    expect(payrollService.getPayslipPdfForRunStaff).toHaveBeenCalledWith(
      'run-1',
      'staff-1',
      actor,
    );
    expect(salarySlipService.getApprovedSalarySlipPdf).toHaveBeenCalledWith(
      'run-1',
      'line-1',
      actor,
    );
  });

  it('delegates payroll reports and CSV export from backend service', () => {
    const { controller, payrollService } = createController();
    payrollService.getPayrollRegister.mockReturnValue({ lines: [] });
    payrollService.getPayrollSummary.mockReturnValue({ totalNet: 0 });
    payrollService.exportPayrollRegisterCsv.mockReturnValue(
      'Employee,Net\nE-001,50000',
    );

    expect(controller.getPayrollRegister(actor)).toEqual({ lines: [] });
    expect(controller.getPayrollSummary(actor)).toEqual({ totalNet: 0 });
    expect(controller.getPayrollPf(actor)).toEqual({ lines: [] });
    expect(controller.getPayrollTds(actor)).toEqual({ lines: [] });
    expect(controller.getPayrollLeaveDeductions(actor)).toEqual({ lines: [] });
    expect(controller.exportPayrollRegisterCsv(actor)).toBe(
      'Employee,Net\nE-001,50000',
    );
    expect(payrollService.getPayrollRegister).toHaveBeenCalledWith(actor);
    expect(payrollService.getPayrollSummary).toHaveBeenCalledWith(actor);
    expect(payrollService.exportPayrollRegisterCsv).toHaveBeenCalledWith(actor);
  });
});
