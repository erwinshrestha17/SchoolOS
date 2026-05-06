import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PaginatedResponse,
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformTenantUsage,
  PlatformAuditLog,
} from '@schoolos/core';
import { ListPlatformTenantsDto } from './dto/list-platform-tenants.dto';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly usageService: UsageService,
  ) {}

  async listTenants(): Promise<PlatformTenantSummary[]> {
    const page = await this.listTenantsPage({ page: 1, limit: 100 });
    return page.items;
  }

  async listTenantsPage(
    query: ListPlatformTenantsDto = {},
  ): Promise<PaginatedResponse<PlatformTenantSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;
    const where = this.buildTenantWhere(query);

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const items = await Promise.all(
      tenants.map((tenant) => this.toTenantSummary(tenant)),
    );

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async getTenantDetail(tenantId: string): Promise<PlatformTenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const usage = await this.usageService.getTenantUsageSummary(tenantId);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      panNumber: tenant.panNumber,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.createdAt.toISOString(),
      studentCount: usage.studentCount,
      staffCount: usage.staffCount,
      usage,
    };
  }

  async updateTenantStatus(
    tenantId: string,
    isActive: boolean,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (tenant.isActive === isActive) {
      await this.auditService.record({
        action: 'tenant_status_noop',
        resource: 'tenants',
        resourceId: tenantId,
        tenantId: 'platform',
        userId,
        before: { isActive: tenant.isActive },
        after: { isActive, reason: reason ?? null },
      });
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive },
    });

    await this.auditService.record({
      action: isActive ? 'tenant_activated' : 'tenant_suspended',
      resource: 'tenants',
      resourceId: tenantId,
      tenantId: 'platform',
      userId,
      before: { isActive: tenant.isActive },
      after: { isActive, reason: reason ?? null },
    });
  }

  async getTenantUsage(tenantId: string): Promise<PlatformTenantUsage> {
    return this.usageService.getTenantUsageSummary(tenantId);
  }

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    tenantId?: string;
    action?: string;
    userId?: string;
  }): Promise<PaginatedResponse<PlatformAuditLog>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items: PlatformAuditLog[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      tenantId: log.tenantId,
      userId: log.userId,
      before: log.before,
      after: log.after,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
      user: log.user,
    }));

    return { items, total, page, limit, hasNextPage: page * limit < total };
  }

  private buildTenantWhere(query: ListPlatformTenantsDto) {
    const where: Prisma.TenantWhereInput = {};

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.plan?.trim()) {
      where.plan = query.plan.trim();
    }

    if (query.status === 'active') {
      where.isActive = true;
    }

    if (query.status === 'suspended') {
      where.isActive = false;
    }

    return where;
  }

  private async toTenantSummary(tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
    createdAt: Date;
  }): Promise<PlatformTenantSummary> {
    const [studentCount, staffCount] = await Promise.all([
      this.prisma.student.count({ where: { tenantId: tenant.id } }),
      this.prisma.staff.count({ where: { tenantId: tenant.id } }),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.createdAt.toISOString(),
      studentCount,
      staffCount,
    };
  }
}
