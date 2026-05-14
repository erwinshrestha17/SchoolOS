import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformTenantUsage } from '@schoolos/core';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

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

  async verifyLimit(tenantId: string, usageKey: string, currentCount: number) {
    return this.plansService.validateLimit(tenantId, usageKey, currentCount);
  }

  async getCurrentUsageCount(
    tenantId: string,
    usageKey: string,
  ): Promise<number> {
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    switch (usageKey) {
      case 'students.count':
        return this.prisma.student.count({ where: { tenantId } });
      case 'staff.count':
        return this.prisma.staff.count({
          where: { tenantId, status: 'ACTIVE' },
        });
      case 'storage.bytes':
        const storage = await this.prisma.fileAsset.aggregate({
          where: { tenantId, softDeletedAt: null },
          _sum: { sizeBytes: true },
        });
        return Number(storage._sum.sizeBytes || 0);
      default:
        // Periodic counters from UsageCounter table
        const counter = await this.prisma.usageCounter.findUnique({
          where: {
            tenantId_usageKey_period_periodStart: {
              tenantId,
              usageKey,
              period: 'MONTHLY',
              periodStart,
            },
          },
        });
        return counter?.value || 0;
    }
  }

  async checkLimit(tenantId: string, usageKey: string, incrementBy = 0) {
    const current = await this.getCurrentUsageCount(tenantId, usageKey);
    await this.plansService.validateLimit(
      tenantId,
      usageKey,
      current + incrementBy,
    );
  }

  async incrementUsage(tenantId: string, usageKey: string, amount = 1) {
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    await this.prisma.usageCounter.upsert({
      where: {
        tenantId_usageKey_period_periodStart: {
          tenantId,
          usageKey,
          period: 'MONTHLY',
          periodStart,
        },
      },
      update: { value: { increment: amount } },
      create: {
        tenantId,
        usageKey,
        period: 'MONTHLY',
        periodStart,
        value: amount,
      },
    });
  }
}
