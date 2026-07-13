import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ReportsQueryDto } from './dto/reports-query.dto';

import {
  AccountingPeriodStatus,
  ChartAccountType,
  JournalEntryStatus,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateChartAccountDto } from './dto/create-chart-account.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';
import { ReverseJournalEntryDto } from './dto/reverse-journal-entry.dto';
import { LockFiscalPeriodDto } from './dto/lock-fiscal-period.dto';
import { UnlockFiscalPeriodDto } from './dto/unlock-fiscal-period.dto';
import { CloseFiscalPeriodDto } from './dto/close-fiscal-period.dto';
import { ReopenFiscalPeriodDto } from './dto/reopen-fiscal-period.dto';
import { SubmitJournalDto } from './dto/submit-journal.dto';
import { ApproveJournalDto } from './dto/approve-journal.dto';
import { RejectJournalDto } from './dto/reject-journal.dto';
import { PostJournalDto } from './dto/post-journal.dto';
import { CancelJournalDto } from './dto/cancel-journal.dto';
import { AccountingPostingService } from './accounting-posting.service';
import { CreateOpeningBalanceDto } from './dto/opening-balance.dto';
import { ImportBankStatementLineDto } from './dto/import-bank-statement.dto';
import {
  ExpenseVoucherDto,
  PaymentVoucherDto,
  ReceiptVoucherDto,
  ContraVoucherDto,
} from './dto/voucher.dto';
import { DEFAULT_CHART_ACCOUNTS } from '../finance/finance.defaults';

export interface UnsafeBankStatement {
  id: string;
  statementDate: Date;
  description: string;
  reference?: string | null;
  debitAmount?: Prisma.Decimal | number | string | null;
  creditAmount?: Prisma.Decimal | number | string | null;
  isReconciled: boolean;
  [key: string]: unknown;
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly postingService: AccountingPostingService,
  ) {}

  /**
   * Block direct updates to posted journal entries.
   */
  updateJournalEntry() {
    throw new ConflictException(
      'Journal entries are immutable. Use correction or reversal workflows.',
    );
  }

  /**
   * Block direct deletions of journal entries.
   */
  deleteJournalEntry() {
    throw new ConflictException(
      'Journal entries are immutable and cannot be deleted once posted.',
    );
  }

  async getDashboardSummary(actor: AuthContext) {
    const now = new Date();
    const sourceJournalTypes = [
      JournalSourceType.INVOICE,
      JournalSourceType.FEE_PAYMENT,
      JournalSourceType.PAYMENT_REFUND,
      JournalSourceType.PAYROLL,
      JournalSourceType.PAYROLL_RUN,
      JournalSourceType.PAYROLL_DISBURSEMENT,
      JournalSourceType.ADJUSTMENT,
    ];

    const [
      activeFiscalYear,
      journalsByStatusRows,
      unreconciledBankItems,
      activeSourceMappings,
      postedSourceEntries,
      postedSourceEntriesWithoutId,
      exportJobsByStatusRows,
      trialBalanceTotals,
      recentJournalRows,
    ] = await Promise.all([
      this.prisma.fiscalYear.findFirst({
        where: { tenantId: actor.tenantId, status: 'OPEN' },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
          periods: {
            where: { startDate: { lte: now }, endDate: { gte: now } },
            orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
            take: 1,
            select: {
              id: true,
              label: true,
              periodNumber: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.journalEntry.groupBy({
        by: ['status'],
        where: { tenantId: actor.tenantId },
        _count: { _all: true },
      }),
      this.prisma.bankStatement.count({
        where: { tenantId: actor.tenantId, isReconciled: false },
      }),
      this.prisma.accountingSourceMapping.count({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
      }),
      this.prisma.journalEntry.count({
        where: {
          tenantId: actor.tenantId,
          status: JournalEntryStatus.POSTED,
          sourceType: { in: sourceJournalTypes },
        },
      }),
      this.prisma.journalEntry.count({
        where: {
          tenantId: actor.tenantId,
          status: JournalEntryStatus.POSTED,
          sourceType: { in: sourceJournalTypes },
          sourceId: null,
        },
      }),
      this.prisma.reportExport.groupBy({
        by: ['status'],
        where: {
          tenantId: actor.tenantId,
          reportKey: { startsWith: 'accounting.' },
        },
        _count: { _all: true },
      }),
      this.prisma.journalLine.aggregate({
        where: {
          tenantId: actor.tenantId,
          journalEntry: { status: JournalEntryStatus.POSTED },
        },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.journalEntry.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          narration: true,
          status: true,
          sourceModule: true,
          sourceType: true,
          sourceId: true,
          reversalOfId: true,
          correctionOfId: true,
          lines: { select: { debit: true, credit: true } },
        },
      }),
    ]);

    const journalsByStatus = Object.fromEntries(
      journalsByStatusRows.map((row) => [row.status, row._count._all]),
    );
    const exportJobsByStatus = Object.fromEntries(
      exportJobsByStatusRows.map((row) => [row.status, row._count._all]),
    );
    const totalDebit = trialBalanceTotals._sum.debit ?? new Prisma.Decimal(0);
    const totalCredit = trialBalanceTotals._sum.credit ?? new Prisma.Decimal(0);
    const sourceMappingIssueCount =
      postedSourceEntriesWithoutId +
      (postedSourceEntries > 0 && activeSourceMappings === 0 ? 1 : 0);
    const closingBlockerCount =
      (journalsByStatus[JournalEntryStatus.DRAFT] ?? 0) +
      (journalsByStatus[JournalEntryStatus.SUBMITTED] ?? 0) +
      (journalsByStatus[JournalEntryStatus.APPROVED] ?? 0) +
      unreconciledBankItems +
      sourceMappingIssueCount;

    return {
      generatedAt: now.toISOString(),
      staleAfterSeconds: 60,
      activeFiscalYear: activeFiscalYear
        ? {
            id: activeFiscalYear.id,
            name: activeFiscalYear.name,
            startDate: activeFiscalYear.startDate.toISOString(),
            endDate: activeFiscalYear.endDate.toISOString(),
            status: activeFiscalYear.status,
          }
        : null,
      activePeriod: activeFiscalYear?.periods[0]
        ? {
            ...activeFiscalYear.periods[0],
            startDate: activeFiscalYear.periods[0].startDate.toISOString(),
            endDate: activeFiscalYear.periods[0].endDate.toISOString(),
          }
        : null,
      journalsByStatus,
      pendingJournalSubmissions:
        journalsByStatus[JournalEntryStatus.DRAFT] ?? 0,
      pendingJournalApprovals:
        journalsByStatus[JournalEntryStatus.SUBMITTED] ?? 0,
      approvedButUnpostedJournals:
        journalsByStatus[JournalEntryStatus.APPROVED] ?? 0,
      unreconciledBankItems,
      activeSourceMappings,
      sourceMappingIssueCount,
      postedSourceEntries,
      postedSourceEntriesWithoutId,
      exportJobsByStatus,
      activeExportJobs:
        (exportJobsByStatus.QUEUED ?? 0) + (exportJobsByStatus.RUNNING ?? 0),
      failedExportJobs: exportJobsByStatus.FAILED ?? 0,
      failedSourcePostings: null,
      failedSourcePostingsAvailability: 'NEEDS_POSTING_FAILURE_CONTRACT',
      trialBalance: {
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        balanced: totalDebit.equals(totalCredit),
      },
      closingBlockerCount,
      recentJournals: recentJournalRows.map((entry) => {
        const total = entry.lines.reduce(
          (sum, line) => sum.add(line.debit),
          new Prisma.Decimal(0),
        );
        return {
          id: entry.id,
          entryNumber: entry.entryNumber,
          entryDate: entry.entryDate.toISOString(),
          narration: entry.narration,
          status: entry.status,
          sourceModule: entry.sourceModule,
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          reversalOfId: entry.reversalOfId,
          correctionOfId: entry.correctionOfId,
          totalDebit: total.toFixed(2),
        };
      }),
    };
  }

  async listPeriods(actor: AuthContext) {
    return this.prisma.accountingPeriod.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ startsOn: 'desc' }],
    });
  }

  async createPeriod(dto: CreateAccountingPeriodDto, actor: AuthContext) {
    const period = await this.prisma.accountingPeriod.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'accounting_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: period.id,
      after: {
        name: period.name,
      },
    });

    return period;
  }

  async listChartAccounts(actor: AuthContext) {
    return this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId },
      include: { children: true },
      orderBy: [{ code: 'asc' }],
    });
  }

  async listChartAccountTree(actor: AuthContext) {
    const accounts = await this.listChartAccounts(actor);
    const byParent = new Map<string | null, typeof accounts>();

    for (const account of accounts) {
      const key = account.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), account]);
    }

    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((account) => ({
        ...account,
        children: build(account.id),
      }));

    return build(null);
  }

  async createChartAccount(dto: CreateChartAccountDto, actor: AuthContext) {
    const existing = await this.prisma.chartAccount.findUnique({
      where: { tenantId_code: { tenantId: actor.tenantId, code: dto.code } },
    });

    if (existing) {
      throw new ConflictException(
        'Chart account code already exists in this tenant',
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.chartAccount.findFirst({
        where: { id: dto.parentId, tenantId: actor.tenantId },
      });
      if (!parent) {
        throw new NotFoundException('Parent account not found in this tenant');
      }
    }

    const account = await this.prisma.chartAccount.create({
      data: {
        tenantId: actor.tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId ?? null,
        isSystem: dto.isSystem ?? false,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'chart_account',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: account.id,
      after: { code: account.code, name: account.name, type: account.type },
    });

    return account;
  }

  async updateChartAccount(
    id: string,
    dto: CreateChartAccountDto,
    actor: AuthContext,
  ) {
    const account = await this.prisma.chartAccount.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!account) {
      throw new NotFoundException('Chart account not found in this tenant');
    }

    const activityCount = await this.prisma.journalLine.count({
      where: { tenantId: actor.tenantId, chartAccountId: account.id },
    });

    if (activityCount > 0 && dto.type !== account.type) {
      throw new ConflictException(
        'Account type cannot change after ledger activity exists',
      );
    }

    const updated = await this.prisma.chartAccount.update({
      where: { id: account.id },
      data: {
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId ?? null,
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'chart_account',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { name: account.name, type: account.type },
      after: { name: updated.name, type: updated.type },
    });

    return updated;
  }

  async archiveChartAccount(id: string, actor: AuthContext) {
    const account = await this.prisma.chartAccount.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!account) {
      throw new NotFoundException('Chart account not found in this tenant');
    }

    if (account.isSystem) {
      throw new ConflictException('System accounts cannot be archived');
    }

    const updated = await this.prisma.chartAccount.update({
      where: { id: account.id },
      data: { isActive: false, archivedAt: new Date() },
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'chart_account',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { code: updated.code, isActive: updated.isActive },
    });

    return updated;
  }

  async seedDefaultChart(actor: AuthContext) {
    const defaults = getDefaultSchoolChartAccounts();
    const accounts: Array<
      Awaited<ReturnType<typeof this.prisma.chartAccount.upsert>>
    > = [];

    for (const account of defaults) {
      accounts.push(
        await this.prisma.chartAccount.upsert({
          where: {
            tenantId_code: { tenantId: actor.tenantId, code: account.code },
          },
          update: {
            name: account.name,
            type: account.type,
            isSystem: true,
            isActive: true,
          },
          create: {
            tenantId: actor.tenantId,
            code: account.code,
            name: account.name,
            type: account.type,
            isSystem: true,
          },
        }),
      );
    }

    await this.auditService.record({
      action: 'seed',
      resource: 'chart_account',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { count: accounts.length },
    });

    return accounts;
  }

  async createManualJournal(dto: CreateManualJournalDto, actor: AuthContext) {
    const accountIds = dto.lines.map((line) => line.chartAccountId);
    const accounts = await this.prisma.chartAccount.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: accountIds },
      },
    });

    if (accounts.length !== new Set(accountIds).size) {
      throw new NotFoundException('One or more chart accounts were not found');
    }

    const totals = sumJournalSides(dto.lines);

    if (!totals.debit.eq(totals.credit)) {
      throw new ConflictException(
        `Manual journal must be balanced. Debit: ${totals.debit.toString()}, Credit: ${totals.credit.toString()}`,
      );
    }

    await this.postingService.ensurePostingPeriodIsOpen(
      this.prisma,
      actor.tenantId,
      new Date(dto.entryDate),
    );

    const entry = await this.postingService.createDraftJournal(
      {
        tenantId: actor.tenantId,
        entryDate: new Date(dto.entryDate),
        narration: dto.narration,
        sourceModule: 'ACCOUNTING',
        sourceType: JournalSourceType.MANUAL,
        sourceId: dto.sourceId ?? null,
        lines: dto.lines.map((line) => ({
          chartAccountId: line.chartAccountId,
          side: line.side,
          amount: line.amount,
          description: line.description,
        })),
      },
      actor,
    );

    await this.auditService.record({
      action: 'create',
      resource: 'journal_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        status: entry.status,
      },
    });

    return entry;
  }

  async submitManualJournal(
    id: string,
    dto: SubmitJournalDto,
    actor: AuthContext,
  ) {
    const entry = await this.getJournalEntry(id, actor);
    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new ConflictException('Only DRAFT journals can be submitted');
    }

    const totals = sumJournalSides(
      entry.lines.map((l) => ({ side: l.side, amount: Number(l.amount) })),
    );
    if (!totals.debit.eq(totals.credit)) {
      throw new ConflictException('Journal must be balanced before submission');
    }

    if (entry.lines.length < 2) {
      throw new ConflictException('Journal must have at least two lines');
    }

    await this.postingService.ensurePostingPeriodIsOpen(
      this.prisma,
      actor.tenantId,
      entry.entryDate,
    );

    const updated = await this.postingService.updateJournalStatus(
      id,
      actor.tenantId,
      JournalEntryStatus.SUBMITTED,
      actor,
      {
        submittedAt: new Date(),
        submittedById: actor.userId,
        submissionNote: dto.reason,
      },
    );

    await this.auditService.record({
      action: 'submit',
      resource: 'journal_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async approveManualJournal(
    id: string,
    dto: ApproveJournalDto,
    actor: AuthContext,
  ) {
    const entry = await this.getJournalEntry(id, actor);
    if (entry.status !== JournalEntryStatus.SUBMITTED) {
      throw new ConflictException('Only SUBMITTED journals can be approved');
    }

    if (entry.createdById === actor.userId) {
      throw new ConflictException(
        'Approver cannot be the same user as creator',
      );
    }

    await this.postingService.ensurePostingPeriodIsOpen(
      this.prisma,
      actor.tenantId,
      entry.entryDate,
    );

    const updated = await this.postingService.updateJournalStatus(
      id,
      actor.tenantId,
      JournalEntryStatus.APPROVED,
      actor,
      {
        approvedAt: new Date(),
        approvedById: actor.userId,
        approvalNote: dto.reason,
      },
    );

    await this.auditService.record({
      action: 'approve',
      resource: 'journal_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async rejectManualJournal(
    id: string,
    dto: RejectJournalDto,
    actor: AuthContext,
  ) {
    const entry = await this.getJournalEntry(id, actor);
    if (entry.status !== JournalEntryStatus.SUBMITTED) {
      throw new ConflictException('Only SUBMITTED journals can be rejected');
    }

    const updated = await this.postingService.updateJournalStatus(
      id,
      actor.tenantId,
      JournalEntryStatus.REJECTED,
      actor,
      {
        rejectedAt: new Date(),
        rejectedById: actor.userId,
        rejectionReason: dto.reason,
      },
    );

    await this.auditService.record({
      action: 'reject',
      resource: 'journal_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async postApprovedManualJournal(
    id: string,
    dto: PostJournalDto,
    actor: AuthContext,
  ) {
    const entry = await this.getJournalEntry(id, actor);
    if (entry.status !== JournalEntryStatus.APPROVED) {
      throw new ConflictException('Only APPROVED journals can be posted');
    }

    const period = await this.postingService.ensurePostingPeriodIsOpen(
      this.prisma,
      actor.tenantId,
      entry.entryDate,
    );

    const entryNumber = await this.postingService.generateJournalEntryNumber(
      this.prisma,
      actor.tenantId,
      period?.fiscalYearId ?? null,
      entry.entryDate,
    );

    const updated = await this.postingService.updateJournalStatus(
      id,
      actor.tenantId,
      JournalEntryStatus.POSTED,
      actor,
      {
        postedAt: new Date(),
        postedById: actor.userId,
        entryNumber,
      },
    );

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, entryNumber },
    });

    return updated;
  }

  async cancelManualJournal(
    id: string,
    dto: CancelJournalDto,
    actor: AuthContext,
  ) {
    const entry = await this.getJournalEntry(id, actor);
    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new ConflictException('Only DRAFT journals can be cancelled');
    }

    const updated = await this.postingService.updateJournalStatus(
      id,
      actor.tenantId,
      JournalEntryStatus.CANCELLED,
      actor,
      {
        cancelledAt: new Date(),
        cancelledById: actor.userId,
        cancellationReason: dto.reason,
      },
    );

    await this.auditService.record({
      action: 'cancel',
      resource: 'journal_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async getJournalEntry(id: string, actor: AuthContext) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        lines: {
          include: { chartAccount: true },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found in this tenant');
    }

    return entry;
  }

  async reverseJournalEntry(
    journalEntryId: string,
    dto: ReverseJournalEntryDto,
    actor: AuthContext,
  ) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id: journalEntryId, tenantId: actor.tenantId },
      include: {
        lines: {
          include: { chartAccount: true },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!original) {
      throw new NotFoundException('Journal entry not found in this tenant');
    }

    await this.ensureJournalIsMutable(original.id, actor.tenantId);

    if (original.status === JournalEntryStatus.REVERSED) {
      throw new ConflictException('Journal entry is already reversed');
    }

    if (original.sourceType === JournalSourceType.REVERSAL) {
      throw new ConflictException(
        'Reversal entries cannot be reversed directly',
      );
    }

    const existingReversal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        reversalOfId: original.id,
      },
    });

    if (existingReversal) {
      throw new ConflictException(
        `Journal entry already reversed by ${existingReversal.entryNumber}`,
      );
    }

    const reversalDate = dto.reversalDate
      ? new Date(dto.reversalDate)
      : new Date();

    await this.postingService.ensurePostingPeriodIsOpen(
      this.prisma,
      actor.tenantId,
      reversalDate,
    );

    const reversal = await this.postingService.postReversal(
      {
        tenantId: actor.tenantId,
        originalEntryId: original.id,
        reversalDate,
        narration:
          dto.narration ?? `Reversal of journal entry ${original.entryNumber}`,
        reason: dto.reason,
        lines: original.lines.map((line) => ({
          chartAccountId: line.chartAccountId,
          side: reverseJournalSide(line.side),
          amount: line.amount,
          description:
            line.description ??
            `Reversal of ${original.entryNumber} line ${line.id}`,
        })),
      },
      actor,
    );

    return reversal;
  }

  async createExpense(dto: CreateExpenseDto, actor: AuthContext) {
    return this.createManualJournal(
      {
        entryDate: dto.expenseDate,
        narration: dto.narration,
        sourceId: dto.referenceNumber,
        lines: [
          {
            chartAccountId: dto.expenseAccountId,
            side: JournalLineSide.DEBIT,
            amount: dto.amount,
            description: dto.narration,
          },
          {
            chartAccountId: dto.paymentAccountId,
            side: JournalLineSide.CREDIT,
            amount: dto.amount,
            description: dto.referenceNumber ?? dto.narration,
          },
        ],
      },
      actor,
    );
  }

  async buildReports(actor: AuthContext, query?: ReportsQueryDto) {
    const where: Prisma.JournalLineWhereInput = {
      tenantId: actor.tenantId,
      journalEntry: {
        status: JournalEntryStatus.POSTED,
      },
    };

    if (query?.startDate || query?.endDate) {
      (where.journalEntry as Prisma.JournalEntryWhereInput).entryDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    if (query?.fiscalYearId) {
      (where.journalEntry as Prisma.JournalEntryWhereInput).fiscalYearId =
        query.fiscalYearId;
    }

    if (query?.fiscalPeriodId) {
      (where.journalEntry as Prisma.JournalEntryWhereInput).fiscalPeriodId =
        query.fiscalPeriodId;
    }

    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        journalLines: {
          where,
          include: {
            journalEntry: true,
          },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    const trialBalance = accounts.map((account) => {
      const debit = account.journalLines.reduce(
        (sum, line) => sum.add(line.debit),
        new Prisma.Decimal(0),
      );
      const credit = account.journalLines.reduce(
        (sum, line) => sum.add(line.credit),
        new Prisma.Decimal(0),
      );

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit: Number(debit),
        credit: Number(credit),
        balance: Number(debit.sub(credit)),
      };
    });

    const totals = trialBalance.reduce(
      (acc, row) => ({
        debit: acc.debit.add(row.debit),
        credit: acc.credit.add(row.credit),
      }),
      { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) },
    );

    const income = trialBalance
      .filter((row) => row.type === ChartAccountType.REVENUE)
      .reduce(
        (sum, row) => sum.add(row.credit).sub(row.debit),
        new Prisma.Decimal(0),
      );
    const expenses = trialBalance
      .filter((row) => row.type === ChartAccountType.EXPENSE)
      .reduce(
        (sum, row) => sum.add(row.debit).sub(row.credit),
        new Prisma.Decimal(0),
      );

    return {
      trialBalance,
      totals: {
        debit: Number(totals.debit),
        credit: Number(totals.credit),
      },
      incomeStatement: {
        income: Number(income),
        expenses: Number(expenses),
        netIncome: Number(income.sub(expenses)),
        groups: {
          revenue: trialBalance.filter(
            (r) => r.type === ChartAccountType.REVENUE,
          ),
          expenses: trialBalance.filter(
            (r) => r.type === ChartAccountType.EXPENSE,
          ),
        },
      },
      balanceSheet: {
        assets: trialBalance.filter((r) => r.type === ChartAccountType.ASSET),
        liabilities: trialBalance.filter(
          (r) => r.type === ChartAccountType.LIABILITY,
        ),
        equity: trialBalance.filter((r) => r.type === ChartAccountType.EQUITY),
        totals: {
          assets: sumRows(trialBalance, ChartAccountType.ASSET),
          liabilities: sumRows(trialBalance, ChartAccountType.LIABILITY),
          equity: sumRows(trialBalance, ChartAccountType.EQUITY),
        },
      },
      cashFlow: {
        netCashMovement: trialBalance
          .filter(
            (row) =>
              row.type === ChartAccountType.ASSET &&
              /cash|bank/i.test(row.name),
          )
          .reduce((sum, row) => sum.add(row.balance), new Prisma.Decimal(0))
          .toNumber(),
      },
      balanced: totals.debit.eq(totals.credit),
    };
  }

  async getSourceLedgerReconciliation(actor: AuthContext) {
    const [groups, missingSourceEntries, totalPosted] = await Promise.all([
      this.prisma.journalEntry.groupBy({
        by: ['sourceModule', 'sourceType', 'status'],
        where: { tenantId: actor.tenantId },
        _count: { _all: true },
      }),
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
          OR: [{ sourceModule: null }, { sourceId: null }],
        },
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          sourceModule: true,
          sourceType: true,
          sourceId: true,
          postingType: true,
          status: true,
        },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.journalEntry.count({
        where: { tenantId: actor.tenantId, status: JournalEntryStatus.POSTED },
      }),
    ]);

    const sourceSummary = groups.map((group) => ({
      sourceModule: group.sourceModule ?? 'UNSPECIFIED',
      sourceType: group.sourceType,
      status: group.status,
      count: group._count._all,
    }));

    const moduleCoverage = summarizeSourceModuleCoverage(sourceSummary);

    return {
      totalPosted,
      sourceSummary,
      moduleCoverage,
      missingSourceId: {
        total: missingSourceEntries.length,
        items: missingSourceEntries,
      },
      isClean: missingSourceEntries.length === 0,
    };
  }

  async closePeriod(id: string, actor: AuthContext) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!period) {
      throw new NotFoundException('Accounting period not found in this tenant');
    }

    const closed = await this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: 'close',
      resource: 'accounting_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: closed.id,
      after: {
        name: closed.name,
        status: closed.status,
      },
    });

    return closed;
  }

  async createFiscalYear(dto: CreateFiscalYearDto, actor: AuthContext) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const overlapping = await this.prisma.fiscalYear.findFirst({
      where: {
        tenantId: actor.tenantId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new ConflictException('Fiscal years cannot overlap');
    }

    const fiscalYear = await this.prisma.fiscalYear.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        startDate,
        endDate,
        periods: {
          create: buildFiscalPeriods(actor.tenantId, startDate, endDate),
        },
      },
      include: { periods: true },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'fiscal_year',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: fiscalYear.id,
      after: { name: fiscalYear.name, periodCount: fiscalYear.periods.length },
    });

    return fiscalYear;
  }

  async listFiscalYears(actor: AuthContext) {
    return this.prisma.fiscalYear.findMany({
      where: { tenantId: actor.tenantId },
      include: { periods: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async listFiscalPeriods(fiscalYearId: string, actor: AuthContext) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, tenantId: actor.tenantId },
    });

    if (!fiscalYear) {
      throw new NotFoundException('Fiscal year not found in this tenant');
    }

    return this.prisma.fiscalPeriod.findMany({
      where: { tenantId: actor.tenantId, fiscalYearId },
      orderBy: { periodNumber: 'asc' },
    });
  }

  async lockFiscalPeriod(
    id: string,
    dto: LockFiscalPeriodDto,
    actor: AuthContext,
  ) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    if (period.status === AccountingPeriodStatus.CLOSED) {
      throw new ConflictException('Cannot lock a closed fiscal period');
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.LOCKED,
        lockedAt: new Date(),
        lockedById: actor.userId,
        lockReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'lock',
      resource: 'fiscal_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: period.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async unlockFiscalPeriod(
    id: string,
    dto: UnlockFiscalPeriodDto,
    actor: AuthContext,
  ) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    if (period.status === AccountingPeriodStatus.CLOSED) {
      throw new ConflictException('Cannot unlock a closed fiscal period');
    }

    if (period.status === AccountingPeriodStatus.OPEN) {
      return period;
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.OPEN,
        unlockedAt: new Date(),
        unlockedById: actor.userId,
        unlockReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'unlock',
      resource: 'fiscal_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: period.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async closeFiscalPeriod(
    id: string,
    dto: CloseFiscalPeriodDto,
    actor: AuthContext,
  ) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    if (period.status === AccountingPeriodStatus.CLOSED) {
      throw new ConflictException('Fiscal period is already closed');
    }

    if (period.status === AccountingPeriodStatus.OPEN) {
      throw new ConflictException(
        'Fiscal period must be LOCKED before closing.',
      );
    }

    // Optional: check if previous period is closed
    const previousPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        tenantId: actor.tenantId,
        fiscalYearId: period.fiscalYearId,
        periodNumber: period.periodNumber - 1,
      },
    });

    if (
      previousPeriod &&
      previousPeriod.status !== AccountingPeriodStatus.CLOSED
    ) {
      throw new ConflictException(
        `Previous fiscal period "${previousPeriod.label}" must be closed first.`,
      );
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.CLOSED,
        closedAt: new Date(),
        closedById: actor.userId,
        closeReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'close',
      resource: 'fiscal_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: period.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async reopenFiscalPeriod(
    id: string,
    dto: ReopenFiscalPeriodDto,
    actor: AuthContext,
  ) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { fiscalYear: true },
    });

    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    if (period.fiscalYear.status === 'CLOSED') {
      throw new ConflictException(
        'Cannot reopen a fiscal period in a closed fiscal year. Reopen the fiscal year first.',
      );
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.OPEN,
        reopenedAt: new Date(),
        reopenedById: actor.userId,
        reopenReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'reopen',
      resource: 'fiscal_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: period.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }
  async correctJournalEntry(
    id: string,
    dto: ReverseJournalEntryDto,
    actor: AuthContext,
  ) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { lines: true },
    });

    if (!original) {
      throw new NotFoundException('Journal entry not found');
    }

    await this.ensureJournalIsMutable(original.id, actor.tenantId);

    if (original.status === JournalEntryStatus.REVERSED) {
      throw new ConflictException(
        'Cannot correct a reversed journal entry. Reverse the reversal first (if applicable) or post a new entry.',
      );
    }

    const correctionDate = dto.reversalDate
      ? new Date(dto.reversalDate)
      : new Date();

    const result = await this.postingService.postCorrection(
      {
        tenantId: actor.tenantId,
        originalEntryId: id,
        correctionDate,
        narration: dto.narration ?? `Correction of ${original.entryNumber}`,
        reason: dto.reason,
        lines: original.lines.map((l) => ({
          chartAccountId: l.chartAccountId,
          debit: l.debit ?? (l.side === JournalLineSide.DEBIT ? l.amount : 0),
          credit:
            l.credit ?? (l.side === JournalLineSide.CREDIT ? l.amount : 0),
          description: l.description,
        })),
      },
      actor,
    );

    return result;
  }

  async listJournalEntries(actor: AuthContext) {
    return this.prisma.journalEntry.findMany({
      where: { tenantId: actor.tenantId },
      include: { lines: { include: { chartAccount: true } } },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async getTrialBalance(actor: AuthContext, query?: ReportsQueryDto) {
    return (await this.buildReports(actor, query)).trialBalance;
  }

  async getIncomeStatement(actor: AuthContext, query?: ReportsQueryDto) {
    return (await this.buildReports(actor, query)).incomeStatement;
  }

  async getBalanceSheet(actor: AuthContext, query?: ReportsQueryDto) {
    return (await this.buildReports(actor, query)).balanceSheet;
  }

  async getGeneralLedger(actor: AuthContext, query?: ReportsQueryDto) {
    const where: Prisma.JournalLineWhereInput = {
      tenantId: actor.tenantId,
      journalEntry: {
        status: JournalEntryStatus.POSTED,
      },
    };

    if (query?.startDate || query?.endDate) {
      (where.journalEntry as Prisma.JournalEntryWhereInput).entryDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    if (query?.fiscalYearId) {
      (where.journalEntry as Prisma.JournalEntryWhereInput).fiscalYearId =
        query.fiscalYearId;
    }

    if (query?.fiscalPeriodId) {
      (where.journalEntry as Prisma.JournalEntryWhereInput).fiscalPeriodId =
        query.fiscalPeriodId;
    }

    const lines = await this.prisma.journalLine.findMany({
      where,
      include: {
        chartAccount: true,
        journalEntry: true,
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { journalEntry: { entryNumber: 'asc' } },
        { lineNumber: 'asc' },
      ],
      skip: query?.page && query?.limit ? (query.page - 1) * query.limit : 0,
      take: query?.limit ?? 1000,
    });
    const running = new Map<string, number>();

    return lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const balance = (running.get(line.chartAccountId) ?? 0) + debit - credit;
      running.set(line.chartAccountId, balance);

      return {
        accountId: line.chartAccountId,
        accountCode: line.chartAccount.code,
        accountName: line.chartAccount.name,
        date: line.journalEntry.entryDate,
        journalNumber: line.journalEntry.entryNumber,
        narration: line.journalEntry.narration,
        source: line.journalEntry.sourceType,
        debit,
        credit,
        runningBalance: balance,
      };
    });
  }

  async getAccountLedger(accountId: string, actor: AuthContext) {
    const account = await this.prisma.chartAccount.findFirst({
      where: { id: accountId, tenantId: actor.tenantId },
    });

    if (!account) {
      throw new NotFoundException('Account not found in this tenant');
    }

    return (await this.getGeneralLedger(actor)).filter(
      (line) => line.accountId === accountId,
    );
  }

  async getCashBook(actor: AuthContext, query?: ReportsQueryDto) {
    const ledger = await this.getGeneralLedger(actor, query);
    const rows = ledger.filter((line) => /cash|bank/i.test(line.accountName));

    return {
      openingBalance: 0,
      receipts: rows.reduce((sum, row) => sum + row.debit, 0),
      payments: rows.reduce((sum, row) => sum + row.credit, 0),
      closingBalance: rows.at(-1)?.runningBalance ?? 0,
      rows,
    };
  }

  async getVatSummary(actor: AuthContext) {
    const ledger = await this.getGeneralLedger(actor);
    return ledger.filter((line) => /vat/i.test(line.accountName));
  }

  async getTdsSummary(actor: AuthContext) {
    const ledger = await this.getGeneralLedger(actor);
    return ledger.filter((line) => /tds/i.test(line.accountName));
  }

  async getPfSummary(actor: AuthContext) {
    const ledger = await this.getGeneralLedger(actor);
    return ledger.filter((line) => /pf/i.test(line.accountName));
  }

  async runConsistencyCheck(actor: AuthContext) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { tenantId: actor.tenantId, status: JournalEntryStatus.POSTED },
      include: { lines: true },
    });

    const imbalanced = entries.filter((entry) => {
      const debit = entry.lines.reduce(
        (sum, l) => sum.add(l.debit),
        new Prisma.Decimal(0),
      );
      const credit = entry.lines.reduce(
        (sum, l) => sum.add(l.credit),
        new Prisma.Decimal(0),
      );
      return !debit.eq(credit);
    });

    const report = await this.buildReports(actor);
    const tbImbalanced = !new Prisma.Decimal(report.totals.debit).eq(
      new Prisma.Decimal(report.totals.credit),
    );

    const result = {
      timestamp: new Date(),
      totalEntriesChecked: entries.length,
      imbalancedEntries: imbalanced.map((e) => ({
        id: e.id,
        number: e.entryNumber,
      })),
      trialBalanceBalanced: !tbImbalanced,
      isConsistent: imbalanced.length === 0 && !tbImbalanced,
    };

    await this.auditService.record({
      action: 'reconcile',
      resource: 'ledger',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: result,
    });

    return result;
  }

  async exportCsv(report: string, actor: AuthContext) {
    const data =
      report === 'general-ledger'
        ? await this.getGeneralLedger(actor)
        : report === 'income-statement'
          ? await this.getIncomeStatement(actor)
          : report === 'balance-sheet'
            ? await this.getBalanceSheet(actor)
            : await this.getTrialBalance(actor);

    await this.auditService.record({
      action: 'export',
      resource: `accounting_${report}`,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { report },
    });

    return toCsv(Array.isArray(data) ? data : [data]);
  }

  // ─── Slice 2: Opening Balance ────────────────────────────────────────

  async createOpeningBalance(dto: CreateOpeningBalanceDto, actor: AuthContext) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: dto.fiscalYearId, tenantId: actor.tenantId },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    });

    if (!fiscalYear) {
      throw new NotFoundException('Fiscal year not found in this tenant');
    }

    if (fiscalYear.status === 'CLOSED') {
      throw new ConflictException(
        'Cannot post opening balance to a closed fiscal year',
      );
    }

    // Validate balance
    const totals = sumJournalSides(dto.lines);
    if (!totals.debit.eq(totals.credit)) {
      throw new ConflictException(
        `Opening balance must be balanced. Debit: ${totals.debit.toString()}, Credit: ${totals.credit.toString()}`,
      );
    }

    // Validate accounts belong to tenant
    const accountIds = dto.lines.map((l) => l.chartAccountId);
    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId, id: { in: accountIds } },
    });
    if (accounts.length !== new Set(accountIds).size) {
      throw new NotFoundException(
        'One or more chart accounts not found in this tenant',
      );
    }

    // Use the fiscal year start date or explicit entryDate
    const entryDate = dto.entryDate
      ? new Date(dto.entryDate)
      : fiscalYear.startDate;

    const entry = await this.postingService.createDraftJournal(
      {
        tenantId: actor.tenantId,
        entryDate,
        narration: dto.narration ?? `Opening balance for ${fiscalYear.name}`,
        sourceModule: 'ACCOUNTING',
        sourceType: 'OPENING_BALANCE',
        sourceId: dto.fiscalYearId,
        lines: dto.lines.map((line) => ({
          chartAccountId: line.chartAccountId,
          side: line.side,
          amount: line.amount,
          description: line.description,
        })),
      },
      actor,
    );

    await this.auditService.record({
      action: 'create',
      resource: 'opening_balance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        fiscalYearId: dto.fiscalYearId,
        status: entry.status,
        lineCount: dto.lines.length,
      },
    });

    return entry;
  }

  async getOpeningBalance(fiscalYearId: string, actor: AuthContext) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        sourceType: 'OPENING_BALANCE',
        sourceId: fiscalYearId,
      },
      include: { lines: { include: { chartAccount: true } } },
    });

    if (!entry) {
      throw new NotFoundException(
        'Opening balance not found for this fiscal year',
      );
    }

    return entry;
  }

  // ─── Slice 3: Voucher Workflows ────────────────────────────────────

  async createExpenseVoucher(dto: ExpenseVoucherDto, actor: AuthContext) {
    return this.createManualJournal(
      {
        entryDate: dto.entryDate,
        narration: dto.narration,
        sourceId: dto.reference,
        lines: [
          {
            chartAccountId: dto.expenseAccountId,
            side: JournalLineSide.DEBIT,
            amount: dto.amount,
            description: `Expense: ${dto.narration}`,
          },
          {
            chartAccountId: dto.paymentAccountId,
            side: JournalLineSide.CREDIT,
            amount: dto.amount,
            description: dto.reference ?? dto.narration,
          },
        ],
      },
      actor,
    );
  }

  async createPaymentVoucher(dto: PaymentVoucherDto, actor: AuthContext) {
    return this.createManualJournal(
      {
        entryDate: dto.entryDate,
        narration: dto.narration,
        sourceId: dto.reference,
        lines: [
          {
            chartAccountId: dto.payeeAccountId,
            side: JournalLineSide.DEBIT,
            amount: dto.amount,
            description: `Payment to payee: ${dto.narration}`,
          },
          {
            chartAccountId: dto.paymentAccountId,
            side: JournalLineSide.CREDIT,
            amount: dto.amount,
            description: dto.reference ?? dto.narration,
          },
        ],
      },
      actor,
    );
  }

  async createReceiptVoucher(dto: ReceiptVoucherDto, actor: AuthContext) {
    return this.createManualJournal(
      {
        entryDate: dto.entryDate,
        narration: dto.narration,
        sourceId: dto.reference,
        lines: [
          {
            chartAccountId: dto.depositAccountId,
            side: JournalLineSide.DEBIT,
            amount: dto.amount,
            description: `Receipt deposit: ${dto.narration}`,
          },
          {
            chartAccountId: dto.receiptAccountId,
            side: JournalLineSide.CREDIT,
            amount: dto.amount,
            description: dto.reference ?? dto.narration,
          },
        ],
      },
      actor,
    );
  }

  async createContraVoucher(dto: ContraVoucherDto, actor: AuthContext) {
    return this.createManualJournal(
      {
        entryDate: dto.entryDate,
        narration: dto.narration,
        lines: [
          {
            chartAccountId: dto.toAccountId,
            side: JournalLineSide.DEBIT,
            amount: dto.amount,
            description: `Contra transfer: ${dto.narration}`,
          },
          {
            chartAccountId: dto.fromAccountId,
            side: JournalLineSide.CREDIT,
            amount: dto.amount,
            description: `Contra transfer: ${dto.narration}`,
          },
        ],
      },
      actor,
    );
  }

  // ─── Slice 4: Fiscal Year Close ────────────────────────────────────

  async closeFiscalYear(fiscalYearId: string, actor: AuthContext) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, tenantId: actor.tenantId },
      include: { periods: true },
    });

    if (!fiscalYear) {
      throw new NotFoundException('Fiscal year not found');
    }

    if (fiscalYear.status === 'CLOSED') {
      throw new ConflictException('Fiscal year is already closed');
    }

    // All periods must be CLOSED
    const openPeriods = fiscalYear.periods.filter(
      (p) => p.status !== AccountingPeriodStatus.CLOSED,
    );
    if (openPeriods.length > 0) {
      throw new ConflictException(
        `All fiscal periods must be closed before closing the fiscal year. Open periods: ${openPeriods.map((p) => p.label).join(', ')}`,
      );
    }

    // Calculate net Revenue and Expense balances
    const linesGrouped = await this.prisma.journalLine.groupBy({
      by: ['chartAccountId'],
      _sum: { debit: true, credit: true },
      where: {
        tenantId: actor.tenantId,
        journalEntry: {
          tenantId: actor.tenantId,
          status: JournalEntryStatus.POSTED,
          fiscalYearId,
        },
      },
    });

    const accounts = await this.prisma.chartAccount.findMany({
      where: {
        tenantId: actor.tenantId,
        type: { in: [ChartAccountType.REVENUE, ChartAccountType.EXPENSE] },
      },
    });

    // Find retained earnings account via mapping
    const retainedEarningsMapping =
      await this.prisma.accountingReportAccountMapping.findFirst({
        where: {
          tenantId: actor.tenantId,
          // RETAINED_EARNINGS added to schema; after prisma generate this cast becomes redundant
          mappingType: 'RETAINED_EARNINGS',
        },
      });

    let retainedEarningsAccountId: string;
    if (retainedEarningsMapping) {
      retainedEarningsAccountId = retainedEarningsMapping.accountId;
    } else {
      // Fallback: use code 3100 (Retained Surplus/Deficit from default chart)
      const retainedAccount = await this.prisma.chartAccount.findFirst({
        where: { tenantId: actor.tenantId, code: '3100' },
      });
      if (!retainedAccount) {
        throw new ConflictException(
          'Retained Earnings account not found. Configure RETAINED_EARNINGS mapping or create account with code 3100.',
        );
      }
      retainedEarningsAccountId = retainedAccount.id;
    }

    const closingLines: Array<{
      chartAccountId: string;
      debit?: Prisma.Decimal | number;
      credit?: Prisma.Decimal | number;
      description?: string;
    }> = [];

    let netResult = new Prisma.Decimal(0);

    for (const account of accounts) {
      const lineData = linesGrouped.find(
        (l) => l.chartAccountId === account.id,
      );
      if (!lineData) continue;

      const debit = new Prisma.Decimal(lineData._sum.debit ?? 0);
      const credit = new Prisma.Decimal(lineData._sum.credit ?? 0);
      const net = debit.minus(credit);

      if (net.isZero()) continue;

      if (account.type === ChartAccountType.REVENUE) {
        // Revenue has credit balance → close by debiting
        const revenueNet = credit.minus(debit);
        closingLines.push({
          chartAccountId: account.id,
          debit: revenueNet,
          credit: 0,
          description: `Close revenue: ${account.name}`,
        });
        netResult = netResult.plus(revenueNet);
      } else if (account.type === ChartAccountType.EXPENSE) {
        // Expense has debit balance → close by crediting
        const expenseNet = debit.minus(credit);
        closingLines.push({
          chartAccountId: account.id,
          debit: 0,
          credit: expenseNet,
          description: `Close expense: ${account.name}`,
        });
        netResult = netResult.minus(expenseNet);
      }
    }

    if (closingLines.length === 0) {
      throw new ConflictException(
        'No revenue or expense balances to close for this fiscal year',
      );
    }

    // Add retained earnings line for the net result
    if (netResult.gt(0)) {
      // Surplus → credit retained earnings
      closingLines.push({
        chartAccountId: retainedEarningsAccountId,
        debit: 0,
        credit: netResult,
        description: `Net surplus transferred to retained earnings`,
      });
    } else if (netResult.lt(0)) {
      // Deficit → debit retained earnings
      closingLines.push({
        chartAccountId: retainedEarningsAccountId,
        debit: netResult.abs(),
        credit: 0,
        description: `Net deficit transferred to retained earnings`,
      });
    }

    // Post the closing entry via posting service
    const closingEntry = await this.postingService.postManualJournal(
      {
        tenantId: actor.tenantId,
        entryDate: fiscalYear.endDate,
        narration: `Closing entries for fiscal year ${fiscalYear.name}`,
        sourceModule: 'ACCOUNTING',
        sourceType: 'CLOSING_ENTRY',
        sourceId: fiscalYearId,
        postingType: 'FISCAL_YEAR_CLOSE',
        lines: closingLines,
      },
      actor,
    );

    // Update fiscal year status
    await this.prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: actor.userId,
        closeReason: `Fiscal year closed with closing entry ${closingEntry.entryNumber}`,
      },
    });

    await this.auditService.record({
      action: 'close',
      resource: 'fiscal_year',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: fiscalYearId,
      after: {
        closingEntryId: closingEntry.id,
        closingEntryNumber: closingEntry.entryNumber,
        netResult: netResult.toString(),
        retainedEarningsAccountId,
      },
    });

    return { fiscalYear: { ...fiscalYear, status: 'CLOSED' }, closingEntry };
  }

  async reopenFiscalYear(
    fiscalYearId: string,
    dto: ReopenFiscalPeriodDto,
    actor: AuthContext,
  ) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, tenantId: actor.tenantId },
    });

    if (!fiscalYear) {
      throw new NotFoundException('Fiscal year not found');
    }

    if (fiscalYear.status !== 'CLOSED') {
      throw new ConflictException('Fiscal year is not closed');
    }

    const updated = await this.prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        status: 'OPEN',
        reopenedAt: new Date(),
        reopenedById: actor.userId,
        reopenReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'reopen',
      resource: 'fiscal_year',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: fiscalYearId,
      after: { reason: dto.reason },
    });

    return updated;
  }

  // ─── Slice 5: Bank Reconciliation ──────────────────────────────────

  private get bankStatements() {
    return this.prisma.bankStatement;
  }

  async importBankStatement(
    accountId: string,
    lines: ImportBankStatementLineDto[],
    actor: AuthContext,
  ) {
    const sanitizedLines = this.validateBankStatementImportLines(lines);
    const account = await this.prisma.chartAccount.findFirst({
      where: { id: accountId, tenantId: actor.tenantId },
    });

    if (!account) {
      throw new NotFoundException('Account not found in this tenant');
    }

    const importBatchId = `IMPORT-${randomUUID()}`;

    const statements = (await this.prisma.$transaction(
      sanitizedLines.map((line) =>
        this.bankStatements.create({
          data: {
            tenantId: actor.tenantId,
            accountId,
            statementDate: new Date(line.statementDate),
            description: line.description,
            reference: line.reference ?? null,
            debitAmount: line.debitAmount ?? 0,
            creditAmount: line.creditAmount ?? 0,
            importBatchId,
          },
        }),
      ),
    )) as UnsafeBankStatement[];

    await this.auditService.record({
      action: 'import',
      resource: 'bank_statement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: importBatchId,
      after: { accountId, lineCount: statements.length },
    });

    return { importBatchId, count: statements.length, statements };
  }

  getUnreconciledStatements(accountId: string, actor: AuthContext) {
    return this.bankStatements.findMany({
      where: {
        tenantId: actor.tenantId,
        accountId,
        isReconciled: false,
      },
      orderBy: { statementDate: 'asc' },
    });
  }

  private validateBankStatementImportLines(
    lines: ImportBankStatementLineDto[],
  ) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException(
        'Bank statement import requires at least one line',
      );
    }

    return lines.map((line, index) => {
      const description = line.description?.trim();
      const statementDate = new Date(line.statementDate);
      const debitAmount = line.debitAmount ?? 0;
      const creditAmount = line.creditAmount ?? 0;

      if (!description) {
        throw new BadRequestException(
          `Bank statement line ${index + 1} requires a description`,
        );
      }

      if (Number.isNaN(statementDate.getTime())) {
        throw new BadRequestException(
          `Bank statement line ${index + 1} has an invalid statement date`,
        );
      }

      if (debitAmount < 0 || creditAmount < 0) {
        throw new BadRequestException(
          `Bank statement line ${index + 1} cannot have negative amounts`,
        );
      }

      if (debitAmount === 0 && creditAmount === 0) {
        throw new BadRequestException(
          `Bank statement line ${index + 1} requires a debit or credit amount`,
        );
      }

      if (debitAmount > 0 && creditAmount > 0) {
        throw new BadRequestException(
          `Bank statement line ${index + 1} cannot include both debit and credit amounts`,
        );
      }

      return {
        ...line,
        description,
        debitAmount,
        creditAmount,
      };
    });
  }

  async suggestBankReconciliationMatches(
    accountId: string,
    actor: AuthContext,
  ) {
    const statements = (await this.getUnreconciledStatements(
      accountId,
      actor,
    )) as UnsafeBankStatement[];

    const reconciledLinks = (await this.bankStatements.findMany({
      where: {
        tenantId: actor.tenantId,
        accountId,
        isReconciled: true,
        journalLineId: { not: null },
      },
      select: { journalLineId: true },
    })) as Array<{ journalLineId: string | null }>;
    const usedJournalLineIds = new Set(
      reconciledLinks
        .map((row) => row.journalLineId)
        .filter((id): id is string => Boolean(id)),
    );

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        tenantId: actor.tenantId,
        chartAccountId: accountId,
        journalEntry: { status: JournalEntryStatus.POSTED },
        id: { notIn: Array.from(usedJournalLineIds) },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'asc' } },
      take: 1000,
    });

    const suggestions = statements.map((statement) => {
      const statementAmount = bankStatementSignedAmount(statement);
      const candidates = journalLines
        .map((line) => {
          const lineAmount = new Prisma.Decimal(line.debit).gt(0)
            ? new Prisma.Decimal(line.debit)
            : new Prisma.Decimal(line.credit).mul(-1);
          const amountMatches = lineAmount.equals(statementAmount);
          const dateDistance = daysBetween(
            statement.statementDate,
            line.journalEntry.entryDate,
          );
          const referenceMatches =
            Boolean(statement.reference) &&
            normalizeMatchText(
              line.journalEntry.entryNumber ?? line.journalEntry.sourceId,
            ).includes(normalizeMatchText(statement.reference));
          const narrationScore = textSimilarity(
            statement.description,
            `${line.journalEntry.narration ?? ''} ${line.journalEntry.entryNumber ?? ''}`,
          );

          let score = 0;
          const matchedFields: string[] = [];
          if (amountMatches) {
            score += 50;
            matchedFields.push('amount');
          }
          if (dateDistance === 0) {
            score += 25;
            matchedFields.push('date');
          } else if (dateDistance <= 3) {
            score += 15;
            matchedFields.push('date_tolerance');
          }
          if (referenceMatches) {
            score += 20;
            matchedFields.push('reference');
          }
          if (narrationScore >= 0.5) {
            score += Math.round(narrationScore * 15);
            matchedFields.push('narration');
          }

          return {
            candidateJournalId: line.journalEntryId,
            ledgerTransactionId: line.id,
            bankTransactionId: statement.id,
            score,
            confidence:
              amountMatches && dateDistance === 0 && referenceMatches
                ? 'EXACT'
                : score >= 80
                  ? 'HIGH'
                  : score >= 60
                    ? 'MEDIUM'
                    : 'LOW',
            matchedFields,
            warningFlags: [] as string[],
            suggestedAction:
              score >= 80 ? 'REVIEW_AND_CONFIRM' : 'MANUAL_REVIEW',
            reason: buildMatchReason(
              amountMatches,
              dateDistance,
              narrationScore,
            ),
          };
        })
        .filter((candidate) => candidate.score >= 50)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const topScore = candidates[0]?.score;
      if (
        topScore !== undefined &&
        candidates.filter((candidate) => candidate.score === topScore).length >
          1
      ) {
        for (const candidate of candidates.filter(
          (candidate) => candidate.score === topScore,
        )) {
          candidate.warningFlags.push('DUPLICATE_CANDIDATE');
          candidate.suggestedAction = 'MANUAL_REVIEW';
        }
      }

      return {
        bankTransactionId: statement.id,
        amount: statementAmount.toFixed(2),
        statementDate: statement.statementDate,
        reference: statement.reference,
        description: statement.description,
        candidates,
      };
    });

    await this.auditService.record({
      action: 'suggest_reconciliation_matches',
      resource: 'bank_statement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: accountId,
      after: {
        statementCount: statements.length,
        suggestionCount: suggestions.reduce(
          (sum, row) => sum + row.candidates.length,
          0,
        ),
      },
    });

    return suggestions;
  }

  async reconcileStatement(
    statementId: string,
    journalLineId: string,
    actor: AuthContext,
  ) {
    const statement = (await this.bankStatements.findFirst({
      where: { id: statementId, tenantId: actor.tenantId },
    })) as UnsafeBankStatement | null;

    if (!statement) {
      throw new NotFoundException('Bank statement line not found');
    }

    if (statement.isReconciled) {
      throw new ConflictException('Statement line is already reconciled');
    }

    const journalLine = await this.prisma.journalLine.findFirst({
      where: { id: journalLineId, tenantId: actor.tenantId },
    });

    if (!journalLine) {
      throw new NotFoundException('Journal line not found in this tenant');
    }

    const updated = await this.bankStatements.update({
      where: { id: statementId },
      data: {
        isReconciled: true,
        reconciledAt: new Date(),
        reconciledById: actor.userId,
        journalLineId,
      },
    });

    await this.auditService.record({
      action: 'reconcile',
      resource: 'bank_statement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: statementId,
      after: { journalLineId },
    });

    return updated;
  }

  async getReconciliationSummary(accountId: string, actor: AuthContext) {
    const account = await this.prisma.chartAccount.findFirst({
      where: { id: accountId, tenantId: actor.tenantId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const [totalStatements, reconciledStatements] = await Promise.all([
      this.bankStatements.count({
        where: { tenantId: actor.tenantId, accountId },
      }),
      this.bankStatements.count({
        where: { tenantId: actor.tenantId, accountId, isReconciled: true },
      }),
    ]);

    const unreconciledStatements = totalStatements - reconciledStatements;

    // Sum up statement amounts
    const statementAgg = (await this.bankStatements.aggregate({
      where: { tenantId: actor.tenantId, accountId },
      _sum: { debitAmount: true, creditAmount: true },
    })) as {
      _sum: { debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal };
    };

    // Sum up ledger amounts for this account (POSTED only)
    const ledgerAgg = await this.prisma.journalLine.aggregate({
      where: {
        tenantId: actor.tenantId,
        chartAccountId: accountId,
        journalEntry: { status: JournalEntryStatus.POSTED },
      },
      _sum: { debit: true, credit: true },
    });

    return {
      accountId,
      accountCode: account.code,
      accountName: account.name,
      totalStatements,
      reconciledStatements,
      unreconciledStatements,
      statementBalance: {
        debit: statementAgg._sum.debitAmount ?? new Prisma.Decimal(0),
        credit: statementAgg._sum.creditAmount ?? new Prisma.Decimal(0),
      },
      ledgerBalance: {
        debit: ledgerAgg._sum.debit ?? new Prisma.Decimal(0),
        credit: ledgerAgg._sum.credit ?? new Prisma.Decimal(0),
      },
    };
  }

  private async ensureJournalIsMutable(id: string, tenantId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId },
      include: { fiscalPeriod: true },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status === JournalEntryStatus.REVERSED) {
      throw new ConflictException(
        'Journal entry is already reversed and immutable',
      );
    }

    if (entry.fiscalPeriod?.status === AccountingPeriodStatus.CLOSED) {
      throw new ConflictException(
        `Journal entry belongs to a closed fiscal period "${entry.fiscalPeriod.label}" and is immutable`,
      );
    }

    if (entry.fiscalPeriod?.status === AccountingPeriodStatus.LOCKED) {
      throw new ConflictException(
        `Journal entry belongs to a locked fiscal period "${entry.fiscalPeriod.label}" and is immutable. Unlock the period first.`,
      );
    }
  }
}

function sumJournalSides(
  lines: Array<{
    side?: JournalLineSide;
    amount?: number | Prisma.Decimal;
    debit?: number | Prisma.Decimal;
    credit?: number | Prisma.Decimal;
  }>,
) {
  return lines.reduce<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>(
    (totals, line) => {
      const debit = new Prisma.Decimal(
        line.debit ??
          (line.side === JournalLineSide.DEBIT ? (line.amount ?? 0) : 0),
      );
      const credit = new Prisma.Decimal(
        line.credit ??
          (line.side === JournalLineSide.CREDIT ? (line.amount ?? 0) : 0),
      );
      return {
        debit: totals.debit.add(debit),
        credit: totals.credit.add(credit),
      };
    },
    { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) },
  );
}

function sumRows(rows: Array<{ type: string; balance: number }>, type: string) {
  return rows
    .filter((row) => row.type === type)
    .reduce((sum, row) => sum + row.balance, 0);
}

export function reverseJournalSide(side: JournalLineSide) {
  return side === JournalLineSide.DEBIT
    ? JournalLineSide.CREDIT
    : JournalLineSide.DEBIT;
}

function buildFiscalPeriods(tenantId: string, startDate: Date, endDate: Date) {
  const periods: Array<{
    tenantId: string;
    label: string;
    periodNumber: number;
    startDate: Date;
    endDate: Date;
  }> = [];
  const current = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
  );
  let periodNumber = 1;

  while (current <= endDate && periodNumber <= 12) {
    const periodStart = new Date(current);
    const periodEnd = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
    );

    periods.push({
      tenantId,
      label: `${periodStart.getUTCFullYear()}-${String(
        periodStart.getUTCMonth() + 1,
      ).padStart(2, '0')}`,
      periodNumber,
      startDate: periodStart < startDate ? startDate : periodStart,
      endDate: periodEnd > endDate ? endDate : periodEnd,
    });

    current.setUTCMonth(current.getUTCMonth() + 1);
    periodNumber += 1;
  }

  return periods;
}

function bankStatementSignedAmount(statement: UnsafeBankStatement) {
  const debit = new Prisma.Decimal(statement.debitAmount ?? 0);
  const credit = new Prisma.Decimal(statement.creditAmount ?? 0);
  return debit.gt(0) ? debit : credit.mul(-1);
}

function daysBetween(a: Date, b: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.abs(
    Math.round(
      (Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) -
        Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) /
        dayMs,
    ),
  );
}

function normalizeMatchText(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const aTokens = new Set(normalizeMatchText(a).split(/\s+/).filter(Boolean));
  const bTokens = new Set(normalizeMatchText(b).split(/\s+/).filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const intersection = Array.from(aTokens).filter((token) =>
    bTokens.has(token),
  );
  return intersection.length / Math.max(aTokens.size, bTokens.size);
}

function buildMatchReason(
  amountMatches: boolean,
  dateDistance: number,
  narrationScore: number,
) {
  return [
    amountMatches ? 'amount matched' : 'amount differs',
    dateDistance === 0
      ? 'same date'
      : dateDistance <= 3
        ? `date within ${dateDistance} day(s)`
        : 'date outside tolerance',
    narrationScore >= 0.5 ? 'narration/reference similar' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function summarizeSourceModuleCoverage(
  sourceSummary: Array<{
    sourceModule: string;
    sourceType: JournalSourceType;
    status: JournalEntryStatus;
    count: number;
  }>,
) {
  const coverage = new Map<string, { posted: number; total: number }>();

  for (const row of sourceSummary) {
    const current = coverage.get(row.sourceModule) ?? { posted: 0, total: 0 };
    current.total += row.count;
    if (row.status === JournalEntryStatus.POSTED) {
      current.posted += row.count;
    }
    coverage.set(row.sourceModule, current);
  }

  return Array.from(coverage.entries())
    .map(([sourceModule, counts]) => ({
      sourceModule,
      postedCount: counts.posted,
      totalCount: counts.total,
    }))
    .sort((a, b) => a.sourceModule.localeCompare(b.sourceModule));
}

function getDefaultSchoolChartAccounts() {
  return DEFAULT_CHART_ACCOUNTS;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);

  const csvValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }

    if (typeof value === 'symbol') {
      return value.description ?? '';
    }

    if (typeof value === 'function') {
      return '[Function]';
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    if (typeof value === 'object') {
      if (
        value.constructor.name === 'Decimal' &&
        'toString' in value &&
        typeof value.toString === 'function'
      ) {
        return value.toString();
      }

      return JSON.stringify(value);
    }

    return '';
  };

  const escapeCsv = (value: unknown): string => {
    const stringValue = csvValue(value);

    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      return `"${stringValue.replaceAll('"', '""')}"`;
    }

    return stringValue;
  };

  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(','),
    ),
  ];

  return lines.join('\n');
}
