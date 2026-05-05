import { ConflictException, Injectable } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  ChartAccountType,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type PostingClient = Prisma.TransactionClient | PrismaService;

export interface PayrollPostingInput {
  tenantId: string;
  payrollRunId: string;
  periodMonth: number;
  periodYear: number;
  grossAmount: Prisma.Decimal;
  deductionAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  entryDate?: Date;
}

@Injectable()
export class AccountingPostingService {
  constructor(private readonly prisma: PrismaService) {}

  async postPayrollAccrual(
    input: PayrollPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();

    await this.ensurePostingPeriodIsOpen(tx, input.tenantId, entryDate);

    const existing = await tx.journalEntry.findFirst({
      where: {
        tenantId: input.tenantId,
        sourceType: JournalSourceType.PAYROLL,
        sourceId: input.payrollRunId,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Payroll run already posted as journal entry ${existing.entryNumber}`,
      );
    }

    const salaryExpense = await this.ensureAccount(tx, input.tenantId, {
      code: '5010',
      name: 'Salary Expense',
      type: ChartAccountType.EXPENSE,
    });
    const salaryPayable = await this.ensureAccount(tx, input.tenantId, {
      code: '2200',
      name: 'Salary Payable',
      type: ChartAccountType.LIABILITY,
    });
    const statutoryPayable = await this.ensureAccount(tx, input.tenantId, {
      code: '2300',
      name: 'Statutory Deductions Payable',
      type: ChartAccountType.LIABILITY,
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: salaryExpense.id,
        side: JournalLineSide.DEBIT,
        amount: input.grossAmount,
        description: `Gross salary ${input.periodMonth}/${input.periodYear}`,
      },
      {
        tenantId: input.tenantId,
        chartAccountId: salaryPayable.id,
        side: JournalLineSide.CREDIT,
        amount: input.netAmount,
        description: `Net salary payable ${input.periodMonth}/${input.periodYear}`,
      },
    ];

    if (input.deductionAmount.gt(0)) {
      lines.push({
        tenantId: input.tenantId,
        chartAccountId: statutoryPayable.id,
        side: JournalLineSide.CREDIT,
        amount: input.deductionAmount,
        description: `Payroll deductions ${input.periodMonth}/${input.periodYear}`,
      });
    }

    this.ensureBalanced(lines);

    return tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate,
        narration: `Payroll posting ${input.periodMonth}/${input.periodYear}`,
        sourceType: JournalSourceType.PAYROLL,
        sourceId: input.payrollRunId,
        createdById: actor.userId,
        lines: {
          create: lines,
        },
      },
      include: {
        lines: true,
      },
    });
  }

  private async ensurePostingPeriodIsOpen(
    tx: PostingClient,
    tenantId: string,
    entryDate: Date,
  ) {
    const closedPeriod = await tx.accountingPeriod.findFirst({
      where: {
        tenantId,
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
  }

  private async generateJournalEntryNumber(
    tx: PostingClient,
    tenantId: string,
  ) {
    const count = await tx.journalEntry.count({
      where: { tenantId },
    });

    return `JE-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async ensureAccount(
    tx: PostingClient,
    tenantId: string,
    account: {
      code: string;
      name: string;
      type: ChartAccountType;
    },
  ) {
    return tx.chartAccount.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: account.code,
        },
      },
      update: {
        name: account.name,
        type: account.type,
        isSystem: true,
      },
      create: {
        tenantId,
        code: account.code,
        name: account.name,
        type: account.type,
        isSystem: true,
      },
    });
  }

  private ensureBalanced(
    lines: Array<{ side: JournalLineSide; amount: Prisma.Decimal }>,
  ) {
    const totals = lines.reduce(
      (acc, line) => {
        const amount = toDecimal(line.amount);

        if (line.side === JournalLineSide.DEBIT) {
          return { ...acc, debit: toDecimal(acc.debit).add(amount) };
        }

        return { ...acc, credit: toDecimal(acc.credit).add(amount) };
      },
      { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) },
    );

    if (decimalText(totals.debit) !== decimalText(totals.credit)) {
      throw new ConflictException('Accounting posting must be balanced');
    }
  }
}

function toDecimal(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value);
}

function decimalText(value: Prisma.Decimal | number | string) {
  return toDecimal(value).toString();
}
