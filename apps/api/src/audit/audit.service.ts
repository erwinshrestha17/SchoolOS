import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AuditLogInput {
  action: string;
  resource: string;
  tenantId: string;
  userId?: string | null;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput) {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        resourceId: input.resourceId ?? null,
        before: input.before as Prisma.InputJsonValue | undefined,
        after: input.after as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * Query accounting-specific audit trail entries with filtering and pagination.
   * Scoped to accounting-related resources for the accounting audit viewer.
   */
  async queryAccountingAuditTrail(query: {
    tenantId: string;
    resource?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const accountingResources = [
      'journal_entry',
      'chart_account',
      'accounting_period',
      'fiscal_year',
      'fiscal_period',
      'bank_statement',
      'accounting_report',
      'opening_balance',
      'voucher',
    ];

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      tenantId: query.tenantId,
      resource: query.resource ?? { in: accountingResources },
    };

    if (query.action) {
      where.action = query.action;
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {
        ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
        ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }
}
