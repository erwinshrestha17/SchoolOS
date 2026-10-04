import { payrollLeaveOverlapDays } from '../hr/payroll-day-policy';
import {
  BadRequestException,
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
  findPayrollPeriodContaining,
  getNepalSchoolDay,
  isBsPayrollPeriodLabel,
  type PayrollPreviewResult,
  type PayslipRegenerationJobStatus,
  type PayslipRegenerationJobSummary,
  type StatutoryPolicyView,
} from '@schoolos/core';
import type { Job, Queue } from 'bullmq';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { AuditService } from '../audit/audit.service';
import { createHash } from 'node:crypto';
import {
  requirePayrollDuty,
  payrollDutyAvailable,
  type PayrollDuty,
  payrollDutyPermission,
} from '../authorization/policies/payroll.policy';
import {
  hasDomainPermission,
  requireDomainPermission,
} from '../authorization/policies/domain-permission';
import {
  requireStaffFieldWrites,
  staffFieldWritePermissions,
} from '../authorization/policies/staff.policy';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import type { AuthContext } from '../auth/auth.types';
import { buildSalarySlipPdf, type PdfImage } from '../common/pdf/simple-pdf';
import { loadSchoolLogoForPdf } from '../common/pdf/school-logo-loader';
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
import { PayrollReadinessService } from './payroll-readiness.service';
import {
  calculateLineFromPlan,
  singleSourcePlan,
} from './payroll-line-calculation';
import {
  calculatePeriodPayroll,
  type PeriodPayrollLine,
  type PricedAdjustment,
} from './payroll-period-calculation';
import {
  payrollPeriodFor,
  payrollPeriodOfRun,
  type PayrollPeriodWindow,
} from './payroll-period';
import {
  formatMinor,
  type PayrollDivisorBasisValue,
} from './payroll-proration';
import {
  findStatutoryScheme,
  statutoryBreakdownJson,
  type ResolvedStatutoryPolicy,
  type StatutoryAmount,
  type StatutoryEnrollment,
  type StatutoryPolicyDefinition,
} from './statutory-policy';
import { resolveStatutoryPolicy } from './statutory-policy-resolver';
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
  PayrollRunStatus.FINALIZED,
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
    @Optional()
    private readonly payrollReadinessService?: PayrollReadinessService,
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

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    assertStaffContractDateRange(startDate, endDate);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const overlappingContracts = await tx.staffContract.findMany({
          where: {
            tenantId: actor.tenantId,
            staffId: dto.staffId,
            status: 'ACTIVE',
            ...(endDate ? { startDate: { lte: endDate } } : {}),
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        });

        const previousContract =
          overlappingContracts.length === 1 &&
          overlappingContracts[0].startDate < startDate
            ? overlappingContracts[0]
            : null;

        if (overlappingContracts.length > 0 && !previousContract) {
          throw new ConflictException(
            'The proposed contract overlaps another active or scheduled contract',
          );
        }

        const closedPreviousContract = previousContract
          ? await tx.staffContract.update({
              where: { id: previousContract.id, tenantId: actor.tenantId },
              data: { endDate: previousDayUtc(startDate) },
            })
          : null;

        const contract = await tx.staffContract.create({
          data: {
            tenantId: actor.tenantId,
            staffId: dto.staffId,
            contractNumber: dto.contractNumber.trim(),
            position: dto.position.trim(),
            startDate,
            endDate,
            baseSalary: new Prisma.Decimal(dto.baseSalary),
            allowances: new Prisma.Decimal(dto.allowances ?? 0),
            deductions: new Prisma.Decimal(dto.deductions ?? 0),
            status: 'ACTIVE',
          },
          include: {
            staff: true,
          },
        });

        return { contract, previousContract, closedPreviousContract };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.previousContract && result.closedPreviousContract) {
      await this.auditService.record({
        action: 'supersede',
        resource: 'staff_contract',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: result.previousContract.id,
        before: {
          endDate: result.previousContract.endDate,
          status: result.previousContract.status,
        },
        after: {
          endDate: result.closedPreviousContract.endDate,
          status: result.closedPreviousContract.status,
          supersededByContractId: result.contract.id,
        },
      });
    }

    await this.auditService.record({
      action: 'create',
      resource: 'staff_contract',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: result.contract.id,
      after: {
        staffId: result.contract.staffId,
        contractNumber: result.contract.contractNumber,
        baseSalary: result.contract.baseSalary.toString(),
        startDate: result.contract.startDate,
        endDate: result.contract.endDate,
      },
    });

    return result.contract;
  }

  async createSalaryStructure(
    dto: CreateSalaryStructureDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'payroll:salary:write');
    requireStaffFieldWrites(actor, dto);
    if (dto.pfEnabled !== undefined || dto.tdsEnabled !== undefined)
      requireDomainPermission(actor, 'hr:tax:write');
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    assertSalaryStructureDateRange(effectiveFrom, effectiveTo);

    const createdStructure = await this.payrollTransaction(
      actor,
      [
        'payroll:salary:write',
        ...staffFieldWritePermissions(dto),
        ...(dto.pfEnabled !== undefined || dto.tdsEnabled !== undefined
          ? ['hr:tax:write']
          : []),
      ],
      async (tx) => {
        await writeStaffBankDetails(tx, actor.tenantId, dto.staffId, dto);
        const structure = await tx.salaryStructure.create({
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
            // Phase 7.8: Staff is the single bank-details source.
            bankAccount: null,
            bankName: null,
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

        await this.auditService.record(
          {
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
          },
          tx,
        );
        return structure;
      },
      true,
    );

    return serializeSalaryStructure(createdStructure, actor);
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

    return paginated(
      items.map((item) => serializeSalaryStructure(item, actor)),
      total,
      page,
      limit,
    );
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
      return serializeSalaryStructure(structure, actor);
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

    return {
      ...contract,
      staff: serializeStaff(contract.staff),
      bankAccount: hasDomainPermission(actor, 'hr:bank:read')
        ? contract.staff.bankAccount
        : null,
      bankName: hasDomainPermission(actor, 'hr:bank:read')
        ? contract.staff.bankName
        : null,
    };
  }

  async updateSalaryStructure(
    id: string,
    dto: UpdateSalaryStructureDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'payroll:salary:write');
    requireStaffFieldWrites(actor, dto);
    if (dto.pfEnabled !== undefined || dto.tdsEnabled !== undefined)
      requireDomainPermission(actor, 'hr:tax:write');
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

    const savedStructure = await this.payrollTransaction(
      actor,
      [
        'payroll:salary:write',
        ...staffFieldWritePermissions(dto),
        ...(dto.pfEnabled !== undefined || dto.tdsEnabled !== undefined
          ? ['hr:tax:write']
          : []),
      ],
      async (tx) => {
        const current = await tx.salaryStructure.findFirst({
          where: { id: existing.id, tenantId: actor.tenantId },
        });
        if (current?.updatedAt.getTime() !== existing.updatedAt.getTime())
          throw new ConflictException(
            'Salary structure changed while the form was open',
          );
        if (
          await tx.payrollLine.count({
            where: { tenantId: actor.tenantId, salaryStructureId: existing.id },
          })
        )
          throw new ConflictException(
            'Salary structure used by payroll cannot be mutated retroactively',
          );
        await writeStaffBankDetails(tx, actor.tenantId, existing.staffId, dto);
        const updated = await tx.salaryStructure.update({
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
            notes: dto.notes,
          },
          include: { staff: true, components: true },
        });

        await this.auditService.record(
          {
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
          },
          tx,
        );
        return updated;
      },
      true,
    );

    return serializeSalaryStructure(savedStructure, actor);
  }

  async activateSalaryStructure(id: string, actor: AuthContext) {
    requireDomainPermission(actor, 'payroll:salary:write');
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

    const activatedStructure = await this.payrollTransaction(
      actor,
      'payroll:salary:write',
      async (tx) => {
        const overlappingStructures = await tx.salaryStructure.findMany({
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

        for (const previousVersion of overlappingStructures) {
          await tx.salaryStructure.update({
            where: { id: previousVersion.id },
            data: {
              effectiveTo: previousDayUtc(structure.effectiveFrom),
            },
          });
        }

        const updated = await tx.salaryStructure.update({
          where: { id: structure.id },
          data: {
            status: SalaryStructureStatus.ACTIVE,
            activatedAt: new Date(),
          },
          include: { staff: true, components: true },
        });
        await this.auditService.record(
          {
            action: 'activate',
            resource: 'salary_structure',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            after: { staffId: updated.staffId, status: updated.status },
          },
          tx,
        );
        return updated;
      },
      true,
    );

    return serializeSalaryStructure(activatedStructure, actor);
  }

  async archiveSalaryStructure(id: string, actor: AuthContext) {
    requireDomainPermission(actor, 'payroll:salary:write');
    const structure = await this.prisma.salaryStructure.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    const archivedStructure = await this.payrollTransaction(
      actor,
      'payroll:salary:write',
      async (tx) => {
        const updated = await tx.salaryStructure.update({
          where: { id: structure.id },
          data: {
            status: SalaryStructureStatus.ARCHIVED,
            archivedAt: new Date(),
          },
          include: { staff: true, components: true },
        });

        await this.auditService.record(
          {
            action: 'archive',
            resource: 'salary_structure',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            after: { status: updated.status },
          },
          tx,
        );
        return updated;
      },
      true,
    );

    return serializeSalaryStructure(archivedStructure, actor);
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

    return paginated(
      items.map((run) => serializePayrollRunSummary(run, actor)),
      total,
      page,
      limit,
    );
  }

  async getPayrollDashboardSummary(
    query: PayrollDashboardSummaryQueryDto | undefined,
    actor: AuthContext,
  ) {
    const schoolDay = getNepalSchoolDay();
    // Phase 7.12: payroll periods are BS months since 7.9. The default used
    // to be the Gregorian year/month, which the readiness lookup refuses, so
    // the overview failed for every caller that sent no period.
    const currentPeriod = findPayrollPeriodContaining(schoolDay.gregorianDate);
    const periodYear = query?.year ?? currentPeriod.bsYear;
    const periodMonth = query?.month ?? currentPeriod.bsMonth;
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
    // A pre-7.9 Gregorian label has no BS readiness; show the run without it.
    const exceptionReadiness =
      this.payrollReadinessService && isBsPayrollPeriodLabel(periodYear)
        ? await this.payrollReadinessService.getReadiness(
            {
              year: periodYear,
              month: periodMonth,
              payrollRunId: selectedRun?.id,
              page: 1,
              limit: 1,
            },
            actor,
          )
        : null;

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
            approvalReadiness: getPayrollRunActions(
              selectedRun.status,
              actor,
              selectedRun,
            ),
            postingReadiness: {
              canPost:
                getPayrollRunActions(selectedRun.status, actor, selectedRun)
                  .canPost && exceptionReadiness?.readinessStatus !== 'BLOCKED',
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
            validationExceptionCount:
              (exceptionReadiness?.blockingExceptionCount ?? 0) +
              (exceptionReadiness?.warningCount ?? 0) +
              (exceptionReadiness?.informationalCount ?? 0),
            validationExceptionSource: 'payroll_exception_workflow',
            validationExceptionsBySeverity: {
              BLOCKING: exceptionReadiness?.blockingExceptionCount ?? 0,
              WARNING: exceptionReadiness?.warningCount ?? 0,
              INFO: exceptionReadiness?.informationalCount ?? 0,
            },
          }
        : null,
    };
  }

  async createPayrollRun(dto: CreatePayrollRunDto, actor: AuthContext) {
    requireDomainPermission(actor, 'payroll:run:create');
    if (!this.payrollReadinessService)
      throw new ConflictException('Payroll readiness is unavailable');
    // Phase 7.9: the period is a BS month; its Gregorian bounds come from the
    // one canonical calendar and are stored on the run as authoritative.
    const period = payrollPeriodFor(dto.periodYear, dto.periodMonth);
    await this.payrollReadinessService.assertActionAllowed(
      actor,
      'CREATE_DRAFT',
      { year: dto.periodYear, month: dto.periodMonth },
    );
    const existing = await this.prisma.payrollRun.findFirst({
      where: {
        tenantId: actor.tenantId,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
      },
      orderBy: { revision: 'desc' },
    });
    if (
      existing &&
      existing.status !== PayrollRunStatus.VOID &&
      existing.status !== PayrollRunStatus.CANCELLED
    )
      throw new ConflictException({
        code: 'PAYROLL_PERIOD_OVERLAP',
        message:
          'A payroll run already exists for this period. Cancel or reverse it with an audited reason before preparing a replacement.',
      });
    const overlapping = await this.prisma.payrollRun.findFirst({
      where: {
        tenantId: actor.tenantId,
        status: {
          notIn: [PayrollRunStatus.VOID, PayrollRunStatus.CANCELLED],
        },
        periodStart: { lte: period.endsOn },
        periodEnd: { gte: period.startsOn },
      },
      select: { periodYear: true, periodMonth: true, status: true },
    });
    if (overlapping)
      throw new ConflictException({
        code: 'PAYROLL_PERIOD_OVERLAP',
        message: `Payroll period ${period.label} overlaps an existing ${overlapping.status} payroll run (${overlapping.periodMonth}/${overlapping.periodYear}). Cancel or reverse it first.`,
      });

    const { divisorDays, divisorBasis } = resolvePayrollDivisor(
      dto.workingDays,
      period,
    );
    const calculation = await calculatePeriodPayroll(this.prisma, {
      tenantId: actor.tenantId,
      period,
      divisorDays,
      divisorBasis,
    });
    assertNoStatutoryConfigurationErrors(calculation.configurationErrors);
    assertNoProrationErrors(calculation.prorationErrors);
    const { lines, totals, policy } = calculation;

    if (lines.length === 0) {
      throw new NotFoundException(
        'No staff with a verified employment and an active contract or salary structure were found for this period',
      );
    }

    let run: Prisma.PayrollRunGetPayload<{
      include: { lines: { include: { staff: true } } };
    }>;
    try {
      run = await this.payrollTransaction(
        actor,
        'payroll:run:create',
        async (tx) => {
          const created = await tx.payrollRun.create({
            data: {
              tenantId: actor.tenantId,
              periodMonth: dto.periodMonth,
              periodYear: dto.periodYear,
              revision: (existing?.revision ?? 0) + 1,
              predecessorRunId: existing?.id ?? null,
              periodStart: period.startsOn,
              periodEnd: period.endsOn,
              divisorDays,
              divisorBasis,
              status: PayrollRunStatus.GENERATED,
              generatedById: actor.userId,
              statutoryPolicyVersionId: statutoryVersionIdFor(lines, policy),
              notes: dto.notes ?? null,
              grossAmount: new Prisma.Decimal(totals.grossAmount),
              deductionAmount: new Prisma.Decimal(totals.deductionAmount),
              netAmount: new Prisma.Decimal(totals.netAmount),
              pfEmployeeAmount: new Prisma.Decimal(totals.pfEmployeeAmount),
              pfEmployerAmount: new Prisma.Decimal(totals.pfEmployerAmount),
              tdsAmount: new Prisma.Decimal(totals.tdsAmount),
              lines: {
                create: lines.map((line) =>
                  payrollLineCreateData(actor.tenantId, line, policy),
                ),
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
          const consumed = await this.applyAdjustments(
            tx,
            actor,
            created.id,
            lines,
          );
          await this.auditService.record(
            {
              action: 'create',
              resource: 'payroll_run',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: created.id,
              after: {
                periodMonth: created.periodMonth,
                periodYear: created.periodYear,
                period: period.label,
                periodStart: period.startsOnIso,
                periodEnd: period.endsOnIso,
                divisorDays,
                divisorBasis,
                lineCount: created.lines.length,
                adjustmentCount: consumed,
                netAmount: created.netAmount.toString(),
              },
            },
            tx,
          );
          return created;
        },
        true,
      );
    } catch (error) {
      throw translateRunWriteError(error);
    }

    return serializePayrollRunSummary(
      { ...run, _count: { lines: run.lines.length } },
      actor,
    );
  }

  /**
   * Consumes the priced 7.7 corrections of the generated lines: one APPLIED
   * row per correction (the database refuses a second one) with its lineage.
   */
  private async applyAdjustments(
    tx: Prisma.TransactionClient,
    actor: AuthContext,
    runId: string,
    lines: PeriodPayrollLine[],
  ): Promise<number> {
    const adjustments: PricedAdjustment[] = lines.flatMap(
      (line) => line.adjustments,
    );
    if (!adjustments.length) return 0;
    await tx.payrollAdjustment.createMany({
      data: adjustments.map((item) => ({
        tenantId: actor.tenantId,
        payrollRunId: runId,
        staffId: item.staffId,
        correctionId: item.correctionId,
        sourcePayrollRunId: item.sourcePayrollRunId,
        attendanceDate: item.attendanceDate,
        kind: item.kind,
        deltaDays: new Prisma.Decimal(formatCentiDays(item.deltaCenti)),
        dailyRate: new Prisma.Decimal(item.dailyRate),
        amount: new Prisma.Decimal(formatMinor(item.amount)),
        pricing: item.pricing as Prisma.InputJsonValue,
        createdById: actor.userId,
      })),
    });
    await this.auditService.record(
      {
        action: 'consume_adjustments',
        resource: 'payroll_run',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: runId,
        after: {
          corrections: adjustments.map((item) => ({
            correctionId: item.correctionId,
            kind: item.kind,
            amount: formatMinor(item.amount),
          })),
        },
      },
      tx,
    );
    return adjustments.length;
  }

  async getPayrollPreview(
    query: PayrollPreviewQueryDto,
    actor: AuthContext,
  ): Promise<PayrollPreviewResult[]> {
    const period = payrollPeriodFor(query.year, query.month);
    const { divisorDays, divisorBasis } = resolvePayrollDivisor(
      query.workingDays,
      period,
    );
    const {
      lines,
      staffMembers,
      contractsByStaff,
      salaryStructureByStaff,
      configurationErrors,
      prorationErrors,
    } = await calculatePeriodPayroll(this.prisma, {
      tenantId: actor.tenantId,
      period,
      divisorDays,
      divisorBasis,
    });

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
      for (const issue of configurationErrors) {
        if (issue.staffId === staff.id) warnings.push(issue.message);
      }
      for (const issue of prorationErrors) {
        if (issue.staffId === staff.id) warnings.push(issue.message);
      }
      if (line && line.netSalary.lt(0))
        warnings.push(
          'Net pay is negative: deductions exceed gross pay. This line blocks the run until the source data is corrected.',
        );

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
        workingDays: line?.workingDays ?? divisorDays,
        periodLabel: period.label,
        periodStart: period.startsOnIso,
        periodEnd: period.endsOnIso,
        divisorBasis,
        paidDays: Number(line?.paidDays ?? 0),
        adjustmentEarnings: Number(line?.adjustmentEarnings ?? 0),
        adjustmentDeductions: Number(line?.adjustmentDeductions ?? 0),
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

  async validatePayrollRun(id: string, actor: AuthContext) {
    return this.transitionPayrollDuty(
      id,
      actor,
      'VALIDATE',
      [PayrollRunStatus.DRAFT, PayrollRunStatus.GENERATED],
      PayrollRunStatus.VALIDATED,
      { validatedById: actor.userId, validatedAt: new Date() },
    );
  }

  async submitPayrollRunForReview(id: string, actor: AuthContext) {
    return this.transitionPayrollDuty(
      id,
      actor,
      'SUBMIT_REVIEW',
      [PayrollRunStatus.VALIDATED],
      PayrollRunStatus.UNDER_REVIEW,
      {},
    );
  }

  async reviewPayrollRun(id: string, actor: AuthContext) {
    return this.transitionPayrollDuty(
      id,
      actor,
      'REVIEW',
      [PayrollRunStatus.UNDER_REVIEW],
      PayrollRunStatus.REVIEWED,
      { reviewedById: actor.userId, reviewedAt: new Date() },
    );
  }

  async approvePayrollRun(id: string, actor: AuthContext) {
    return this.transitionPayrollDuty(
      id,
      actor,
      'APPROVE',
      [PayrollRunStatus.REVIEWED],
      PayrollRunStatus.APPROVED,
      { approvedById: actor.userId, approvedAt: new Date() },
    );
  }

  async finalizePayrollRun(id: string, actor: AuthContext) {
    return this.transitionPayrollDuty(
      id,
      actor,
      'FINALIZE',
      [PayrollRunStatus.APPROVED],
      PayrollRunStatus.FINALIZED,
      { finalizedById: actor.userId, finalizedAt: new Date() },
    );
  }

  private async transitionPayrollDuty(
    id: string,
    actor: AuthContext,
    duty: PayrollDuty,
    expected: PayrollRunStatus[],
    target: PayrollRunStatus,
    data: Prisma.PayrollRunUpdateManyMutationInput,
  ) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    requirePayrollDuty(actor, duty, run);
    if (!expected.includes(run.status))
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot perform ${duty.toLowerCase()}`,
      );
    if (duty === 'APPROVE' && (!run.reviewedById || !run.reviewedAt))
      throw new ConflictException(
        'Independent payroll review evidence is required',
      );
    if (!this.payrollReadinessService)
      throw new ConflictException('Payroll readiness is unavailable');
    await this.payrollReadinessService.assertActionAllowed(
      actor,
      duty === 'VALIDATE'
        ? 'CREATE_DRAFT'
        : duty === 'FINALIZE'
          ? 'POST'
          : duty === 'APPROVE'
            ? 'APPROVE'
            : 'SUBMIT_REVIEW',
      { year: run.periodYear, month: run.periodMonth, payrollRunId: run.id },
    );

    const updated = await this.payrollTransaction(
      actor,
      payrollDutyPermission(duty),
      async (tx) => {
        const fingerprint = await this.payrollSourceFingerprint(
          tx,
          run.id,
          actor.tenantId,
        );
        if (
          duty === 'FINALIZE' &&
          (!run.approvedSourceFingerprint ||
            fingerprint !== run.approvedSourceFingerprint)
        )
          throw new ConflictException(
            'Payroll source data changed after approval. Return the run for a new review and approval.',
          );
        const claim = await tx.payrollRun.updateMany({
          where: {
            id: run.id,
            tenantId: actor.tenantId,
            status: run.status,
            generatedById: run.generatedById,
            reviewedById: run.reviewedById,
            approvedSourceFingerprint: run.approvedSourceFingerprint,
          },
          data: {
            ...data,
            status: target,
            ...(duty === 'APPROVE'
              ? { approvedSourceFingerprint: fingerprint }
              : {}),
          },
        });
        if (claim.count !== 1)
          throw new ConflictException(
            'Payroll run changed while the action was being applied',
          );
        if (duty === 'FINALIZE') {
          await tx.payrollLine.updateMany({
            where: { tenantId: actor.tenantId, payrollRunId: run.id },
            data: { status: PayrollLineStatus.APPROVED },
          });
          const lines = await tx.payrollLine.findMany({
            where: { tenantId: actor.tenantId, payrollRunId: run.id },
            orderBy: { id: 'asc' },
          });
          await tx.payslip.createMany({
            data: lines.map((line, index) => ({
              tenantId: actor.tenantId,
              payrollRunId: run.id,
              payrollLineId: line.id,
              staffId: line.staffId,
              payslipNumber: `PS-${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}${run.revision > 1 ? `-R${run.revision}` : ''}-${String(index + 1).padStart(4, '0')}`,
              status: 'ISSUED',
              grossSalary: line.grossSalary,
              deductionAmount: line.deductions,
              pfEmployee: line.pfEmployee,
              pfEmployer: line.pfEmployer,
              tds: line.tds,
              netSalary: line.netSalary,
              issuedAt: new Date(),
            })),
          });
        }
        await this.auditService.record(
          {
            action: duty.toLowerCase(),
            resource: 'payroll_run',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: run.id,
            before: { status: run.status },
            after: { status: target },
          },
          tx,
        );
        return tx.payrollRun.findFirstOrThrow({
          where: { id: run.id, tenantId: actor.tenantId },
          include: { lines: { include: { staff: true } } },
        });
      },
      true,
    );
    return serializePayrollRunSummary(updated, actor);
  }

  private async payrollTransaction<T>(
    actor: AuthContext,
    permission: string | readonly string[],
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    serializable = false,
  ): Promise<T> {
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        permission,
        [],
        work,
        false,
        serializable
          ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          : {},
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('SalaryStructure_no_active_overlap'))
        throw new ConflictException({
          code: 'SALARY_STRUCTURE_OVERLAP',
          message:
            'Another active salary structure already covers some of these dates for this staff member. End it before activating this one.',
        });
      if (message.includes('PAYROLL_NEGATIVE_NET'))
        throw new ConflictException({
          code: 'PAYROLL_NEGATIVE_NET',
          message:
            'A payroll line has a negative net pay, so the run cannot advance. Correct the deductions or salary structure and regenerate the run.',
        });
      if (message.includes('PAYROLL_HOLD_ACTIVE'))
        throw new ConflictException({
          code: 'PAYROLL_HOLD_ACTIVE',
          message:
            'An active payment hold exists on this run. Release it before marking the run as paid.',
        });
      if (message.includes('PAYROLL_STATUTORY_POLICY_'))
        throw new ConflictException({
          code: 'PAYROLL_STATUTORY_POLICY_REJECTED',
          message:
            'The statutory policy version does not apply to this payroll run, or the run is already approved and its policy is frozen.',
        });
      if (isFinancialTransactionConflict(error))
        throw new ConflictException(
          'Payroll source data changed concurrently. Reload and retry the action.',
        );
      throw error;
    }
  }

  /** The current source fingerprint, for services that bind output to an approval. */
  currentSourceFingerprint(
    tx: Prisma.TransactionClient,
    runId: string,
    tenantId: string,
  ) {
    return this.payrollSourceFingerprint(tx, runId, tenantId);
  }

  private async payrollSourceFingerprint(
    tx: Prisma.TransactionClient,
    runId: string,
    tenantId: string,
  ) {
    const lines = await tx.payrollLine.findMany({
      where: { tenantId, payrollRunId: runId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        staffId: true,
        contractId: true,
        salaryStructureId: true,
        basicSalary: true,
        earnings: true,
        grossSalary: true,
        allowances: true,
        leaveDeductions: true,
        pfEmployee: true,
        pfEmployer: true,
        tds: true,
        otherDeductions: true,
        deductions: true,
        netSalary: true,
        paidDays: true,
        unpaidDays: true,
        attendanceDays: true,
        workingDays: true,
        staff: {
          select: {
            status: true,
            joiningDate: true,
            bankAccount: true,
            bankName: true,
            panNumber: true,
          },
        },
        salaryStructure: {
          select: {
            status: true,
            effectiveFrom: true,
            effectiveTo: true,
            basicSalary: true,
            allowances: true,
            deductions: true,
            paymentMethod: true,
            bankAccount: true,
            bankName: true,
            pfEnabled: true,
            tdsEnabled: true,
          },
        },
        contract: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
            baseSalary: true,
            allowances: true,
            deductions: true,
          },
        },
      },
    });
    if (!lines.length)
      throw new ConflictException('Payroll requires verified staff lines');

    // Phase 7.8: runs that used a statutory policy also pin that policy
    // version, each line's computed breakdown and the members' scheme and
    // identifier on the period end date, so drift in any of them invalidates
    // an approval. Runs created before 7.8 keep their original (v1) hash so
    // existing approvals are not invalidated.
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, tenantId },
      select: {
        statutoryPolicyVersionId: true,
        periodStart: true,
        periodEnd: true,
        divisorDays: true,
        divisorBasis: true,
      },
    });
    const divisorDays = run?.divisorDays ?? null;
    if (!run || (!run.statutoryPolicyVersionId && divisorDays === null)) {
      return createHash('sha256')
        .update('schoolos:payroll-sources:v1\0')
        .update(JSON.stringify(lines))
        .digest('hex');
    }
    const endDay = new Date(
      Date.UTC(
        run.periodEnd.getUTCFullYear(),
        run.periodEnd.getUTCMonth(),
        run.periodEnd.getUTCDate(),
      ),
    );
    const breakdowns = await tx.payrollLine.findMany({
      where: { tenantId, payrollRunId: runId },
      orderBy: { id: 'asc' },
      select: { id: true, statutoryBreakdown: true },
    });
    const memberships = await tx.staffStatutoryMembership.findMany({
      where: {
        tenantId,
        staffId: { in: lines.map((line) => line.staffId) },
        effectiveFrom: { lte: endDay },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: endDay } }],
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        staffId: true,
        scheme: true,
        memberIdentifier: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });
    if (divisorDays === null) {
      return createHash('sha256')
        .update('schoolos:payroll-sources:v2\0')
        .update(
          JSON.stringify({
            lines,
            statutoryPolicyVersionId: run.statutoryPolicyVersionId,
            breakdowns,
            memberships,
          }),
        )
        .digest('hex');
    }
    // Phase 7.9 (v3): additionally pins the period bounds, the divisor and its
    // basis, every line's proration lineage and adjustment amounts, and the
    // consumed adjustments, so drift in any of them invalidates an approval.
    // Holds are payment-side and deliberately not part of the fingerprint.
    const proration = await tx.payrollLine.findMany({
      where: { tenantId, payrollRunId: runId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        paidDays: true,
        unpaidDays: true,
        prorationBreakdown: true,
        adjustmentEarnings: true,
        adjustmentDeductions: true,
      },
    });
    const adjustments = await tx.payrollAdjustment.findMany({
      where: { tenantId, payrollRunId: runId, status: 'APPLIED' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        correctionId: true,
        staffId: true,
        kind: true,
        deltaDays: true,
        amount: true,
        sourcePayrollRunId: true,
      },
    });
    return createHash('sha256')
      .update('schoolos:payroll-sources:v3\0')
      .update(
        JSON.stringify({
          lines,
          statutoryPolicyVersionId: run.statutoryPolicyVersionId,
          breakdowns,
          memberships,
          period: {
            start: run.periodStart,
            end: run.periodEnd,
            divisorDays: run.divisorDays,
            divisorBasis: run.divisorBasis,
          },
          proration,
          adjustments,
        }),
      )
      .digest('hex');
  }

  async postPayrollRun(id: string, actor: AuthContext) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    requirePayrollDuty(actor, 'POST', run);
    if (!this.payrollReadinessService)
      throw new ConflictException('Payroll readiness is unavailable');
    await this.payrollReadinessService.assertActionAllowed(actor, 'POST', {
      year: run.periodYear,
      month: run.periodMonth,
      payrollRunId: run.id,
    });
    const actions = payrollRunLifecycle(run.status);

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
        'Payroll run must be finalized before posting',
      );
    }

    const posted = await this.payrollTransaction(
      actor,
      'payroll:run:post',
      async (tx) => {
        const fingerprint = await this.payrollSourceFingerprint(
          tx,
          run.id,
          actor.tenantId,
        );
        if (
          !run.approvedSourceFingerprint ||
          run.approvedSourceFingerprint !== fingerprint
        )
          throw new ConflictException(
            'Finalized payroll source data changed. Cancel this unposted run with a reason and prepare a replacement.',
          );
        // Claim the row by flipping status inside the transaction, guarded by
        // the exact status/journalEntryId we validated above. A concurrent
        // posting request racing in blocks on the row lock, then finds this
        // where clause no longer matches once we commit, so it fails closed
        // with a clean conflict instead of a raw duplicate-journal P2002.
        const claimed = await tx.payrollRun.updateMany({
          where: {
            id: run.id,
            tenantId: actor.tenantId,
            status: run.status,
            journalEntryId: null,
          },
          data: { status: PayrollRunStatus.POSTED },
        });

        if (claimed.count === 0) {
          throw new ConflictException('Payroll run is already posted');
        }

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
              entryDate: run.periodEnd,
            },
            actor,
            tx,
          );

        await tx.payrollLine.updateMany({
          where: { tenantId: actor.tenantId, payrollRunId: run.id },
          data: { status: PayrollLineStatus.POSTED },
        });

        const updated = await tx.payrollRun.update({
          where: { id: run.id },
          data: {
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
        await this.auditService.record(
          {
            action: 'post',
            resource: 'payroll_run',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: run.id,
            after: {
              journalEntryId: updated.journalEntryId,
              grossAmount: updated.grossAmount.toString(),
              netAmount: updated.netAmount.toString(),
            },
          },
          tx,
        );
        return updated;
      },
      true,
    );

    return serializePayrollRunSummary(
      {
        ...posted,
        _count: {
          lines: posted.lines.length,
          payslips: posted.payslips.length,
        },
      },
      actor,
    );
  }

  async reverseAndCorrectPayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'payroll:run:reverse');
    const run = await this.getPayrollRunOrThrow(id, actor);
    const actions = payrollRunLifecycle(run.status);

    if (!actions.canReverse) {
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot be reversed`,
      );
    }

    const journalEntryId = run.journalEntryId;
    if (!journalEntryId) {
      throw new ConflictException('No journal entry found to reverse');
    }

    const result = await this.payrollTransaction(
      actor,
      'payroll:run:reverse',
      async (tx) => {
        const claimed = await tx.payrollRun.updateMany({
          where: {
            id: run.id,
            tenantId: actor.tenantId,
            status: run.status,
            journalEntryId: run.journalEntryId,
            disbursementJournalEntryId: run.disbursementJournalEntryId,
          },
          data: { status: PayrollRunStatus.VOID },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            'Payroll run changed while the action was being applied',
          );

        const originalEntry = await tx.journalEntry.findUnique({
          where: { id: journalEntryId },
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

        await tx.payslip.updateMany({
          where: { tenantId: actor.tenantId, payrollRunId: run.id },
          data: { status: PayslipStatus.VOID },
        });
        await this.auditService.record(
          {
            action: 'reverse',
            resource: 'payroll_run',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: run.id,
            after: {
              status: PayrollRunStatus.VOID,
              reversalEntryId: reversalEntry.id,
            },
          },
          tx,
        );
        return { updated, reversalEntry };
      },
    );

    return result;
  }

  async rejectPayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    requirePayrollDuty(actor, 'REVIEW', run);
    if (
      ![
        PayrollRunStatus.UNDER_REVIEW,
        PayrollRunStatus.REVIEWED,
        PayrollRunStatus.APPROVED,
      ].some((status) => status === run.status)
    )
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot be returned for correction`,
      );
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Correction reason is required');
    const updated = await this.payrollTransaction(
      actor,
      'payroll:run:review',
      async (tx) => {
        const claim = await tx.payrollRun.updateMany({
          where: { id: run.id, tenantId: actor.tenantId, status: run.status },
          data: {
            status: PayrollRunStatus.GENERATED,
            notes: reason,
            validatedById: null,
            validatedAt: null,
            reviewedById: null,
            reviewedAt: null,
            approvedById: null,
            approvedAt: null,
            approvedSourceFingerprint: null,
          },
        });
        if (claim.count !== 1)
          throw new ConflictException('Payroll run changed while returning it');
        await this.auditService.record(
          {
            action: 'return_for_correction',
            resource: 'payroll_run',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: run.id,
            before: { status: run.status },
            after: { status: PayrollRunStatus.GENERATED, reason },
          },
          tx,
        );
        return tx.payrollRun.findFirstOrThrow({
          where: { id: run.id, tenantId: actor.tenantId },
          include: { lines: { include: { staff: true } } },
        });
      },
    );
    return serializePayrollRunSummary(updated, actor);
  }

  async cancelFinalizedPayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    requirePayrollDuty(actor, 'FINALIZE', run);
    const reason = dto.reason?.trim();
    if (!reason)
      throw new BadRequestException('Cancellation reason is required');
    if (run.status !== PayrollRunStatus.FINALIZED || run.journalEntryId)
      throw new ConflictException(
        'Only finalized unposted payroll can be cancelled',
      );
    await this.payrollTransaction(actor, 'payroll:run:finalize', async (tx) => {
      const claim = await tx.payrollRun.updateMany({
        where: {
          id: run.id,
          tenantId: actor.tenantId,
          status: PayrollRunStatus.FINALIZED,
          journalEntryId: null,
        },
        data: {
          status: PayrollRunStatus.VOID,
          reversalReason: reason,
          reversalAt: new Date(),
          reversedById: actor.userId,
        },
      });
      if (claim.count !== 1)
        throw new ConflictException('Payroll run changed while cancelling it');
      await tx.payslip.updateMany({
        where: { tenantId: actor.tenantId, payrollRunId: run.id },
        data: { status: 'VOID' },
      });
      await this.auditService.record(
        {
          action: 'cancel_finalized',
          resource: 'payroll_run',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: run.id,
          before: { status: run.status },
          after: { status: PayrollRunStatus.VOID, reason },
        },
        tx,
      );
    });
    return this.getPayrollRun(id, actor);
  }

  async markPayrollRunPaid(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'payroll:run:pay');
    const run = await this.getPayrollRunOrThrow(id, actor);
    await this.payrollReadinessService?.assertActionAllowed(
      actor,
      'MARK_PAID',
      {
        year: run.periodYear,
        month: run.periodMonth,
        payrollRunId: run.id,
      },
    );

    if (run.status === PayrollRunStatus.PAID) {
      throw new ConflictException('Payroll run is already marked as paid');
    }

    if (run.status !== PayrollRunStatus.POSTED) {
      throw new ConflictException('Payroll run must be posted before payment');
    }

    if (run.disbursementJournalEntryId) {
      throw new ConflictException('Payroll run is already marked as paid');
    }

    const paid = await this.payrollTransaction(
      actor,
      'payroll:run:pay',
      async (tx) => {
        const claimed = await tx.payrollRun.updateMany({
          where: {
            id: run.id,
            tenantId: actor.tenantId,
            status: run.status,
            journalEntryId: run.journalEntryId,
            disbursementJournalEntryId: run.disbursementJournalEntryId,
          },
          data: { status: PayrollRunStatus.PAID },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            'Payroll run changed while the action was being applied',
          );
        // Phase 7.9: a held line is not paid. Checked after the run row is
        // claimed, so a concurrent hold either committed first (seen here) or
        // is refused by the database once the run is PAID.
        const activeHolds = await tx.payrollHold.count({
          where: {
            tenantId: actor.tenantId,
            payrollRunId: run.id,
            status: 'ACTIVE',
          },
        });
        if (activeHolds > 0)
          throw new ConflictException({
            code: 'PAYROLL_HOLD_ACTIVE',
            message:
              'An active payment hold exists on this run. Release it before marking the run as paid.',
          });

        const journalEntry =
          await this.accountingPostingService.postPayrollDisbursement(
            {
              tenantId: actor.tenantId,
              payrollRunId: run.id,
              periodMonth: run.periodMonth,
              periodYear: run.periodYear,
              netAmount: run.netAmount,
              paymentAccountCode: dto.paymentAccountCode,
              entryDate: run.periodEnd,
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

        const updated = await tx.payrollRun.update({
          where: { id: run.id },
          data: {
            status: PayrollRunStatus.PAID,
            paidAt: new Date(),
            paidById: actor.userId,
            disbursementJournalEntryId: journalEntry.id,
          },
          include: { lines: { include: { staff: true } }, payslips: true },
        });
        await this.auditService.record(
          {
            action: 'mark_paid',
            resource: 'payroll_run',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            after: {
              disbursementJournalEntryId: updated.disbursementJournalEntryId,
              reason: dto.reason ?? null,
            },
          },
          tx,
        );
        return updated;
      },
    );

    return paid;
  }

  async reversePayrollRun(
    id: string,
    dto: PayrollActionDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason;
    if (!reason) {
      throw new ConflictException('Reversal reason is required');
    }

    requireDomainPermission(actor, 'payroll:run:reverse');
    const run = await this.getPayrollRunOrThrow(id, actor);

    if (
      run.status !== PayrollRunStatus.POSTED &&
      run.status !== PayrollRunStatus.PAID
    ) {
      throw new ConflictException(
        'Only posted or paid payroll runs can be reversed',
      );
    }

    const reversed = await this.payrollTransaction(
      actor,
      'payroll:run:reverse',
      async (tx) => {
        const claimed = await tx.payrollRun.updateMany({
          where: {
            id: run.id,
            tenantId: actor.tenantId,
            status: run.status,
            journalEntryId: run.journalEntryId,
            disbursementJournalEntryId: run.disbursementJournalEntryId,
          },
          data: { status: PayrollRunStatus.CANCELLED },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            'Payroll run changed while the action was being applied',
          );

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
              reason,
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
              reason,
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
        const updated = await tx.payrollRun.update({
          where: { id: run.id },
          data: {
            status: PayrollRunStatus.CANCELLED,
            reversalReason: dto.reason,
            reversalAt: new Date(),
            reversedById: actor.userId,
          },
        });
        await tx.payslip.updateMany({
          where: { tenantId: actor.tenantId, payrollRunId: run.id },
          data: { status: PayslipStatus.VOID },
        });
        await this.auditService.record(
          {
            action: 'reverse',
            resource: 'payroll_run',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            after: {
              status: updated.status,
              reason: dto.reason,
            },
          },
          tx,
        );
        return updated;
      },
    );

    return reversed;
  }

  async getPayrollRun(id: string, actor: AuthContext) {
    const run = await this.getPayrollRunOrThrow(id, actor);
    const holds = await this.prisma.payrollHold.findMany({
      where: {
        tenantId: actor.tenantId,
        payrollRunId: run.id,
        status: 'ACTIVE',
      },
      select: { id: true, staffId: true, reason: true, createdAt: true },
    });
    return serializePayrollRunDetail(run, actor, holds);
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
      job?.name !== 'regeneratePayslip' ||
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
    const logo = await loadSchoolLogoForPdf(
      this.prisma,
      this.fileRegistryService,
      {
        tenantId: input.tenantId,
        userId: input.requestedByUserId,
      },
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
        logo,
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
    logo?: PdfImage | null;
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
      logo: input.logo,
    });
  }

  /**
   * The approved statutory policy in force on a date, exactly as calculation
   * would use it. Rates are policy data, not secrets; the source title and
   * checksum let a reviewer tie the numbers to the legal source document.
   */
  async getStatutoryPolicy(
    asOf: string | undefined,
    actor: AuthContext,
  ): Promise<StatutoryPolicyView> {
    requireDomainPermission(actor, 'payroll:run:read');
    const date = asOf
      ? new Date(`${asOf.slice(0, 10)}T23:59:59.999Z`)
      : new Date();
    const policy = await resolveStatutoryPolicy(this.prisma, date);
    const iso = (value: Date | null) =>
      value ? value.toISOString().slice(0, 10) : null;
    const isoRequired = (value: Date) => value.toISOString().slice(0, 10);
    return {
      asOf: date.toISOString().slice(0, 10),
      policy: policy
        ? {
            versionId: policy.versionId,
            policyKey: policy.policyKey,
            version: policy.version,
            effectiveFrom: isoRequired(policy.effectiveFrom),
            effectiveTo: iso(policy.effectiveTo),
            sourceTitle: policy.sourceTitle,
            sourceChecksumSha256: policy.sourceChecksumSha256,
            schemes: policy.definition.schemes.map((scheme) => ({
              code: scheme.code,
              base: scheme.base,
              method: scheme.method,
              employeeRate: scheme.employeeRate?.toString() ?? null,
              employerRate: scheme.employerRate?.toString() ?? null,
              baseCap: scheme.baseCap?.toString() ?? null,
              slabs: scheme.slabs.map((slab) => ({
                upTo: slab.upTo?.toString() ?? null,
                rate: slab.rate.toString(),
              })),
              requiresIdentifier: scheme.requiresIdentifier,
            })),
          }
        : null,
    };
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

    // Phase 7.8: rates shown here are the approved policy's, never constants.
    let policy: ResolvedStatutoryPolicy | null = null;
    let policyNote =
      'No approved statutory policy covers today, so no rate is shown.';
    try {
      policy = await resolveStatutoryPolicy(this.prisma, new Date());
      if (policy) policyNote = `Policy ${policy.policyKey} v${policy.version}.`;
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      policyNote = 'The statutory policy is ambiguous or unusable.';
    }
    const flatPercent = (code: 'SSF' | 'PF' | 'REMUNERATION_TAX') => {
      const rule = findStatutoryScheme(policy?.definition, code);
      return rule?.employeeRate ? rule.employeeRate.mul(100).toNumber() : null;
    };
    const today = new Date();
    const todayDay = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const memberships = await this.prisma.staffStatutoryMembership.groupBy({
      by: ['scheme'],
      where: {
        tenantId: actor.tenantId,
        effectiveFrom: { lte: todayDay },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: todayDay } }],
      },
      _count: { _all: true },
    });
    const retirementEntries = memberships.map((row) => ({
      code: row.scheme,
      name: row.scheme === 'SSF' ? 'Social Security Fund' : 'Provident fund',
      ratePercent: flatPercent(row.scheme),
      activeStructureCount,
      configuredStructureCount: row._count._all,
      source: 'staff_statutory_membership',
      note: `Active memberships. ${policyNote}`,
    }));

    return [
      ...retirementEntries,
      ...(pfStructureCount > 0 && memberships.length === 0
        ? [
            {
              code: 'PF',
              name: 'Provident fund',
              ratePercent: null,
              activeStructureCount,
              configuredStructureCount: pfStructureCount,
              source: 'salary_structure_pf_enabled',
              note: 'Enabled on salary structures but no scheme membership is recorded.',
            },
          ]
        : []),
      ...(tdsStructureCount > 0
        ? [
            {
              code: 'TDS',
              name: 'Tax deducted at source',
              ratePercent: flatPercent('REMUNERATION_TAX'),
              activeStructureCount,
              configuredStructureCount: tdsStructureCount,
              source: 'salary_structure_tds_enabled',
              note: `Enabled on active tenant salary structures. ${policyNote}`,
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

  async getPayrollGlReconciliation(
    actor: AuthContext,
    filtersInput?: PayrollReportFilterInput,
  ) {
    const filters = normalizePayrollReportFilters(filtersInput);
    const runs = await this.prisma.payrollRun.findMany({
      where: {
        tenantId: actor.tenantId,
        status: {
          in: [PayrollRunStatus.POSTED, PayrollRunStatus.PAID],
        },
        ...(filters.payrollRunId ? { id: filters.payrollRunId } : {}),
        ...(filters.month ? { periodMonth: filters.month } : {}),
        ...(filters.year ? { periodYear: filters.year } : {}),
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 100,
    });

    const journalIds = [
      ...runs.map((run) => run.journalEntryId).filter(Boolean),
      ...runs.map((run) => run.disbursementJournalEntryId).filter(Boolean),
    ] as string[];

    const journals = journalIds.length
      ? await this.prisma.journalEntry.findMany({
          where: {
            tenantId: actor.tenantId,
            id: { in: journalIds },
          },
          include: { lines: true },
        })
      : [];
    const journalMap = new Map(journals.map((entry) => [entry.id, entry]));

    const rows = runs.map((run) => {
      const accrualJournal = run.journalEntryId
        ? journalMap.get(run.journalEntryId)
        : undefined;
      const disbursementJournal = run.disbursementJournalEntryId
        ? journalMap.get(run.disbursementJournalEntryId)
        : undefined;

      const journalTotalDebit = accrualJournal
        ? accrualJournal.lines.reduce(
            (sum, line) => sum.add(line.debit),
            new Prisma.Decimal(0),
          )
        : new Prisma.Decimal(0);
      const journalTotalCredit = accrualJournal
        ? accrualJournal.lines.reduce(
            (sum, line) => sum.add(line.credit),
            new Prisma.Decimal(0),
          )
        : new Prisma.Decimal(0);
      const expectedExpenseDebit = run.grossAmount.add(run.pfEmployerAmount);

      const issues: string[] = [];
      if (!accrualJournal) {
        issues.push('Missing accrual journal entry.');
      } else {
        if (!journalTotalDebit.eq(journalTotalCredit)) {
          issues.push('Accrual journal entry is not balanced.');
        }
        if (!journalTotalDebit.eq(expectedExpenseDebit)) {
          issues.push(
            'Accrual journal debits do not match payroll gross salary plus employer PF.',
          );
        }
      }

      if (run.status === PayrollRunStatus.PAID && !disbursementJournal) {
        issues.push('Paid payroll run is missing disbursement journal entry.');
      }

      return {
        payrollRunId: run.id,
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        status: run.status,
        runGrossAmount: moneyString(run.grossAmount),
        runNetAmount: moneyString(run.netAmount),
        runPfEmployee: moneyString(run.pfEmployeeAmount),
        runPfEmployer: moneyString(run.pfEmployerAmount),
        runTds: moneyString(run.tdsAmount),
        journalEntryId: run.journalEntryId,
        journalEntryNumber: accrualJournal?.entryNumber ?? null,
        journalTotalDebit: moneyString(journalTotalDebit),
        journalTotalCredit: moneyString(journalTotalCredit),
        expectedExpenseDebit: moneyString(expectedExpenseDebit),
        disbursementJournalEntryId: run.disbursementJournalEntryId,
        disbursementJournalEntryNumber:
          disbursementJournal?.entryNumber ?? null,
        isReconciled: issues.length === 0,
        issues,
      };
    });

    return {
      rows,
      summary: {
        totalRuns: rows.length,
        reconciledRuns: rows.filter((row) => row.isReconciled).length,
        unreconciledRuns: rows.filter((row) => !row.isReconciled).length,
      },
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
    const actions = payrollRunLifecycle(run.status);

    if (!actions.canEdit) {
      throw new ConflictException(
        `Payroll run in ${run.status} status cannot be edited`,
      );
    }

    // The run's own stored bounds and divisor are authoritative, so a
    // regeneration reproduces the period it was prepared for.
    const period = payrollPeriodOfRun(run);
    const divisorDays = run.divisorDays ?? period.calendarDays;
    const divisorBasis: PayrollDivisorBasisValue =
      run.divisorBasis ?? 'CALENDAR_DAYS_OF_PERIOD';
    const calculation = await calculatePeriodPayroll(this.prisma, {
      tenantId: actor.tenantId,
      period,
      divisorDays,
      divisorBasis,
      ownRunId: run.id,
    });
    assertNoStatutoryConfigurationErrors(calculation.configurationErrors);
    assertNoProrationErrors(calculation.prorationErrors);
    const { lines, totals, policy } = calculation;

    try {
      return await this.payrollTransaction(
        actor,
        'payroll:run:create',
        async (tx) => {
          const claimed = await tx.payrollRun.updateMany({
            where: {
              id: run.id,
              tenantId: actor.tenantId,
              status: run.status,
              updatedAt: run.updatedAt,
            },
            data: {
              status: PayrollRunStatus.GENERATED,
              generatedById: actor.userId,
              validatedById: null,
              validatedAt: null,
              reviewedById: null,
              reviewedAt: null,
              approvedById: null,
              approvedAt: null,
              approvedSourceFingerprint: null,
            },
          });
          if (claimed.count !== 1)
            throw new ConflictException(
              'Payroll run changed while regenerating its lines',
            );
          // Give back the corrections this run held; they are re-consumed
          // below if they are still eligible.
          await tx.payrollAdjustment.updateMany({
            where: {
              tenantId: actor.tenantId,
              payrollRunId: run.id,
              status: 'APPLIED',
            },
            data: {
              status: 'RELEASED',
              releasedAt: new Date(),
              releaseReason: 'REGENERATED',
            },
          });
          await tx.payrollLine.deleteMany({
            where: { tenantId: actor.tenantId, payrollRunId: run.id },
          });

          const updated = await tx.payrollRun.update({
            where: { id: run.id },
            data: {
              grossAmount: new Prisma.Decimal(totals.grossAmount),
              deductionAmount: new Prisma.Decimal(totals.deductionAmount),
              netAmount: new Prisma.Decimal(totals.netAmount),
              pfEmployeeAmount: new Prisma.Decimal(totals.pfEmployeeAmount),
              pfEmployerAmount: new Prisma.Decimal(totals.pfEmployerAmount),
              tdsAmount: new Prisma.Decimal(totals.tdsAmount),
              divisorDays,
              divisorBasis,
              statutoryPolicyVersionId: statutoryVersionIdFor(lines, policy),
              status: PayrollRunStatus.GENERATED,
              lines: {
                create: lines.map((line) =>
                  payrollLineCreateData(actor.tenantId, line, policy),
                ),
              },
            },
            include: {
              lines: { include: { staff: true, payslip: true } },
              payslips: true,
            },
          });
          const consumed = await this.applyAdjustments(
            tx,
            actor,
            run.id,
            lines,
          );
          await this.auditService.record(
            {
              action: 'regenerate',
              resource: 'payroll_run',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: run.id,
              before: { status: run.status },
              after: {
                status: updated.status,
                lineCount: lines.length,
                adjustmentCount: consumed,
              },
            },
            tx,
          );
          const holds = await tx.payrollHold.findMany({
            where: {
              tenantId: actor.tenantId,
              payrollRunId: run.id,
              status: 'ACTIVE',
            },
            select: { id: true, staffId: true, reason: true, createdAt: true },
          });
          return serializePayrollRunDetail(updated, actor, holds);
        },
        true,
      );
    } catch (error) {
      throw translateRunWriteError(error);
    }
  }
}

interface PayrollLineInput {
  baseSalary: Prisma.Decimal | number;
  allowances: Prisma.Decimal | number;
  contractDeductions: Prisma.Decimal | number;
  attendanceDays: number;
  workingDays: number;
  /** Approved statutory policy in force for the period (null when none). */
  policy: StatutoryPolicyDefinition | null;
  enrollment: StatutoryEnrollment;
}

export function calculatePayrollLine(input: PayrollLineInput) {
  // Pre-7.9 entry point for pricing one salary: same rules as the period
  // engine (one calculation path), a single compensation source, fixed
  // deductions charged in full. The net is never floored at zero.
  const plan = singleSourcePlan({
    baseSalary: input.baseSalary,
    allowances: input.allowances,
    contractDeductions: input.contractDeductions,
    paidDays: input.attendanceDays,
    divisorDays: input.workingDays > 0 ? input.workingDays : 1,
  });
  const calculated = calculateLineFromPlan({
    plan,
    policy: input.policy,
    enrollment: input.enrollment,
  });
  return {
    earnings: calculated.earnings,
    grossSalary: calculated.grossSalary,
    allowances: calculated.allowances,
    leaveDeductions: calculated.leaveDeductions,
    pfEmployee: calculated.pfEmployee,
    pfEmployer: calculated.pfEmployer,
    tds: calculated.tds,
    otherDeductions: calculated.otherDeductions,
    deductions: calculated.deductions,
    netSalary: calculated.netSalary,
    statutoryAmounts: calculated.statutoryAmounts,
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

/**
 * Status-only transition table used by internal lifecycle guards (a caller
 * that has already enforced the duty/permission). NEVER serialize this as
 * actor-facing actions: it says what the lifecycle permits, not what the
 * actor may do.
 */
export function payrollRunLifecycle(status: string) {
  return buildPayrollRunActions(
    status,
    () => true,
    () => true,
  );
}

/**
 * Actor-facing actions. The actor is required: there is no default-allow
 * path, so a response built without an actor cannot advertise actions.
 */
export function getPayrollRunActions(
  status: string,
  actor: AuthContext,
  run = {},
) {
  return buildPayrollRunActions(
    status,
    (duty) => payrollDutyAvailable(actor, duty, run),
    (permission) => hasDomainPermission(actor, permission),
  );
}

const HOLDABLE_STATUSES: string[] = [
  PayrollRunStatus.GENERATED,
  PayrollRunStatus.VALIDATED,
  PayrollRunStatus.UNDER_REVIEW,
  PayrollRunStatus.REVIEWED,
  PayrollRunStatus.APPROVED,
  PayrollRunStatus.FINALIZED,
  PayrollRunStatus.POSTED,
];
const BANK_ADVICE_STATUSES: string[] = [
  PayrollRunStatus.FINALIZED,
  PayrollRunStatus.POSTED,
];

type RunPermission =
  | 'payroll:run:pay'
  | 'payroll:run:reverse'
  | 'payroll:hold:create'
  | 'payroll:hold:release'
  | 'payroll:bank-advice:export';

function buildPayrollRunActions(
  status: string,
  available: (duty: PayrollDuty) => boolean,
  holds: (permission: RunPermission) => boolean,
) {
  const editable =
    status === PayrollRunStatus.DRAFT || status === PayrollRunStatus.GENERATED;
  return {
    canEdit: editable && available('SUBMIT_REVIEW'),
    canValidate: editable && available('VALIDATE'),
    canReview:
      status === PayrollRunStatus.VALIDATED && available('SUBMIT_REVIEW'),
    canSubmitReview:
      status === PayrollRunStatus.VALIDATED && available('SUBMIT_REVIEW'),
    canCompleteReview:
      status === PayrollRunStatus.UNDER_REVIEW && available('REVIEW'),
    canApprove: status === PayrollRunStatus.REVIEWED && available('APPROVE'),
    canFinalize: status === PayrollRunStatus.APPROVED && available('FINALIZE'),
    canCancelFinalized:
      status === PayrollRunStatus.FINALIZED && available('FINALIZE'),
    canReject:
      (status === PayrollRunStatus.UNDER_REVIEW ||
        status === PayrollRunStatus.REVIEWED ||
        status === PayrollRunStatus.APPROVED) &&
      available('REVIEW'),
    canPost: status === PayrollRunStatus.FINALIZED && available('POST'),
    canPay: status === PayrollRunStatus.POSTED && holds('payroll:run:pay'),
    canReverse:
      (status === PayrollRunStatus.POSTED ||
        status === PayrollRunStatus.PAID) &&
      holds('payroll:run:reverse'),
    canHold: HOLDABLE_STATUSES.includes(status) && holds('payroll:hold:create'),
    canReleaseHold:
      HOLDABLE_STATUSES.includes(status) && holds('payroll:hold:release'),
    canExportBankAdvice:
      BANK_ADVICE_STATUSES.includes(status) &&
      holds('payroll:bank-advice:export'),
    isLocked: [
      PayrollRunStatus.FINALIZED,
      PayrollRunStatus.POSTED,
      PayrollRunStatus.PAID,
      PayrollRunStatus.CANCELLED,
      PayrollRunStatus.VOID,
    ].some((lockedStatus) => lockedStatus === status),
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

function assertStaffContractDateRange(startDate: Date, endDate: Date | null) {
  if (Number.isNaN(startDate.getTime())) {
    throw new BadRequestException('Contract start date must be valid');
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new BadRequestException('Contract end date must be valid');
  }

  if (endDate && endDate < startDate) {
    throw new BadRequestException(
      'Contract end date cannot be before the start date',
    );
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

/**
 * Bank details live on Staff (protected by hr:bank:*). Salary-structure writes
 * that still carry them are routed here; the structure columns are deprecated
 * and no longer written. The caller has already required hr:bank:write.
 */
async function writeStaffBankDetails(
  tx: Prisma.TransactionClient,
  tenantId: string,
  staffId: string,
  fields: { bankAccount?: string | null; bankName?: string | null },
) {
  if (fields.bankAccount === undefined && fields.bankName === undefined) return;
  const result = await tx.staff.updateMany({
    where: { id: staffId, tenantId },
    data: {
      ...(fields.bankAccount !== undefined
        ? { bankAccount: fields.bankAccount }
        : {}),
      ...(fields.bankName !== undefined ? { bankName: fields.bankName } : {}),
    },
  });
  if (result.count !== 1)
    throw new NotFoundException('Staff member not found in this tenant');
}

function staffBankOf(staff: unknown): {
  bankAccount: string | null;
  bankName: string | null;
} | null {
  if (typeof staff !== 'object' || staff === null) return null;
  const value = staff as {
    bankAccount?: string | null;
    bankName?: string | null;
  };
  return {
    bankAccount: value.bankAccount ?? null,
    bankName: value.bankName ?? null,
  };
}

interface StatutoryConfigurationIssue {
  staffId: string;
  code: string;
  message: string;
}

/**
 * A payroll run is never created or regenerated from lines that could not be
 * computed: the caller sees which staff need configuration, not a silently
 * smaller (or zero-statutory) run.
 */
function assertNoStatutoryConfigurationErrors(
  issues: StatutoryConfigurationIssue[],
) {
  if (!issues.length) return;
  throw new ConflictException({
    code: 'MISSING_STATUTORY_CONFIGURATION',
    message:
      'Payroll cannot be calculated until the statutory configuration is complete.',
    issues: issues.map(({ staffId, code, message }) => ({
      staffId,
      code,
      message,
    })),
  });
}

/**
 * The proration divisor: the calendar days of the BS period unless the
 * operator names one. Either way the basis is recorded on the run.
 */
function resolvePayrollDivisor(
  workingDays: number | undefined,
  period: Pick<PayrollPeriodWindow, 'calendarDays'>,
): { divisorDays: number; divisorBasis: PayrollDivisorBasisValue } {
  if (workingDays === undefined)
    return {
      divisorDays: period.calendarDays,
      divisorBasis: 'CALENDAR_DAYS_OF_PERIOD',
    };
  if (!Number.isInteger(workingDays) || workingDays < 1 || workingDays > 32)
    throw new BadRequestException({
      code: 'PRORATION_DIVISOR_INVALID',
      message: 'workingDays must be a whole number of days from 1 to 32',
    });
  return { divisorDays: workingDays, divisorBasis: 'OPERATOR_SUPPLIED' };
}

function assertNoProrationErrors(
  issues: Array<{ staffId: string; code: string; message: string }>,
) {
  if (!issues.length) return;
  throw new ConflictException({
    code: 'PRORATION_INPUT_UNRESOLVED',
    message:
      'Payroll cannot be prorated until every employed day has an authoritative salary source.',
    issues: issues.map(({ staffId, code, message }) => ({
      staffId,
      code,
      message,
    })),
  });
}

function formatCentiDays(centi: bigint): string {
  const negative = centi < 0n;
  const abs = negative ? -centi : centi;
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

/** Maps database refusals on a run write to precise, machine-readable conflicts. */
function translateRunWriteError(error: unknown): unknown {
  const err = error as { code?: unknown; message?: unknown } | null;
  const message = typeof err?.message === 'string' ? err.message : '';
  if (
    message.includes('PayrollRun_no_overlapping_live_period') ||
    message.includes('23P01')
  )
    return new ConflictException({
      code: 'PAYROLL_PERIOD_OVERLAP',
      message:
        'This period overlaps another live payroll run for the school. Cancel or reverse it first.',
    });
  if (message.includes('PayrollAdjustment_one_applied'))
    return new ConflictException({
      code: 'PAYROLL_ADJUSTMENT_ALREADY_APPLIED',
      message:
        'A payroll adjustment was consumed by another run while this one was being prepared. Retry.',
    });
  if (err?.code === 'P2002')
    return new ConflictException(
      'A payroll run already exists for this period. Void the existing one first if a re-run is needed.',
    );
  return error;
}

function statutoryVersionIdFor(
  lines: Array<{ statutoryAmounts: StatutoryAmount[] }>,
  policy: ResolvedStatutoryPolicy | null,
): string | null {
  return policy && lines.some((line) => line.statutoryAmounts.length > 0)
    ? policy.versionId
    : null;
}

function payrollLineCreateData(
  tenantId: string,
  line: PeriodPayrollLine,
  policy: ResolvedStatutoryPolicy | null,
) {
  return {
    tenantId,
    staffId: line.staffId,
    contractId: line.contractId,
    salaryStructureId: line.salaryStructureId,
    employmentId: line.employmentId,
    employmentFrom: line.employmentFrom,
    employmentTo: line.employmentTo,
    statutoryBreakdown: statutoryBreakdownJson(
      policy?.versionId ?? null,
      line.statutoryAmounts,
    ),
    prorationBreakdown: line.prorationBreakdown,
    basicSalary: new Prisma.Decimal(line.baseSalary),
    earnings: new Prisma.Decimal(line.earnings),
    grossSalary: new Prisma.Decimal(line.grossSalary),
    allowances: new Prisma.Decimal(line.allowances),
    leaveDeductions: new Prisma.Decimal(line.leaveDeductions),
    pfEmployee: new Prisma.Decimal(line.pfEmployee),
    pfEmployer: new Prisma.Decimal(line.pfEmployer),
    tds: new Prisma.Decimal(line.tds),
    otherDeductions: new Prisma.Decimal(line.otherDeductions),
    adjustmentEarnings: new Prisma.Decimal(line.adjustmentEarnings),
    adjustmentDeductions: new Prisma.Decimal(line.adjustmentDeductions),
    deductions: new Prisma.Decimal(line.deductions),
    netSalary: new Prisma.Decimal(line.netSalary),
    paidDays: new Prisma.Decimal(line.paidDays),
    unpaidDays: new Prisma.Decimal(line.unpaidDays),
    attendanceDays: line.attendanceDays,
    workingDays: line.workingDays,
  };
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

interface MinimalStaff {
  id: string;
  employeeId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  designation?: string | null;
}

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

function serializeSalaryStructure(
  structure: {
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
  },
  actor?: AuthContext,
) {
  return {
    id: structure.id,
    staffId: structure.staffId,
    effectiveFrom: structure.effectiveFrom,
    effectiveTo: structure.effectiveTo,
    status: structure.status,
    paymentMethod: structure.paymentMethod,
    notes: structure.notes,
    activatedAt: structure.activatedAt,
    archivedAt: structure.archivedAt,
    createdAt: structure.createdAt,
    updatedAt: structure.updatedAt,
    bankAccount:
      actor && hasDomainPermission(actor, 'hr:bank:read')
        ? (staffBankOf(structure.staff)?.bankAccount ??
          structure.bankAccount ??
          null)
        : null,
    bankName:
      actor && hasDomainPermission(actor, 'hr:bank:read')
        ? (staffBankOf(structure.staff)?.bankName ?? structure.bankName ?? null)
        : null,
    pfEnabled:
      actor && hasDomainPermission(actor, 'hr:tax:read')
        ? structure.pfEnabled
        : null,
    tdsEnabled:
      actor && hasDomainPermission(actor, 'hr:tax:read')
        ? structure.tdsEnabled
        : null,
    basicSalary: moneyString(structure.basicSalary),
    allowances: moneyString(structure.allowances),
    deductions: moneyString(structure.deductions),
    staff: serializeStaff(structure.staff),
    components: (structure.components ?? []).map((component) => ({
      id: component.id,
      name: component.name,
      componentType: component.componentType,
      taxable: component.taxable,
      amount: moneyString(component.amount),
    })),
  };
}

function serializePayrollRunSummary(
  run: {
    id: string;
    revision?: number;
    predecessorRunId?: string | null;
    periodMonth: number;
    periodYear: number;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    divisorDays?: number | null;
    divisorBasis?: string | null;
    status: string;
    grossAmount: Prisma.Decimal;
    deductionAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal;
    pfEmployeeAmount?: Prisma.Decimal;
    pfEmployerAmount?: Prisma.Decimal;
    tdsAmount?: Prisma.Decimal;
    generatedById?: string | null;
    reviewedById?: string | null;
    approvedById?: string | null;
    postedById?: string | null;
    paidById?: string | null;
    approvedAt?: Date | null;
    postedAt?: Date | null;
    paidAt?: Date | null;
    journalEntryId?: string | null;
    disbursementJournalEntryId?: string | null;
    statutoryPolicyVersionId?: string | null;
    notes?: string | null;
    reversalReason?: string | null;
    reversalAt?: Date | null;
    reversedById?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    lines?: unknown;
    payslips?: unknown;
    _count?: { lines?: number; payslips?: number };
  },
  actor: AuthContext,
) {
  const _count = run._count;
  const rest = {
    id: run.id,
    revision: run.revision,
    predecessorRunId: run.predecessorRunId,
    periodMonth: run.periodMonth,
    periodYear: run.periodYear,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    ...periodPresentation(run),
    divisorDays: run.divisorDays ?? null,
    divisorBasis: run.divisorBasis ?? null,
    status: run.status,
    generatedById: run.generatedById,
    reviewedById: run.reviewedById,
    approvedById: run.approvedById,
    postedById: run.postedById,
    paidById: run.paidById,
    approvedAt: run.approvedAt,
    postedAt: run.postedAt,
    paidAt: run.paidAt,
    journalEntryId: run.journalEntryId,
    disbursementJournalEntryId: run.disbursementJournalEntryId,
    statutoryPolicyVersionId: run.statutoryPolicyVersionId ?? null,
    notes: run.notes,
    reversalReason: run.reversalReason,
    reversalAt: run.reversalAt,
    reversedById: run.reversedById,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
  return {
    ...rest,
    allowedActions: getPayrollRunActions(run.status, actor, run),
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

/** BS label and ISO bounds of a run for display; the stored bounds stay authoritative. */
function periodPresentation(run: {
  periodYear: number;
  periodMonth: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) {
  if (!run.periodStart || !run.periodEnd) return {};
  const window = payrollPeriodOfRun({
    periodYear: run.periodYear,
    periodMonth: run.periodMonth,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
  });
  return {
    periodLabel: window.label,
    periodStartsOn: window.startsOnIso,
    periodEndsOn: window.endsOnIso,
    periodCalendar: window.bs ? 'BS' : 'GREGORIAN_LEGACY',
    periodCalendarDays: window.calendarDays,
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
  actor: AuthContext,
  holds: Array<{
    id: string;
    staffId: string;
    reason: string;
    createdAt: Date;
  }> = [],
) {
  const holdByStaff = new Map(holds.map((hold) => [hold.staffId, hold]));
  return {
    ...serializePayrollRunSummary(
      {
        ...run,
        _count: { lines: run.lines.length, payslips: run.payslips.length },
      },
      actor,
    ),
    lines: run.lines.map((line) =>
      serializePayrollLine(line, holdByStaff.get(line.staffId) ?? null),
    ),
    payslips: run.payslips.map((payslip) =>
      serializePayslipSummary({ ...payslip, payrollRun: run, staff: null }),
    ),
  };
}

function serializePayrollLine(
  line: {
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
    prorationBreakdown?: unknown;
    adjustmentEarnings?: Prisma.Decimal;
    adjustmentDeductions?: Prisma.Decimal;
    statutoryBreakdown?: unknown;
  },
  activeHold?: { id: string; reason: string; createdAt: Date } | null,
) {
  return {
    ...line,
    // The per-day ledger stays server-side (it is attendance detail); the
    // summary of how the amounts were derived is what the line exposes.
    prorationBreakdown: publicProrationBreakdown(line.prorationBreakdown),
    adjustmentEarnings: moneyString(line.adjustmentEarnings),
    adjustmentDeductions: moneyString(line.adjustmentDeductions),
    hold: activeHold
      ? {
          id: activeHold.id,
          reason: activeHold.reason,
          createdAt: activeHold.createdAt,
        }
      : null,
    netNegative: line.netSalary.lt(0),
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

function publicProrationBreakdown(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { ledger: _ledger, ...rest } = value as Record<string, unknown>;
  void _ledger;
  return rest;
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
  return payrollLeaveOverlapDays(start1, end1, start2, end2);
}
