import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '@schoolos/core';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DynamicRecord = Record<string, unknown>;
type DynamicWhere = Record<string, unknown>;
interface DynamicDelegate {
  findMany(args?: unknown): Promise<DynamicRecord[]>;
  count(args?: unknown): Promise<number>;
}

export interface ListReportExportsQuery {
  tenantId?: string;
  module?: string;
  reportType?: string;
  status?: string;
  requestedBy?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class PlatformReportExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReportExportsPage(
    query: ListReportExportsQuery,
  ): Promise<PaginatedResponse<DynamicRecord>> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);
    const delegate = this.delegate('reportExport');

    if (!delegate) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        hasNextPage: false,
      };
    }

    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      delegate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async listReportExports(tenantId?: string) {
    const page = await this.listReportExportsPage({
      tenantId,
      page: 1,
      limit: 100,
    });
    return page.items;
  }

  async recordReportExport(input: {
    tenantId?: string | null;
    scope: string;
    reportKey: string;
    format: string;
    filters: Prisma.InputJsonValue;
    requestedBy?: string | null;
    status?: string;
  }) {
    const delegate = this.delegate('reportExport') as
      | (DynamicDelegate & {
          create(args?: unknown): Promise<DynamicRecord>;
        })
      | null;
    if (!delegate) return null;
    return delegate.create({
      data: {
        tenantId: input.tenantId,
        scope: input.scope,
        reportKey: input.reportKey,
        format: input.format,
        filters: input.filters,
        requestedBy: input.requestedBy,
        status: input.status ?? 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  private buildWhere(query: ListReportExportsQuery): DynamicWhere | undefined {
    const where: DynamicWhere = {};

    if (query.tenantId?.trim()) {
      where.tenantId = query.tenantId.trim();
    }

    if (query.module?.trim()) {
      where.scope = query.module.trim();
    }

    if (query.reportType?.trim()) {
      where.reportKey = query.reportType.trim();
    }

    if (query.status?.trim()) {
      where.status = query.status.trim();
    }

    if (query.requestedBy?.trim()) {
      where.requestedBy = query.requestedBy.trim();
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private delegate(name: string): DynamicDelegate | null {
    return (
      (this.prisma as unknown as Record<string, DynamicDelegate | undefined>)[
        name
      ] ?? null
    );
  }
}
