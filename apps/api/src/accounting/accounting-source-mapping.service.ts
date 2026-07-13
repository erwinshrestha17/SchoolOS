import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalEntryStatus, JournalSourceType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNTING_SOURCE_MODULES,
  type AccountingSourceModule,
  type ArchiveAccountingSourceMappingDto,
  type CreateAccountingSourceMappingDto,
  type ListAccountingSourceMappingsQueryDto,
} from './dto/accounting-source-mapping.dto';

const mappingAccountSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  isActive: true,
} satisfies Prisma.ChartAccountSelect;

@Injectable()
export class AccountingSourceMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listMappings(
    actor: AuthContext,
    query: ListAccountingSourceMappingsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.search?.trim();
    const where: Prisma.AccountingSourceMappingWhereInput = {
      tenantId: actor.tenantId,
      ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
      ...(query.status === 'ACTIVE'
        ? { isActive: true }
        : query.status === 'ARCHIVED'
          ? { isActive: false }
          : {}),
      ...(search
        ? {
            OR: [
              { sourceType: { contains: search, mode: 'insensitive' } },
              { postingType: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountingSourceMapping.findMany({
        where,
        include: {
          debitAccount: { select: mappingAccountSelect },
          creditAccount: { select: mappingAccountSelect },
        },
        orderBy: [
          { sourceModule: 'asc' },
          { sourceType: 'asc' },
          { effectiveFrom: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingSourceMapping.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async createMapping(
    dto: CreateAccountingSourceMappingDto,
    actor: AuthContext,
  ) {
    const sourceType = normalizeAccountingToken(dto.sourceType);
    const postingType = normalizeAccountingToken(dto.postingType ?? 'DEFAULT');
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'Effective-to date must be on or after the effective-from date',
      );
    }
    if (dto.debitAccountId === dto.creditAccountId) {
      throw new BadRequestException(
        'Debit and credit accounts must be different',
      );
    }

    const mapping = await this.prisma.$transaction(
      async (tx) => {
        const accounts = await tx.chartAccount.findMany({
          where: {
            tenantId: actor.tenantId,
            id: { in: [dto.debitAccountId, dto.creditAccountId] },
            isActive: true,
          },
          select: { id: true },
        });
        if (accounts.length !== 2) {
          throw new BadRequestException(
            'Select active debit and credit accounts from this school',
          );
        }

        const overlap = await tx.accountingSourceMapping.findFirst({
          where: {
            tenantId: actor.tenantId,
            sourceModule: dto.sourceModule,
            sourceType,
            postingType,
            isActive: true,
            effectiveFrom: effectiveTo ? { lte: effectiveTo } : undefined,
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: effectiveFrom } },
            ],
          },
          select: { id: true },
        });
        if (overlap) {
          throw new ConflictException(
            'An active mapping already covers this source and effective period',
          );
        }

        return tx.accountingSourceMapping.create({
          data: {
            tenantId: actor.tenantId,
            sourceModule: dto.sourceModule,
            sourceType,
            postingType,
            debitAccountId: dto.debitAccountId,
            creditAccountId: dto.creditAccountId,
            description: dto.description?.trim() || null,
            effectiveFrom,
            effectiveTo,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          include: {
            debitAccount: { select: mappingAccountSelect },
            creditAccount: { select: mappingAccountSelect },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.auditService.record({
      action: 'create',
      resource: 'accounting_source_mapping',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: mapping.id,
      after: {
        sourceModule: mapping.sourceModule,
        sourceType: mapping.sourceType,
        postingType: mapping.postingType,
        debitAccountId: mapping.debitAccountId,
        creditAccountId: mapping.creditAccountId,
        effectiveFrom: mapping.effectiveFrom,
        effectiveTo: mapping.effectiveTo,
      },
    });

    return mapping;
  }

  async archiveMapping(
    id: string,
    dto: ArchiveAccountingSourceMappingDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.accountingSourceMapping.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Accounting source mapping not found');
    }
    if (!existing.isActive) {
      return existing;
    }

    const archivedAt = new Date();
    const updated = await this.prisma.accountingSourceMapping.update({
      where: { id: existing.id, tenantId: actor.tenantId },
      data: {
        isActive: false,
        archivedAt,
        effectiveTo:
          !existing.effectiveTo || existing.effectiveTo > archivedAt
            ? archivedAt
            : existing.effectiveTo,
        updatedById: actor.userId,
      },
      include: {
        debitAccount: { select: mappingAccountSelect },
        creditAccount: { select: mappingAccountSelect },
      },
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'accounting_source_mapping',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { isActive: true, effectiveTo: existing.effectiveTo },
      after: {
        isActive: false,
        effectiveTo: updated.effectiveTo,
        reason: dto.reason,
      },
    });

    return updated;
  }

  async getSourceMappingHealth(actor: AuthContext) {
    const [entries, mappingCounts] = await Promise.all([
      this.prisma.journalEntry.findMany({
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
              chartAccount: { select: { code: true, type: true } },
            },
          },
        },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        take: 1000,
      }),
      this.prisma.accountingSourceMapping.groupBy({
        by: ['sourceModule'],
        where: { tenantId: actor.tenantId, isActive: true },
        _count: { _all: true },
      }),
    ]);

    const configuredByModule = new Map(
      mappingCounts.map((row) => [row.sourceModule, row._count._all]),
    );
    const modules = ACCOUNTING_SOURCE_MODULES.map((sourceModule) => ({
      ...summarizeSourceModule(sourceModule, entries),
      configuredMappingCount: configuredByModule.get(sourceModule) ?? 0,
    }));
    const missingSourceId = entries.filter((entry) => !entry.sourceId);

    return {
      checkedAt: new Date().toISOString(),
      sampledPostedSourceEntries: entries.length,
      sampleLimit: 1000,
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
      isClean: modules.every(
        (module) =>
          module.missingSourceIdCount === 0 &&
          (module.postedCount === 0 || module.configuredMappingCount > 0),
      ),
    };
  }
}

interface SourceEntry {
  id: string;
  entryNumber: string | null;
  sourceModule: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  lines: Array<{ chartAccount: { code: string; type: string } }>;
}

const FINANCE_SOURCE_TYPES: readonly JournalSourceType[] = [
  JournalSourceType.FEE_PAYMENT,
  JournalSourceType.INVOICE,
  JournalSourceType.ADJUSTMENT,
  JournalSourceType.PAYMENT_REFUND,
];

function summarizeSourceModule(
  sourceModule: AccountingSourceModule,
  entries: SourceEntry[],
) {
  const matched = entries.filter((entry) =>
    matchesExpectedSourceModule(sourceModule, entry),
  );
  return {
    sourceModule,
    postedCount: matched.length,
    missingSourceIdCount: matched.filter((entry) => !entry.sourceId).length,
    sampleEntryIds: matched.slice(0, 10).map((entry) => entry.id),
  };
}

function matchesExpectedSourceModule(
  sourceModule: AccountingSourceModule,
  entry: SourceEntry,
) {
  if (sourceModule === 'PAYROLL') return entry.sourceModule === 'PAYROLL';
  if (sourceModule === 'CANTEEN') {
    return entry.sourceModule === 'CANTEEN' || hasAccountCode(entry, '4050');
  }
  if (sourceModule === 'LIBRARY') return hasAccountCode(entry, '4040');
  if (sourceModule === 'TRANSPORT') return hasAccountCode(entry, '4030');
  return (
    entry.sourceModule === 'FINANCE' &&
    FINANCE_SOURCE_TYPES.includes(entry.sourceType) &&
    !['4030', '4040', '4050'].some((code) => hasAccountCode(entry, code))
  );
}

function hasAccountCode(entry: SourceEntry, accountCode: string) {
  return entry.lines.some((line) => line.chartAccount.code === accountCode);
}

export function normalizeAccountingToken(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
