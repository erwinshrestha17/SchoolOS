import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformTenantUsage,
} from '@schoolos/core';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listTenants(): Promise<PlatformTenantSummary[]> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const tenantSummaries = await Promise.all(
      tenants.map(async (tenant) => {
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
          updatedAt: tenant.createdAt.toISOString(), // Placeholder if updatedAt missing in Tenant model
          studentCount,
          staffCount,
        };
      }),
    );

    return tenantSummaries;
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
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive },
    });

    await this.auditService.record({
      action: isActive ? 'tenant_activated' : 'tenant_suspended',
      resource: 'tenants',
      resourceId: tenantId,
      tenantId: 'platform', // Platform-wide audit
      userId,
      before: { isActive: tenant.isActive },
      after: { isActive },
    });
  }

  async getTenantUsage(tenantId: string): Promise<PlatformTenantUsage> {
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
}
