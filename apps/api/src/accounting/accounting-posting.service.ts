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

export interface FeePaymentPostingInput {
  tenantId: string;
  paymentId: string;
  invoiceNumber: string;
  receiptNumber: string;
  paymentAmount: Prisma.Decimal;
  paymentMethod: string;
  paymentAccountCode?: string;
  narration?: string | null;
  entryDate?: Date;
  lines: Array<{
    chartAccountId: string;
    amount: Prisma.Decimal;
    description: string;
  }>;
}

export interface FeeWaiverPostingInput {
  tenantId: string;
  waiverId: string;
  studentId: string;
  invoiceId?: string | null;
  amount: Prisma.Decimal;
  reason: string;
  entryDate?: Date;
}

export interface PaymentRefundPostingInput {
  tenantId: string;
  refundId: string;
  paymentId: string;
  amount: Prisma.Decimal;
  reason: string;
  paymentMethod: string;
  paymentAccountCode?: string;
  entryDate?: Date;
  lines: Array<{
    chartAccountId: string;
    amount: Prisma.Decimal;
    description: string;
  }>;
}

@Injectable()
export class AccountingPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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

    const entry = await tx.journalEntry.create({
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

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        amount: input.grossAmount.toString(),
      },
    });

    return entry;
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

    const entry = await tx.journalEntry.create({
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

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        amount: input.netAmount.toString(),
      },
    });

    return entry;
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

    const entry = await tx.journalEntry.create({
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

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
      },
    });

    return entry;
  }

  async postReversal(
    input: {
      tenantId: string;
      originalEntryId: string;
      reversalDate: Date;
      narration: string;
      lines: Array<{
        chartAccountId: string;
        side: JournalLineSide;
        amount: Prisma.Decimal;
        description: string;
      }>;
    },
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      input.reversalDate,
    );

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate: input.reversalDate,
        status: JournalEntryStatus.POSTED,
        narration: input.narration,
        sourceModule: 'ACCOUNTING',
        sourceType: JournalSourceType.REVERSAL,
        sourceId: input.originalEntryId,
        postingType: 'REVERSAL',
        reversalOfId: input.originalEntryId,
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: input.lines.map((line, index) => ({
            tenantId: input.tenantId,
            chartAccountId: line.chartAccountId,
            side: line.side,
            debit: line.side === JournalLineSide.DEBIT ? line.amount : 0,
            credit: line.side === JournalLineSide.CREDIT ? line.amount : 0,
            amount: line.amount,
            lineNumber: index + 1,
            description: line.description,
          })),
        },
      },
      include: { lines: true },
    });

    await this.auditService.record({
      action: 'reverse',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        reversalOfId: input.originalEntryId,
      },
    });

    return entry;
  }

  async postFeePayment(
    input: FeePaymentPostingInput,
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
      'FINANCE',
      JournalSourceType.FEE_PAYMENT,
      input.paymentId,
      'RECEIPT',
    );

    const debitAccount = await tx.chartAccount.findUniqueOrThrow({
      where: {
        tenantId_code: {
          tenantId: input.tenantId,
          code: input.paymentAccountCode ?? '1010',
        },
      },
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: debitAccount.id,
        side: JournalLineSide.DEBIT,
        amount: input.paymentAmount,
        description: `Fee collection via ${input.paymentMethod}`,
      },
      ...input.lines.map((line) => ({
        tenantId: input.tenantId,
        chartAccountId: line.chartAccountId,
        side: JournalLineSide.CREDIT,
        amount: line.amount,
        description: line.description,
      })),
    ];

    this.ensureBalanced(lines);

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: input.narration ?? `Fee payment ${input.receiptNumber}`,
        sourceModule: 'FINANCE',
        sourceType: JournalSourceType.FEE_PAYMENT,
        sourceId: input.paymentId,
        postingType: 'RECEIPT',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
            debit: line.side === JournalLineSide.DEBIT ? line.amount : 0,
            credit: line.side === JournalLineSide.CREDIT ? line.amount : 0,
          })),
        },
      },
    });

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        amount: input.paymentAmount.toString(),
      },
    });

    return entry;
  }

  async postFeeWaiver(
    input: FeeWaiverPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      entryDate,
    );

    const waiverExpense = await this.ensureAccount(tx, input.tenantId, {
      code: '5100',
      name: 'Fee Waivers & Discounts',
      type: ChartAccountType.EXPENSE,
    });
    const studentReceivable = await this.ensureAccount(tx, input.tenantId, {
      code: '1200',
      name: 'Student Receivables',
      type: ChartAccountType.ASSET,
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: waiverExpense.id,
        side: JournalLineSide.DEBIT,
        amount: input.amount,
        description: `Waiver: ${input.reason}`,
      },
      {
        tenantId: input.tenantId,
        chartAccountId: studentReceivable.id,
        side: JournalLineSide.CREDIT,
        amount: input.amount,
        description: `Waiver adjustment for student ${input.studentId}`,
      },
    ];

    this.ensureBalanced(lines);

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: `Fee waiver: ${input.reason}`,
        sourceModule: 'FINANCE',
        sourceType: JournalSourceType.ADJUSTMENT,
        sourceId: input.waiverId,
        postingType: 'WAIVER',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
            debit: line.side === JournalLineSide.DEBIT ? line.amount : 0,
            credit: line.side === JournalLineSide.CREDIT ? line.amount : 0,
          })),
        },
      },
    });

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        amount: input.amount.toString(),
      },
    });

    return entry;
  }

  async postPaymentRefund(
    input: PaymentRefundPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      entryDate,
    );

    const paymentAccount = await tx.chartAccount.findUniqueOrThrow({
      where: {
        tenantId_code: {
          tenantId: input.tenantId,
          code: input.paymentAccountCode ?? '1010',
        },
      },
    });

    const lines = [
      ...input.lines.map((line) => ({
        tenantId: input.tenantId,
        chartAccountId: line.chartAccountId,
        side: JournalLineSide.DEBIT,
        amount: line.amount,
        description: line.description,
      })),
      {
        tenantId: input.tenantId,
        chartAccountId: paymentAccount.id,
        side: JournalLineSide.CREDIT,
        amount: input.amount,
        description: `Cash/bank refund via ${input.paymentMethod}`,
      },
    ];

    this.ensureBalanced(lines);

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(tx, input.tenantId),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: `Payment refund: ${input.reason}`,
        sourceModule: 'FINANCE',
        sourceType: JournalSourceType.PAYMENT_REFUND,
        sourceId: input.refundId,
        postingType: 'REFUND',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((line, index) => ({
            ...line,
            lineNumber: index + 1,
            debit: line.side === JournalLineSide.DEBIT ? line.amount : 0,
            credit: line.side === JournalLineSide.CREDIT ? line.amount : 0,
          })),
        },
      },
    });

    await this.auditService.record({
      action: 'post',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: entry.id,
      after: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        amount: input.amount.toString(),
      },
    });

    return entry;
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
