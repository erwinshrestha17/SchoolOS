import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChartAccountType,
  JournalLineSide,
  JournalSourceType,
  PayrollLineStatus,
  PayrollRunStatus,
  PayslipStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffContractDto } from '../hr/dto/create-staff-contract.dto';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { PayrollPreviewResult } from '@schoolos/core';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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

    if (existing) {
      throw new ConflictException('Payroll run already exists for this period');
    }

    const period = getPayrollPeriod(dto.periodYear, dto.periodMonth);
    const workingDays = dto.workingDays ?? 30;
    const contracts = await this.prisma.staffContract.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        startDate: { lte: period.endsOn },
        OR: [{ endDate: null }, { endDate: { gte: period.startsOn } }],
      },
      include: {
        staff: true,
      },
    });

    if (contracts.length === 0) {
      throw new NotFoundException('No active staff contracts found');
    }

    const attendanceCounts = await Promise.all(
      contracts.map(async (contract) => ({
        staffId: contract.staffId,
        count: await this.prisma.staffAttendance.count({
          where: {
            tenantId: actor.tenantId,
            staffId: contract.staffId,
            attendanceDate: {
              gte: period.startsOn,
              lte: period.endsOn,
            },
            status: { in: ['PRESENT', 'LATE'] },
          },
        }),
      })),
    );
    const attendanceByStaff = new Map(
      attendanceCounts.map((item) => [item.staffId, item.count]),
    );

    const lines = contracts.map((contract) => {
      const recordedAttendance = attendanceByStaff.get(contract.staffId) ?? 0;
      const attendanceDays =
        recordedAttendance > 0 ? recordedAttendance : workingDays;
      const calculated = calculatePayrollLine({
        baseSalary: Number(contract.baseSalary),
        allowances: Number(contract.allowances),
        contractDeductions: Number(contract.deductions),
        attendanceDays,
        workingDays,
      });

      return {
        tenantId: actor.tenantId,
        staffId: contract.staffId,
        contractId: contract.id,
        grossSalary: new Prisma.Decimal(calculated.grossSalary),
        allowances: new Prisma.Decimal(calculated.allowances),
        deductions: new Prisma.Decimal(calculated.deductions),
        netSalary: new Prisma.Decimal(calculated.netSalary),
        attendanceDays,
        workingDays,
      };
    });
    const totals = calculatePayrollTotals(
      lines.map((line) => ({
        grossSalary: Number(line.grossSalary),
        deductions: Number(line.deductions),
        netSalary: Number(line.netSalary),
      })),
    );

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
          create: lines,
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
    const period = getPayrollPeriod(query.year, query.month);
    const workingDays = query.workingDays ?? 30;

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

    const contractsByStaff = new Map(contracts.map((c) => [c.staffId, c]));
    const attendanceByStaff = new Map<string, number>();
    attendanceRecords.forEach((a) => {
      attendanceByStaff.set(
        a.staffId,
        (attendanceByStaff.get(a.staffId) ?? 0) + 1,
      );
    });

    const leaveByStaff = new Map<string, number>();
    leaveRequests.forEach((l) => {
      const overlap = getOverlapDays(
        l.startsOn,
        l.endsOn,
        period.startsOn,
        period.endsOn,
      );
      leaveByStaff.set(l.staffId, (leaveByStaff.get(l.staffId) ?? 0) + overlap);
    });

    return staffMembers.map((staff) => {
      const contract = contractsByStaff.get(staff.id);
      const presentDays = attendanceByStaff.get(staff.id) ?? 0;
      const approvedPaidLeaveDays = leaveByStaff.get(staff.id) ?? 0;
      const warnings: string[] = [];

      if (!contract) {
        warnings.push('No active contract found for this period');
      }

      const totalEffectiveDays = presentDays + approvedPaidLeaveDays;
      const unpaidLeaveDays = Math.max(0, workingDays - totalEffectiveDays);

      const baseSalary = contract ? Number(contract.baseSalary) : 0;
      const allowances = contract ? Number(contract.allowances) : 0;
      const contractDeductions = contract ? Number(contract.deductions) : 0;

      const calculated = calculatePayrollLine({
        baseSalary,
        allowances,
        contractDeductions,
        attendanceDays: totalEffectiveDays,
        workingDays,
      });

      return {
        staffId: staff.id,
        fullName: `${staff.firstName} ${staff.lastName}`,
        employeeId: staff.employeeId,
        contractSummary: contract
          ? {
              contractNumber: contract.contractNumber,
              position: contract.position,
              baseSalary,
              allowances,
              deductions: contractDeductions,
            }
          : undefined,
        periodMonth: query.month,
        periodYear: query.year,
        workingDays,
        presentDays,
        approvedPaidLeaveDays,
        unpaidLeaveDays,
        baseSalary,
        allowances,
        grossPay: calculated.grossSalary,
        deductions: calculated.deductions,
        netPay: calculated.netSalary,
        warnings,
      };
    });
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
        'Payroll run must be reviewed before approval',
      );
    }

    await this.prisma.payrollLine.updateMany({
      where: { tenantId: actor.tenantId, payrollRunId: run.id },
      data: { status: PayrollLineStatus.APPROVED },
    });

    return this.prisma.payrollRun.update({
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

    const entryNumber = await this.generateJournalEntryNumber(actor.tenantId);
    const payslipStart = await this.prisma.payslip.count({
      where: { tenantId: actor.tenantId },
    });

    const posted = await this.prisma.$transaction(async (tx) => {
      const salaryExpense = await ensureAccount(tx, actor.tenantId, {
        code: '5010',
        name: 'Salary Expense',
        type: ChartAccountType.EXPENSE,
      });
      const salaryPayable = await ensureAccount(tx, actor.tenantId, {
        code: '2200',
        name: 'Salary Payable',
        type: ChartAccountType.LIABILITY,
      });
      const statutoryPayable = await ensureAccount(tx, actor.tenantId, {
        code: '2300',
        name: 'Statutory Deductions Payable',
        type: ChartAccountType.LIABILITY,
      });

      const creditLines = [
        {
          tenantId: actor.tenantId,
          chartAccountId: salaryPayable.id,
          side: JournalLineSide.CREDIT,
          amount: run.netAmount,
          description: `Net salary payable ${run.periodMonth}/${run.periodYear}`,
        },
      ];

      if (Number(run.deductionAmount) > 0) {
        creditLines.push({
          tenantId: actor.tenantId,
          chartAccountId: statutoryPayable.id,
          side: JournalLineSide.CREDIT,
          amount: run.deductionAmount,
          description: `Payroll deductions ${run.periodMonth}/${run.periodYear}`,
        });
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId: actor.tenantId,
          entryNumber,
          entryDate: new Date(),
          narration: `Payroll posting ${run.periodMonth}/${run.periodYear}`,
          sourceType: JournalSourceType.PAYROLL,
          sourceId: run.id,
          createdById: actor.userId,
          lines: {
            create: [
              {
                tenantId: actor.tenantId,
                chartAccountId: salaryExpense.id,
                side: JournalLineSide.DEBIT,
                amount: run.grossAmount,
                description: `Gross salary ${run.periodMonth}/${run.periodYear}`,
              },
              ...creditLines,
            ],
          },
        },
      });

      await tx.payrollLine.updateMany({
        where: { tenantId: actor.tenantId, payrollRunId: run.id },
        data: { status: PayrollLineStatus.POSTED },
      });

      for (const [index, line] of run.lines.entries()) {
        await tx.payslip.upsert({
          where: { payrollLineId: line.id },
          update: {
            status: PayslipStatus.ISSUED,
            issuedAt: new Date(),
          },
          create: {
            tenantId: actor.tenantId,
            payrollRunId: run.id,
            payrollLineId: line.id,
            staffId: line.staffId,
            payslipNumber: `PAY-${run.periodYear}-${String(
              payslipStart + index + 1,
            ).padStart(5, '0')}`,
            status: PayslipStatus.ISSUED,
            grossSalary: line.grossSalary,
            deductionAmount: line.deductions,
            netSalary: line.netSalary,
            issuedAt: new Date(),
          },
        });
      }

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

  async listPayslips(actor: AuthContext) {
    return this.prisma.payslip.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        staff: true,
        payrollRun: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
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
        payrollRun: true,
      },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found in this tenant');
    }

    return buildSimplePdf([
      'SchoolOS Payslip',
      `Payslip: ${payslip.payslipNumber}`,
      `Employee: ${payslip.staff.firstName} ${payslip.staff.lastName}`,
      `Employee ID: ${payslip.staff.employeeId}`,
      `Period: ${payslip.payrollRun.periodMonth}/${payslip.payrollRun.periodYear}`,
      `Gross Salary: Rs ${Number(payslip.grossSalary).toFixed(2)}`,
      `Deductions: Rs ${Number(payslip.deductionAmount).toFixed(2)}`,
      `Net Salary: Rs ${Number(payslip.netSalary).toFixed(2)}`,
      `Status: ${payslip.status}`,
    ]);
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

  private async generateJournalEntryNumber(tenantId: string) {
    const count = await this.prisma.journalEntry.count({
      where: { tenantId },
    });

    return `JE-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }
}

type PayrollLineInput = {
  baseSalary: number;
  allowances: number;
  contractDeductions: number;
  attendanceDays: number;
  workingDays: number;
};

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

export function getPayrollRunActions(status: PayrollRunStatus | string) {
  return {
    canReview: status === PayrollRunStatus.DRAFT,
    canApprove: status === PayrollRunStatus.REVIEWED,
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

async function ensureAccount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  account: {
    code: string;
    name: string;
    type: ChartAccountType;
  },
) {
  return tx.chartAccount.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: account.code,
      },
    },
    update: {
      name: account.name,
      type: account.type,
      isSystem: true,
    },
    create: {
      tenantId,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: true,
    },
  });
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

  // Set to UTC midnight to ensure we count full calendar days inclusive
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  const diffTime = Math.abs(e - s);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
