import { ConflictException, Injectable } from '@nestjs/common';
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

type PostingClient = Prisma.TransactionClient | PrismaService;

export interface PayrollPostingInput {
  tenantId: string;
  payrollRunId: string;
  periodMonth: number;
  periodYear: number;
  grossAmount: Prisma.Decimal;
  deductionAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  pfEmployeeAmount?: Prisma.Decimal;
  pfEmployerAmount?: Prisma.Decimal;
  tdsAmount?: Prisma.Decimal;
  entryDate?: Date;
}

export interface PayrollDisbursementPostingInput {
  tenantId: string;
  payrollRunId: string;
  periodMonth: number;
  periodYear: number;
  netAmount: Prisma.Decimal;
  paymentAccountCode?: string;
  entryDate?: Date;
}

export interface JournalPostingLineInput {
  chartAccountId: string;
  debit?: Prisma.Decimal | number | string;
  credit?: Prisma.Decimal | number | string;
  description?: string | null;
}

@Injectable()
export class AccountingPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService?: AuditService,
  ) {}

  async postPayrollAccrual(
    input: PayrollPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return this.postPayrollApproval(input, actor, tx);
  }

  async postPayrollApproval(
    input: PayrollPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      entryDate,
    );

    await this.ensureNoDuplicateSource(
      tx,
      input.tenantId,
      'PAYROLL',
      JournalSourceType.PAYROLL_RUN,
      input.payrollRunId,
      'APPROVAL',
    );

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
    const pfPayable = await this.ensureAccount(tx, input.tenantId, {
      code: '2210',
      name: 'PF Payable',
      type: ChartAccountType.LIABILITY,
    });
    const tdsPayable = await this.ensureAccount(tx, input.tenantId, {
      code: '2220',
      name: 'TDS Payable',
      type: ChartAccountType.LIABILITY,
    });
    const statutoryPayable = await this.ensureAccount(tx, input.tenantId, {
      code: '2300',
      name: 'Other Payroll Deductions Payable',
      type: ChartAccountType.LIABILITY,
    });
    const pfEmployerExpense = await this.ensureAccount(tx, input.tenantId, {
      code: '5020',
      name: 'PF Employer Contribution Expense',
      type: ChartAccountType.EXPENSE,
    });

    const pfEmployeeAmount = toDecimal(input.pfEmployeeAmount ?? 0);
    const pfEmployerAmount = toDecimal(input.pfEmployerAmount ?? 0);
    const tdsAmount = toDecimal(input.tdsAmount ?? 0);
    const otherDeductions = toDecimal(input.deductionAmount)
      .sub(pfEmployeeAmount)
      .sub(tdsAmount);

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: salaryExpense.id,
        side: JournalLineSide.DEBIT,
        debit: input.grossAmount,
        credit: new Prisma.Decimal(0),
        amount: input.grossAmount,
        description: `Gross salary ${input.periodMonth}/${input.periodYear}`,
      },
      {
        tenantId: input.tenantId,
        chartAccountId: salaryPayable.id,
        side: JournalLineSide.CREDIT,
        debit: new Prisma.Decimal(0),
        credit: input.netAmount,
        amount: input.netAmount,
        description: `Net salary payable ${input.periodMonth}/${input.periodYear}`,
      },
    ];

    if (pfEmployerAmount.gt(0)) {
      lines.push({
        tenantId: input.tenantId,
        chartAccountId: pfEmployerExpense.id,
        side: JournalLineSide.DEBIT,
        debit: pfEmployerAmount,
        credit: new Prisma.Decimal(0),
        amount: pfEmployerAmount,
        description: `Employer PF ${input.periodMonth}/${input.periodYear}`,
      });
      lines.push({
        tenantId: input.tenantId,
        chartAccountId: pfPayable.id,
        side: JournalLineSide.CREDIT,
        debit: new Prisma.Decimal(0),
        credit: pfEmployerAmount,
        amount: pfEmployerAmount,
        description: `Employer PF payable ${input.periodMonth}/${input.periodYear}`,
      });
    }

    if (pfEmployeeAmount.gt(0)) {
      lines.push({
        tenantId: input.tenantId,
        chartAccountId: pfPayable.id,
        side: JournalLineSide.CREDIT,
        debit: new Prisma.Decimal(0),
        credit: pfEmployeeAmount,
        amount: pfEmployeeAmount,
        description: `Employee PF payable ${input.periodMonth}/${input.periodYear}`,
      });
    }

    if (tdsAmount.gt(0)) {
      lines.push({
        tenantId: input.tenantId,
        chartAccountId: tdsPayable.id,
        side: JournalLineSide.CREDIT,
        debit: new Prisma.Decimal(0),
        credit: tdsAmount,
        amount: tdsAmount,
        description: `TDS payable ${input.periodMonth}/${input.periodYear}`,
      });
    }

    if (otherDeductions.gt(0)) {
      lines.push({
        tenantId: input.tenantId,
        chartAccountId: statutoryPayable.id,
        side: JournalLineSide.CREDIT,
        debit: new Prisma.Decimal(0),
        credit: otherDeductions,
        amount: otherDeductions,
        description: `Payroll deductions ${input.periodMonth}/${input.periodYear}`,
      });
    }

    this.ensureBalanced(lines);

    return tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: `Payroll posting ${input.periodMonth}/${input.periodYear}`,
        sourceModule: 'PAYROLL',
        sourceType: JournalSourceType.PAYROLL_RUN,
        sourceId: input.payrollRunId,
        postingType: 'APPROVAL',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
          })),
        },
      },
      include: {
        lines: true,
      },
    });
  }

  async postPayrollDisbursement(
    input: PayrollDisbursementPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      entryDate,
    );

    await this.ensureNoDuplicateSource(
      tx,
      input.tenantId,
      'PAYROLL',
      JournalSourceType.PAYROLL_DISBURSEMENT,
      input.payrollRunId,
      'DISBURSEMENT',
    );

    const salaryPayable = await this.ensureAccount(tx, input.tenantId, {
      code: '2200',
      name: 'Salary Payable',
      type: ChartAccountType.LIABILITY,
    });
    const paymentAccount = await this.ensureAccount(tx, input.tenantId, {
      code: input.paymentAccountCode ?? '1010',
      name:
        input.paymentAccountCode === '1000' ? 'Cash in Hand' : 'Bank Account',
      type: ChartAccountType.ASSET,
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: salaryPayable.id,
        side: JournalLineSide.DEBIT,
        debit: input.netAmount,
        credit: new Prisma.Decimal(0),
        amount: input.netAmount,
        description: `Salary disbursement ${input.periodMonth}/${input.periodYear}`,
      },
      {
        tenantId: input.tenantId,
        chartAccountId: paymentAccount.id,
        side: JournalLineSide.CREDIT,
        debit: new Prisma.Decimal(0),
        credit: input.netAmount,
        amount: input.netAmount,
        description: `Cash/bank salary payment ${input.periodMonth}/${input.periodYear}`,
      },
    ];

    this.ensureBalanced(lines);

    return tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: `Payroll disbursement ${input.periodMonth}/${input.periodYear}`,
        sourceModule: 'PAYROLL',
        sourceType: JournalSourceType.PAYROLL_DISBURSEMENT,
        sourceId: input.payrollRunId,
        postingType: 'DISBURSEMENT',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async postManualJournal(
    input: {
      tenantId: string;
      entryDate: Date;
      narration: string;
      sourceModule?: string | null;
      sourceType?: JournalSourceType;
      sourceId?: string | null;
      postingType?: string | null;
      lines: JournalPostingLineInput[];
    },
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      input.entryDate,
    );
    const lines = input.lines.map((line, index) => {
      const debit = toDecimal(line.debit ?? 0);
      const credit = toDecimal(line.credit ?? 0);
      const side = debit.gt(0) ? JournalLineSide.DEBIT : JournalLineSide.CREDIT;
      const amount = debit.gt(0) ? debit : credit;

      return {
        tenantId: input.tenantId,
        chartAccountId: line.chartAccountId,
        side,
        debit,
        credit,
        amount,
        lineNumber: index + 1,
        description: line.description ?? input.narration,
      };
    });

    this.ensureBalanced(lines);

    return tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate: input.entryDate,
        status: JournalEntryStatus.POSTED,
        narration: input.narration,
        sourceModule: input.sourceModule ?? 'ACCOUNTING',
        sourceType: input.sourceType ?? JournalSourceType.MANUAL,
        sourceId: input.sourceId ?? null,
        postingType: input.postingType ?? 'MANUAL',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: { create: lines },
      },
      include: { lines: true },
    });
  }

  async postFeePayment() {
    throw new ConflictException(
      'Fee payment posting remains owned by the existing finance workflow in this phase.',
    );
  }

  async reverseJournal() {
    throw new ConflictException(
      'Use AccountingService.reverseJournalEntry for audited reversals.',
    );
  }

  async postAdjustment() {
    throw new ConflictException(
      'Use AccountingService correction/adjustment endpoints for audited adjustments.',
    );
  }

  private async ensurePostingPeriodIsOpen(
    tx: PostingClient,
    tenantId: string,
    entryDate: Date,
  ) {
    const fiscalPeriod = await tx.fiscalPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    if (fiscalPeriod && fiscalPeriod.status !== AccountingPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post journal entry to ${fiscalPeriod.status.toLowerCase()} fiscal period "${fiscalPeriod.label}"`,
      );
    }

    const closedPeriod = await tx.accountingPeriod.findFirst({
      where: {
        tenantId,
        status: {
          in: [AccountingPeriodStatus.LOCKED, AccountingPeriodStatus.CLOSED],
        },
        startsOn: { lte: entryDate },
        endsOn: { gte: entryDate },
      },
    });

    if (closedPeriod) {
      throw new ConflictException(
        `Cannot post journal entry to closed accounting period "${closedPeriod.name}"`,
      );
    }

    return fiscalPeriod;
  }

  private async ensureNoDuplicateSource(
    tx: PostingClient,
    tenantId: string,
    sourceModule: string,
    sourceType: JournalSourceType,
    sourceId: string,
    postingType: string,
  ) {
    const existing = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        OR: [
          { sourceModule, sourceType, sourceId, postingType },
          { sourceType, sourceId, postingType },
          { sourceType: JournalSourceType.PAYROLL, sourceId },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        `Source document already posted as journal entry ${existing.entryNumber}`,
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
