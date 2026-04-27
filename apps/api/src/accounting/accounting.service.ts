import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AccountingPeriodStatus,
  ChartAccountType,
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
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

    if (Math.abs(totals.debit - totals.credit) > 0.01) {
      throw new ConflictException('Manual journal must be balanced');
    }

    // Period guard: reject entries posted to a CLOSED period
    const entryDate = new Date(dto.entryDate);
    const closedPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: actor.tenantId,
        status: AccountingPeriodStatus.CLOSED,
        startsOn: { lte: entryDate },
        endsOn: { gte: entryDate },
      },
    });

    if (closedPeriod) {
      throw new ConflictException(
        `Cannot post journal entry to closed accounting period "${closedPeriod.name}"`,
      );
    }

    const entry = await this.prisma.journalEntry.create({
      data: {
        tenantId: actor.tenantId,
        entryNumber: await this.generateJournalEntryNumber(actor.tenantId),
        entryDate: new Date(dto.entryDate),
        narration: dto.narration,
        sourceType: JournalSourceType.MANUAL,
        sourceId: dto.sourceId ?? null,
        createdById: actor.userId,
        lines: {
          create: dto.lines.map((line) => ({
            tenantId: actor.tenantId,
            chartAccountId: line.chartAccountId,
            side: line.side,
            amount: new Prisma.Decimal(line.amount),
            description: line.description ?? dto.narration,
          })),
        },
      },
      include: {
        lines: {
          include: { chartAccount: true },
        },
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'manual_journal',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        entryNumber: entry.entryNumber,
        debit: totals.debit,
        credit: totals.credit,
      },
    });

    return entry;
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

  async buildReports(actor: AuthContext) {
    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        journalLines: {
          include: {
            journalEntry: true,
          },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    const trialBalance = accounts.map((account) => {
      const debit = account.journalLines
        .filter((line) => line.side === JournalLineSide.DEBIT)
        .reduce((sum, line) => sum + Number(line.amount), 0);
      const credit = account.journalLines
        .filter((line) => line.side === JournalLineSide.CREDIT)
        .reduce((sum, line) => sum + Number(line.amount), 0);

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: debit - credit,
      };
    });

    const totals = trialBalance.reduce(
      (acc, row) => ({
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
      }),
      { debit: 0, credit: 0 },
    );
    const income = trialBalance
      .filter((row) => row.type === 'INCOME')
      .reduce((sum, row) => sum + row.credit - row.debit, 0);
    const expenses = trialBalance
      .filter((row) => row.type === 'EXPENSE')
      .reduce((sum, row) => sum + row.debit - row.credit, 0);

    return {
      trialBalance,
      totals,
      incomeStatement: {
        income,
        expenses,
        netIncome: income - expenses,
      },
      balanceSheet: {
        assets: sumRows(trialBalance, 'ASSET'),
        liabilities: sumRows(trialBalance, 'LIABILITY'),
        equity: sumRows(trialBalance, 'EQUITY'),
      },
      cashFlow: {
        netCashMovement: trialBalance
          .filter((row) => row.type === 'ASSET' && /cash|bank/i.test(row.name))
          .reduce((sum, row) => sum + row.balance, 0),
      },
      balanced: Math.abs(totals.debit - totals.credit) < 0.01,
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

  private async generateJournalEntryNumber(tenantId: string) {
    const count = await this.prisma.journalEntry.count({
      where: { tenantId },
    });

    return `JE-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }
}

function sumJournalSides(
  lines: Array<{ side: JournalLineSide; amount: number }>,
) {
  return lines.reduce(
    (totals, line) => ({
      debit:
        totals.debit + (line.side === JournalLineSide.DEBIT ? line.amount : 0),
      credit:
        totals.credit +
        (line.side === JournalLineSide.CREDIT ? line.amount : 0),
    }),
    { debit: 0, credit: 0 },
  );
}

function sumRows(rows: Array<{ type: string; balance: number }>, type: string) {
  return rows
    .filter((row) => row.type === type)
    .reduce((sum, row) => sum + row.balance, 0);
}
