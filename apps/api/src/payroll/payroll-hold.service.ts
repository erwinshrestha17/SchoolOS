import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PayrollHoldSummary } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import {
  requireDomainPermission,
  requireIndependentActor,
} from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePayrollHoldDto,
  ReleasePayrollHoldDto,
} from './dto/payroll-hold.dto';

const holdSelect = {
  id: true,
  payrollRunId: true,
  staffId: true,
  status: true,
  reason: true,
  createdAt: true,
  createdById: true,
  releasedAt: true,
  releasedById: true,
  releaseReason: true,
  staff: { select: { firstName: true, lastName: true, employeeId: true } },
} satisfies Prisma.PayrollHoldSelect;

type HoldRow = Prisma.PayrollHoldGetPayload<{ select: typeof holdSelect }>;

/**
 * Phase 7.9 — payment holds.
 *
 * A hold withholds the *payment* of one staff member in one run (bank advice
 * and mark-paid). It never changes the calculation, the approval or the
 * accounting; it is reason-bound, append-only (released, never deleted) and the
 * person releasing it must differ from the person who placed it. Every rule is
 * also enforced by the database (see the 7.9 migration), so a direct write
 * cannot bypass it.
 */
@Injectable()
export class PayrollHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(runId: string, actor: AuthContext): Promise<PayrollHoldSummary[]> {
    requireDomainPermission(actor, 'payroll:run:read');
    await this.requireRun(runId, actor);
    const rows = await this.prisma.payrollHold.findMany({
      where: { tenantId: actor.tenantId, payrollRunId: runId },
      select: holdSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 1000,
    });
    return rows.map(serializeHold);
  }

  async create(
    runId: string,
    dto: CreatePayrollHoldDto,
    actor: AuthContext,
  ): Promise<PayrollHoldSummary> {
    requireDomainPermission(actor, 'payroll:hold:create');
    await this.requireRun(runId, actor);
    const line = await this.prisma.payrollLine.findFirst({
      where: {
        tenantId: actor.tenantId,
        payrollRunId: runId,
        staffId: dto.staffId,
      },
      select: { id: true },
    });
    if (!line)
      throw new NotFoundException(
        'Staff member has no line in this payroll run',
      );

    try {
      const created = await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        'payroll:hold:create',
        [],
        async (tx) => {
          const hold = await tx.payrollHold.create({
            data: {
              tenantId: actor.tenantId,
              payrollRunId: runId,
              staffId: dto.staffId,
              reason: dto.reason,
              createdById: actor.userId,
            },
            select: holdSelect,
          });
          await this.auditService.record(
            {
              action: 'create',
              resource: 'payroll_hold',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: hold.id,
              after: {
                payrollRunId: runId,
                staffId: dto.staffId,
                status: hold.status,
                reason: hold.reason,
              },
            },
            tx,
          );
          return hold;
        },
      );
      return serializeHold(created);
    } catch (error) {
      throw translateHoldError(error);
    }
  }

  async release(
    runId: string,
    holdId: string,
    dto: ReleasePayrollHoldDto,
    actor: AuthContext,
  ): Promise<PayrollHoldSummary> {
    requireDomainPermission(actor, 'payroll:hold:release');
    const hold = await this.prisma.payrollHold.findFirst({
      where: { id: holdId, payrollRunId: runId, tenantId: actor.tenantId },
      select: holdSelect,
    });
    if (!hold) throw new NotFoundException('Payroll hold not found');
    if (hold.status !== 'ACTIVE')
      throw new ConflictException({
        code: 'PAYROLL_HOLD_NOT_ACTIVE',
        message: 'This hold has already been released',
      });
    requireIndependentActor(actor, [hold.createdById]);

    try {
      const released = await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        'payroll:hold:release',
        [],
        async (tx) => {
          const claimed = await tx.payrollHold.updateMany({
            where: {
              id: hold.id,
              tenantId: actor.tenantId,
              status: 'ACTIVE',
            },
            data: {
              status: 'RELEASED',
              releasedById: actor.userId,
              releasedAt: new Date(),
              releaseReason: dto.reason,
            },
          });
          if (claimed.count !== 1)
            throw new ConflictException({
              code: 'PAYROLL_HOLD_NOT_ACTIVE',
              message: 'This hold has already been released',
            });
          const row = await tx.payrollHold.findFirstOrThrow({
            where: { id: hold.id, tenantId: actor.tenantId },
            select: holdSelect,
          });
          await this.auditService.record(
            {
              action: 'release',
              resource: 'payroll_hold',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: hold.id,
              before: { status: 'ACTIVE', createdById: hold.createdById },
              after: {
                payrollRunId: runId,
                staffId: hold.staffId,
                status: 'RELEASED',
                releaseReason: dto.reason,
              },
            },
            tx,
          );
          return row;
        },
      );
      return serializeHold(released);
    } catch (error) {
      throw translateHoldError(error);
    }
  }

  private async requireRun(runId: string, actor: AuthContext) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!run)
      throw new NotFoundException('Payroll run not found in this tenant');
    return run;
  }
}

function serializeHold(row: HoldRow): PayrollHoldSummary {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    staffId: row.staffId,
    staffName: `${row.staff.firstName} ${row.staff.lastName}`.trim() || null,
    employeeId: row.staff.employeeId,
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
    releasedAt: row.releasedAt?.toISOString() ?? null,
    releasedById: row.releasedById,
    releaseReason: row.releaseReason,
  };
}

function translateHoldError(error: unknown): unknown {
  if (error instanceof ConflictException) return error;
  const message = error instanceof Error ? error.message : '';
  if (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002') ||
    message.includes('PayrollHold_one_active')
  )
    return new ConflictException({
      code: 'PAYROLL_HOLD_ALREADY_ACTIVE',
      message: 'This staff member already has an active hold in this run',
    });
  if (message.includes('PAYROLL_HOLD_NOT_ALLOWED'))
    return new ConflictException({
      code: 'PAYROLL_HOLD_NOT_ALLOWED',
      message:
        'A hold can only be placed on a staff line of a generated, approved or posted run that is not yet paid',
    });
  if (message.includes('PayrollHold_independent_release'))
    return new ConflictException({
      code: 'SELF_APPROVAL_PROHIBITED',
      message: 'A different authorized user must release this hold',
    });
  if (message.includes('PAYROLL_HOLD_TENANT_MISMATCH'))
    return new NotFoundException('Payroll hold not found');
  return error;
}
