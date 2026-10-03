import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StaffStatutoryMembership } from '@prisma/client';
import type { StatutoryMembershipView } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateStatutoryMembershipDto,
  EndStatutoryMembershipDto,
} from './dto/statutory-membership.dto';

const READ = 'hr:tax:read';
const WRITE = 'hr:tax:write';

function dateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function isoDay(value: Date): string;
function isoDay(value: Date | null): string | null;
function isoDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function serializeStatutoryMembership(
  row: StaffStatutoryMembership,
): StatutoryMembershipView {
  return {
    id: row.id,
    staffId: row.staffId,
    scheme: row.scheme,
    memberIdentifier: row.memberIdentifier,
    effectiveFrom: isoDay(row.effectiveFrom),
    effectiveTo: isoDay(row.effectiveTo),
    endReason: row.endReason,
    endedById: row.endedById,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Maps the database guards of migration 7.8 to stable 409s. */
export function translateMembershipError(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('StaffStatutoryMembership_one_scheme_at_a_time')) {
    throw new ConflictException({
      code: 'STATUTORY_MEMBERSHIP_OVERLAP',
      message:
        'This staff member already belongs to a statutory scheme during those dates. End the existing membership first.',
    });
  }
  if (message.includes('STATUTORY_MEMBERSHIP_PAYROLL_LOCKED')) {
    throw new ConflictException({
      code: 'STATUTORY_MEMBERSHIP_PAYROLL_LOCKED',
      message:
        'An approved payroll run already covers these dates for this staff member, so membership cannot change underneath it.',
    });
  }
  if (message.includes('STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE')) {
    throw new ConflictException({
      code: 'STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE',
      message:
        'Membership history cannot be edited. End the membership and record a new one.',
    });
  }
  if (isFinancialTransactionConflict(error)) {
    throw new ConflictException(
      'Membership changed concurrently. Reload and retry.',
    );
  }
  throw error;
}

/**
 * Phase 7.8 — effective-dated SSF/PF membership and identifiers per staff.
 * Everything here is protected under hr:tax:*: an HR manager without it can
 * neither read nor change a member number.
 */
@Injectable()
export class StatutoryMembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    staffId: string,
    actor: AuthContext,
  ): Promise<StatutoryMembershipView[]> {
    requireDomainPermission(actor, READ);
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    const rows = await this.prisma.staffStatutoryMembership.findMany({
      where: { tenantId: actor.tenantId, staffId },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return rows.map(serializeStatutoryMembership);
  }

  async create(
    staffId: string,
    dto: CreateStatutoryMembershipDto,
    actor: AuthContext,
  ): Promise<StatutoryMembershipView> {
    requireDomainPermission(actor, WRITE);
    const effectiveFrom = dateOnly(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? dateOnly(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        WRITE,
        [],
        async (tx) => {
          const staff = await tx.staff.findFirst({
            where: { id: staffId, tenantId: actor.tenantId },
            select: { id: true },
          });
          if (!staff) throw new NotFoundException('Staff member not found');
          const created = await tx.staffStatutoryMembership.create({
            data: {
              tenantId: actor.tenantId,
              staffId,
              scheme: dto.scheme,
              memberIdentifier: dto.memberIdentifier ?? null,
              effectiveFrom,
              effectiveTo,
              createdById: actor.userId,
            },
          });
          await this.auditService.record(
            {
              action: 'create',
              resource: 'staff_statutory_membership',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: created.id,
              // The identifier is deliberately not copied into the audit log.
              after: {
                staffId,
                scheme: created.scheme,
                effectiveFrom: isoDay(created.effectiveFrom),
                effectiveTo: isoDay(created.effectiveTo),
                hasIdentifier: created.memberIdentifier !== null,
              },
            },
            tx,
          );
          return serializeStatutoryMembership(created);
        },
      );
    } catch (error) {
      return translateMembershipError(error);
    }
  }

  async end(
    id: string,
    dto: EndStatutoryMembershipDto,
    actor: AuthContext,
  ): Promise<StatutoryMembershipView> {
    requireDomainPermission(actor, WRITE);
    const effectiveTo = dateOnly(dto.effectiveTo);
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        WRITE,
        [],
        async (tx) => {
          const existing = await tx.staffStatutoryMembership.findFirst({
            where: { id, tenantId: actor.tenantId },
          });
          if (!existing) throw new NotFoundException('Membership not found');
          if (existing.effectiveTo !== null) {
            throw new ConflictException('This membership has already ended');
          }
          if (effectiveTo <= existing.effectiveFrom) {
            throw new BadRequestException(
              'effectiveTo must be after the membership start',
            );
          }
          const claimed = await tx.staffStatutoryMembership.updateMany({
            where: { id, tenantId: actor.tenantId, effectiveTo: null },
            data: {
              effectiveTo,
              endedById: actor.userId,
              endReason: dto.reason,
            },
          });
          if (claimed.count !== 1) {
            throw new ConflictException('This membership has already ended');
          }
          const ended = await tx.staffStatutoryMembership.findFirstOrThrow({
            where: { id, tenantId: actor.tenantId },
          });
          await this.auditService.record(
            {
              action: 'end',
              resource: 'staff_statutory_membership',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: id,
              before: { effectiveTo: null },
              after: {
                effectiveTo: isoDay(ended.effectiveTo),
                reason: dto.reason,
              },
            },
            tx,
          );
          return serializeStatutoryMembership(ended);
        },
      );
    } catch (error) {
      return translateMembershipError(error);
    }
  }
}
