import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingPeriodStatus,
  PaymentMethod,
  PayrollExceptionCode,
  PayrollExceptionSeverity,
  PayrollExceptionStatus,
  PayrollRunStatus,
  SalaryStructureStatus,
  StaffStatus,
  type Prisma,
} from '@prisma/client';
import type {
  PayrollExceptionPage,
  PayrollExceptionSummary,
  PayrollReadinessSummary,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AcknowledgePayrollExceptionDto,
  PayrollExceptionQueryDto,
} from './dto/payroll-exception-query.dto';

type ReadinessAction =
  | 'CREATE_DRAFT'
  | 'SUBMIT_REVIEW'
  | 'APPROVE'
  | 'POST'
  | 'GENERATE_PAYSLIP'
  | 'MARK_PAID';

interface Candidate {
  identityKey: string;
  payrollRunId: string | null;
  staffId: string | null;
  code: PayrollExceptionCode;
  severity: PayrollExceptionSeverity;
  title: string;
  safeMessage: string;
  resolutionRoute: string | null;
  blockedActions: ReadinessAction[];
}

interface ReadinessLine {
  staffId: string;
  contractId: string | null;
  workingDays: number;
  attendanceDays: number;
  grossSalary: Prisma.Decimal;
  netSalary: Prisma.Decimal;
  tds: Prisma.Decimal;
  staff: {
    status: StaffStatus;
    panNumber: string | null;
    bankAccount: string | null;
  };
  salaryStructure: {
    paymentMethod: PaymentMethod;
    bankAccount: string | null;
  } | null;
}

const ACTIVE_EXCEPTION_STATUSES = [
  PayrollExceptionStatus.OPEN,
  PayrollExceptionStatus.ACKNOWLEDGED,
] as const;

@Injectable()
export class PayrollReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getReadiness(
    query: PayrollExceptionQueryDto,
    actor: AuthContext,
  ): Promise<PayrollReadinessSummary> {
    const scope = await this.sync(query, actor);
    return this.buildSummary(
      actor.tenantId,
      scope.year,
      scope.month,
      scope.runId,
      scope.staffConsidered,
      scope.staffExcluded,
    );
  }

  async listExceptions(
    query: PayrollExceptionQueryDto,
    actor: AuthContext,
  ): Promise<PayrollExceptionPage> {
    const scope = await this.sync(query, actor);
    const page = query.page;
    const limit = query.limit;
    const search = query.search?.trim();
    const where: Prisma.PayrollExceptionWhereInput = {
      tenantId: actor.tenantId,
      periodYear: scope.year,
      periodMonth: scope.month,
      ...(query.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.code ? { code: query.code } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.department
        ? { staff: { department: { equals: query.department.trim() } } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { safeMessage: { contains: search, mode: 'insensitive' } },
              {
                staff: {
                  employeeId: { contains: search, mode: 'insensitive' },
                },
              },
              {
                staff: { firstName: { contains: search, mode: 'insensitive' } },
              },
              {
                staff: { lastName: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };

    const [items, total, readiness] = await Promise.all([
      this.prisma.payrollException.findMany({
        where,
        include: {
          staff: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
        orderBy: [
          { severity: 'asc' },
          { status: 'asc' },
          { detectedAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payrollException.count({ where }),
      this.buildSummary(
        actor.tenantId,
        scope.year,
        scope.month,
        scope.runId,
        scope.staffConsidered,
        scope.staffExcluded,
      ),
    ]);

    return {
      items: items.map(serializeException),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      readiness,
    };
  }

  async acknowledge(
    id: string,
    dto: AcknowledgePayrollExceptionDto,
    actor: AuthContext,
  ): Promise<PayrollExceptionSummary> {
    const exception = await this.prisma.payrollException.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        staff: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
    });

    if (!exception) {
      throw new NotFoundException('Payroll exception not found in this tenant');
    }
    if (exception.severity !== PayrollExceptionSeverity.WARNING) {
      throw new ConflictException(
        'Only warning exceptions can be acknowledged. Blocking exceptions must be resolved at their source.',
      );
    }
    if (exception.status === PayrollExceptionStatus.RESOLVED) {
      return serializeException(exception);
    }
    if (exception.status !== PayrollExceptionStatus.OPEN) {
      throw new ConflictException(
        'This payroll warning is already acknowledged',
      );
    }

    const reason = dto.reason.trim();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payrollException.update({
        where: { id: exception.id },
        data: {
          status: PayrollExceptionStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
          acknowledgedById: actor.userId,
          acknowledgementReason: reason,
        },
        include: {
          staff: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      });
      await this.auditService.record(
        {
          action: 'acknowledge',
          resource: 'payroll_exception',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: exception.id,
          before: { status: exception.status },
          after: {
            status: result.status,
            code: result.code,
            reason,
          },
        },
        tx,
      );
      return result;
    });

    return serializeException(updated);
  }

  async assertActionAllowed(
    actor: AuthContext,
    action: ReadinessAction,
    input: { year: number; month: number; payrollRunId?: string },
  ) {
    await this.sync(
      {
        year: input.year,
        month: input.month,
        payrollRunId: input.payrollRunId,
        page: 1,
        limit: 1,
      },
      actor,
    );
    const exception = await this.prisma.payrollException.findFirst({
      where: {
        tenantId: actor.tenantId,
        periodYear: input.year,
        periodMonth: input.month,
        status: { in: [...ACTIVE_EXCEPTION_STATUSES] },
        severity: PayrollExceptionSeverity.BLOCKING,
        blockedActions: { has: action },
        ...(input.payrollRunId
          ? {
              OR: [
                { payrollRunId: input.payrollRunId },
                { payrollRunId: null },
              ],
            }
          : { payrollRunId: null }),
      },
      select: { title: true, safeMessage: true },
      orderBy: [{ detectedAt: 'asc' }, { id: 'asc' }],
    });
    if (exception) {
      throw new ConflictException(
        `${exception.title}: ${exception.safeMessage}`,
      );
    }

    const warning = await this.prisma.payrollException.findFirst({
      where: {
        tenantId: actor.tenantId,
        periodYear: input.year,
        periodMonth: input.month,
        status: PayrollExceptionStatus.OPEN,
        severity: PayrollExceptionSeverity.WARNING,
        blockedActions: { has: action },
        ...(input.payrollRunId
          ? {
              OR: [
                { payrollRunId: input.payrollRunId },
                { payrollRunId: null },
              ],
            }
          : { payrollRunId: null }),
      },
      select: { title: true, safeMessage: true },
      orderBy: [{ detectedAt: 'asc' }, { id: 'asc' }],
    });
    if (warning) {
      throw new ConflictException(
        `Warning acknowledgement required — ${warning.title}: ${warning.safeMessage}`,
      );
    }
  }

  private async sync(query: PayrollExceptionQueryDto, actor: AuthContext) {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const period = getPayrollPeriod(year, month);
    const selectedRun = await this.prisma.payrollRun.findFirst({
      where: query.payrollRunId
        ? { id: query.payrollRunId, tenantId: actor.tenantId }
        : { tenantId: actor.tenantId, periodYear: year, periodMonth: month },
      select: { id: true, periodStart: true, periodEnd: true, status: true },
      orderBy: query.payrollRunId ? undefined : { createdAt: 'desc' },
    });
    if (query.payrollRunId && !selectedRun) {
      throw new NotFoundException('Payroll run not found in this tenant');
    }

    const runId = selectedRun?.id ?? null;
    const start = selectedRun?.periodStart ?? period.startsOn;
    const end = selectedRun?.periodEnd ?? period.endsOn;
    const [
      staff,
      contracts,
      structures,
      lines,
      attendance,
      mapping,
      fiscalPeriod,
    ] = await Promise.all([
      this.prisma.staff.findMany({
        where: {
          tenantId: actor.tenantId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
        },
        select: {
          id: true,
          employeeId: true,
          panNumber: true,
          bankAccount: true,
        },
        orderBy: { id: 'asc' },
        take: 5000,
      }),
      this.prisma.staffContract.findMany({
        where: {
          tenantId: actor.tenantId,
          status: 'ACTIVE',
          startDate: { lte: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }],
        },
        select: { id: true, staffId: true },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        take: 5000,
      }),
      this.prisma.salaryStructure.findMany({
        where: {
          tenantId: actor.tenantId,
          status: SalaryStructureStatus.ACTIVE,
          effectiveFrom: { lte: end },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
        },
        select: {
          id: true,
          staffId: true,
          paymentMethod: true,
          bankAccount: true,
          tdsEnabled: true,
        },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
        take: 5000,
      }),
      runId
        ? this.prisma.payrollLine.findMany({
            where: { tenantId: actor.tenantId, payrollRunId: runId },
            select: {
              staffId: true,
              contractId: true,
              workingDays: true,
              attendanceDays: true,
              grossSalary: true,
              netSalary: true,
              tds: true,
              staff: {
                select: {
                  status: true,
                  panNumber: true,
                  bankAccount: true,
                },
              },
              salaryStructure: {
                select: {
                  paymentMethod: true,
                  bankAccount: true,
                },
              },
            },
            orderBy: { staffId: 'asc' },
            take: 5000,
          })
        : Promise.resolve<ReadinessLine[]>([]),
      this.prisma.staffAttendance.groupBy({
        by: ['staffId'],
        where: {
          tenantId: actor.tenantId,
          attendanceDate: { gte: start, lte: end },
        },
        _count: { _all: true },
        orderBy: { staffId: 'asc' },
        take: 5000,
      }),
      runId
        ? this.prisma.accountingSourceMapping.findFirst({
            where: {
              tenantId: actor.tenantId,
              sourceModule: 'PAYROLL',
              sourceType: 'PAYROLL_RUN',
              postingType: 'APPROVAL',
              isActive: true,
              effectiveFrom: { lte: end },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
              debitAccount: { tenantId: actor.tenantId, isActive: true },
              creditAccount: { tenantId: actor.tenantId, isActive: true },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      runId
        ? this.prisma.fiscalPeriod.findFirst({
            where: {
              tenantId: actor.tenantId,
              startDate: { lte: end },
              endDate: { gte: end },
            },
            select: { id: true, status: true },
          })
        : Promise.resolve(null),
    ]);

    const candidates: Candidate[] = [];
    const contractStaff = new Set(contracts.map((item) => item.staffId));
    const structureByStaff = new Map(
      structures.map((item) => [item.staffId, item]),
    );
    const lineStaff = new Set(lines.map((item) => item.staffId));
    const attendanceStaff = new Set(attendance.map((item) => item.staffId));

    for (const member of staff) {
      const structure = structureByStaff.get(member.id);
      const includedInRun = runId ? lineStaff.has(member.id) : true;
      if (!contractStaff.has(member.id)) {
        candidates.push(
          candidate(year, month, runId, member.id, {
            code: PayrollExceptionCode.MISSING_ACTIVE_CONTRACT,
            severity: includedInRun
              ? PayrollExceptionSeverity.WARNING
              : PayrollExceptionSeverity.INFO,
            title: 'Active contract not found',
            safeMessage:
              'This staff member has no active contract covering the payroll period.',
            resolutionRoute: `/dashboard/hr/staff/${member.id}`,
            blockedActions: [],
          }),
        );
      }
      if (!structure) {
        candidates.push(
          candidate(year, month, runId, member.id, {
            code: PayrollExceptionCode.MISSING_SALARY_STRUCTURE,
            severity: includedInRun
              ? PayrollExceptionSeverity.WARNING
              : PayrollExceptionSeverity.INFO,
            title: 'Salary structure not configured',
            safeMessage:
              'Payroll will use the effective contract values until an active salary structure is configured.',
            resolutionRoute: '/dashboard/payroll/salary-structures',
            blockedActions: includedInRun ? ['SUBMIT_REVIEW'] : [],
          }),
        );
      } else if (
        structure.paymentMethod === PaymentMethod.BANK &&
        !structure.bankAccount?.trim() &&
        !member.bankAccount?.trim()
      ) {
        candidates.push(
          candidate(year, month, runId, member.id, {
            code: PayrollExceptionCode.MISSING_BANK_ACCOUNT,
            severity: includedInRun
              ? PayrollExceptionSeverity.WARNING
              : PayrollExceptionSeverity.INFO,
            title: 'Bank payment details missing',
            safeMessage:
              'Bank payment is selected but no bank account is configured for this staff member.',
            resolutionRoute: `/dashboard/hr/staff/${member.id}`,
            blockedActions: includedInRun ? ['MARK_PAID'] : [],
          }),
        );
      }
      if (!attendanceStaff.has(member.id)) {
        candidates.push(
          candidate(year, month, runId, member.id, {
            code: PayrollExceptionCode.MISSING_ATTENDANCE,
            severity: includedInRun
              ? PayrollExceptionSeverity.WARNING
              : PayrollExceptionSeverity.INFO,
            title: 'Attendance not recorded',
            safeMessage:
              'No attendance records were found for this staff member in the payroll period.',
            resolutionRoute: '/dashboard/hr/attendance',
            blockedActions: includedInRun ? ['SUBMIT_REVIEW'] : [],
          }),
        );
      }
    }

    for (const line of lines) {
      if (!line.contractId && !line.salaryStructure) {
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.MISSING_ACTIVE_CONTRACT,
            severity: PayrollExceptionSeverity.BLOCKING,
            title:
              'Payroll line requires an active contract or salary structure',
            safeMessage:
              'This included payroll line is not linked to a contract or an active salary structure covering the payroll period.',
            resolutionRoute: `/dashboard/hr/staff/${line.staffId}`,
            blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST'],
          }),
        );
      }
      if (
        line.staff.status !== StaffStatus.ACTIVE &&
        line.staff.status !== StaffStatus.ON_LEAVE
      ) {
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.INACTIVE_STAFF_INCLUDED,
            severity: PayrollExceptionSeverity.BLOCKING,
            title: 'Inactive staff included',
            safeMessage:
              'A payroll line belongs to staff who are no longer active for payroll.',
            resolutionRoute: `/dashboard/payroll/runs`,
            blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST'],
          }),
        );
      }
      if (line.workingDays <= 0 || line.attendanceDays > line.workingDays) {
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.INVALID_WORKING_DAYS,
            severity: PayrollExceptionSeverity.BLOCKING,
            title: 'Working days need correction',
            safeMessage:
              'The payroll line has an invalid working-day or attendance-day value.',
            resolutionRoute: `/dashboard/payroll/runs`,
            blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST'],
          }),
        );
      }
      if (line.netSalary.isNegative()) {
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.NEGATIVE_NET_PAY,
            severity: PayrollExceptionSeverity.BLOCKING,
            title: 'Negative net pay',
            safeMessage: 'This payroll line has a negative net-pay amount.',
            resolutionRoute: `/dashboard/payroll/runs`,
            blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST'],
          }),
        );
      }
      if (line.grossSalary.isZero()) {
        // A fully-unpaid line (e.g. no attendance/leave recorded yet for a
        // brand-new period) produces a $0 gross salary. That line's M11
        // accrual journal entry always includes an unconditional gross-
        // salary debit, which the accounting posting boundary correctly
        // rejects ("a journal line must have either a debit or a credit
        // amount"). Block earlier, at readiness, instead of letting HR
        // discover this only after approving the run and attempting to post.
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.ZERO_GROSS_PAY,
            severity: PayrollExceptionSeverity.BLOCKING,
            title: 'Zero gross pay',
            safeMessage:
              'This payroll line has zero gross pay, usually because no attendance or approved leave is recorded yet for this period. It will fail when posted to accounting.',
            resolutionRoute: `/dashboard/hr/attendance`,
            blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST'],
          }),
        );
      }
      if (line.tds.isPositive() && !line.staff.panNumber?.trim()) {
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.MISSING_PAN,
            severity: PayrollExceptionSeverity.WARNING,
            title: 'PAN not recorded',
            safeMessage:
              'This payroll line has a tax deduction but the staff PAN is not recorded.',
            resolutionRoute: `/dashboard/hr/staff/${line.staffId}`,
            blockedActions: ['APPROVE'],
          }),
        );
      }
      if (
        line.salaryStructure?.paymentMethod === PaymentMethod.BANK &&
        !line.salaryStructure.bankAccount?.trim() &&
        !line.staff.bankAccount?.trim()
      ) {
        candidates.push(
          candidate(year, month, runId, line.staffId, {
            code: PayrollExceptionCode.MISSING_BANK_ACCOUNT,
            severity: PayrollExceptionSeverity.WARNING,
            title: 'Bank payment details missing',
            safeMessage:
              'Bank payment is selected but no bank account is configured for this payroll line.',
            resolutionRoute: `/dashboard/hr/staff/${line.staffId}`,
            blockedActions: ['MARK_PAID'],
          }),
        );
      }
    }

    if (
      runId &&
      selectedRun?.status === PayrollRunStatus.APPROVED &&
      !mapping
    ) {
      candidates.push(
        candidate(year, month, runId, null, {
          code: PayrollExceptionCode.MISSING_ACCOUNT_MAPPING,
          severity: PayrollExceptionSeverity.BLOCKING,
          title: 'Payroll account mapping required',
          safeMessage:
            'No active payroll source mapping covers this payroll posting date.',
          resolutionRoute: '/dashboard/accounting/source-mappings',
          blockedActions: ['POST'],
        }),
      );
    }
    if (
      runId &&
      selectedRun?.status === PayrollRunStatus.APPROVED &&
      fiscalPeriod &&
      fiscalPeriod.status !== AccountingPeriodStatus.OPEN
    ) {
      candidates.push(
        candidate(year, month, runId, null, {
          code: PayrollExceptionCode.FISCAL_PERIOD_LOCKED,
          severity: PayrollExceptionSeverity.BLOCKING,
          title: 'Fiscal period is not open',
          safeMessage:
            'The fiscal period covering this payroll date is locked or closed for posting.',
          resolutionRoute: '/dashboard/accounting/fiscal-periods',
          blockedActions: ['POST'],
        }),
      );
    }

    await this.persistCandidates(actor.tenantId, year, month, runId, [
      ...new Map(candidates.map((item) => [item.identityKey, item])).values(),
    ]);

    return {
      year,
      month,
      runId,
      staffConsidered: staff.length,
      staffExcluded: runId
        ? staff.filter((member) => !lineStaff.has(member.id)).length
        : staff.filter(
            (member) =>
              !contractStaff.has(member.id) && !structureByStaff.has(member.id),
          ).length,
    };
  }

  private async persistCandidates(
    tenantId: string,
    year: number,
    month: number,
    runId: string | null,
    candidates: Candidate[],
  ) {
    const now = new Date();
    const existing = await this.prisma.payrollException.findMany({
      where: {
        tenantId,
        periodYear: year,
        periodMonth: month,
        payrollRunId: runId,
      },
    });
    const byKey = new Map(existing.map((item) => [item.identityKey, item]));
    const detectedKeys = candidates.map((item) => item.identityKey);

    await this.prisma.$transaction(async (tx) => {
      for (const item of candidates) {
        const previous = byKey.get(item.identityKey);
        const reopen = previous?.status === PayrollExceptionStatus.RESOLVED;
        if (previous) {
          await tx.payrollException.update({
            where: { id: previous.id },
            data: {
              payrollRunId: item.payrollRunId,
              staffId: item.staffId,
              code: item.code,
              severity: item.severity,
              title: item.title,
              safeMessage: item.safeMessage,
              resolutionRoute: item.resolutionRoute,
              blockedActions: item.blockedActions,
              lastDetectedAt: now,
              ...(reopen
                ? {
                    status: PayrollExceptionStatus.OPEN,
                    detectedAt: now,
                    acknowledgedAt: null,
                    acknowledgedById: null,
                    acknowledgementReason: null,
                    resolvedAt: null,
                    resolutionReason: null,
                  }
                : {}),
            },
          });
        } else {
          await tx.payrollException.create({
            data: {
              tenantId,
              periodYear: year,
              periodMonth: month,
              ...item,
            },
          });
        }
      }

      await tx.payrollException.updateMany({
        where: {
          tenantId,
          periodYear: year,
          periodMonth: month,
          payrollRunId: runId,
          status: { in: [...ACTIVE_EXCEPTION_STATUSES] },
          ...(detectedKeys.length
            ? { identityKey: { notIn: detectedKeys } }
            : {}),
        },
        data: {
          status: PayrollExceptionStatus.RESOLVED,
          resolvedAt: now,
          resolutionReason: 'Source condition is no longer detected.',
        },
      });
    });
  }

  private async buildSummary(
    tenantId: string,
    year: number,
    month: number,
    runId: string | null,
    staffConsidered: number,
    staffExcluded: number,
  ): Promise<PayrollReadinessSummary> {
    const [run, active, last] = await Promise.all([
      runId
        ? this.prisma.payrollRun.findFirst({
            where: { id: runId, tenantId },
            select: {
              id: true,
              status: true,
              _count: { select: { lines: true } },
            },
          })
        : Promise.resolve(null),
      this.prisma.payrollException.groupBy({
        by: ['severity', 'status', 'code'],
        where: {
          tenantId,
          periodYear: year,
          periodMonth: month,
          payrollRunId: runId,
          status: { in: [...ACTIVE_EXCEPTION_STATUSES] },
        },
        _count: { _all: true },
      }),
      this.prisma.payrollException.findFirst({
        where: {
          tenantId,
          periodYear: year,
          periodMonth: month,
          payrollRunId: runId,
        },
        select: { lastDetectedAt: true },
        orderBy: { lastDetectedAt: 'desc' },
      }),
    ]);
    const blockingExceptionCount = countSeverity(
      active,
      PayrollExceptionSeverity.BLOCKING,
    );
    const warningCount = countSeverity(
      active,
      PayrollExceptionSeverity.WARNING,
    );
    const informationalCount = countSeverity(
      active,
      PayrollExceptionSeverity.INFO,
    );
    const openWarningCount = active
      .filter(
        (item) =>
          item.severity === PayrollExceptionSeverity.WARNING &&
          item.status === PayrollExceptionStatus.OPEN,
      )
      .reduce((total, item) => total + item._count._all, 0);
    const exceptionsByCategory = active.reduce<Record<string, number>>(
      (counts, item) => {
        counts[item.code] = (counts[item.code] ?? 0) + item._count._all;
        return counts;
      },
      {},
    );
    const readinessStatus =
      blockingExceptionCount > 0
        ? 'BLOCKED'
        : openWarningCount > 0
          ? 'NEEDS_ACKNOWLEDGEMENT'
          : 'READY';

    return {
      period: { year, month },
      staffConsidered,
      staffExcluded,
      blockingExceptionCount,
      warningCount,
      informationalCount,
      exceptionsByCategory,
      readinessStatus,
      allowedNextAction:
        readinessStatus !== 'READY'
          ? null
          : run
            ? nextActionForStatus(run.status)
            : 'CREATE_DRAFT',
      lastCalculatedAt: (last?.lastDetectedAt ?? new Date()).toISOString(),
      stale: false,
      selectedPayrollRun: run ? { id: run.id, status: run.status } : null,
    };
  }
}

function candidate(
  year: number,
  month: number,
  runId: string | null,
  staffId: string | null,
  input: Omit<Candidate, 'identityKey' | 'payrollRunId' | 'staffId'>,
): Candidate {
  return {
    ...input,
    payrollRunId: runId,
    staffId,
    identityKey: `${year}-${month}:${runId ?? 'period'}:${staffId ?? 'global'}:${input.code}`,
  };
}

function serializeException(exception: {
  id: string;
  payrollRunId: string | null;
  staffId: string | null;
  code: PayrollExceptionCode;
  severity: PayrollExceptionSeverity;
  status: PayrollExceptionStatus;
  title: string;
  safeMessage: string;
  resolutionRoute: string | null;
  blockedActions: string[];
  detectedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  acknowledgementReason: string | null;
  resolutionReason: string | null;
  staff: {
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string | null;
  } | null;
}): PayrollExceptionSummary {
  return {
    id: exception.id,
    payrollRunId: exception.payrollRunId,
    staffId: exception.staffId,
    employeeId: exception.staff?.employeeId ?? null,
    staffName: exception.staff
      ? `${exception.staff.firstName} ${exception.staff.lastName}`.trim()
      : null,
    department: exception.staff?.department ?? null,
    code: exception.code,
    severity: exception.severity,
    status: exception.status,
    title: exception.title,
    safeMessage: exception.safeMessage,
    resolutionRoute: exception.resolutionRoute,
    blockedActions: exception.blockedActions,
    detectedAt: exception.detectedAt.toISOString(),
    acknowledgedAt: exception.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: exception.resolvedAt?.toISOString() ?? null,
    resolutionReason:
      exception.acknowledgementReason ?? exception.resolutionReason,
  };
}

function countSeverity(
  groups: Array<{
    severity: PayrollExceptionSeverity;
    _count: { _all: number };
  }>,
  severity: PayrollExceptionSeverity,
) {
  return groups
    .filter((item) => item.severity === severity)
    .reduce((total, item) => total + item._count._all, 0);
}

function nextActionForStatus(status: PayrollRunStatus): string | null {
  switch (status) {
    case PayrollRunStatus.DRAFT:
    case PayrollRunStatus.GENERATED:
      return 'SUBMIT_REVIEW';
    case PayrollRunStatus.UNDER_REVIEW:
      return 'COMPLETE_REVIEW';
    case PayrollRunStatus.REVIEWED:
      return 'APPROVE';
    case PayrollRunStatus.APPROVED:
      return 'POST';
    case PayrollRunStatus.POSTED:
      return 'MARK_PAID';
    default:
      return null;
  }
}

function getPayrollPeriod(periodYear: number, periodMonth: number) {
  return {
    startsOn: new Date(Date.UTC(periodYear, periodMonth - 1, 1)),
    endsOn: new Date(Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999)),
  };
}
