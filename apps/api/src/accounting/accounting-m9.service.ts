import { Injectable } from '@nestjs/common';
import {
  ChartAccountType,
  FiscalYearStatus,
  JournalEntryStatus,
  Prisma,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingSourceMappingService } from './accounting-source-mapping.service';

type NetPositionResultType = 'SURPLUS' | 'DEFICIT' | 'BREAK_EVEN';

@Injectable()
export class AccountingM9Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceMappings: AccountingSourceMappingService,
  ) {}

  health() {
    return {
      module: 'M11 Accounting and Finance',
      status: 'available',
      legacyRoute: true,
    };
  }

  async principalSnapshot(actor: AuthContext) {
    const now = new Date();
    const [fiscalYear, postingQueueCounts, reconciliation] =
      await Promise.all([
        this.prisma.fiscalYear.findFirst({
          where: { tenantId: actor.tenantId, status: FiscalYearStatus.OPEN },
          orderBy: { startDate: 'desc' },
          include: {
            periods: {
              where: { startDate: { lte: now }, endDate: { gte: now } },
              take: 1,
            },
          },
        }),
        this.prisma.journalEntry.groupBy({
          by: ['status'],
          _count: { _all: true },
          where: {
            tenantId: actor.tenantId,
            status: {
              in: [JournalEntryStatus.SUBMITTED, JournalEntryStatus.APPROVED],
            },
          },
        }),
        this.sourceMappings.getSourceMappingHealth(actor),
      ]);

    const currentPeriod = fiscalYear?.periods[0] ?? null;
    const netPosition = fiscalYear
      ? await this.getNetPosition(actor.tenantId, fiscalYear.id)
      : null;

    const awaitingReview =
      postingQueueCounts.find(
        (row) => row.status === JournalEntryStatus.SUBMITTED,
      )?._count._all ?? 0;
    const awaitingPosting =
      postingQueueCounts.find(
        (row) => row.status === JournalEntryStatus.APPROVED,
      )?._count._all ?? 0;

    return {
      readOnly: true,
      generatedAt: now.toISOString(),
      fiscalYear: fiscalYear
        ? {
            id: fiscalYear.id,
            name: fiscalYear.name,
            status: fiscalYear.status,
          }
        : null,
      currentPeriod: currentPeriod
        ? {
            id: currentPeriod.id,
            label: currentPeriod.label,
            status: currentPeriod.status,
            startDate: currentPeriod.startDate,
            endDate: currentPeriod.endDate,
          }
        : null,
      postingQueue: {
        awaitingReview,
        awaitingPosting,
      },
      netPosition,
      reconciliation: {
        isClean: reconciliation.isClean,
        missingSourceIdCount: reconciliation.missingSourceId.count,
        checkedAt: reconciliation.checkedAt,
      },
    };
  }

  private async getNetPosition(tenantId: string, fiscalYearId: string) {
    const linesGrouped = await this.prisma.journalLine.groupBy({
      by: ['chartAccountId'],
      _sum: { debit: true, credit: true },
      where: {
        tenantId,
        journalEntry: {
          tenantId,
          status: JournalEntryStatus.POSTED,
          fiscalYearId,
        },
      },
    });

    if (linesGrouped.length === 0) {
      return {
        totalIncome: '0.00',
        totalExpense: '0.00',
        netSurplusOrDeficit: '0.00',
        resultType: 'BREAK_EVEN' as NetPositionResultType,
        isBalanced: true,
      };
    }

    const accounts = await this.prisma.chartAccount.findMany({
      where: {
        tenantId,
        id: { in: linesGrouped.map((row) => row.chartAccountId) },
      },
      select: { id: true, type: true },
    });
    const typeByAccountId = new Map(
      accounts.map((account) => [account.id, account.type]),
    );

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const row of linesGrouped) {
      const debit = new Prisma.Decimal(row._sum.debit ?? 0);
      const credit = new Prisma.Decimal(row._sum.credit ?? 0);
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      const accountType = typeByAccountId.get(row.chartAccountId);
      if (accountType === ChartAccountType.REVENUE) {
        totalIncome = totalIncome.plus(credit.minus(debit));
      } else if (accountType === ChartAccountType.EXPENSE) {
        totalExpense = totalExpense.plus(debit.minus(credit));
      }
    }

    const net = totalIncome.minus(totalExpense);
    const resultType: NetPositionResultType = net.gt(0)
      ? 'SURPLUS'
      : net.lt(0)
        ? 'DEFICIT'
        : 'BREAK_EVEN';

    return {
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netSurplusOrDeficit: net.abs().toFixed(2),
      resultType,
      isBalanced: totalDebit.equals(totalCredit),
    };
  }
}
