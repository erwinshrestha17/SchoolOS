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

export enum PostingAction {
  POST = 'POST',
  REVERSE = 'REVERSE',
  CORRECT = 'CORRECT',
}

export interface CanteenTopUpPostingInput {
  tenantId: string;
  walletId: string;
  studentId: string;
  amount: Prisma.Decimal;
  paymentMethod: string;
  paymentAccountCode?: string;
  note?: string | null;
  entryDate?: Date;
}

export interface CanteenSalePostingInput {
  tenantId: string;
  saleId: string;
  studentId?: string | null;
  walletId?: string | null;
  amount: Prisma.Decimal;
  paymentMethod: string;
  paymentAccountCode?: string;
  note?: string | null;
  entryDate?: Date;
}

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

export interface InvoicePostingLineInput {
  chartAccountId?: string;
  accountCode?: string;
  accountName?: string;
  accountType?: ChartAccountType;
  amount: Prisma.Decimal;
  description: string;
}

export interface InvoicePostingInput {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  totalAmount: Prisma.Decimal;
  entryDate?: Date;
  lines: InvoicePostingLineInput[];
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
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
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
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
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
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          input.entryDate,
        ),
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
        entryNumber: entry.entryNumber,
      },
    });

    return entry;
  }

  /**
   * Post a correction for an existing journal entry.
   * This reverses the original entry and posts a new one in a single transaction.
   */
  async postCorrection(
    input: {
      tenantId: string;
      originalEntryId: string;
      correctionDate: Date;
      narration: string;
      lines: JournalPostingLineInput[];
    },
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const original = await tx.journalEntry.findFirst({
      where: { id: input.originalEntryId, tenantId: input.tenantId },
      include: { lines: true },
    });

    if (!original) {
      throw new ConflictException('Original journal entry not found');
    }

    if (original.status === JournalEntryStatus.REVERSED) {
      throw new ConflictException('Original entry is already reversed');
    }

    // 1. Post Reversal
    const reversal = await this.postReversal(
      {
        tenantId: input.tenantId,
        originalEntryId: original.id,
        reversalDate: input.correctionDate,
        narration: `Correction Reversal: ${input.narration}`,
        lines: original.lines.map((line) => ({
          chartAccountId: line.chartAccountId,
          side:
            line.side === JournalLineSide.DEBIT
              ? JournalLineSide.CREDIT
              : JournalLineSide.DEBIT,
          amount: line.amount,
          description: `Reversal for correction: ${line.description}`,
        })),
      },
      actor,
      tx,
    );

    // 2. Post New Corrected Entry
    const correction = await this.postManualJournal(
      {
        tenantId: input.tenantId,
        entryDate: input.correctionDate,
        narration: input.narration,
        sourceModule: original.sourceModule,
        sourceType: JournalSourceType.CORRECTION,
        sourceId: original.id,
        postingType: 'CORRECTION',
        lines: input.lines,
      },
      actor,
      tx,
    );

    // 3. Update original with correction link
    await tx.journalEntry.update({
      where: { id: original.id },
      data: {
        correctionOfId: correction.id, // Or use a separate field if needed, but the schema has correctionOfId
        // Wait, correctionOfId should probably be on the NEW entry pointing to OLD.
        // Let's check schema: correctionOfId String?
      },
    });

    // Actually, according to schema:
    // correctionOf   JournalEntry?  @relation("JournalEntryCorrection", fields: [correctionOfId], references: [id], onDelete: Restrict)
    // corrections  JournalEntry[] @relation("JournalEntryCorrection")
    // So the NEW entry (correction) should have correctionOfId = original.id.

    await tx.journalEntry.update({
      where: { id: correction.id },
      data: {
        correctionOfId: original.id,
      },
    });

    await this.auditService.record({
      action: 'correct',
      resource: 'journal_entry',
      tenantId: input.tenantId,
      userId: actor.userId,
      resourceId: correction.id,
      after: {
        originalEntryId: original.id,
        reversalEntryId: reversal.id,
        correctionEntryNumber: correction.entryNumber,
      },
    });

    return { reversal, correction };
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
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          input.reversalDate,
        ),
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

    const receivableAccount = await this.ensureAccount(tx, input.tenantId, {
      code: '1200',
      name: 'Student Receivables',
      type: ChartAccountType.ASSET,
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: debitAccount.id,
        side: JournalLineSide.DEBIT,
        amount: input.paymentAmount,
        description: `Fee collection via ${input.paymentMethod}: ${input.receiptNumber}`,
      },
      ...(input.lines?.length > 0
        ? input.lines.map((l) => ({
            tenantId: input.tenantId,
            chartAccountId: l.chartAccountId,
            side: JournalLineSide.CREDIT,
            amount: l.amount,
            description: l.description,
          }))
        : [
            {
              tenantId: input.tenantId,
              chartAccountId: receivableAccount.id,
              side: JournalLineSide.CREDIT,
              amount: input.paymentAmount,
              description: `Payment applied to ${input.invoiceNumber}`,
            },
          ]),
    ];

    this.ensureBalanced(lines);

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
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

  async postInvoice(
    input: InvoicePostingInput,
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
      JournalSourceType.INVOICE,
      input.invoiceId,
      'BILLING',
    );

    const receivableAccount = await this.ensureAccount(tx, input.tenantId, {
      code: '1200',
      name: 'Student Receivables',
      type: ChartAccountType.ASSET,
    });

    const lines: Prisma.JournalLineUncheckedCreateWithoutJournalEntryInput[] = [
      {
        tenantId: input.tenantId,
        chartAccountId: receivableAccount.id,
        side: JournalLineSide.DEBIT,
        amount: input.totalAmount,
        description: `Invoice ${input.invoiceNumber} for student ${input.studentId}`,
      },
    ];

    for (const line of input.lines) {
      let chartAccountId = line.chartAccountId;
      if (!chartAccountId && line.accountCode) {
        const account = await this.ensureAccount(tx, input.tenantId, {
          code: line.accountCode,
          name: line.accountName ?? 'Revenue Account',
          type: line.accountType ?? ChartAccountType.REVENUE,
        });
        chartAccountId = account.id;
      }

      if (!chartAccountId) {
        throw new ConflictException(
          `Line for invoice ${input.invoiceNumber} is missing chartAccountId or accountCode`,
        );
      }

      lines.push({
        tenantId: input.tenantId,
        chartAccountId,
        side: JournalLineSide.CREDIT,
        amount: line.amount,
        description: line.description,
      });
    }

    this.ensureBalanced(lines);

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: `Invoice ${input.invoiceNumber}`,
        sourceModule: 'FINANCE',
        sourceType: JournalSourceType.INVOICE,
        sourceId: input.invoiceId,
        postingType: 'BILLING',
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
        amount: input.totalAmount.toString(),
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
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
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
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
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

  async postCanteenTopUp(
    input: CanteenTopUpPostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      entryDate,
    );

    const cashAccount = await this.ensureAccount(tx, input.tenantId, {
      code: input.paymentAccountCode ?? '1010',
      name: 'Cash/Bank',
      type: ChartAccountType.ASSET,
    });
    const walletLiability = await this.ensureAccount(tx, input.tenantId, {
      code: '2400',
      name: 'Canteen Wallet Liability',
      type: ChartAccountType.LIABILITY,
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: cashAccount.id,
        side: JournalLineSide.DEBIT,
        amount: input.amount,
        description: `Canteen top-up via ${input.paymentMethod}`,
      },
      {
        tenantId: input.tenantId,
        chartAccountId: walletLiability.id,
        side: JournalLineSide.CREDIT,
        amount: input.amount,
        description: `Wallet top-up for student ${input.studentId}`,
      },
    ];

    this.ensureBalanced(lines);

    return tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: input.note ?? `Canteen top-up for ${input.studentId}`,
        sourceModule: 'CANTEEN',
        sourceType: JournalSourceType.ADJUSTMENT,
        sourceId: input.walletId,
        postingType: 'TOPUP',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((l, i) => ({
            ...l,
            lineNumber: i + 1,
            debit: l.side === JournalLineSide.DEBIT ? l.amount : 0,
            credit: l.side === JournalLineSide.CREDIT ? l.amount : 0,
          })),
        },
      },
    });
  }

  async postCanteenSale(
    input: CanteenSalePostingInput,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const entryDate = input.entryDate ?? new Date();
    const period = await this.ensurePostingPeriodIsOpen(
      tx,
      input.tenantId,
      entryDate,
    );

    const revenueAccount = await this.ensureAccount(tx, input.tenantId, {
      code: '4100',
      name: 'Canteen Revenue',
      type: ChartAccountType.REVENUE,
    });

    let debitAccountCode = '1010';
    let debitAccountName = 'Cash/Bank';

    if (input.paymentMethod === 'WALLET') {
      debitAccountCode = '2400';
      debitAccountName = 'Canteen Wallet Liability';
    }

    const debitAccount = await this.ensureAccount(tx, input.tenantId, {
      code: debitAccountCode,
      name: debitAccountName,
      type:
        input.paymentMethod === 'WALLET'
          ? ChartAccountType.LIABILITY
          : ChartAccountType.ASSET,
    });

    const lines = [
      {
        tenantId: input.tenantId,
        chartAccountId: debitAccount.id,
        side: JournalLineSide.DEBIT,
        amount: input.amount,
        description: `Canteen sale payment via ${input.paymentMethod}`,
      },
      {
        tenantId: input.tenantId,
        chartAccountId: revenueAccount.id,
        side: JournalLineSide.CREDIT,
        amount: input.amount,
        description: `Canteen sale revenue: ${input.saleId}`,
      },
    ];

    this.ensureBalanced(lines);

    return tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        fiscalYearId: period?.fiscalYearId ?? null,
        fiscalPeriodId: period?.id ?? null,
        entryNumber: await this.generateJournalEntryNumber(
          tx,
          input.tenantId,
          period?.fiscalYearId ?? null,
          entryDate,
        ),
        entryDate,
        status: JournalEntryStatus.POSTED,
        narration: input.note ?? `Canteen sale ${input.saleId}`,
        sourceModule: 'CANTEEN',
        sourceType: JournalSourceType.FEE_PAYMENT, // Reusing FeePayment for sale revenue for now or add CANTEEN_SALE to enum if possible
        sourceId: input.saleId,
        postingType: 'SALE',
        createdById: actor.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((l, i) => ({
            ...l,
            lineNumber: i + 1,
            debit: l.side === JournalLineSide.DEBIT ? l.amount : 0,
            credit: l.side === JournalLineSide.CREDIT ? l.amount : 0,
          })),
        },
      },
    });
  }

  public async ensurePostingPeriodIsOpen(
    tx: PostingClient,
    tenantId: string,
    entryDate: Date,
    allowLocked = false,
  ) {
    // 1. Check Fiscal Period (Primary)
    const fiscalPeriod = await tx.fiscalPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      include: {
        fiscalYear: true,
      },
    });

    if (!fiscalPeriod) {
      throw new ConflictException(
        `No fiscal period found for date ${entryDate.toISOString().split('T')[0]}`,
      );
    }

    if (fiscalPeriod.status === AccountingPeriodStatus.CLOSED) {
      throw new ConflictException(
        `Cannot post to closed fiscal period "${fiscalPeriod.label}"`,
      );
    }

    if (fiscalPeriod.status === AccountingPeriodStatus.LOCKED && !allowLocked) {
      throw new ConflictException(
        `Fiscal period "${fiscalPeriod.label}" is locked for posting.`,
      );
    }

    if (fiscalPeriod.fiscalYear.status === 'CLOSED') {
      throw new ConflictException(
        `Cannot post to fiscal period in a closed fiscal year "${fiscalPeriod.fiscalYear.name}"`,
      );
    }

    // 2. Check Global Accounting Period (Secondary/Overlay)
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
      if (
        closedPeriod.status === AccountingPeriodStatus.LOCKED &&
        allowLocked
      ) {
        // Allowed
      } else {
        throw new ConflictException(
          `Cannot post to ${closedPeriod.status.toLowerCase()} accounting period "${closedPeriod.name}"`,
        );
      }
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
    fiscalYearId: string | null,
    entryDate: Date = new Date(),
  ) {
    const year = entryDate.getUTCFullYear();
    const count = await tx.journalEntry.count({
      where: {
        tenantId,
        fiscalYearId,
      },
    });

    return `JE-${year}-${String(count + 1).padStart(6, '0')}`;
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
    lines: Array<{
      side?: JournalLineSide;
      amount?: Prisma.Decimal | number | string | Prisma.DecimalJsLike;
      debit?: Prisma.Decimal | number | string | Prisma.DecimalJsLike;
      credit?: Prisma.Decimal | number | string | Prisma.DecimalJsLike;
    }>,
  ) {
    if (lines.length < 2) {
      throw new ConflictException('Journal entry must have at least two lines.');
    }

    const totals = lines.reduce(
      (acc: { debit: Prisma.Decimal; credit: Prisma.Decimal }, line) => {
        const debit =
          line.debit !== undefined
            ? toDecimal(line.debit)
            : line.side === JournalLineSide.DEBIT
              ? toDecimal(line.amount ?? 0)
              : new Prisma.Decimal(0);

        const credit =
          line.credit !== undefined
            ? toDecimal(line.credit)
            : line.side === JournalLineSide.CREDIT
              ? toDecimal(line.amount ?? 0)
              : new Prisma.Decimal(0);

        return {
          debit: acc.debit.add(debit),
          credit: acc.credit.add(credit),
        };
      },
      {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      },
    );

    if (!totals.debit.equals(totals.credit)) {
      throw new ConflictException(
        `Journal entry is not balanced. Total Debit: ${totals.debit.toFixed(
          2,
        )}, Total Credit: ${totals.credit.toFixed(2)}. Difference: ${totals.debit
          .sub(totals.credit)
          .toFixed(2)}`,
      );
    }

    if (totals.debit.lte(0) && totals.credit.lte(0)) {
      throw new ConflictException(
        'Journal entry must have a non-zero balanced amount.',
      );
    }
  }
}

function toDecimal(value: Prisma.Decimal | number | string | Prisma.DecimalJsLike | null | undefined) {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(value as string | number);
}

function decimalText(value: Prisma.Decimal | number | string) {
  return toDecimal(value).toString();
}
