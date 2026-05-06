import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformTenantUsage } from '@schoolos/core';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantUsageSummary(tenantId: string): Promise<PlatformTenantUsage> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const [
      studentCount,
      staffCount,
      userCount,
      activeStudents,
      activeStaff,
      storageUsage,
    ] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.staff.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.student.count({
        where: { tenantId, lifecycleStatus: 'ACTIVE' },
      }),
      this.prisma.staff.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.fileAsset.aggregate({
        where: { tenantId, softDeletedAt: null },
        _sum: { sizeBytes: true },
      }),
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
      activeStudents,
      activeStaff,
      storageSizeBytes: Number(storageUsage._sum.sizeBytes || 0),
      lastActivityAt: lastAudit?.createdAt.toISOString() || null,
    };
  }

  async getGlobalUsageStats() {
    const [tenants, students, staff, users, storage] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.student.count({ where: { lifecycleStatus: 'ACTIVE' } }),
      this.prisma.staff.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count(),
      this.prisma.fileAsset.aggregate({
        where: { softDeletedAt: null },
        _sum: { sizeBytes: true },
      }),
    ]);

    return {
      totalTenants: tenants,
      totalActiveStudents: students,
      totalActiveStaff: staff,
      totalUsers: users,
      totalStorageBytes: Number(storage._sum.sizeBytes || 0),
    };
  }
}
