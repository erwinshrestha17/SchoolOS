import { Injectable } from '@nestjs/common';
import { JournalEntryStatus, JournalSourceType } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  M9_ACCOUNTING_SOURCE_MODULES,
  type M9AccountingSourceModule,
} from './dto/m9-accounting.dto';

type AccountingSourceMappingDelegate = {
  findMany(args: { where: { tenantId: string } }): Promise<unknown[]>;
};

type PrismaWithAccountingSourceMapping = PrismaService & {
  accountingSourceMapping?: AccountingSourceMappingDelegate;
};

@Injectable()
export class M9SourceService {
  constructor(private readonly prisma: PrismaService) {}

  listMappings(actor: AuthContext) {
    const db = this.prisma as PrismaWithAccountingSourceMapping;
    if (!db.accountingSourceMapping) {
      return [];
    }
    return db.accountingSourceMapping.findMany({
      where: { tenantId: actor.tenantId },
    });
  }

  async getSourceMappingHealth(actor: AuthContext) {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        status: JournalEntryStatus.POSTED,
        sourceType: {
          notIn: [
            JournalSourceType.MANUAL,
            JournalSourceType.OPENING_BALANCE,
            JournalSourceType.REVERSAL,
            JournalSourceType.CORRECTION,
          ],
        },
      },
      include: {
        lines: {
          select: {
            chartAccount: {
              select: {
                code: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });

    const modules = M9_ACCOUNTING_SOURCE_MODULES.map((sourceModule) =>
      summarizeModule(sourceModule, entries),
    );
    const missingSourceId = entries.filter((entry) => !entry.sourceId);

    return {
      tenantId: actor.tenantId,
      checkedAt: new Date().toISOString(),
      totalPostedSourceEntries: entries.length,
      missingSourceId: {
        count: missingSourceId.length,
        samples: missingSourceId.slice(0, 10).map((entry) => ({
          id: entry.id,
          entryNumber: entry.entryNumber,
          sourceModule: entry.sourceModule,
          sourceType: entry.sourceType,
        })),
      },
      modules,
      isClean:
        missingSourceId.length === 0 &&
        modules.every((module) => module.status !== 'MISSING_SOURCE_ID'),
    };
  }
}

type SourceEntry = {
  id: string;
  entryNumber: string | null;
  sourceModule: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  lines: Array<{
    chartAccount: {
      code: string;
      type: string;
    };
  }>;
};

const FINANCE_SOURCE_TYPES: readonly JournalSourceType[] = [
  JournalSourceType.FEE_PAYMENT,
  JournalSourceType.INVOICE,
  JournalSourceType.ADJUSTMENT,
  JournalSourceType.PAYMENT_REFUND,
];

function summarizeModule(
  sourceModule: M9AccountingSourceModule,
  entries: SourceEntry[],
) {
  const matched = entries.filter((entry) =>
    matchesExpectedSourceModule(sourceModule, entry),
  );
  const missingSourceId = matched.filter((entry) => !entry.sourceId);

  return {
    sourceModule,
    postedCount: matched.length,
    missingSourceIdCount: missingSourceId.length,
    sampleEntryIds: matched.slice(0, 10).map((entry) => entry.id),
    status:
      missingSourceId.length > 0
        ? 'MISSING_SOURCE_ID'
        : matched.length > 0
          ? 'MAPPED'
          : 'NO_POSTED_ACTIVITY',
  };
}

function matchesExpectedSourceModule(
  sourceModule: M9AccountingSourceModule,
  entry: SourceEntry,
) {
  if (sourceModule === 'PAYROLL') {
    return entry.sourceModule === 'PAYROLL';
  }

  if (sourceModule === 'CANTEEN') {
    return entry.sourceModule === 'CANTEEN' || hasAccountCode(entry, '4050');
  }

  if (sourceModule === 'LIBRARY') {
    return hasAccountCode(entry, '4040');
  }

  if (sourceModule === 'TRANSPORT') {
    return hasAccountCode(entry, '4030');
  }

  return (
    entry.sourceModule === 'FINANCE' &&
    FINANCE_SOURCE_TYPES.includes(entry.sourceType) &&
    !['4030', '4040', '4050'].some((code) => hasAccountCode(entry, code))
  );
}

function hasAccountCode(entry: SourceEntry, accountCode: string) {
  return entry.lines.some((line) => line.chartAccount.code === accountCode);
}
