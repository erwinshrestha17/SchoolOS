import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformTenantUsage } from '@schoolos/core';
import { PlansService } from '../plans/plans.service';
import { RedisService } from '../redis/redis.service';

/** Redis key holding un-flushed counter deltas, as a hash of counter -> delta. */
const PENDING_USAGE_KEY = 'usage:pending';

function counterField(
  tenantId: string,
  usageKey: string,
  periodStart: Date,
): string {
  return `${tenantId}|${usageKey}|MONTHLY|${periodStart.toISOString()}`;
}

/** First instant of the current monthly counting period, in UTC. */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function parseCounterField(field: string) {
  const [tenantId, usageKey, period, periodStartIso] = field.split('|');
  if (!tenantId || !usageKey || !period || !periodStartIso) return null;
  return { tenantId, usageKey, period, periodStart: new Date(periodStartIso) };
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly redisService: RedisService,
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
      default: {
        // Periodic counters: persisted value plus any delta still buffered in
        // Redis, so limit checks stay accurate between flushes.
        const [counter, pending] = await Promise.all([
          this.prisma.usageCounter.findUnique({
            where: {
              tenantId_usageKey_period_periodStart: {
                tenantId,
                usageKey,
                period: 'MONTHLY',
                periodStart,
              },
            },
          }),
          this.pendingDelta(tenantId, usageKey, periodStart),
        ]);
        return (counter?.value || 0) + pending;
      }
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

  /**
   * Accumulate a usage delta.
   *
   * This is called from `UsageInterceptor` on **every** API request. Writing
   * straight to `UsageCounter` made every request — including every read —
   * take a row-level exclusive lock on a single row, because for one tenant
   * `(tenantId, usageKey, MONTHLY, periodStart)` resolves to exactly one row
   * for the whole month. That serialized the entire API behind one lock and
   * turned a read workload into a write workload. See
   * docs/performance/BASELINE_RESULTS.md §7.
   *
   * Deltas now accumulate in a Redis hash (`HINCRBY` — no lock, no WAL) and
   * are flushed to PostgreSQL periodically by {@link flushPendingUsage}.
   * Redis is shared across API replicas, so counting stays correct when
   * requests are spread over several processes.
   *
   * If Redis is unavailable the call falls back to the direct database write
   * so counting degrades in accuracy of *timing* only, never in totals.
   */
  async incrementUsage(tenantId: string, usageKey: string, amount = 1) {
    const periodStart = currentPeriodStart();

    try {
      const client = this.redisService.getClient();
      if (client.status === 'wait') await client.connect();
      await client.hincrby(
        PENDING_USAGE_KEY,
        counterField(tenantId, usageKey, periodStart),
        amount,
      );
      return;
    } catch (error) {
      this.logger.warn(
        `Redis usage accumulation failed, falling back to direct write: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.writeUsageDelta(tenantId, usageKey, periodStart, amount);
  }

  private async writeUsageDelta(
    tenantId: string,
    usageKey: string,
    periodStart: Date,
    amount: number,
  ) {
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

  /**
   * Drain accumulated deltas into `UsageCounter`.
   *
   * Uses `HGETALL` + `DEL` in a MULTI so a concurrent flush on another replica
   * cannot double-count: whichever replica wins the transaction takes the
   * whole batch and the other sees an empty hash. Deltas that arrive between
   * the read and the delete are preserved by Redis (`HINCRBY` recreates the
   * hash), so they are simply picked up by the next flush.
   *
   * If the database write fails the batch is returned to Redis so the counts
   * are not lost.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async flushPendingUsage() {
    let batch: Record<string, string>;

    try {
      const client = this.redisService.getClient();
      if (client.status === 'wait') await client.connect();

      const results = await client
        .multi()
        .hgetall(PENDING_USAGE_KEY)
        .del(PENDING_USAGE_KEY)
        .exec();

      batch = (results?.[0]?.[1] as Record<string, string>) ?? {};
    } catch (error) {
      this.logger.error(
        `Unable to read pending usage from Redis: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    const entries = Object.entries(batch);
    if (entries.length === 0) return;

    for (const [field, rawDelta] of entries) {
      const parsed = parseCounterField(field);
      const delta = Number.parseInt(rawDelta, 10);
      if (!parsed || !Number.isFinite(delta) || delta === 0) continue;

      try {
        await this.writeUsageDelta(
          parsed.tenantId,
          parsed.usageKey,
          parsed.periodStart,
          delta,
        );
      } catch (error) {
        this.logger.error(
          `Failed to flush usage counter ${field}, returning it to Redis: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        try {
          const client = this.redisService.getClient();
          await client.hincrby(PENDING_USAGE_KEY, field, delta);
        } catch {
          this.logger.error(`Lost usage delta for ${field}: ${delta}`);
        }
      }
    }
  }

  /** Un-flushed delta for a counter, so reads stay accurate between flushes. */
  private async pendingDelta(
    tenantId: string,
    usageKey: string,
    periodStart: Date,
  ): Promise<number> {
    try {
      const client = this.redisService.getClient();
      if (client.status === 'wait') await client.connect();
      const raw = await client.hget(
        PENDING_USAGE_KEY,
        counterField(tenantId, usageKey, periodStart),
      );
      const parsed = raw ? Number.parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }
}
