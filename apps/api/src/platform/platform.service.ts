import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PaginatedResponse,
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformTenantUsage,
} from '@schoolos/core';
import { ListPlatformTenantsDto } from './dto/list-platform-tenants.dto';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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

    return { items, total };
  }

  async getTenantDetail(tenantId: string): Promise<PlatformTenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const [studentCount, staffCount, userCount] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);

    const lastAudit = await this.prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      panNumber: tenant.panNumber,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.createdAt.toISOString(),
      studentCount,
      staffCount,
      usage: {
        tenantId,
        studentCount,
        staffCount,
        userCount,
        lastActivityAt: lastAudit?.createdAt.toISOString() || null,
      },
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
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const [studentCount, staffCount, userCount] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);

    const lastAudit = await this.prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      tenantId,
      studentCount,
      staffCount,
      userCount,
      lastActivityAt: lastAudit?.createdAt.toISOString() || null,
    };
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
