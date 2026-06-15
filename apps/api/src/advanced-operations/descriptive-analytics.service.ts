import { Injectable } from '@nestjs/common';
import {
  AnalyticsRefreshStatus,
  AnalyticsSummaryDomain,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  AnalyticsSummaryQueryDto,
  RefreshAnalyticsSummaryDto,
} from './dto/analytics.dto';

@Injectable()
export class DescriptiveAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listSummaries(actor: AuthContext, query: AnalyticsSummaryQueryDto) {
    return this.prisma.analyticsSummary.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.domain ? { domain: query.domain } : {}),
        ...(query.summaryDate
          ? { summaryDate: startOfDay(new Date(query.summaryDate)) }
          : {}),
      },
      orderBy: [{ summaryDate: 'desc' }, { domain: 'asc' }],
      take: 100,
    });
  }

  async refresh(dto: RefreshAnalyticsSummaryDto, actor: AuthContext) {
    const summaryDate = startOfDay(new Date(dto.summaryDate));
    const idempotencyKey =
      dto.idempotencyKey ?? `${dto.domain}:${summaryDate.toISOString()}`;

    const existingJob = await this.prisma.analyticsRefreshJob.findFirst({
      where: { tenantId: actor.tenantId, idempotencyKey },
    });
    if (existingJob?.status === AnalyticsRefreshStatus.COMPLETED) {
      return this.prisma.analyticsSummary.findFirst({
        where: {
          tenantId: actor.tenantId,
          domain: dto.domain,
          summaryDate,
          scopeType: 'tenant',
          scopeId: actor.tenantId,
        },
      });
    }

    const job =
      existingJob ??
      (await this.prisma.analyticsRefreshJob.create({
        data: {
          tenantId: actor.tenantId,
          domain: dto.domain,
          summaryDate,
          requestedById: actor.userId,
          idempotencyKey,
        },
      }));

    await this.prisma.analyticsRefreshJob.update({
      where: { id: job.id },
      data: { status: AnalyticsRefreshStatus.RUNNING, startedAt: new Date() },
    });

    try {
      const metrics = await this.buildMetrics(
        actor.tenantId,
        dto.domain,
        summaryDate,
      );
      const summary = await this.prisma.analyticsSummary.upsert({
        where: {
          tenantId_domain_summaryDate_scopeType_scopeId: {
            tenantId: actor.tenantId,
            domain: dto.domain,
            summaryDate,
            scopeType: 'tenant',
            scopeId: actor.tenantId,
          },
        },
        update: {
          metrics: metrics as Prisma.InputJsonValue,
          sourceHash: JSON.stringify(metrics),
          generatedAt: new Date(),
        },
        create: {
          tenantId: actor.tenantId,
          domain: dto.domain,
          summaryDate,
          scopeType: 'tenant',
          scopeId: actor.tenantId,
          metrics: metrics as Prisma.InputJsonValue,
          sourceHash: JSON.stringify(metrics),
        },
      });

      await this.prisma.analyticsRefreshJob.update({
        where: { id: job.id },
        data: {
          status: AnalyticsRefreshStatus.COMPLETED,
          completedAt: new Date(),
          errorSummary: null,
        },
      });

      await this.auditService.record({
        action: 'analytics_summary_refreshed',
        resource: 'analytics_summary',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: summary.id,
        after: {
          domain: dto.domain,
          summaryDate: summaryDate.toISOString(),
          metricKeys: Object.keys(metrics),
        },
      });

      return summary;
    } catch (error) {
      await this.prisma.analyticsRefreshJob.update({
        where: { id: job.id },
        data: {
          status: AnalyticsRefreshStatus.FAILED,
          errorSummary:
            error instanceof Error ? error.message : 'Analytics refresh failed',
        },
      });
      throw error;
    }
  }

  private async buildMetrics(
    tenantId: string,
    domain: AnalyticsSummaryDomain,
    summaryDate: Date,
  ) {
    const day = dateRange(summaryDate);
    switch (domain) {
      case AnalyticsSummaryDomain.ATTENDANCE: {
        const [records, sessions, corrections] = await Promise.all([
          this.prisma.attendanceRecord.groupBy({
            by: ['status'],
            where: { tenantId, createdAt: { gte: day.start, lt: day.end } },
            _count: { _all: true },
          }),
          this.prisma.attendanceSession.count({
            where: {
              tenantId,
              attendanceDate: { gte: day.start, lt: day.end },
            },
          }),
          this.prisma.attendanceCorrectionRequest.count({
            where: { tenantId, status: 'PENDING' },
          }),
        ]);
        return {
          sessionsMarked: sessions,
          pendingCorrections: corrections,
          recordsByStatus: Object.fromEntries(
            records.map((row) => [row.status, row._count._all]),
          ),
        };
      }
      case AnalyticsSummaryDomain.FEES: {
        const [invoices, overdue, payments] = await Promise.all([
          this.prisma.invoice.aggregate({
            where: { tenantId, createdAt: { gte: day.start, lt: day.end } },
            _sum: { totalAmount: true },
            _count: { _all: true },
          }),
          this.prisma.invoice.count({
            where: {
              tenantId,
              status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
              dueDate: { lt: day.end },
            },
          }),
          this.prisma.payment.aggregate({
            where: {
              tenantId,
              status: PaymentStatus.SUCCESS,
              paidAt: { gte: day.start, lt: day.end },
            },
            _sum: { amount: true },
            _count: { _all: true },
          }),
        ]);
        return {
          invoiceCount: invoices._count._all,
          invoicedAmount: decimalString(invoices._sum.totalAmount),
          paymentCount: payments._count._all,
          collectedAmount: decimalString(payments._sum.amount),
          overdueInvoiceCount: overdue,
        };
      }
      case AnalyticsSummaryDomain.EXAMS: {
        const [marks, locked, corrections] = await Promise.all([
          this.prisma.markEntry.count({ where: { tenantId } }),
          this.prisma.markEntry.count({ where: { tenantId, isLocked: true } }),
          this.prisma.reportCardCorrectionRequest.count({
            where: { tenantId, status: 'PENDING' },
          }),
        ]);
        return {
          markEntryCount: marks,
          lockedMarkEntryCount: locked,
          pendingCorrectionCount: corrections,
        };
      }
      case AnalyticsSummaryDomain.USAGE: {
        const counters = await this.prisma.usageCounter.findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
        return {
          counters: counters.map((counter) => ({
            usageKey: counter.usageKey,
            period: counter.period,
            value: counter.value,
            periodStart: counter.periodStart.toISOString(),
          })),
        };
      }
      case AnalyticsSummaryDomain.DASHBOARD:
      default: {
        const [
          activeStudents,
          activeStaff,
          pendingApprovals,
          unreadNoticeDeliveries,
          failedExports,
        ] = await Promise.all([
          this.prisma.student.count({
            where: { tenantId, lifecycleStatus: StudentLifecycleStatus.ACTIVE },
          }),
          this.prisma.staff.count({ where: { tenantId, status: 'ACTIVE' } }),
          this.prisma.approvalRequest.count({
            where: { tenantId, status: 'PENDING' },
          }),
          this.prisma.notificationDelivery.count({
            where: {
              tenantId,
              noticeId: { not: null },
              readReceipts: { none: {} },
            },
          }),
          this.prisma.dataExportJob.count({
            where: { tenantId, status: 'FAILED' },
          }),
        ]);
        return {
          activeStudents,
          activeStaff,
          pendingApprovals,
          unreadNoticeRecipients: unreadNoticeDeliveries,
          failedExportJobs: failedExports,
        };
      }
    }
  }
}

function startOfDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function dateRange(date: Date) {
  const start = startOfDay(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function decimalString(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : '0';
}
