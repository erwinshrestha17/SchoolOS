import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollLineStatus, PayrollRunStatus, Prisma } from '@prisma/client';
import type { PayrollPreviewResult } from '@schoolos/core';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { buildSalarySlipPdf, buildSimplePdf } from '../common/pdf/simple-pdf';
import { CreateStaffContractDto } from '../hr/dto/create-staff-contract.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accountingPostingService: AccountingPostingService,
  ) {}

  async listContracts(actor: AuthContext) {
    return this.prisma.staffContract.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createContract(dto: CreateStaffContractDto, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    const contract = await this.prisma.staffContract.create({
      data: {
        tenantId: actor.tenantId,
        staffId: dto.staffId,
        contractNumber: dto.contractNumber,
        position: dto.position,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        baseSalary: new Prisma.Decimal(dto.baseSalary),
        allowances: new Prisma.Decimal(dto.allowances ?? 0),
        deductions: new Prisma.Decimal(dto.deductions ?? 0),
      },
      include: {
        staff: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'staff_contract',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: contract.id,
      after: {
        staffId: contract.staffId,
        contractNumber: contract.contractNumber,
        baseSalary: Number(contract.baseSalary),
      },
    });

    return contract;
  }

  async listPayrollRuns(actor: AuthContext) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        lines: {
          include: {
            staff: true,
          },
        },
        payslips: true,
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  async createPayrollRun(dto: CreatePayrollRunDto, actor: AuthContext) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        tenantId_periodMonth_periodYear: {
          tenantId: actor.tenantId,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
        },
      },
    });

    if (existing && existing.status !== PayrollRunStatus.VOID) {
      throw new ConflictException(
        'A payroll run already exists for this period. Void the existing one first if a re-run is needed.',
      );
    }

    if (existing?.status === PayrollRunStatus.VOID) {
      await this.prisma.payrollRun.delete({ where: { id: existing.id } });
    }

    const workingDays = dto.workingDays ?? 30;

    const { lines, totals } = await this.calculatePeriodPayrollLines(
      dto.periodYear,
      dto.periodMonth,
      workingDays,
      actor,
    );

    if (lines.length === 0) {
      throw new NotFoundException('No active staff contracts found to process');
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        tenantId: actor.tenantId,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        notes: dto.notes ?? null,
        grossAmount: new Prisma.Decimal(totals.grossAmount),
        deductionAmount: new Prisma.Decimal(totals.deductionAmount),
        netAmount: new Prisma.Decimal(totals.netAmount),
        lines: {
          create: lines.map((line) => ({
            tenantId: actor.tenantId,
            staffId: line.staffId,
            contractId: line.contractId,
            grossSalary: new Prisma.Decimal(line.grossSalary),
            allowances: new Prisma.Decimal(line.allowances),
            deductions: new Prisma.Decimal(line.deductions),
            netSalary: new Prisma.Decimal(line.netSalary),
            attendanceDays: line.attendanceDays,
            workingDays: line.workingDays,
          })),
        },
      },
      include: {
        lines: {
          include: {
            staff: true,
          },
        },
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: run.id,
      after: {
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        lineCount: run.lines.length,
        netAmount: Number(run.netAmount),
      },
    });

    return run;
  }

  async getPayrollPreview(
    query: PayrollPreviewQueryDto,
    actor: AuthContext,
  ): Promise<PayrollPreviewResult[]> {
    const { lines, staffMembers, contractsByStaff } =
      await this.calculatePeriodPayrollLines(
        query.year,
        query.month,
        query.workingDays ?? 30,
        actor,
      );

    const linesByStaff = new Map(lines.map((line) => [line.staffId, line]));

    return staffMembers.map((staff) => {
      const line = linesByStaff.get(staff.id);
      const contract = contractsByStaff.get(staff.id);
      const warnings: string[] = [];

      if (!contract) {
        warnings.push('No active contract found for this period');
      }

      return {
        staffId: staff.id,
        fullName: `${staff.firstName} ${staff.lastName}`,
        employeeId: staff.employeeId,
        contractSummary: contract
          ? {
              contractNumber: contract.contractNumber,
              position: contract.position,
              baseSalary: Number(contract.baseSalary),
              allowances: Number(contract.allowances),
              deductions: Number(contract.deductions),
            }
          : undefined,
        periodMonth: query.month,
        periodYear: query.year,
        workingDays: line?.workingDays ?? query.workingDays ?? 30,
        presentDays: line?.presentDays ?? 0,
        approvedPaidLeaveDays: line?.approvedPaidLeaveDays ?? 0,
        unpaidLeaveDays: line?.unpaidLeaveDays ?? 0,
        baseSalary: line?.baseSalary ?? 0,
        allowances: line?.allowances ?? 0,
        grossPay: line?.grossSalary ?? 0,
        deductions: line?.deductions ?? 0,
        netPay: line?.netSalary ?? 0,
        warnings,
      };
    });
  }

  private async calculatePeriodPayrollLines(
    year: number,
    month: number,
    workingDays: number,
    actor: AuthContext,
  ) {
    const period = getPayrollPeriod(year, month);

    const staffMembers = await this.prisma.staff.findMany({
      where: {
        tenantId: actor.tenantId,
      },
    });

    const contracts = await this.prisma.staffContract.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        startDate: { lte: period.endsOn },
        OR: [{ endDate: null }, { endDate: { gte: period.startsOn } }],
      },
    });

    const attendanceRecords = await this.prisma.staffAttendance.findMany({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: {
          gte: period.startsOn,
          lte: period.endsOn,
        },
        status: { in: ['PRESENT', 'LATE'] },
      },
    });

    const leaveRequests = await this.prisma.staffLeaveRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'APPROVED',
        startsOn: { lte: period.endsOn },
        endsOn: { gte: period.startsOn },
      },
    });

    const contractsByStaff = new Map(
      contracts.map((contract) => [contract.staffId, contract]),
    );
    const attendanceByStaff = new Map<string, number>();
    attendanceRecords.forEach((attendance) => {
      attendanceByStaff.set(
        attendance.staffId,
        (attendanceByStaff.get(attendance.staffId) ?? 0) + 1,
      );
    });

    const leaveByStaff = new Map<string, number>();
    leaveRequests.forEach((leave) => {
      const overlap = getOverlapDays(
        leave.startsOn,
        leave.endsOn,
        period.startsOn,
        period.endsOn,
      );
      leaveByStaff.set(
        leave.staffId,
        (leaveByStaff.get(leave.staffId) ?? 0) + overlap,
      );
    });

    const lines = contracts.map((contract) => {
      const presentDays = attendanceByStaff.get(contract.staffId) ?? 0;
      const approvedPaidLeaveDays = leaveByStaff.get(contract.staffId) ?? 0;
      const totalEffectiveDays = presentDays + approvedPaidLeaveDays;
      const unpaidLeaveDays = Math.max(0, workingDays - totalEffectiveDays);

      const baseSalary = Number(contract.baseSalary);
      const allowances = Number(contract.allowances);
      const contractDeductions = Number(contract.deductions);

      const calculated = calculatePayrollLine({
        baseSalary,
        allowances,
        contractDeductions,
        attendanceDays: totalEffectiveDays,
        workingDays,
      });

      return {
        staffId: contract.staffId,
        contractId: contract.id,
        baseSalary,
        allowances,
        grossSalary: calculated.grossSalary,
        deductions: calculated.deductions,
        netSalary: calculated.netSalary,
        workingDays,
        presentDays,
        approvedPaidLeaveDays,
        unpaidLeaveDays,
        attendanceDays: totalEffectiveDays,
      };
    });

    const totals = calculatePayrollTotals(
      lines.map((line) => ({
        grossSalary: line.grossSalary,
        deductions: line.deductions,
        netSalary: line.netSalary,
      })),
    );

    return {
      lines,
      totals,
      staffMembers,
      contractsByStaff,
    };
  }

  async approvePayrollRun(id: string, actor: AuthContext) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    const actions = getPayrollRunActions(run.status);

    if (run.status === PayrollRunStatus.POSTED) {
      throw new ConflictException('Posted payroll cannot be re-approved');
    }

    if (run.status === PayrollRunStatus.APPROVED) {
      return run;
    }

    if (!actions.canApprove) {
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot be approved`,
      );
    }

    await this.prisma.payrollLine.updateMany({
      where: { tenantId: actor.tenantId, payrollRunId: run.id },
      data: { status: PayrollLineStatus.APPROVED },
    });

    const updated = await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: PayrollRunStatus.APPROVED,
        approvedAt: new Date(),
      },
      include: {
        lines: {
          include: {
            staff: true,
          },
        },
      },
    });

    await this.auditService.record({
      action: 'approve',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: {
        status: updated.status,
        approvedAt: updated.approvedAt,
      },
    });

    return updated;
  }

  async reviewPayrollRun(id: string, actor: AuthContext) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    const actions = getPayrollRunActions(run.status);

    if (run.status === PayrollRunStatus.POSTED) {
      throw new ConflictException('Posted payroll cannot be reviewed');
    }

    if (!actions.canReview) {
      return run;
    }

    return this.prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: PayrollRunStatus.REVIEWED },
      include: {
        lines: {
          include: {
            staff: true,
          },
        },
      },
    });
  }

  async postPayrollRun(id: string, actor: AuthContext) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    const actions = getPayrollRunActions(run.status);

    if (run.status === PayrollRunStatus.POSTED) {
      return run;
    }

    if (!actions.canPost) {
      throw new ConflictException(
        'Payroll run must be approved before posting',
      );
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const journalEntry =
        await this.accountingPostingService.postPayrollAccrual(
          {
            tenantId: actor.tenantId,
            payrollRunId: run.id,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            grossAmount: run.grossAmount,
            deductionAmount: run.deductionAmount,
            netAmount: run.netAmount,
          },
          actor,
          tx,
        );

      await tx.payrollLine.updateMany({
        where: { tenantId: actor.tenantId, payrollRunId: run.id },
        data: { status: PayrollLineStatus.POSTED },
      });

      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.POSTED,
          postedAt: new Date(),
          journalEntryId: journalEntry.id,
        },
        include: {
          lines: {
            include: {
              staff: true,
            },
          },
          payslips: true,
        },
      });
    });

    await this.auditService.record({
      action: 'post',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: run.id,
      after: {
        journalEntryId: posted.journalEntryId,
      grossAmount: Number(posted.grossAmount),
        netAmount: Number(posted.netAmount),
      },
    });

    return posted;
  }

  async listMyPayslips(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    return this.prisma.payslip.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
      },
      include: {
        payrollRun: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayslipPdf(payslipNumber: string, actor: AuthContext) {
    const payslip = await this.prisma.payslip.findFirst({
      where: {
        tenantId: actor.tenantId,
        payslipNumber,
      },
      include: {
        staff: true,
        payrollRun: {
          include: { tenant: true },
        },
        payrollLine: true,
      },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found in this tenant');
    }

    if (
      payslip.staff.userId !== actor.userId &&
      !actor.permissions.includes('payroll:read')
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this payslip',
      );
    }

    const monthLabels = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    return buildSalarySlipPdf({
      schoolName: payslip.payrollRun.tenant.name,
      payslipNumber: payslip.payslipNumber,
      period: `${monthLabels[payslip.payrollRun.periodMonth - 1]} ${payslip.payrollRun.periodYear}`,
      staff: {
        name: `${payslip.staff.firstName} ${payslip.staff.lastName}`,
        id: payslip.staff.employeeId,
        bankAccount: payslip.staff.bankAccount,
        panNumber: payslip.staff.panNumber,
      },
      earnings: [
        {
          name: 'Basic Salary',
          amount:
            Number(payslip.payrollLine.grossSalary) -
            Number(payslip.payrollLine.allowances),
        },
        { name: 'Allowances', amount: Number(payslip.payrollLine.allowances) },
      ],
      deductions: [
        { name: 'Statutory Deductions', amount: Number(payslip.deductionAmount) },
      ],
      grossSalary: Number(payslip.grossSalary),
      totalDeductions: Number(payslip.deductionAmount),
      netSalary: Number(payslip.netSalary),
      attendance: {
        present: payslip.payrollLine.attendanceDays,
        working: payslip.payrollLine.workingDays,
      },
    });
  }

  listStatutoryDeductions() {
    return [
      {
        code: 'SSF_DEMO',
        name: 'Social security demo deduction',
        ratePercent: 1,
        note: 'Demo-ready placeholder; final statutory rates remain configurable by policy.',
      },
    ];
  }

  private async getPayrollRunOrThrow(id: string, actor: AuthContext) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        lines: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found in this tenant');
    }

    return run;
  }
}

interface PayrollLineInput {
  baseSalary: number;
  allowances: number;
  contractDeductions: number;
  attendanceDays: number;
  workingDays: number;
}

export function calculatePayrollLine(input: PayrollLineInput) {
  const attendanceRatio =
    input.workingDays > 0
      ? Math.min(input.attendanceDays / input.workingDays, 1)
      : 1;
  const fullGross = input.baseSalary + input.allowances;
  const grossSalary = roundMoney(fullGross * attendanceRatio);
  const statutoryDeduction = roundMoney(grossSalary * 0.01);
  const deductions = roundMoney(input.contractDeductions + statutoryDeduction);
  const netSalary = roundMoney(Math.max(0, grossSalary - deductions));

  return {
    grossSalary,
    allowances: input.allowances,
    deductions,
    netSalary,
  };
}

export function calculatePayrollTotals(
  lines: Array<{
    grossSalary: number;
    deductions: number;
    netSalary: number;
  }>,
) {
  return lines.reduce(
    (totals, line) => ({
      grossAmount: roundMoney(totals.grossAmount + line.grossSalary),
      deductionAmount: roundMoney(totals.deductionAmount + line.deductions),
      netAmount: roundMoney(totals.netAmount + line.netSalary),
    }),
    { grossAmount: 0, deductionAmount: 0, netAmount: 0 },
  );
}

export function getPayrollRunActions(status: string) {
  return {
    canReview: status === PayrollRunStatus.DRAFT,
    canApprove:
      status === PayrollRunStatus.DRAFT || status === PayrollRunStatus.REVIEWED,
    canPost: status === PayrollRunStatus.APPROVED,
  };
}

function getPayrollPeriod(periodYear: number, periodMonth: number) {
  const startsOn = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const endsOn = new Date(
    Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999),
  );

  return { startsOn, endsOn };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getOverlapDays(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): number {
  const start = new Date(Math.max(start1.getTime(), start2.getTime()));
  const end = new Date(Math.min(end1.getTime(), end2.getTime()));

  if (start > end) return 0;

  const s = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  const diffTime = Math.abs(e - s);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
