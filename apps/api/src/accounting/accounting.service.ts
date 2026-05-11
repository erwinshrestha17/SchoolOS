import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { AccountingActionDto } from './dto/accounting-action.dto';
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

    const period = await this.postingService.ensurePostingPeriodIsOpen(
      this.prisma,
      actor.tenantId,
      new Date(dto.entryDate),
    );

    const entry = await this.prisma.journalEntry.create({
      data: {
        tenantId: actor.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: null as any, // assigned when posted (or omit if optional)
        entryDate: new Date(dto.entryDate),
        status: 'DRAFT' as any,
        narration: dto.narration,
        sourceModule: 'ACCOUNTING',
        sourceType: JournalSourceType.MANUAL,
        sourceId: dto.sourceId ?? null,
        postingType: 'MANUAL',
        createdById: actor.userId,
        lines: {
          create: dto.lines.map((line, index) => ({
            tenantId: actor.tenantId,
            chartAccountId: line.chartAccountId,
            side: line.side,
            debit: line.side === JournalLineSide.DEBIT ? line.amount : 0,
            credit: line.side === JournalLineSide.CREDIT ? line.amount : 0,
            amount: line.amount,
            lineNumber: index + 1,
            description: line.description ?? dto.narration,
          })),
        },
      },
      include: { lines: true },
    });

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
    if ((entry.status as any) !== 'DRAFT') {
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

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'SUBMITTED' as any,
        submittedAt: new Date(),
        submittedById: actor.userId,
        submissionNote: dto.reason,
      } as any,
      include: { lines: true },
    });

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
    if ((entry.status as any) !== 'SUBMITTED') {
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

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'APPROVED' as any,
        approvedAt: new Date(),
        approvedById: actor.userId,
        approvalNote: dto.reason,
      } as any,
      include: { lines: true },
    });

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
    if ((entry.status as any) !== 'SUBMITTED') {
      throw new ConflictException('Only SUBMITTED journals can be rejected');
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'REJECTED' as any,
        rejectedAt: new Date(),
        rejectedById: actor.userId,
        rejectionReason: dto.reason,
      } as any,
      include: { lines: true },
    });

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
    if ((entry.status as any) !== 'APPROVED') {
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

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: JournalEntryStatus.POSTED,
        postedAt: new Date(),
        postedById: actor.userId,
        entryNumber,
      } as any,
      include: { lines: true },
    });

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
    if ((entry.status as any) !== 'DRAFT') {
      throw new ConflictException('Only DRAFT journals can be cancelled');
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'CANCELLED' as any,
        cancelledAt: new Date(),
        cancelledById: actor.userId,
        cancellationReason: dto.reason,
      } as any,
      include: { lines: true },
    });

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
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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

function getDefaultSchoolChartAccounts() {
  return [
    { code: '1000', name: 'Cash in Hand', type: ChartAccountType.ASSET },
    { code: '1010', name: 'Bank Account', type: ChartAccountType.ASSET },
    { code: '1100', name: 'Accounts Receivable', type: ChartAccountType.ASSET },
    { code: '1300', name: 'Library Assets', type: ChartAccountType.ASSET },
    { code: '1400', name: 'Equipment/Furniture', type: ChartAccountType.ASSET },
    { code: '2200', name: 'Salary Payable', type: ChartAccountType.LIABILITY },
    { code: '2210', name: 'PF Payable', type: ChartAccountType.LIABILITY },
    { code: '2220', name: 'TDS Payable', type: ChartAccountType.LIABILITY },
    { code: '2230', name: 'VAT Payable', type: ChartAccountType.LIABILITY },
    {
      code: '2240',
      name: 'Advance Fees Liability',
      type: ChartAccountType.LIABILITY,
    },
    {
      code: '3000',
      name: 'Opening Balance Equity',
      type: ChartAccountType.EQUITY,
    },
    {
      code: '3100',
      name: 'Retained Surplus/Deficit',
      type: ChartAccountType.EQUITY,
    },
    {
      code: '4010',
      name: 'Tuition Fee Income',
      type: ChartAccountType.REVENUE,
    },
    {
      code: '4020',
      name: 'Admission Fee Income',
      type: ChartAccountType.REVENUE,
    },
    { code: '4030', name: 'Exam Fee Income', type: ChartAccountType.REVENUE },
    {
      code: '4040',
      name: 'Transport Fee Income',
      type: ChartAccountType.REVENUE,
    },
    {
      code: '4050',
      name: 'Library Fine Income',
      type: ChartAccountType.REVENUE,
    },
    { code: '4090', name: 'Other Income', type: ChartAccountType.REVENUE },
    { code: '5010', name: 'Salary Expense', type: ChartAccountType.EXPENSE },
    {
      code: '5020',
      name: 'PF Employer Contribution Expense',
      type: ChartAccountType.EXPENSE,
    },
    {
      code: '5030',
      name: 'Staff Allowance Expense',
      type: ChartAccountType.EXPENSE,
    },
    {
      code: '5040',
      name: 'Stationery Expense',
      type: ChartAccountType.EXPENSE,
    },
    { code: '5050', name: 'Rent Expense', type: ChartAccountType.EXPENSE },
    { code: '5060', name: 'Utilities Expense', type: ChartAccountType.EXPENSE },
    {
      code: '5070',
      name: 'Maintenance Expense',
      type: ChartAccountType.EXPENSE,
    },
    {
      code: '5080',
      name: 'Academic Expense',
      type: ChartAccountType.EXPENSE,
    },
  ];
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
