import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  FileStatus,
  JournalLineSide,
  PayrollLineStatus,
  PayrollPaymentStatus,
  PayrollRunStatus,
  PayslipStatus,
  Prisma,
  SalaryComponentType,
  SalaryStructureStatus,
  StaffStatus,
} from '@prisma/client';
import {
  getNepalSchoolDay,
  type PayrollPreviewResult,
  type PayslipRegenerationJobStatus,
  type PayslipRegenerationJobSummary,
} from '@schoolos/core';
import type { Job, Queue } from 'bullmq';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { buildSalarySlipPdf, buildSimplePdf } from '../common/pdf/simple-pdf';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { CreateStaffContractDto } from '../hr/dto/create-staff-contract.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageOperationError } from '../storage/storage.utils';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PayrollActionDto } from './dto/payroll-action.dto';
import type {
  PayrollDashboardSummaryQueryDto,
  PayrollPaginatedQueryDto,
  PayrollRunListQueryDto,
  PayslipListQueryDto,
  SalaryStructureListQueryDto,
  StaffContractListQueryDto,
} from './dto/payroll-list-query.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';

interface PayrollReportFilters {
  payrollRunId?: string;
  month?: number;
  year?: number;
  department?: string;
  staffId?: string;
  status?: PayrollRunStatus;
}

type PayrollReportFilterInput = string | PayrollReportFilters;

interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export interface PayslipGenerationJobData {
  tenantId: string;
  payrollRunId: string;
  payslipId?: string;
  requestedByUserId: string | null;
}

export interface PayslipGenerationJobResult {
  payrollRunId: string;
  periodMonth: number;
  periodYear: number;
  payslipCount: number;
  generated: number;
  skipped: number;
}

interface PayslipGenerationTarget {
  id: string;
  payslipNumber: string;
  payrollRun: {
    id: string;
    periodMonth: number;
    periodYear: number;
    status: PayrollRunStatus;
  };
}

const PAYSLIP_FILE_UNAVAILABLE_MESSAGE =
  'Protected payslip file is unavailable. Regenerate payslips before downloading.';
const PAYSLIP_GENERATION_RUN_STATUSES: ReadonlySet<PayrollRunStatus> = new Set([
  PayrollRunStatus.APPROVED,
  PayrollRunStatus.POSTED,
  PayrollRunStatus.PAID,
]);

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accountingPostingService: AccountingPostingService,
    @Optional() private readonly fileRegistryService?: FileRegistryService,
    @Optional()
    @InjectQueue('payroll')
    private readonly payrollQueue?: Queue<
      PayslipGenerationJobData,
      PayslipGenerationJobResult
    >,
  ) {}

  async listContracts(
    query: StaffContractListQueryDto | undefined,
    actor: AuthContext,
  ) {
    const { page, limit, skip } = getPagination(query);
    const search = query?.search?.trim();
    const department = query?.department?.trim();
    const expiringCutoff =
      query?.expiringWithinDays !== undefined
        ? addDaysUtc(getNepalSchoolDay().startUtc, query.expiringWithinDays)
        : null;
    const where: Prisma.StaffContractWhereInput = {
      tenantId: actor.tenantId,
      ...(query?.staffId ? { staffId: query.staffId } : {}),
      ...(query?.status ? { status: query.status.trim().toUpperCase() } : {}),
      ...(expiringCutoff
        ? {
            endDate: {
              gte: getNepalSchoolDay().startUtc,
              lte: expiringCutoff,
            },
          }
        : {}),
      ...(department ? { staff: { department: { equals: department } } } : {}),
      ...(search
        ? {
            OR: [
              { contractNumber: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
              {
                staff: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { employeeId: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffContract.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.staffContract.count({ where }),
    ]);

    return paginated(
      items.map((contract) => ({
        ...contract,
        baseSalary: moneyString(contract.baseSalary),
        allowances: moneyString(contract.allowances),
        deductions: moneyString(contract.deductions),
      })),
      total,
      page,
      limit,
    );
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
        baseSalary: contract.baseSalary.toString(),
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

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    assertSalaryStructureDateRange(effectiveFrom, effectiveTo);

    const structure = await this.prisma.salaryStructure.create({
      data: {
        tenantId: actor.tenantId,
        staffId: dto.staffId,
        effectiveFrom,
        effectiveTo,
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

  async listSalaryStructures(
    query: SalaryStructureListQueryDto | undefined,
    actor: AuthContext,
  ) {
    const { page, limit, skip } = getPagination(query);
    const search = query?.search?.trim();
    const where: Prisma.SalaryStructureWhereInput = {
      tenantId: actor.tenantId,
      ...(query?.staffId ? { staffId: query.staffId } : {}),
      ...(query?.status ? { status: query.status } : {}),
      ...(search
        ? {
            staff: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { employeeId: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.salaryStructure.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
          components: true,
        },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.salaryStructure.count({ where }),
    ]);

    return paginated(items.map(serializeSalaryStructure), total, page, limit);
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

    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo
      ? new Date(dto.effectiveTo)
      : existing.effectiveTo;
    assertSalaryStructureDateRange(effectiveFrom, effectiveTo);

    const updated = await this.prisma.salaryStructure.update({
      where: { id: existing.id },
      data: {
        effectiveFrom: dto.effectiveFrom ? effectiveFrom : undefined,
        effectiveTo: dto.effectiveTo ? effectiveTo : undefined,
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

    assertSalaryStructureDateRange(
      structure.effectiveFrom,
      structure.effectiveTo,
    );

    const overlappingStructures = await this.prisma.salaryStructure.findMany({
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
      orderBy: { effectiveFrom: 'asc' },
    });

    const unsafeOverlap = overlappingStructures.find(
      (activeStructure) =>
        !canClosePreviousSalaryVersion(activeStructure, structure),
    );

    if (unsafeOverlap) {
      throw new ConflictException(
        'Only one ACTIVE salary structure is allowed for an effective date range',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const previousVersion of overlappingStructures) {
        await tx.salaryStructure.update({
          where: { id: previousVersion.id },
          data: {
            effectiveTo: previousDayUtc(structure.effectiveFrom),
          },
        });
      }

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

  async listPayrollRuns(
    query: PayrollRunListQueryDto | undefined,
    actor: AuthContext,
  ) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.PayrollRunWhereInput = {
      tenantId: actor.tenantId,
      ...(query?.month ? { periodMonth: query.month } : {}),
      ...(query?.year ? { periodYear: query.year } : {}),
      ...(query?.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payrollRun.findMany({
        where,
        include: {
          _count: { select: { lines: true, payslips: true } },
        },
        orderBy: [
          { periodYear: 'desc' },
          { periodMonth: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    return paginated(items.map(serializePayrollRunSummary), total, page, limit);
  }

  async getPayrollDashboardSummary(
    query: PayrollDashboardSummaryQueryDto | undefined,
    actor: AuthContext,
  ) {
    const schoolDay = getNepalSchoolDay();
    const [currentYear, currentMonth] = schoolDay.gregorianDate
      .split('-')
      .map(Number);
    const periodYear = query?.year ?? currentYear;
    const periodMonth = query?.month ?? currentMonth;
    const contractWindowDays = clampInt(query?.contractWindowDays, 30, 1, 180);
    const contractWindowEnd = addDaysUtc(
      schoolDay.startUtc,
      contractWindowDays,
    );
    const payrollRunWhere: Prisma.PayrollRunWhereInput = {
      tenantId: actor.tenantId,
      periodMonth,
      periodYear,
    };

    const [
      activeStaffCount,
      activeStaffWithoutActiveSalaryStructureCount,
      contractsExpiringCount,
      pendingLeaveRequests,
      onLeaveTodayCount,
      payrollRunStatusGroups,
      latestPayrollRun,
      selectedRun,
    ] = await Promise.all([
      this.prisma.staff.count({
        where: {
          tenantId: actor.tenantId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
        },
      }),
      this.prisma.staff.count({
        where: {
          tenantId: actor.tenantId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
          salaryStructures: {
            none: { status: SalaryStructureStatus.ACTIVE },
          },
        },
      }),
      this.prisma.staffContract.count({
        where: {
          tenantId: actor.tenantId,
          status: 'ACTIVE',
          endDate: {
            gte: schoolDay.startUtc,
            lte: contractWindowEnd,
          },
          staff: {
            status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
          },
        },
      }),
      this.prisma.staffLeaveRequest.count({
        where: { tenantId: actor.tenantId, status: 'PENDING' },
      }),
      this.prisma.staffLeaveRequest.count({
        where: {
          tenantId: actor.tenantId,
          status: 'APPROVED',
          startsOn: { lt: schoolDay.endExclusiveUtc },
          endsOn: { gte: schoolDay.startUtc },
        },
      }),
      this.prisma.payrollRun.groupBy({
        by: ['status'],
        where: payrollRunWhere,
        _count: { _all: true },
      }),
      this.prisma.payrollRun.findFirst({
        where: { tenantId: actor.tenantId },
        orderBy: [
          { periodYear: 'desc' },
          { periodMonth: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          periodMonth: true,
          periodYear: true,
          status: true,
          journalEntryId: true,
          disbursementJournalEntryId: true,
        },
      }),
      this.prisma.payrollRun.findFirst({
        where: query?.payrollRunId
          ? { tenantId: actor.tenantId, id: query.payrollRunId }
          : payrollRunWhere,
        include: {
          _count: { select: { lines: true, payslips: true } },
        },
        orderBy: query?.payrollRunId
          ? undefined
          : [
              { periodYear: 'desc' },
              { periodMonth: 'desc' },
              { createdAt: 'desc' },
            ],
      }),
    ]);

    const payslipsByStatus = selectedRun
      ? await this.prisma.payslip.groupBy({
          by: ['status'],
          where: { tenantId: actor.tenantId, payrollRunId: selectedRun.id },
          _count: { _all: true },
        })
      : [];

    const runStatusCounts = Object.values(PayrollRunStatus).reduce<
      Record<string, number>
    >((acc, status) => {
      acc[status] =
        payrollRunStatusGroups.find((group) => group.status === status)?._count
          ._all ?? 0;
      return acc;
    }, {});
    const payslipStatusCounts = Object.values(PayslipStatus).reduce<
      Record<string, number>
    >((acc, status) => {
      acc[status] =
        payslipsByStatus.find((group) => group.status === status)?._count
          ._all ?? 0;
      return acc;
    }, {});
    const payslipCount = selectedRun?._count.payslips ?? 0;
    const employeeCount = selectedRun?._count.lines ?? 0;

    return {
      filters: {
        periodMonth,
        periodYear,
        payrollRunId: query?.payrollRunId ?? selectedRun?.id ?? null,
        contractWindowDays,
        timezone: 'Asia/Kathmandu',
        windowStart: schoolDay.startUtc.toISOString(),
        windowEndExclusive: contractWindowEnd.toISOString(),
      },
      activeStaffCount,
      activeStaffWithoutActiveSalaryStructureCount,
      contractsExpiringWithinWindow: contractsExpiringCount,
      pendingLeaveRequests,
      onLeaveTodayCount,
      payrollRunsByStatus: runStatusCounts,
      latestPayrollRun: latestPayrollRun
        ? {
            id: latestPayrollRun.id,
            periodMonth: latestPayrollRun.periodMonth,
            periodYear: latestPayrollRun.periodYear,
            status: latestPayrollRun.status,
            journalEntryId: latestPayrollRun.journalEntryId,
            disbursementJournalEntryId:
              latestPayrollRun.disbursementJournalEntryId,
          }
        : null,
      selectedPayrollRun: selectedRun
        ? {
            id: selectedRun.id,
            periodMonth: selectedRun.periodMonth,
            periodYear: selectedRun.periodYear,
            status: selectedRun.status,
            employeeCount,
            totalGross: moneyString(selectedRun.grossAmount),
            totalDeductions: moneyString(selectedRun.deductionAmount),
            totalNet: moneyString(selectedRun.netAmount),
            pfEmployeeAmount: moneyString(selectedRun.pfEmployeeAmount),
            pfEmployerAmount: moneyString(selectedRun.pfEmployerAmount),
            tdsAmount: moneyString(selectedRun.tdsAmount),
            approvalReadiness: getPayrollRunActions(selectedRun.status),
            postingReadiness: {
              canPost: getPayrollRunActions(selectedRun.status).canPost,
              accountingJournalId: selectedRun.journalEntryId,
              disbursementJournalEntryId:
                selectedRun.disbursementJournalEntryId,
              createsAccountingAccrualOnly: true,
              salaryDisbursementProviderSupported: false,
            },
            payslipGeneration: {
              status:
                employeeCount === 0
                  ? 'UNAVAILABLE'
                  : payslipCount === 0
                    ? 'PENDING'
                    : payslipCount < employeeCount
                      ? 'PARTIAL'
                      : 'COMPLETE',
              total: payslipCount,
              expected: employeeCount,
              byStatus: payslipStatusCounts,
            },
            validationExceptionCount: null,
            validationExceptionSource: 'needs_exception_workflow_contract',
          }
        : null,
    };
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
        netAmount: run.netAmount.toString(),
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
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
      },
    });

    const contracts = await this.prisma.staffContract.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        startDate: { lte: period.endsOn },
        OR: [{ endDate: null }, { endDate: { gte: period.startsOn } }],
        staff: {
          status: { in: ['ACTIVE', 'ON_LEAVE'] },
        },
      },
    });
    const salaryStructures = await this.prisma.salaryStructure.findMany({
      where: {
        tenantId: actor.tenantId,
        status: SalaryStructureStatus.ACTIVE,
        effectiveFrom: { lte: period.endsOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startsOn } }],
        staff: {
          status: { in: ['ACTIVE', 'ON_LEAVE'] },
        },
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

      const totalEffectiveDays = Math.min(
        workingDays,
        presentDays + approvedPaidLeaveDays,
      );
      const unpaidLeaveDays = Math.max(0, workingDays - totalEffectiveDays);
      // Ensure we count explicit unpaid leave if it exceeds the working day gap
      const finalUnpaidDays = Math.max(
        unpaidLeaveDays,
        approvedUnpaidLeaveDays,
      );
      const payrollPaidDays = Math.max(0, workingDays - finalUnpaidDays);

      const baseSalary = new Prisma.Decimal(source.baseSalary);
      const allowances = new Prisma.Decimal(source.allowances);
      const contractDeductions = new Prisma.Decimal(source.contractDeductions);

      const calculated = calculatePayrollLine({
        baseSalary,
        allowances,
        contractDeductions,
        attendanceDays: payrollPaidDays,
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
        unpaidLeaveDays: finalUnpaidDays,
        attendanceDays: payrollPaidDays,
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

    if (run.journalEntryId) {
      throw new ConflictException('Payroll run is already posted');
    }

    if (
      run.status === PayrollRunStatus.POSTED ||
      run.status === PayrollRunStatus.PAID
    ) {
      throw new ConflictException('Payroll run is already posted');
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
            entryDate:
              run.periodEnd ??
              getPayrollPeriod(run.periodYear, run.periodMonth).endsOn,
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
        grossAmount: posted.grossAmount.toString(),
        netAmount: posted.netAmount.toString(),
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

    if (run.status === PayrollRunStatus.PAID) {
      throw new ConflictException('Payroll run is already marked as paid');
    }

    if (run.status !== PayrollRunStatus.POSTED) {
      throw new ConflictException('Payroll run must be posted before payment');
    }

    if (run.disbursementJournalEntryId) {
      throw new ConflictException('Payroll run is already marked as paid');
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
            entryDate:
              run.periodEnd ??
              getPayrollPeriod(run.periodYear, run.periodMonth).endsOn,
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
        if (!originalEntry) {
          throw new ConflictException(
            'Payroll disbursement journal entry was not found',
          );
        }
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

      // 2. Reverse Accrual
      if (run.journalEntryId) {
        const originalEntry = await tx.journalEntry.findUnique({
          where: { id: run.journalEntryId },
          include: { lines: true },
        });
        if (!originalEntry) {
          throw new ConflictException(
            'Payroll accrual journal entry was not found',
          );
        }
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
    const run = await this.getPayrollRunOrThrow(id, actor);
    return serializePayrollRunDetail(run);
  }

  async queuePayslipRegenerationJob(
    runId: string,
    payslipId: string,
    actor: AuthContext,
  ): Promise<PayslipRegenerationJobSummary> {
    if (!this.payrollQueue) {
      throw new ConflictException(
        'Payslip regeneration is temporarily unavailable',
      );
    }

    const target = await this.getPayslipGenerationTargetOrThrow(
      runId,
      payslipId,
      actor,
    );
    const jobId = payslipRegenerationJobId(actor.tenantId, runId, payslipId);
    const existingJob = await this.payrollQueue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();
      if (state !== 'completed' && state !== 'failed') {
        return serializePayslipRegenerationJob(existingJob, target, state);
      }
      await existingJob.remove();
    }

    const job = await this.payrollQueue.add(
      'regeneratePayslip',
      {
        tenantId: actor.tenantId,
        payrollRunId: runId,
        payslipId,
        requestedByUserId: actor.userId,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 86_400, count: 5_000 },
        removeOnFail: { age: 604_800, count: 5_000 },
      },
    );

    await this.auditService.record({
      action: 'queue_payslip_regeneration',
      resource: 'payslip',
      resourceId: payslipId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        jobId: job.id ?? jobId,
        payrollRunId: runId,
        payslipNumber: target.payslipNumber,
        periodMonth: target.payrollRun.periodMonth,
        periodYear: target.payrollRun.periodYear,
        status: 'QUEUED',
      },
    });

    return serializePayslipRegenerationJob(job, target, 'waiting');
  }

  async getPayslipRegenerationJob(
    runId: string,
    payslipId: string,
    jobId: string,
    actor: AuthContext,
  ): Promise<PayslipRegenerationJobSummary> {
    if (!this.payrollQueue) {
      throw new ConflictException(
        'Payslip regeneration is temporarily unavailable',
      );
    }

    const target = await this.getPayslipGenerationTargetOrThrow(
      runId,
      payslipId,
      actor,
    );
    const job = await this.payrollQueue.getJob(jobId);

    if (
      !job ||
      job.name !== 'regeneratePayslip' ||
      job.data.tenantId !== actor.tenantId ||
      job.data.payrollRunId !== runId ||
      job.data.payslipId !== payslipId
    ) {
      throw new NotFoundException('Payslip regeneration job not found');
    }

    return serializePayslipRegenerationJob(job, target, await job.getState());
  }

  async listPayslips(
    query: PayslipListQueryDto | undefined,
    actor: AuthContext,
  ) {
    const { page, limit, skip } = getPagination(query);
    const search = query?.search?.trim();
    const where: Prisma.PayslipWhereInput = {
      tenantId: actor.tenantId,
      ...(query?.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
      ...(query?.staffId ? { staffId: query.staffId } : {}),
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.month || query?.year
        ? {
            payrollRun: {
              ...(query.month ? { periodMonth: query.month } : {}),
              ...(query.year ? { periodYear: query.year } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { payslipNumber: { contains: search, mode: 'insensitive' } },
              {
                staff: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { employeeId: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payslip.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
          payrollRun: {
            select: {
              id: true,
              periodMonth: true,
              periodYear: true,
              status: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return paginated(items.map(serializePayslipSummary), total, page, limit);
  }

  async listMyPayslips(
    query: PayslipListQueryDto | undefined,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!staff) {
      throw new NotFoundException('Staff record not found');
    }

    const { page, limit, skip } = getPagination(query);
    const where: Prisma.PayslipWhereInput = {
      tenantId: actor.tenantId,
      staffId: staff.id,
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.month || query?.year
        ? {
            payrollRun: {
              ...(query.month ? { periodMonth: query.month } : {}),
              ...(query.year ? { periodYear: query.year } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payslip.findMany({
        where,
        include: {
          payrollRun: {
            select: {
              id: true,
              periodMonth: true,
              periodYear: true,
              status: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return paginated(items.map(serializePayslipSummary), total, page, limit);
  }

  async getPayslipPdf(payslipNumber: string, actor: AuthContext) {
    if (!this.fileRegistryService) {
      throw new ConflictException(PAYSLIP_FILE_UNAVAILABLE_MESSAGE);
    }

    const payslip = await this.prisma.payslip.findFirst({
      where: {
        tenantId: actor.tenantId,
        payslipNumber,
      },
      include: {
        staff: true,
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

    const exports = await this.prisma.reportExport.findMany({
      where: {
        tenantId: actor.tenantId,
        reportKey: 'payroll.payslip',
        format: 'pdf',
        status: 'COMPLETED',
        fileAssetId: { not: null },
      },
      select: {
        fileAssetId: true,
        filters: true,
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    const exportRecord = exports.find((record) => {
      return (
        getJsonString(record.filters, 'payslipId') === payslip.id ||
        getJsonString(record.filters, 'payslipNumber') === payslip.payslipNumber
      );
    });

    if (!exportRecord?.fileAssetId) {
      throw new ConflictException(PAYSLIP_FILE_UNAVAILABLE_MESSAGE);
    }

    let asset: Awaited<ReturnType<FileRegistryService['getFileMetadata']>>;
    try {
      asset = await this.fileRegistryService.getFileMetadata(
        actor.tenantId,
        exportRecord.fileAssetId,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ConflictException(PAYSLIP_FILE_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }

    if (asset.status !== FileStatus.UPLOADED) {
      throw new ConflictException(PAYSLIP_FILE_UNAVAILABLE_MESSAGE);
    }

    await this.fileRegistryService.assertFileAccessForAuth(asset, actor);
    let protectedFile: Awaited<
      ReturnType<FileRegistryService['getProtectedDownload']>
    >;
    try {
      protectedFile = await this.fileRegistryService.getProtectedDownload(
        actor.tenantId,
        asset.id,
        actor.userId,
      );
    } catch (error) {
      if (isMissingGeneratedFileError(error)) {
        throw new ConflictException(PAYSLIP_FILE_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }

    return protectedFile.content;
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

  async generatePayslipPdfBatch(
    input: PayslipGenerationJobData,
  ): Promise<PayslipGenerationJobResult> {
    if (!this.fileRegistryService) {
      throw new ConflictException(
        'File Registry is required for payslip PDF batch generation',
      );
    }

    const run = await this.prisma.payrollRun.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.payrollRunId,
        status: {
          in: Array.from(PAYSLIP_GENERATION_RUN_STATUSES),
        },
      },
      include: {
        tenant: true,
        payslips: {
          where: input.payslipId ? { id: input.payslipId } : undefined,
          include: {
            staff: true,
            payrollLine: true,
          },
          orderBy: { payslipNumber: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(
        'Eligible payroll run not found for payslip PDF generation',
      );
    }

    if (input.payslipId && run.payslips.length === 0) {
      throw new NotFoundException('Payslip not found in this payroll run');
    }

    const existingExports = input.payslipId
      ? []
      : await this.prisma.reportExport.findMany({
          where: {
            tenantId: input.tenantId,
            reportKey: 'payroll.payslip',
            format: 'pdf',
            status: 'COMPLETED',
          },
          select: {
            id: true,
            filters: true,
          },
          take: 1000,
        });
    const exportedPayslipIds = new Set(
      existingExports
        .filter((exportRecord) =>
          isPayslipExportForRun(exportRecord.filters, run.id),
        )
        .map((exportRecord) => getJsonString(exportRecord.filters, 'payslipId'))
        .filter((payslipId): payslipId is string => Boolean(payslipId)),
    );

    let generated = 0;
    let skipped = 0;

    for (const payslip of run.payslips) {
      if (exportedPayslipIds.has(payslip.id)) {
        skipped += 1;
        continue;
      }

      const pdf = this.buildBatchPayslipPdf({
        schoolName: run.tenant.name,
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        payslip,
      });
      const fileName = `${payslip.payslipNumber}.pdf`;
      const asset = await this.fileRegistryService.registerGeneratedFile({
        tenantId: input.tenantId,
        generatedByUserId: input.requestedByUserId,
        originalFilename: fileName,
        content: pdf,
        mimeType: 'application/pdf',
        module: 'payroll',
        entityId: payslip.id,
        metadata: {
          reportKey: 'payroll.payslip',
          payrollRunId: run.id,
          payrollLineId: payslip.payrollLineId,
          payslipId: payslip.id,
          payslipNumber: payslip.payslipNumber,
          staffId: payslip.staffId,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
          generatedBy: 'payroll_batch_job',
        },
      });

      await this.prisma.reportExport.create({
        data: {
          tenantId: input.tenantId,
          reportKey: 'payroll.payslip',
          format: 'pdf',
          filters: {
            payrollRunId: run.id,
            payrollLineId: payslip.payrollLineId,
            payslipId: payslip.id,
            payslipNumber: payslip.payslipNumber,
            staffId: payslip.staffId,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
          },
          status: 'COMPLETED',
          fileAssetId: asset.id,
          requestedBy: input.requestedByUserId,
          completedAt: new Date(),
        },
      });

      generated += 1;
      exportedPayslipIds.add(payslip.id);
    }

    await this.auditService.record({
      action: 'generate_payslip_pdf_batch',
      resource: 'payroll_run',
      resourceId: run.id,
      tenantId: input.tenantId,
      userId: input.requestedByUserId,
      after: {
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        generated,
        skipped,
        payslipCount: run.payslips.length,
      },
    });

    return {
      payrollRunId: run.id,
      periodMonth: run.periodMonth,
      periodYear: run.periodYear,
      payslipCount: run.payslips.length,
      generated,
      skipped,
    };
  }

  private buildBatchPayslipPdf(input: {
    schoolName: string;
    periodMonth: number;
    periodYear: number;
    payslip: Prisma.PayslipGetPayload<{
      include: { staff: true; payrollLine: true };
    }>;
  }) {
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
    const { payslip } = input;

    return buildSalarySlipPdf({
      schoolName: input.schoolName,
      payslipNumber: payslip.payslipNumber,
      period: `${monthLabels[input.periodMonth - 1]} ${input.periodYear}`,
      staff: {
        name: `${payslip.staff.firstName} ${payslip.staff.lastName}`,
        id: payslip.staff.employeeId,
        bankAccount: maskSensitiveStaffValue(payslip.staff.bankAccount),
        panNumber: maskSensitiveStaffValue(payslip.staff.panNumber),
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

  async listStatutoryDeductions(actor: AuthContext) {
    const structures = await this.prisma.salaryStructure.findMany({
      where: {
        tenantId: actor.tenantId,
        status: SalaryStructureStatus.ACTIVE,
      },
      select: {
        pfEnabled: true,
        tdsEnabled: true,
        components: {
          where: { componentType: SalaryComponentType.DEDUCTION },
          select: { name: true, amount: true, taxable: true },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }],
      take: 100,
    });

    const activeStructureCount = structures.length;
    const pfStructureCount = structures.filter(
      (structure) => structure.pfEnabled,
    ).length;
    const tdsStructureCount = structures.filter(
      (structure) => structure.tdsEnabled,
    ).length;
    const configuredComponentMap = new Map<
      string,
      {
        name: string;
        totalAmount: Prisma.Decimal;
        structureCount: number;
        taxable: boolean;
      }
    >();

    for (const structure of structures) {
      const seenNames = new Set<string>();
      for (const component of structure.components) {
        const name = component.name.trim();
        if (!name) {
          continue;
        }

        const key = name.toLowerCase();
        const existing = configuredComponentMap.get(key);
        if (existing) {
          existing.totalAmount = existing.totalAmount.add(component.amount);
          existing.taxable = existing.taxable || component.taxable;
          if (!seenNames.has(key)) {
            existing.structureCount += 1;
          }
        } else {
          configuredComponentMap.set(key, {
            name,
            totalAmount: component.amount,
            structureCount: 1,
            taxable: component.taxable,
          });
        }
        seenNames.add(key);
      }
    }

    const configuredDeductions = Array.from(
      configuredComponentMap.values(),
    ).map((component) => ({
      code: `DEDUCTION_${component.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')}`,
      name: component.name,
      ratePercent: null,
      amount: moneyString(component.totalAmount),
      activeStructureCount,
      configuredStructureCount: component.structureCount,
      taxable: component.taxable,
      source: 'salary_structure_component',
      note: 'Configured deduction component from active tenant salary structures.',
    }));

    return [
      ...(pfStructureCount > 0
        ? [
            {
              code: 'PF',
              name: 'Provident fund',
              ratePercent: 10,
              activeStructureCount,
              configuredStructureCount: pfStructureCount,
              source: 'salary_structure_pf_enabled',
              note: 'Enabled on active tenant salary structures. Rate follows the current payroll calculation policy.',
            },
          ]
        : []),
      ...(tdsStructureCount > 0
        ? [
            {
              code: 'TDS',
              name: 'Tax deducted at source',
              ratePercent: 1,
              activeStructureCount,
              configuredStructureCount: tdsStructureCount,
              source: 'salary_structure_tds_enabled',
              note: 'Enabled on active tenant salary structures. Rate follows the current payroll calculation policy.',
            },
          ]
        : []),
      ...configuredDeductions,
    ];
  }

  async getPayrollRegister(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const lineWhere: Prisma.PayrollLineWhereInput = {
      ...(filters.staffId ? { staffId: filters.staffId } : {}),
      ...(filters.department
        ? { staff: { department: filters.department } }
        : {}),
    };

    const runs = await this.prisma.payrollRun.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.payrollRunId ? { id: filters.payrollRunId } : {}),
        ...(filters.month ? { periodMonth: filters.month } : {}),
        ...(filters.year ? { periodYear: filters.year } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        lines: {
          where: Object.keys(lineWhere).length > 0 ? lineWhere : undefined,
          include: { staff: true },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 100,
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
        department: line.staff.department,
        grossSalary: moneyString(line.grossSalary),
        deductions: moneyString(line.deductions),
        leaveDeductions: moneyString(line.leaveDeductions),
        pfEmployee: moneyString(line.pfEmployee),
        pfEmployer: moneyString(line.pfEmployer),
        tds: moneyString(line.tds),
        netPayable: moneyString(line.netSalary),
        paidDays: moneyString(line.paidDays),
        unpaidDays: moneyString(line.unpaidDays),
      })),
    );
  }

  async getPayrollSummary(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const rows = await this.getPayrollRegister(actor, filtersInput);
    const runIds = new Set(rows.map((row) => row.payrollRunId));

    return {
      runCount: runIds.size,
      staffCount: rows.length,
      gross: moneyString(sumReportMoney(rows, (row) => row.grossSalary)),
      deductions: moneyString(sumReportMoney(rows, (row) => row.deductions)),
      netPayable: moneyString(sumReportMoney(rows, (row) => row.netPayable)),
      pf: moneyString(
        sumReportMoney(rows, (row) =>
          new Prisma.Decimal(row.pfEmployee).add(row.pfEmployer),
        ),
      ),
      tds: moneyString(sumReportMoney(rows, (row) => row.tds)),
    };
  }

  async getPayrollPfSummary(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const rows = await this.getPayrollRegister(actor, filters);
    const contributors = rows.filter(
      (row) =>
        isPositiveMoney(row.pfEmployee) || isPositiveMoney(row.pfEmployer),
    );

    return {
      payrollRunId: filters.payrollRunId ?? null,
      staffCount: contributors.length,
      employeeContribution: moneyString(
        sumReportMoney(contributors, (row) => row.pfEmployee),
      ),
      employerContribution: moneyString(
        sumReportMoney(contributors, (row) => row.pfEmployer),
      ),
      totalContribution: moneyString(
        sumReportMoney(contributors, (row) =>
          new Prisma.Decimal(row.pfEmployee).add(row.pfEmployer),
        ),
      ),
      rows: contributors.map((row) => ({
        payrollRunId: row.payrollRunId,
        employeeId: row.employeeId,
        staffName: row.staffName,
        periodMonth: row.periodMonth,
        periodYear: row.periodYear,
        pfEmployee: row.pfEmployee,
        pfEmployer: row.pfEmployer,
      })),
    };
  }

  async getPayrollTdsSummary(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const rows = await this.getPayrollRegister(actor, filters);
    const contributors = rows.filter((row) => isPositiveMoney(row.tds));

    return {
      payrollRunId: filters.payrollRunId ?? null,
      staffCount: contributors.length,
      totalTds: moneyString(sumReportMoney(contributors, (row) => row.tds)),
      rows: contributors.map((row) => ({
        payrollRunId: row.payrollRunId,
        employeeId: row.employeeId,
        staffName: row.staffName,
        periodMonth: row.periodMonth,
        periodYear: row.periodYear,
        tds: row.tds,
      })),
    };
  }

  async getSalaryComponentSummary(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const rows = await this.getPayrollRegister(actor, filters);

    return {
      payrollRunId: filters.payrollRunId ?? null,
      staffCount: rows.length,
      grossSalary: moneyString(sumReportMoney(rows, (row) => row.grossSalary)),
      deductions: moneyString(sumReportMoney(rows, (row) => row.deductions)),
      leaveDeductions: moneyString(
        sumReportMoney(rows, (row) => row.leaveDeductions),
      ),
      pfEmployee: moneyString(sumReportMoney(rows, (row) => row.pfEmployee)),
      pfEmployer: moneyString(sumReportMoney(rows, (row) => row.pfEmployer)),
      tds: moneyString(sumReportMoney(rows, (row) => row.tds)),
      netPayable: moneyString(sumReportMoney(rows, (row) => row.netPayable)),
    };
  }

  async getPayrollLeaveDeductionSummary(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const rows = (await this.getPayrollRegister(actor, filters)).filter(
      (row) =>
        isPositiveMoney(row.leaveDeductions) || isPositiveMoney(row.unpaidDays),
    );

    return {
      payrollRunId: filters.payrollRunId ?? null,
      staffCount: rows.length,
      leaveDeductions: moneyString(
        sumReportMoney(rows, (row) => row.leaveDeductions),
      ),
      unpaidDays: moneyString(sumReportMoney(rows, (row) => row.unpaidDays)),
      rows: rows.map((row) => ({
        payrollRunId: row.payrollRunId,
        employeeId: row.employeeId,
        staffName: row.staffName,
        department: row.department,
        periodMonth: row.periodMonth,
        periodYear: row.periodYear,
        leaveDeductions: row.leaveDeductions,
        unpaidDays: row.unpaidDays,
      })),
    };
  }

  async exportPayrollRegisterCsv(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const rows = await this.getPayrollRegister(actor, filters);

    await this.auditService.record({
      action: 'export',
      resource: 'payroll_register',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: rows.length, filters },
    });

    return [
      'Period,Employee ID,Staff Name,Department,Gross,Deductions,Leave Deductions,PF Employee,PF Employer,TDS,Net Payable,Paid Days,Unpaid Days,Status',
      ...rows.map((row) =>
        [
          `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}`,
          row.employeeId,
          row.staffName,
          row.department ?? '',
          row.grossSalary,
          row.deductions,
          row.leaveDeductions,
          row.pfEmployee,
          row.pfEmployer,
          row.tds,
          row.netPayable,
          row.paidDays,
          row.unpaidDays,
          row.status,
        ]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
  }

  async exportPayrollPfCsv(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const report = await this.getPayrollPfSummary(actor, filters);

    await this.auditService.record({
      action: 'export',
      resource: 'payroll_pf_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: report.rows.length, filters },
    });

    return [
      'Period,Employee ID,Staff Name,PF Employee,PF Employer,PF Total',
      ...report.rows.map((row) =>
        [
          `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}`,
          row.employeeId,
          row.staffName,
          row.pfEmployee,
          row.pfEmployer,
          moneyString(new Prisma.Decimal(row.pfEmployee).add(row.pfEmployer)),
        ]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
  }

  async exportPayrollTdsCsv(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const report = await this.getPayrollTdsSummary(actor, filters);

    await this.auditService.record({
      action: 'export',
      resource: 'payroll_tds_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: report.rows.length, filters },
    });

    return [
      'Period,Employee ID,Staff Name,TDS',
      ...report.rows.map((row) =>
        [
          `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}`,
          row.employeeId,
          row.staffName,
          row.tds,
        ]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
  }

  private async getPayrollRunOrThrow(id: string, actor: AuthContext) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        lines: {
          include: {
            staff: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: true,
                designation: true,
              },
            },
            payslip: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        },
        payslips: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found in this tenant');
    }

    return run;
  }

  private async getPayslipGenerationTargetOrThrow(
    runId: string,
    payslipId: string,
    actor: AuthContext,
  ) {
    const payslip = await this.prisma.payslip.findFirst({
      where: {
        id: payslipId,
        tenantId: actor.tenantId,
        payrollRunId: runId,
      },
      select: {
        id: true,
        payslipNumber: true,
        payrollRun: {
          select: {
            id: true,
            periodMonth: true,
            periodYear: true,
            status: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found in this payroll run');
    }

    if (!PAYSLIP_GENERATION_RUN_STATUSES.has(payslip.payrollRun.status)) {
      throw new ConflictException(
        'Payslip regeneration requires an approved, posted, or paid payroll run',
      );
    }

    return payslip;
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

function assertSalaryStructureDateRange(
  effectiveFrom: Date,
  effectiveTo: Date | null,
) {
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new ConflictException('effectiveFrom must be a valid date');
  }

  if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
    throw new ConflictException('effectiveTo must be a valid date');
  }

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new ConflictException('effectiveTo cannot be before effectiveFrom');
  }
}

function canClosePreviousSalaryVersion(
  activeStructure: { effectiveFrom: Date; effectiveTo: Date | null },
  nextStructure: { effectiveFrom: Date },
) {
  return (
    activeStructure.effectiveFrom < nextStructure.effectiveFrom &&
    (!activeStructure.effectiveTo ||
      activeStructure.effectiveTo >= nextStructure.effectiveFrom)
  );
}

function previousDayUtc(date: Date) {
  const previous = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous;
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

function moneyString(
  value: Prisma.Decimal | number | string | null | undefined,
) {
  return new Prisma.Decimal(value ?? 0).toDecimalPlaces(2).toFixed(2);
}

function isPositiveMoney(
  value: Prisma.Decimal | number | string | null | undefined,
) {
  return new Prisma.Decimal(value ?? 0).gt(0);
}

function getPagination(query?: PayrollPaginatedQueryDto): PaginationResult {
  const page = clampInt(query?.page, 1, 1, 10_000);
  const limit = clampInt(query?.limit, 25, 1, 100);
  return { page, limit, skip: (page - 1) * limit };
}

function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    total,
    page,
    limit,
    hasNextPage: page * limit < total,
  };
}

function clampInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const candidate =
    value === undefined || !Number.isFinite(value)
      ? fallback
      : Math.trunc(value);
  return Math.min(Math.max(candidate, min), max);
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

type MinimalStaff = {
  id: string;
  employeeId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  designation?: string | null;
};

function serializeStaff(staff?: MinimalStaff | null) {
  if (!staff) {
    return null;
  }

  return {
    id: staff.id,
    employeeId: staff.employeeId ?? null,
    firstName: staff.firstName ?? '',
    lastName: staff.lastName ?? '',
    firstNameEn: staff.firstName ?? '',
    lastNameEn: staff.lastName ?? '',
    fullName: `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim(),
    department: staff.department ?? null,
    designation: staff.designation ?? null,
  };
}

function serializeSalaryStructure(structure: {
  id: string;
  staffId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  basicSalary: Prisma.Decimal;
  allowances: Prisma.Decimal;
  deductions: Prisma.Decimal;
  pfEnabled: boolean;
  tdsEnabled: boolean;
  paymentMethod: string;
  bankAccount?: string | null;
  bankName?: string | null;
  status: string;
  notes?: string | null;
  activatedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  staff?: MinimalStaff | null;
  components?: Array<{
    id: string;
    name: string;
    componentType: string;
    amount: Prisma.Decimal;
    taxable: boolean;
  }>;
}) {
  return {
    ...structure,
    basicSalary: moneyString(structure.basicSalary),
    allowances: moneyString(structure.allowances),
    deductions: moneyString(structure.deductions),
    staff: serializeStaff(structure.staff),
    components: (structure.components ?? []).map((component) => ({
      ...component,
      amount: moneyString(component.amount),
    })),
  };
}

function serializePayrollRunSummary(run: {
  id: string;
  periodMonth: number;
  periodYear: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  status: string;
  grossAmount: Prisma.Decimal;
  deductionAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  pfEmployeeAmount?: Prisma.Decimal;
  pfEmployerAmount?: Prisma.Decimal;
  tdsAmount?: Prisma.Decimal;
  generatedById?: string | null;
  approvedById?: string | null;
  postedById?: string | null;
  paidById?: string | null;
  approvedAt?: Date | null;
  postedAt?: Date | null;
  paidAt?: Date | null;
  journalEntryId?: string | null;
  disbursementJournalEntryId?: string | null;
  notes?: string | null;
  reversalReason?: string | null;
  reversalAt?: Date | null;
  reversedById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  _count?: { lines?: number; payslips?: number };
}) {
  const { _count, ...rest } = run;
  return {
    ...rest,
    grossAmount: moneyString(run.grossAmount),
    deductionAmount: moneyString(run.deductionAmount),
    netAmount: moneyString(run.netAmount),
    pfEmployeeAmount: moneyString(run.pfEmployeeAmount),
    pfEmployerAmount: moneyString(run.pfEmployerAmount),
    tdsAmount: moneyString(run.tdsAmount),
    lineCount: _count?.lines ?? 0,
    payslipCount: _count?.payslips ?? 0,
  };
}

function serializePayrollRunDetail(
  run: Prisma.PayrollRunGetPayload<{
    include: {
      lines: {
        include: {
          staff: {
            select: {
              id: true;
              employeeId: true;
              firstName: true;
              lastName: true;
              department: true;
              designation: true;
            };
          };
          payslip: true;
        };
      };
      payslips: true;
    };
  }>,
) {
  return {
    ...serializePayrollRunSummary({
      ...run,
      _count: { lines: run.lines.length, payslips: run.payslips.length },
    }),
    lines: run.lines.map(serializePayrollLine),
    payslips: run.payslips.map((payslip) =>
      serializePayslipSummary({ ...payslip, payrollRun: run, staff: null }),
    ),
  };
}

function serializePayrollLine(line: {
  id: string;
  staffId: string;
  payrollRunId: string;
  contractId?: string | null;
  salaryStructureId?: string | null;
  basicSalary: Prisma.Decimal;
  earnings: Prisma.Decimal;
  grossSalary: Prisma.Decimal;
  allowances: Prisma.Decimal;
  leaveDeductions: Prisma.Decimal;
  pfEmployee: Prisma.Decimal;
  pfEmployer: Prisma.Decimal;
  tds: Prisma.Decimal;
  otherDeductions: Prisma.Decimal;
  deductions: Prisma.Decimal;
  netSalary: Prisma.Decimal;
  paidDays: Prisma.Decimal;
  unpaidDays: Prisma.Decimal;
  attendanceDays: number;
  workingDays: number;
  paymentStatus: string;
  status: string;
  createdAt?: Date;
  staff?: MinimalStaff | null;
  payslip?: { payslipNumber: string } | null;
}) {
  return {
    ...line,
    basicSalary: moneyString(line.basicSalary),
    earnings: moneyString(line.earnings),
    grossSalary: moneyString(line.grossSalary),
    allowances: moneyString(line.allowances),
    leaveDeductions: moneyString(line.leaveDeductions),
    pfEmployee: moneyString(line.pfEmployee),
    pfEmployer: moneyString(line.pfEmployer),
    tds: moneyString(line.tds),
    otherDeductions: moneyString(line.otherDeductions),
    deductions: moneyString(line.deductions),
    netSalary: moneyString(line.netSalary),
    paidDays: moneyString(line.paidDays),
    unpaidDays: moneyString(line.unpaidDays),
    staff: serializeStaff(line.staff),
  };
}

function serializePayslipSummary(payslip: {
  id: string;
  payrollRunId: string;
  payrollLineId: string;
  staffId: string;
  payslipNumber: string;
  status: string;
  grossSalary: Prisma.Decimal;
  deductionAmount: Prisma.Decimal;
  pfEmployee?: Prisma.Decimal;
  pfEmployer?: Prisma.Decimal;
  tds?: Prisma.Decimal;
  netSalary: Prisma.Decimal;
  paymentStatus?: string;
  generatedAt?: Date;
  issuedAt: Date | null;
  createdAt?: Date;
  staff?: MinimalStaff | null;
  payrollRun?: {
    id: string;
    periodMonth: number;
    periodYear: number;
    status: string;
  } | null;
}) {
  return {
    ...payslip,
    grossSalary: moneyString(payslip.grossSalary),
    deductionAmount: moneyString(payslip.deductionAmount),
    pfEmployee: moneyString(payslip.pfEmployee),
    pfEmployer: moneyString(payslip.pfEmployer),
    tds: moneyString(payslip.tds),
    netSalary: moneyString(payslip.netSalary),
    netAmount: moneyString(payslip.netSalary),
    periodMonth: payslip.payrollRun?.periodMonth ?? null,
    periodYear: payslip.payrollRun?.periodYear ?? null,
    staff: serializeStaff(payslip.staff),
    payrollRun: payslip.payrollRun ?? null,
  };
}

function sumReportMoney<T>(
  rows: T[],
  pick: (row: T) => Prisma.Decimal | number | string,
) {
  return rows.reduce(
    (sum, row) => sum.add(new Prisma.Decimal(pick(row))),
    new Prisma.Decimal(0),
  );
}

function isMissingGeneratedFileError(error: unknown) {
  if (error instanceof NotFoundException) {
    return true;
  }

  if (
    error instanceof StorageOperationError &&
    (error.message.includes('status 404') ||
      error.message.includes('returned no data'))
  ) {
    return true;
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function payslipRegenerationJobId(
  tenantId: string,
  runId: string,
  payslipId: string,
) {
  return `payroll-payslip-${tenantId}-${runId}-${payslipId}`;
}

function serializePayslipRegenerationJob(
  job: Job<PayslipGenerationJobData, PayslipGenerationJobResult>,
  target: PayslipGenerationTarget,
  state: string,
): PayslipRegenerationJobSummary {
  const result = job.returnvalue;

  return {
    jobId: String(job.id),
    payrollRunId: target.payrollRun.id,
    payslipId: target.id,
    payslipNumber: target.payslipNumber,
    status: mapPayslipRegenerationJobStatus(state),
    requestedAt: new Date(job.timestamp).toISOString(),
    startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    generated: typeof result?.generated === 'number' ? result.generated : null,
    skipped: typeof result?.skipped === 'number' ? result.skipped : null,
    payslipCount:
      typeof result?.payslipCount === 'number' ? result.payslipCount : null,
  };
}

function mapPayslipRegenerationJobStatus(
  state: string,
): PayslipRegenerationJobStatus {
  if (state === 'active') {
    return 'PROCESSING';
  }
  if (state === 'completed') {
    return 'SUCCEEDED';
  }
  if (state === 'failed') {
    return 'FAILED';
  }
  return 'QUEUED';
}

function normalizePayrollReportFilters(
  input?: PayrollReportFilterInput,
): PayrollReportFilters {
  if (!input) {
    return {};
  }

  if (typeof input === 'string') {
    return { payrollRunId: input };
  }

  return {
    payrollRunId: input.payrollRunId,
    month: input.month,
    year: input.year,
    department: input.department?.trim() || undefined,
    staffId: input.staffId,
    status: input.status,
  };
}

function isPayslipExportForRun(
  filters: Prisma.JsonValue,
  payrollRunId: string,
) {
  return getJsonString(filters, 'payrollRunId') === payrollRunId;
}

function getJsonString(filters: Prisma.JsonValue, key: string) {
  if (
    typeof filters !== 'object' ||
    filters === null ||
    Array.isArray(filters)
  ) {
    return null;
  }

  const value = (filters as Record<string, Prisma.JsonValue>)[key];
  return typeof value === 'string' ? value : null;
}

function maskSensitiveStaffValue(value: string | null | undefined) {
  if (!value) return value;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
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
