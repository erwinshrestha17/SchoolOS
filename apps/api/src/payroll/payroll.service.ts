import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JournalLineSide,
  PayrollLineStatus,
  PayrollPaymentStatus,
  PayrollRunStatus,
  Prisma,
  SalaryStructureStatus,
} from '@prisma/client';
import type { PayrollPreviewResult } from '@schoolos/core';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { buildSalarySlipPdf, buildSimplePdf } from '../common/pdf/simple-pdf';
import { CreateStaffContractDto } from '../hr/dto/create-staff-contract.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PayrollActionDto } from './dto/payroll-action.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';

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
      take: 100,
    });
  }

  async createContract(dto: CreateStaffContractDto, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    const contract = await this.prisma.$transaction(async (tx) => {
      // Deactivate current active contracts
      await tx.staffContract.updateMany({
        where: {
          tenantId: actor.tenantId,
          staffId: dto.staffId,
          status: 'ACTIVE',
        },
        data: {
          status: 'INACTIVE',
          endDate: new Date(),
        },
      });

      return tx.staffContract.create({
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
          status: 'ACTIVE',
        },
        include: {
          staff: true,
        },
      });
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

  async createSalaryStructure(
    dto: CreateSalaryStructureDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    const structure = await this.prisma.salaryStructure.create({
      data: {
        tenantId: actor.tenantId,
        staffId: dto.staffId,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        basicSalary: new Prisma.Decimal(dto.basicSalary),
        allowances: new Prisma.Decimal(dto.allowances ?? 0),
        deductions: new Prisma.Decimal(dto.deductions ?? 0),
        pfEnabled: dto.pfEnabled ?? false,
        tdsEnabled: dto.tdsEnabled ?? false,
        paymentMethod: dto.paymentMethod ?? 'BANK',
        bankAccount: dto.bankAccount ?? staff.bankAccount,
        bankName: dto.bankName ?? staff.bankName,
        notes: dto.notes ?? null,
        components: {
          create: (dto.components ?? []).map((component) => ({
            tenantId: actor.tenantId,
            name: component.name,
            componentType: component.componentType,
            amount: new Prisma.Decimal(component.amount),
            taxable: component.taxable ?? true,
          })),
        },
      },
      include: { staff: true, components: true },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'salary_structure',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: structure.id,
      after: {
        staffId: structure.staffId,
        basicSalary: structure.basicSalary.toString(),
        effectiveFrom: structure.effectiveFrom,
      },
    });

    return structure;
  }

  async listSalaryStructures(actor: AuthContext) {
    return this.prisma.salaryStructure.findMany({
      where: { tenantId: actor.tenantId },
      include: { staff: true, components: true },
      orderBy: [{ effectiveFrom: 'desc' }],
      take: 100,
    });
  }

  async getActiveSalaryStructure(staffId: string, actor: AuthContext) {
    const structure = await this.prisma.salaryStructure.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId,
        status: SalaryStructureStatus.ACTIVE,
      },
      include: { staff: true, components: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (structure) {
      return structure;
    }

    const contract = await this.prisma.staffContract.findFirst({
      where: { tenantId: actor.tenantId, staffId, status: 'ACTIVE' },
      include: { staff: true },
      orderBy: { startDate: 'desc' },
    });

    if (!contract) {
      throw new NotFoundException(
        'No active salary structure or staff contract found',
      );
    }

    return contract;
  }

  async updateSalaryStructure(
    id: string,
    dto: UpdateSalaryStructureDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.salaryStructure.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { components: true },
    });

    if (!existing) {
      throw new NotFoundException('Salary structure not found');
    }

    if (existing.status !== SalaryStructureStatus.DRAFT) {
      const usedInPayroll = await this.prisma.payrollLine.count({
        where: { tenantId: actor.tenantId, salaryStructureId: existing.id },
      });

      if (usedInPayroll > 0) {
        throw new ConflictException(
          'Salary structure used by payroll cannot be mutated retroactively',
        );
      }
    }

    const updated = await this.prisma.salaryStructure.update({
      where: { id: existing.id },
      data: {
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : undefined,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        basicSalary:
          dto.basicSalary !== undefined
            ? new Prisma.Decimal(dto.basicSalary)
            : undefined,
        allowances:
          dto.allowances !== undefined
            ? new Prisma.Decimal(dto.allowances)
            : undefined,
        deductions:
          dto.deductions !== undefined
            ? new Prisma.Decimal(dto.deductions)
            : undefined,
        pfEnabled: dto.pfEnabled,
        tdsEnabled: dto.tdsEnabled,
        paymentMethod: dto.paymentMethod,
        bankAccount: dto.bankAccount,
        bankName: dto.bankName,
        notes: dto.notes,
      },
      include: { staff: true, components: true },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'salary_structure',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: existing.status },
      after: {
        status: updated.status,
        basicSalary: updated.basicSalary.toString(),
      },
    });

    return updated;
  }

  async activateSalaryStructure(id: string, actor: AuthContext) {
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    const overlapping = await this.prisma.salaryStructure.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: structure.staffId,
        status: SalaryStructureStatus.ACTIVE,
        id: { not: structure.id },
        effectiveFrom: {
          lte: structure.effectiveTo ?? structure.effectiveFrom,
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: structure.effectiveFrom } },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'Only one ACTIVE salary structure is allowed for an effective date range',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Archive current active structure
      await tx.salaryStructure.updateMany({
        where: {
          tenantId: actor.tenantId,
          staffId: structure.staffId,
          status: SalaryStructureStatus.ACTIVE,
          id: { not: structure.id },
        },
        data: {
          status: SalaryStructureStatus.ARCHIVED,
          effectiveTo: new Date(),
        },
      });

      return tx.salaryStructure.update({
        where: { id: structure.id },
        data: {
          status: SalaryStructureStatus.ACTIVE,
          activatedAt: new Date(),
        },
        include: { staff: true, components: true },
      });
    });

    await this.auditService.record({
      action: 'activate',
      resource: 'salary_structure',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { staffId: updated.staffId, status: updated.status },
    });

    return updated;
  }

  async archiveSalaryStructure(id: string, actor: AuthContext) {
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    const updated = await this.prisma.salaryStructure.update({
      where: { id: structure.id },
      data: {
        status: SalaryStructureStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: { staff: true, components: true },
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'salary_structure',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status },
    });

    return updated;
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
      take: 100,
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
        periodStart: getPayrollPeriod(dto.periodYear, dto.periodMonth).startsOn,
        periodEnd: getPayrollPeriod(dto.periodYear, dto.periodMonth).endsOn,
        status: PayrollRunStatus.GENERATED,
        generatedById: actor.userId,
        notes: dto.notes ?? null,
        grossAmount: new Prisma.Decimal(totals.grossAmount),
        deductionAmount: new Prisma.Decimal(totals.deductionAmount),
        netAmount: new Prisma.Decimal(totals.netAmount),
        pfEmployeeAmount: new Prisma.Decimal(totals.pfEmployeeAmount),
        pfEmployerAmount: new Prisma.Decimal(totals.pfEmployerAmount),
        tdsAmount: new Prisma.Decimal(totals.tdsAmount),
        lines: {
          create: lines.map((line) => ({
            tenantId: actor.tenantId,
            staffId: line.staffId,
            contractId: line.contractId,
            salaryStructureId: line.salaryStructureId,
            basicSalary: new Prisma.Decimal(line.baseSalary),
            earnings: new Prisma.Decimal(line.earnings),
            grossSalary: new Prisma.Decimal(line.grossSalary),
            allowances: new Prisma.Decimal(line.allowances),
            leaveDeductions: new Prisma.Decimal(line.leaveDeductions),
            pfEmployee: new Prisma.Decimal(line.pfEmployee),
            pfEmployer: new Prisma.Decimal(line.pfEmployer),
            tds: new Prisma.Decimal(line.tds),
            otherDeductions: new Prisma.Decimal(line.otherDeductions),
            deductions: new Prisma.Decimal(line.deductions),
            netSalary: new Prisma.Decimal(line.netSalary),
            paidDays: new Prisma.Decimal(line.attendanceDays),
            unpaidDays: new Prisma.Decimal(line.unpaidLeaveDays),
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
    const { lines, staffMembers, contractsByStaff, salaryStructureByStaff } =
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
      const salaryStructure = salaryStructureByStaff.get(staff.id);
      const warnings: string[] = [];

      if (!contract && !salaryStructure) {
        warnings.push(
          'No active salary structure or contract found for this period',
        );
      }

      return {
        staffId: staff.id,
        fullName: `${staff.firstName} ${staff.lastName}`,
        employeeId: staff.employeeId,
        contractSummary: salaryStructure
          ? {
              contractNumber: salaryStructure.id,
              position: 'Active salary structure',
              baseSalary: Number(salaryStructure.basicSalary),
              allowances: Number(salaryStructure.allowances),
              deductions: Number(salaryStructure.deductions),
            }
          : contract
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
        baseSalary: Number(line?.baseSalary ?? 0),
        allowances: Number(line?.allowances ?? 0),
        grossPay: Number(line?.grossSalary ?? 0),
        deductions: Number(line?.deductions ?? 0),
        netPay: Number(line?.netSalary ?? 0),
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
    const salaryStructures = await this.prisma.salaryStructure.findMany({
      where: {
        tenantId: actor.tenantId,
        status: SalaryStructureStatus.ACTIVE,
        effectiveFrom: { lte: period.endsOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startsOn } }],
      },
      include: { components: true },
      orderBy: { effectiveFrom: 'desc' },
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
    const salaryStructureByStaff = new Map(
      salaryStructures.map((structure) => [structure.staffId, structure]),
    );
    const attendanceByStaff = new Map<string, number>();
    attendanceRecords.forEach((attendance) => {
      attendanceByStaff.set(
        attendance.staffId,
        (attendanceByStaff.get(attendance.staffId) ?? 0) + 1,
      );
    });

    const paidLeaveByStaff = new Map<string, number>();
    const unpaidLeaveByStaff = new Map<string, number>();

    leaveRequests.forEach((leave) => {
      const overlap = getOverlapDays(
        leave.startsOn,
        leave.endsOn,
        period.startsOn,
        period.endsOn,
      );
      if (leave.isPaid) {
        paidLeaveByStaff.set(
          leave.staffId,
          (paidLeaveByStaff.get(leave.staffId) ?? 0) + overlap,
        );
      } else {
        unpaidLeaveByStaff.set(
          leave.staffId,
          (unpaidLeaveByStaff.get(leave.staffId) ?? 0) + overlap,
        );
      }
    });

    const payrollSources = [
      ...salaryStructures.map((structure) => ({
        staffId: structure.staffId,
        contractId: null,
        salaryStructureId: structure.id,
        baseSalary: structure.basicSalary,
        allowances: structure.allowances,
        contractDeductions: structure.deductions,
        pfEnabled: structure.pfEnabled,
        tdsEnabled: structure.tdsEnabled,
      })),
      ...contracts
        .filter((contract) => !salaryStructureByStaff.has(contract.staffId))
        .map((contract) => ({
          staffId: contract.staffId,
          contractId: contract.id,
          salaryStructureId: null,
          baseSalary: contract.baseSalary,
          allowances: contract.allowances,
          contractDeductions: contract.deductions,
          pfEnabled: false,
          tdsEnabled: true,
        })),
    ];

    const lines = payrollSources.map((source) => {
      const presentDays = attendanceByStaff.get(source.staffId) ?? 0;
      const approvedPaidLeaveDays = paidLeaveByStaff.get(source.staffId) ?? 0;
      const approvedUnpaidLeaveDays =
        unpaidLeaveByStaff.get(source.staffId) ?? 0;

      const totalEffectiveDays = presentDays + approvedPaidLeaveDays;
      const unpaidLeaveDays = Math.max(0, workingDays - totalEffectiveDays);
      // Ensure we count explicit unpaid leave if it exceeds the working day gap
      const finalUnpaidDays = Math.max(
        unpaidLeaveDays,
        approvedUnpaidLeaveDays,
      );

      const baseSalary = new Prisma.Decimal(source.baseSalary);
      const allowances = new Prisma.Decimal(source.allowances);
      const contractDeductions = new Prisma.Decimal(source.contractDeductions);

      const calculated = calculatePayrollLine({
        baseSalary,
        allowances,
        contractDeductions,
        attendanceDays: totalEffectiveDays,
        workingDays,
        pfEnabled: source.pfEnabled,
        tdsEnabled: source.tdsEnabled,
      });

      return {
        staffId: source.staffId,
        contractId: source.contractId,
        salaryStructureId: source.salaryStructureId,
        baseSalary,
        allowances,
        earnings: calculated.earnings,
        grossSalary: calculated.grossSalary,
        leaveDeductions: calculated.leaveDeductions,
        pfEmployee: calculated.pfEmployee,
        pfEmployer: calculated.pfEmployer,
        tds: calculated.tds,
        otherDeductions: calculated.otherDeductions,
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
      salaryStructureByStaff,
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

    const lines = await this.prisma.payrollLine.findMany({
      where: { tenantId: actor.tenantId, payrollRunId: run.id },
    });

    await this.prisma.payslip.createMany({
      data: lines.map((line, index) => ({
        tenantId: actor.tenantId,
        payrollRunId: run.id,
        payrollLineId: line.id,
        staffId: line.staffId,
        payslipNumber: `PS-${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}`,
        status: 'ISSUED',
        grossSalary: line.grossSalary,
        deductionAmount: line.deductions,
        pfEmployee: line.pfEmployee,
        pfEmployer: line.pfEmployer,
        tds: line.tds,
        netSalary: line.netSalary,
        issuedAt: new Date(),
      })),
      skipDuplicates: true,
    });

    const updated = await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: PayrollRunStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: actor.userId,
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
      data: { status: PayrollRunStatus.UNDER_REVIEW },
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

    if (run.journalEntryId) {
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
            pfEmployeeAmount: run.pfEmployeeAmount,
            pfEmployerAmount: run.pfEmployerAmount,
            tdsAmount: run.tdsAmount,
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
          postedById: actor.userId,
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

  async reverseAndCorrectPayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    const actions = getPayrollRunActions(run.status);

    if (!actions.canReverse) {
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot be reversed`,
      );
    }

    if (!run.journalEntryId) {
      throw new ConflictException('No journal entry found to reverse');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const originalEntry = await tx.journalEntry.findUnique({
        where: { id: run.journalEntryId! },
        include: { lines: true },
      });

      if (!originalEntry) {
        throw new ConflictException('Payroll journal entry was not found');
      }

      // 1. Reverse in accounting
      const reversalEntry = await this.accountingPostingService.postReversal(
        {
          tenantId: actor.tenantId,
          originalEntryId: originalEntry.id,
          reversalDate: new Date(),
          narration: `Reversal of payroll run ${run.periodMonth}/${run.periodYear}`,
          reason: dto.reason || 'Payroll correction',
          lines: originalEntry.lines.map((line) => ({
            chartAccountId: line.chartAccountId,
            side:
              line.side === JournalLineSide.DEBIT
                ? JournalLineSide.CREDIT
                : JournalLineSide.DEBIT,
            amount: line.amount,
            description: `Reversal of ${line.description}`,
          })),
        },
        actor,
        tx,
      );

      // 2. Void current run
      const updated = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.VOID,
          reversalAt: new Date(),
          reversalReason: dto.reason || 'Payroll correction',
          reversedById: actor.userId,
        },
      });

      return { updated, reversalEntry };
    });

    await this.auditService.record({
      action: 'reverse',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: run.id,
      after: {
        status: PayrollRunStatus.VOID,
        reversalEntryId: result.reversalEntry.id,
      },
    });

    return result;
  }

  async rejectPayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    const run = await this.getPayrollRunOrThrow(id, actor);

    if (
      run.status === PayrollRunStatus.APPROVED ||
      run.status === PayrollRunStatus.POSTED ||
      run.status === PayrollRunStatus.PAID
    ) {
      throw new ConflictException(
        'Approved, posted, or paid payroll cannot be rejected',
      );
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: PayrollRunStatus.CANCELLED,
        notes: dto.reason ?? run.notes,
      },
      include: { lines: { include: { staff: true } } },
    });

    await this.auditService.record({
      action: 'reject',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, reason: dto.reason ?? null },
    });

    return updated;
  }

  async markPayrollRunPaid(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    const run = await this.getPayrollRunOrThrow(id, actor);

    if (run.status !== PayrollRunStatus.POSTED) {
      throw new ConflictException('Payroll run must be posted before payment');
    }

    if (run.disbursementJournalEntryId) {
      return run;
    }

    const paid = await this.prisma.$transaction(async (tx) => {
      const journalEntry =
        await this.accountingPostingService.postPayrollDisbursement(
          {
            tenantId: actor.tenantId,
            payrollRunId: run.id,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            netAmount: run.netAmount,
            paymentAccountCode: dto.paymentAccountCode,
          },
          actor,
          tx,
        );

      await tx.payrollLine.updateMany({
        where: { tenantId: actor.tenantId, payrollRunId: run.id },
        data: { paymentStatus: PayrollPaymentStatus.PAID },
      });

      await tx.payslip.updateMany({
        where: { tenantId: actor.tenantId, payrollRunId: run.id },
        data: { paymentStatus: PayrollPaymentStatus.PAID },
      });

      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.PAID,
          paidAt: new Date(),
          paidById: actor.userId,
          disbursementJournalEntryId: journalEntry.id,
        },
        include: { lines: { include: { staff: true } }, payslips: true },
      });
    });

    await this.auditService.record({
      action: 'mark_paid',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: paid.id,
      after: {
        disbursementJournalEntryId: paid.disbursementJournalEntryId,
        reason: dto.reason ?? null,
      },
    });

    return paid;
  }

  async reversePayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    if (!dto.reason) {
      throw new ConflictException('Reversal reason is required');
    }

    const run = await this.getPayrollRunOrThrow(id, actor);

    if (
      run.status !== PayrollRunStatus.POSTED &&
      run.status !== PayrollRunStatus.PAID
    ) {
      throw new ConflictException(
        'Only posted or paid payroll runs can be reversed',
      );
    }

    const reversed = await this.prisma.$transaction(async (tx) => {
      // 1. Reverse Disbursement if paid
      if (run.disbursementJournalEntryId) {
        const originalEntry = await tx.journalEntry.findUnique({
          where: { id: run.disbursementJournalEntryId },
          include: { lines: true },
        });
        if (originalEntry) {
          await this.accountingPostingService.postReversal(
            {
              tenantId: actor.tenantId,
              originalEntryId: originalEntry.id,
              reversalDate: new Date(),
              narration: `Reversal of Payroll Disbursement for ${run.periodMonth}/${run.periodYear}`,
              reason: dto.reason!,
              lines: originalEntry.lines.map((l) => ({
                chartAccountId: l.chartAccountId,
                side:
                  l.side === JournalLineSide.DEBIT
                    ? JournalLineSide.CREDIT
                    : JournalLineSide.DEBIT,
                amount: l.amount,
                description: `Reversal of ${l.description}`,
              })),
            },
            actor,
            tx,
          );
        }
      }

      // 2. Reverse Accrual
      if (run.journalEntryId) {
        const originalEntry = await tx.journalEntry.findUnique({
          where: { id: run.journalEntryId },
          include: { lines: true },
        });
        if (originalEntry) {
          await this.accountingPostingService.postReversal(
            {
              tenantId: actor.tenantId,
              originalEntryId: originalEntry.id,
              reversalDate: new Date(),
              narration: `Reversal of Payroll Accrual for ${run.periodMonth}/${run.periodYear}`,
              reason: dto.reason!,
              lines: originalEntry.lines.map((l) => ({
                chartAccountId: l.chartAccountId,
                side:
                  l.side === JournalLineSide.DEBIT
                    ? JournalLineSide.CREDIT
                    : JournalLineSide.DEBIT,
                amount: l.amount,
                description: `Reversal of ${l.description}`,
              })),
            },
            actor,
            tx,
          );
        }
      }

      // 3. Update Payroll Run Status
      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.CANCELLED,
          reversalReason: dto.reason,
          reversalAt: new Date(),
          reversedById: actor.userId,
        },
      });
    });

    await this.auditService.record({
      action: 'reverse',
      resource: 'payroll_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reversed.id,
      after: {
        status: reversed.status,
        reason: dto.reason,
      },
    });

    return reversed;
  }

  async getPayrollRun(id: string, actor: AuthContext) {
    return this.getPayrollRunOrThrow(id, actor);
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

    const canSeeSensitive =
      actor.permissions.includes('hr:manage') ||
      actor.permissions.includes('payroll:manage') ||
      actor.userId === payslip.staff.userId;

    const mask = (val: string | null | undefined) => {
      if (!val) return val;
      if (canSeeSensitive) return val;
      if (val.length <= 4) return '****';
      return val.substring(0, 2) + '****' + val.substring(val.length - 2);
    };

    return buildSalarySlipPdf({
      schoolName: payslip.payrollRun.tenant.name,
      payslipNumber: payslip.payslipNumber,
      period: `${monthLabels[payslip.payrollRun.periodMonth - 1]} ${payslip.payrollRun.periodYear}`,
      staff: {
        name: `${payslip.staff.firstName} ${payslip.staff.lastName}`,
        id: payslip.staff.employeeId,
        bankAccount: mask(payslip.staff.bankAccount),
        panNumber: mask(payslip.staff.panNumber),
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
        {
          name: 'Statutory Deductions',
          amount: Number(payslip.deductionAmount),
        },
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

  async getPayslipPdfForRunStaff(
    runId: string,
    staffId: string,
    actor: AuthContext,
  ) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { tenantId: actor.tenantId, payrollRunId: runId, staffId },
      include: {
        staff: true,
        payrollRun: { include: { tenant: true } },
        payrollLine: true,
      },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found in this tenant');
    }

    return this.getPayslipPdf(payslip.payslipNumber, actor);
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

  async getPayrollRegister(actor: AuthContext) {
    const runs = await this.prisma.payrollRun.findMany({
      where: { tenantId: actor.tenantId },
      include: { lines: { include: { staff: true } } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    return runs.flatMap((run) =>
      run.lines.map((line) => ({
        payrollRunId: run.id,
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        status: run.status,
        staffId: line.staffId,
        employeeId: line.staff.employeeId,
        staffName: `${line.staff.firstName} ${line.staff.lastName}`,
        grossSalary: Number(line.grossSalary),
        deductions: Number(line.deductions),
        pfEmployee: Number(line.pfEmployee),
        pfEmployer: Number(line.pfEmployer),
        tds: Number(line.tds),
        netPayable: Number(line.netSalary),
        paidDays: Number(line.paidDays),
        unpaidDays: Number(line.unpaidDays),
      })),
    );
  }

  async getPayrollSummary(actor: AuthContext) {
    const runs = await this.prisma.payrollRun.findMany({
      where: { tenantId: actor.tenantId },
      include: { lines: true },
    });

    return runs.reduce(
      (summary, run) => ({
        runCount: summary.runCount + 1,
        staffCount: summary.staffCount + run.lines.length,
        gross: summary.gross + Number(run.grossAmount),
        deductions: summary.deductions + Number(run.deductionAmount),
        netPayable: summary.netPayable + Number(run.netAmount),
        pf:
          summary.pf +
          Number(run.pfEmployeeAmount) +
          Number(run.pfEmployerAmount),
        tds: summary.tds + Number(run.tdsAmount),
      }),
      {
        runCount: 0,
        staffCount: 0,
        gross: 0,
        deductions: 0,
        netPayable: 0,
        pf: 0,
        tds: 0,
      },
    );
  }

  async exportPayrollRegisterCsv(actor: AuthContext) {
    const rows = await this.getPayrollRegister(actor);

    await this.auditService.record({
      action: 'export',
      resource: 'payroll_register',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: rows.length },
    });

    return [
      'Period,Employee ID,Staff Name,Gross,Deductions,PF Employee,PF Employer,TDS,Net Payable,Paid Days,Unpaid Days,Status',
      ...rows.map((row) =>
        [
          `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}`,
          row.employeeId,
          row.staffName,
          row.grossSalary,
          row.deductions,
          row.pfEmployee,
          row.pfEmployer,
          row.tds,
          row.netPayable,
          row.paidDays,
          row.unpaidDays,
          row.status,
        ].join(','),
      ),
    ].join('\n');
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

  async regeneratePayrollLines(id: string, actor: AuthContext) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    const actions = getPayrollRunActions(run.status);

    if (!actions.canEdit) {
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot be edited`,
      );
    }

    const { lines, totals } = await this.calculatePeriodPayrollLines(
      run.periodYear,
      run.periodMonth,
      30, // Default working days, should ideally be stored in the run
      actor,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({
        where: { tenantId: actor.tenantId, payrollRunId: run.id },
      });

      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          grossAmount: new Prisma.Decimal(totals.grossAmount),
          deductionAmount: new Prisma.Decimal(totals.deductionAmount),
          netAmount: new Prisma.Decimal(totals.netAmount),
          pfEmployeeAmount: new Prisma.Decimal(totals.pfEmployeeAmount),
          pfEmployerAmount: new Prisma.Decimal(totals.pfEmployerAmount),
          tdsAmount: new Prisma.Decimal(totals.tdsAmount),
          status: PayrollRunStatus.GENERATED,
          lines: {
            create: lines.map((line) => ({
              tenantId: actor.tenantId,
              staffId: line.staffId,
              contractId: line.contractId,
              salaryStructureId: line.salaryStructureId,
              basicSalary: new Prisma.Decimal(line.baseSalary),
              earnings: new Prisma.Decimal(line.earnings),
              grossSalary: new Prisma.Decimal(line.grossSalary),
              allowances: new Prisma.Decimal(line.allowances),
              leaveDeductions: new Prisma.Decimal(line.leaveDeductions),
              pfEmployee: new Prisma.Decimal(line.pfEmployee),
              pfEmployer: new Prisma.Decimal(line.pfEmployer),
              tds: new Prisma.Decimal(line.tds),
              otherDeductions: new Prisma.Decimal(line.otherDeductions),
              deductions: new Prisma.Decimal(line.deductions),
              netSalary: new Prisma.Decimal(line.netSalary),
              paidDays: new Prisma.Decimal(line.attendanceDays),
              unpaidDays: new Prisma.Decimal(line.unpaidLeaveDays),
              attendanceDays: line.attendanceDays,
              workingDays: line.workingDays,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }
}

interface PayrollLineInput {
  baseSalary: Prisma.Decimal | number;
  allowances: Prisma.Decimal | number;
  contractDeductions: Prisma.Decimal | number;
  attendanceDays: number;
  workingDays: number;
  pfEnabled?: boolean;
  tdsEnabled?: boolean;
}

export function calculatePayrollLine(input: PayrollLineInput) {
  const workingDays = new Prisma.Decimal(input.workingDays || 1);
  const paidDays = new Prisma.Decimal(
    Math.min(input.attendanceDays, input.workingDays || input.attendanceDays),
  );
  const attendanceRatio =
    input.workingDays > 0 ? paidDays.div(workingDays) : new Prisma.Decimal(1);
  const basicSalary = new Prisma.Decimal(input.baseSalary);
  const allowances = new Prisma.Decimal(input.allowances);
  const fullGross = basicSalary.add(allowances);
  const grossSalaryDecimal = moneyDecimal(fullGross.mul(attendanceRatio));
  const fullPeriodLeaveDeduction = fullGross.sub(grossSalaryDecimal);

  // These should ideally be configurable, but using 10% and 1% for hardening logic
  const pfEmployee = input.pfEnabled
    ? moneyDecimal(grossSalaryDecimal.mul(new Prisma.Decimal('0.10')))
    : new Prisma.Decimal(0);
  const pfEmployer = input.pfEnabled
    ? moneyDecimal(grossSalaryDecimal.mul(new Prisma.Decimal('0.10')))
    : new Prisma.Decimal(0);
  const tds = input.tdsEnabled
    ? moneyDecimal(grossSalaryDecimal.mul(new Prisma.Decimal('0.01')))
    : new Prisma.Decimal(0);

  const otherDeductions = new Prisma.Decimal(input.contractDeductions);
  const totalDeductions = moneyDecimal(
    otherDeductions.add(pfEmployee).add(tds),
  );

  const calculatedNet = grossSalaryDecimal.sub(totalDeductions);
  const netSalaryDecimal = calculatedNet.lt(0)
    ? new Prisma.Decimal(0)
    : moneyDecimal(calculatedNet);

  return {
    earnings: grossSalaryDecimal,
    grossSalary: grossSalaryDecimal,
    allowances,
    leaveDeductions: moneyDecimal(fullPeriodLeaveDeduction),
    pfEmployee,
    pfEmployer,
    tds,
    otherDeductions,
    deductions: totalDeductions,
    netSalary: netSalaryDecimal,
  };
}

export function calculatePayrollTotals(
  lines: Array<{
    grossSalary: Prisma.Decimal;
    deductions: Prisma.Decimal;
    netSalary: Prisma.Decimal;
    pfEmployee?: Prisma.Decimal;
    pfEmployer?: Prisma.Decimal;
    tds?: Prisma.Decimal;
  }>,
) {
  return lines.reduce(
    (totals, line) => ({
      grossAmount: totals.grossAmount.add(line.grossSalary),
      deductionAmount: totals.deductionAmount.add(line.deductions),
      netAmount: totals.netAmount.add(line.netSalary),
      pfEmployeeAmount: totals.pfEmployeeAmount.add(line.pfEmployee ?? 0),
      pfEmployerAmount: totals.pfEmployerAmount.add(line.pfEmployer ?? 0),
      tdsAmount: totals.tdsAmount.add(line.tds ?? 0),
    }),
    {
      grossAmount: new Prisma.Decimal(0),
      deductionAmount: new Prisma.Decimal(0),
      netAmount: new Prisma.Decimal(0),
      pfEmployeeAmount: new Prisma.Decimal(0),
      pfEmployerAmount: new Prisma.Decimal(0),
      tdsAmount: new Prisma.Decimal(0),
    },
  );
}

export function getPayrollRunActions(status: string) {
  return {
    canEdit:
      status === PayrollRunStatus.DRAFT ||
      status === PayrollRunStatus.GENERATED ||
      status === PayrollRunStatus.UNDER_REVIEW,
    canReview:
      status === PayrollRunStatus.DRAFT ||
      status === PayrollRunStatus.GENERATED,
    canApprove:
      status === PayrollRunStatus.UNDER_REVIEW ||
      status === PayrollRunStatus.REVIEWED ||
      status === PayrollRunStatus.GENERATED,
    canPost: status === PayrollRunStatus.APPROVED,
    canPay: status === PayrollRunStatus.POSTED,
    canReverse:
      status === PayrollRunStatus.POSTED || status === PayrollRunStatus.PAID,
    isLocked:
      status === PayrollRunStatus.POSTED ||
      status === PayrollRunStatus.PAID ||
      status === PayrollRunStatus.CANCELLED ||
      status === PayrollRunStatus.VOID,
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

function moneyDecimal(value: Prisma.Decimal) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function decimalNumber(value: Prisma.Decimal | number | string) {
  return Number(new Prisma.Decimal(value));
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
