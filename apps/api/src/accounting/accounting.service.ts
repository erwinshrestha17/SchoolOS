import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { BankReconciliationService } from './bank-reconciliation.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

import {
  AccountingPeriodStatus,
  AccountingPostingBatchStatus,
  ApprovalWorkflowType,
  ChartAccountType,
  JournalEntryStatus,
  JournalLineSide,
  JournalSourceType,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import { formatBsDate } from '@schoolos/core';
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
import { CloseFiscalYearDto } from './dto/close-fiscal-year.dto';
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
  bankStatementImportFingerprint,
  validateBankStatementImportLines,
} from './bank-statement-import.util';
import {
  ExpenseVoucherDto,
  PaymentVoucherDto,
  ReceiptVoucherDto,
  ContraVoucherDto,
} from './dto/voucher.dto';
import {
  DEFAULT_CHART_ACCOUNTS,
  resolveCashAccountCode,
} from '../finance/finance.defaults';
import { ApprovalWorkflowService } from '../advanced-operations/approval-workflow.service';
import { ListPostingBatchesQueryDto } from './dto/list-posting-batches.query.dto';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';
import {
  journalAllowedActions,
  journalDutyPermission,
  journalSourceFingerprint,
  requireJournalDuty,
  type JournalDuty,
} from '../authorization/policies/journal.policy';

export interface UnsafeBankStatement {
  id: string;
  accountId: string;
  statementDate: Date;
  description: string;
  reference?: string | null;
  debitAmount?: Prisma.Decimal | number | string | null;
  creditAmount?: Prisma.Decimal | number | string | null;
  isReconciled: boolean;
  journalLineId?: string | null;
  [key: string]: unknown;
}

@Injectable()
export class AccountingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly postingService: AccountingPostingService,
    @Optional()
    private readonly approvalWorkflowService?: ApprovalWorkflowService,
  ) {}

  onModuleInit() {
    this.approvalWorkflowService?.registerFinalAction(
      'accounting.fiscal_period.reopen',
      {
        apply: async ({ tenantId, targetId, payload, actor, tx }) => {
          if (tenantId !== actor.tenantId) {
            throw new NotFoundException('Fiscal period not found');
          }
          if (!tx)
            throw new ConflictException(
              'Fiscal reopen requires atomic approval execution',
            );
          const reason = readRequiredReason(payload);
          return this.applyApprovedFiscalPeriodReopen(
            targetId,
            reason,
            actor,
            tx,
          );
        },
      },
    );
    this.approvalWorkflowService?.registerFinalAction(
      'accounting.fiscal_year.reopen',
      {
        apply: async ({ tenantId, targetId, payload, actor, tx }) => {
          if (tenantId !== actor.tenantId)
            throw new NotFoundException('Fiscal year not found');
          if (!tx)
            throw new ConflictException(
              'Fiscal reopen requires atomic approval execution',
            );
          return this.applyApprovedFiscalYearReopen(
            targetId,
            readRequiredReason(payload),
            actor,
            tx,
          );
        },
      },
    );
  }

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

  async listPostingBatches(
    query: ListPostingBatchesQueryDto,
    actor: AuthContext,
  ) {
    const where: Prisma.AccountingPostingBatchWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceModule
        ? { sourceModule: query.sourceModule.trim().toUpperCase() }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [batches, total] = await Promise.all([
      this.prisma.accountingPostingBatch.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: query.limit,
        select: {
          id: true,
          sourceModule: true,
          sourceType: true,
          sourceBatchId: true,
          postingType: true,
          status: true,
          fiscalYearId: true,
          fiscalPeriodId: true,
          sourceTotal: true,
          postedTotal: true,
          reconciliationDifference: true,
          journalEntryId: true,
          failureCode: true,
          failureDetail: true,
          retryCount: true,
          postedAt: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.accountingPostingBatch.count({ where }),
    ]);

    return {
      items: batches.map((batch) => ({
        ...batch,
        sourceTotal: batch.sourceTotal.toFixed(2),
        postedTotal: batch.postedTotal.toFixed(2),
        reconciliationDifference: batch.reconciliationDifference.toFixed(2),
        itemCount: batch._count.items,
        _count: undefined,
      })),
      page: query.page,
      limit: query.limit,
      total,
      hasNextPage: skip + batches.length < total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async retryPostingBatch(id: string, actor: AuthContext) {
    const batch = await this.prisma.accountingPostingBatch.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!batch) {
      throw new NotFoundException('Source posting batch not found');
    }
    if (batch.status === AccountingPostingBatchStatus.POSTED) {
      return this.serializePostingBatch(batch);
    }
    if (batch.status !== AccountingPostingBatchStatus.FAILED) {
      throw new ConflictException(
        `Only failed source posting batches can be retried. Current status: ${batch.status}.`,
      );
    }

    const claimed = await this.prisma.accountingPostingBatch.updateMany({
      where: {
        id: batch.id,
        tenantId: actor.tenantId,
        status: AccountingPostingBatchStatus.FAILED,
      },
      data: {
        status: AccountingPostingBatchStatus.POSTING,
        retryCount: { increment: 1 },
        failureCode: null,
        failureDetail: null,
        requestedById: actor.userId,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'This source posting batch is already being retried. Refresh before trying again.',
      );
    }

    try {
      await this.replaySourcePostingBatch(batch, actor);
      const posted = await this.prisma.accountingPostingBatch.findFirstOrThrow({
        where: { id: batch.id, tenantId: actor.tenantId },
      });
      await this.auditService.record({
        action: 'retry',
        resource: 'accounting_posting_batch',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: batch.id,
        before: { status: batch.status, retryCount: batch.retryCount },
        after: { status: posted.status, retryCount: posted.retryCount },
      });
      return this.serializePostingBatch(posted);
    } catch (error) {
      const failureDetail =
        error instanceof ConflictException || error instanceof NotFoundException
          ? error.message
          : 'The source posting retry failed. Review account mappings and the fiscal period before retrying.';
      await this.prisma.accountingPostingBatch.updateMany({
        where: { id: batch.id, tenantId: actor.tenantId },
        data: {
          status: AccountingPostingBatchStatus.FAILED,
          failureCode: 'SOURCE_RETRY_FAILED',
          failureDetail,
        },
      });
      await this.auditService.record({
        action: 'retry_failed',
        resource: 'accounting_posting_batch',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: batch.id,
        before: { status: batch.status, retryCount: batch.retryCount },
        after: { status: AccountingPostingBatchStatus.FAILED, failureDetail },
      });
      throw new ConflictException(failureDetail);
    }
  }

  private async replaySourcePostingBatch(
    batch: {
      sourceModule: string;
      sourceType: string;
      sourceBatchId: string;
      postingType: string;
    },
    actor: AuthContext,
  ) {
    if (batch.sourceModule === 'M7') {
      const run = await this.prisma.payrollRun.findFirst({
        where: { id: batch.sourceBatchId, tenantId: actor.tenantId },
      });
      if (!run) throw new NotFoundException('Payroll source record not found');
      if (batch.postingType === 'APPROVAL') {
        await this.postingService.postPayrollAccrual(
          {
            tenantId: actor.tenantId,
            payrollRunId: run.id,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            grossAmount: run.grossAmount,
            deductionAmount: run.deductionAmount,
            netAmount: run.netAmount,
            pfEmployeeAmount: run.pfEmployeeAmount,
            pfEmployerAmount: run.pfEmployerAmount,
            tdsAmount: run.tdsAmount,
            entryDate: run.periodEnd ?? run.updatedAt,
          },
          actor,
        );
        return;
      }
      if (batch.postingType === 'DISBURSEMENT') {
        await this.postingService.postPayrollDisbursement(
          {
            tenantId: actor.tenantId,
            payrollRunId: run.id,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            netAmount: run.netAmount,
            entryDate: run.paidAt ?? run.updatedAt,
          },
          actor,
        );
        return;
      }
    }

    if (batch.sourceModule === 'M3' && batch.postingType === 'RECEIPT') {
      const payment = await this.prisma.payment.findFirst({
        where: { id: batch.sourceBatchId, tenantId: actor.tenantId },
        include: { invoice: true, receipt: true },
      });
      if (!payment?.receipt) {
        throw new NotFoundException('Fee payment source record not found');
      }
      await this.postingService.postFeePayment(
        {
          tenantId: actor.tenantId,
          paymentId: payment.id,
          invoiceNumber:
            payment.invoice?.invoiceNumber ?? 'Unallocated advance',
          receiptNumber: payment.receipt.receiptNumber,
          paymentAmount: payment.amount,
          paymentMethod: payment.method,
          paymentAccountCode: resolveCashAccountCode(payment.method),
          narration: payment.narration,
          entryDate: payment.paidAt,
          lines: [],
        },
        actor,
      );
      return;
    }

    if (batch.sourceModule === 'M3' && batch.postingType === 'BILLING') {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: batch.sourceBatchId, tenantId: actor.tenantId },
        include: { lines: { include: { feeHead: true } } },
      });
      if (!invoice)
        throw new NotFoundException('Invoice source record not found');
      await this.postingService.postInvoice(
        {
          tenantId: actor.tenantId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          studentId: invoice.studentId,
          totalAmount: invoice.totalAmount,
          entryDate: invoice.issuedAt,
          lines: invoice.lines.map((line) => ({
            accountCode: incomeAccountCodeForFeeHead(line.feeHead.code),
            accountName: line.feeHead.name,
            accountType: ChartAccountType.REVENUE,
            amount: line.totalAmount,
            description: `Revenue from ${line.feeHead.name}`,
          })),
        },
        actor,
      );
      return;
    }

    if (batch.sourceModule === 'M3' && batch.postingType === 'WAIVER') {
      const waiver = await this.prisma.feeWaiver.findFirst({
        where: { id: batch.sourceBatchId, tenantId: actor.tenantId },
      });
      if (!waiver)
        throw new NotFoundException('Fee waiver source record not found');
      await this.postingService.postFeeWaiver(
        {
          tenantId: actor.tenantId,
          waiverId: waiver.id,
          studentId: waiver.studentId,
          invoiceId: waiver.invoiceId,
          amount: waiver.amount,
          reason: waiver.reason,
          entryDate: waiver.approvedAt ?? waiver.createdAt,
        },
        actor,
      );
      return;
    }

    if (batch.sourceModule === 'M3' && batch.postingType === 'REFUND') {
      const refund = await this.prisma.paymentRefund.findFirst({
        where: { id: batch.sourceBatchId, tenantId: actor.tenantId },
        include: { payment: true },
      });
      if (!refund)
        throw new NotFoundException('Payment refund source record not found');
      const receivable = await this.prisma.chartAccount.findUniqueOrThrow({
        where: {
          tenantId_code: { tenantId: actor.tenantId, code: '1200' },
        },
      });
      await this.postingService.postPaymentRefund(
        {
          tenantId: actor.tenantId,
          refundId: refund.id,
          paymentId: refund.paymentId,
          amount: refund.amount,
          reason: refund.reason,
          paymentMethod: refund.payment.method,
          paymentAccountCode: resolveCashAccountCode(refund.payment.method),
          entryDate: refund.refundDate,
          lines: [
            {
              chartAccountId: receivable.id,
              amount: refund.amount,
              description: 'Student receivable refund reversal',
            },
          ],
        },
        actor,
      );
      return;
    }

    throw new ConflictException(
      'This source posting type is not eligible for an automated retry.',
    );
  }

  private serializePostingBatch<
    T extends {
      sourceTotal: Prisma.Decimal;
      postedTotal: Prisma.Decimal;
      reconciliationDifference: Prisma.Decimal;
      [key: string]: unknown;
    },
  >(batch: T) {
    return {
      ...batch,
      sourceTotal: batch.sourceTotal.toFixed(2),
      postedTotal: batch.postedTotal.toFixed(2),
      reconciliationDifference: batch.reconciliationDifference.toFixed(2),
    };
  }

  async createPeriod(dto: CreateAccountingPeriodDto, actor: AuthContext) {
    void dto;
    void actor;
    return Promise.reject(
      new BadRequestException(
        'Legacy accounting periods are read-only. Create a fiscal year and use its fiscal periods.',
      ),
    );
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

  private async journalTransaction<T>(
    actor: AuthContext,
    permission: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    requireDomainPermission(actor, permission);
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        permission,
        [],
        work,
        false,
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isFinancialTransactionConflict(error))
        throw new ConflictException(
          'The financial record changed concurrently. Reload before retrying.',
        );
      throw error;
    }
  }

  async createManualJournal(dto: CreateManualJournalDto, actor: AuthContext) {
    return this.journalTransaction(
      actor,
      'accounting:journals:create',
      async (tx) => {
        const accountIds = dto.lines.map((line) => line.chartAccountId);
        const accounts = await tx.chartAccount.findMany({
          where: {
            tenantId: actor.tenantId,
            id: { in: accountIds },
            isActive: true,
          },
        });
        if (accounts.length !== new Set(accountIds).size)
          throw new NotFoundException(
            'One or more active chart accounts were not found',
          );
        const totals = sumJournalSides(dto.lines);
        if (!totals.debit.eq(totals.credit))
          throw new ConflictException('Manual journal must be balanced');
        const entryDate = new Date(dto.entryDate);
        await this.postingService.lockPostingPeriod(
          tx,
          actor.tenantId,
          entryDate,
        );
        const entry = await this.postingService.createDraftJournal(
          {
            tenantId: actor.tenantId,
            entryDate,
            narration: dto.narration,
            sourceModule: 'ACCOUNTING',
            sourceType: JournalSourceType.MANUAL,
            sourceId: dto.sourceId ?? null,
            lines: dto.lines.map((line) => ({
              chartAccountId: line.chartAccountId,
              side: line.side,
              amount: new Prisma.Decimal(line.amount),
              description: line.description,
            })),
          },
          actor,
          tx,
        );
        return {
          ...this.journalProjection(entry),
          allowedActions: journalAllowedActions(actor, entry),
        };
      },
    );
  }

  private async transitionManualJournal(
    id: string,
    duty: JournalDuty,
    actor: AuthContext,
    reason?: string,
  ) {
    return this.journalTransaction(
      actor,
      journalDutyPermission(duty),
      async (tx) => {
        const entry = await tx.journalEntry.findFirst({
          where: { id, tenantId: actor.tenantId },
          include: { lines: true },
        });
        if (!entry)
          throw new NotFoundException('Journal entry not found in this tenant');
        requireJournalDuty(actor, entry, duty);
        if (['REJECT', 'CANCEL'].includes(duty) && !reason?.trim())
          throw new BadRequestException('A reason is required');
        const totals = sumJournalSides(entry.lines);
        if (entry.lines.length < 2 || !totals.debit.eq(totals.credit))
          throw new ConflictException(
            'Journal must have at least two balanced lines',
          );
        if (
          entry.lines.some(
            (line) =>
              !line.amount.gt(0) ||
              line.amount.decimalPlaces() > 2 ||
              !line.debit.eq(
                line.side === JournalLineSide.DEBIT ? line.amount : 0,
              ) ||
              !line.credit.eq(
                line.side === JournalLineSide.CREDIT ? line.amount : 0,
              ),
          )
        )
          throw new ConflictException('Journal line amounts are inconsistent');
        const fingerprint = journalSourceFingerprint(entry);
        if (duty === 'POST' && entry.approvedSourceFingerprint !== fingerprint)
          throw new ConflictException(
            'Journal sources changed after approval. Obtain a new independent review and approval.',
          );
        const data: Prisma.JournalEntryUpdateManyMutationInput = {};
        if (!['REJECT', 'CANCEL'].includes(duty)) {
          const period = await this.postingService.lockPostingPeriod(
            tx,
            actor.tenantId,
            entry.entryDate,
          );
          const activeCount = await tx.chartAccount.count({
            where: {
              tenantId: actor.tenantId,
              id: {
                in: [
                  ...new Set(entry.lines.map((line) => line.chartAccountId)),
                ],
              },
              isActive: true,
            },
          });
          if (
            activeCount !==
            new Set(entry.lines.map((line) => line.chartAccountId)).size
          )
            throw new ConflictException(
              'A journal account is no longer active',
            );
          if (duty === 'POST') {
            data.entryNumber =
              await this.postingService.generateJournalEntryNumber(
                tx,
                actor.tenantId,
                period.fiscalYearId,
                entry.entryDate,
              );
            data.postedAt = new Date();
            data.postedById = actor.userId;
          }
        }
        switch (duty) {
          case 'SUBMIT':
            Object.assign(data, {
              status: JournalEntryStatus.SUBMITTED,
              submittedAt: new Date(),
              submittedById: actor.userId,
              submissionNote: reason,
            });
            break;
          case 'REVIEW':
            Object.assign(data, {
              status: JournalEntryStatus.REVIEWED,
              reviewedAt: new Date(),
              reviewedById: actor.userId,
              reviewNote: reason,
            });
            break;
          case 'APPROVE':
            Object.assign(data, {
              status: JournalEntryStatus.APPROVED,
              approvedAt: new Date(),
              approvedById: actor.userId,
              approvalNote: reason,
              approvedSourceFingerprint: fingerprint,
            });
            break;
          case 'POST':
            data.status = JournalEntryStatus.POSTED;
            break;
          case 'REJECT':
            Object.assign(data, {
              status: JournalEntryStatus.REJECTED,
              rejectedAt: new Date(),
              rejectedById: actor.userId,
              rejectionReason: reason?.trim(),
            });
            break;
          case 'CANCEL':
            Object.assign(data, {
              status: JournalEntryStatus.CANCELLED,
              cancelledAt: new Date(),
              cancelledById: actor.userId,
              cancellationReason: reason?.trim(),
            });
            break;
        }
        const claim =
          await this.postingService.compareAndSetUnpostedManualJournal(
            entry.id,
            actor,
            {
              status: entry.status,
              createdById: entry.createdById,
              reviewedById: entry.reviewedById,
              approvedById: entry.approvedById,
              approvedSourceFingerprint: entry.approvedSourceFingerprint,
            },
            data,
            tx,
          );
        if (claim.count !== 1)
          throw new ConflictException(
            'Journal changed concurrently. Reload before retrying.',
          );
        await this.auditService.record(
          {
            action: duty.toLowerCase(),
            resource: 'journal_entry',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: entry.id,
            before: { status: entry.status },
            after: {
              status: data.status,
              reason,
              entryNumber: data.entryNumber,
              actorUserId: actor.userId,
            },
          },
          tx,
        );
        const updated = await tx.journalEntry.findFirstOrThrow({
          where: { id: entry.id, tenantId: actor.tenantId },
          include: { lines: { include: { chartAccount: true } } },
        });
        return {
          ...this.journalProjection(updated),
          allowedActions: journalAllowedActions(actor, updated),
        };
      },
    );
  }

  async submitManualJournal(
    id: string,
    dto: SubmitJournalDto,
    actor: AuthContext,
  ) {
    return this.transitionManualJournal(id, 'SUBMIT', actor, dto.reason);
  }
  async reviewManualJournal(
    id: string,
    dto: ApproveJournalDto,
    actor: AuthContext,
  ) {
    return this.transitionManualJournal(id, 'REVIEW', actor, dto.reason);
  }
  async approveManualJournal(
    id: string,
    dto: ApproveJournalDto,
    actor: AuthContext,
  ) {
    return this.transitionManualJournal(id, 'APPROVE', actor, dto.reason);
  }
  async rejectManualJournal(
    id: string,
    dto: RejectJournalDto,
    actor: AuthContext,
  ) {
    return this.transitionManualJournal(id, 'REJECT', actor, dto.reason);
  }
  async postApprovedManualJournal(
    id: string,
    _dto: PostJournalDto,
    actor: AuthContext,
  ) {
    return this.transitionManualJournal(id, 'POST', actor);
  }
  async cancelManualJournal(
    id: string,
    dto: CancelJournalDto,
    actor: AuthContext,
  ) {
    return this.transitionManualJournal(id, 'CANCEL', actor, dto.reason);
  }

  private journalProjection<
    T extends {
      approvedSourceFingerprint?: string | null;
      lines: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>;
    },
  >(entry: T) {
    const totals = sumJournalSides(entry.lines);
    const { approvedSourceFingerprint: _internalFingerprint, ...record } =
      entry;
    return {
      ...record,
      totalDebit: totals.debit.toNumber(),
      totalCredit: totals.credit.toNumber(),
    };
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

    if (entry?.tenantId !== actor.tenantId) {
      throw new NotFoundException('Journal entry not found in this tenant');
    }

    return {
      ...this.journalProjection(entry),
      allowedActions: journalAllowedActions(actor, entry),
    };
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
    void id;
    void actor;
    return Promise.reject(
      new BadRequestException(
        'Legacy accounting periods are read-only. Close the linked fiscal period through Fiscal Periods.',
      ),
    );
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
        reopenedWarning: false,
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
    return this.journalTransaction(
      actor,
      'accounting:fiscal:manage',
      async (tx) => {
        const period = await tx.fiscalPeriod.findFirst({
          where: { id, tenantId: actor.tenantId },
        });
        if (!period) throw new NotFoundException('Fiscal period not found');
        if (period.status === AccountingPeriodStatus.CLOSED)
          throw new ConflictException('Fiscal period is already closed');
        if (period.status !== AccountingPeriodStatus.LOCKED)
          throw new ConflictException(
            'Fiscal period must be LOCKED before closing.',
          );
        const claim = await tx.fiscalPeriod.updateMany({
          where: {
            id,
            tenantId: actor.tenantId,
            status: AccountingPeriodStatus.LOCKED,
          },
          data: {
            status: AccountingPeriodStatus.CLOSED,
            closedAt: new Date(),
            closedById: actor.userId,
            closeReason: dto.reason,
          },
        });
        if (claim.count !== 1)
          throw new ConflictException('Fiscal period changed before close');
        const readiness = await this.getFiscalPeriodCloseReadiness(
          id,
          actor,
          tx,
        );
        if (!readiness.readyToClose)
          throw new ConflictException(
            `Fiscal period cannot be closed until these blockers are resolved: ${readiness.blockers.map((blocker) => blocker.code).join(', ')}`,
          );
        const previousPeriod = await tx.fiscalPeriod.findFirst({
          where: {
            tenantId: actor.tenantId,
            fiscalYearId: period.fiscalYearId,
            periodNumber: period.periodNumber - 1,
          },
        });
        if (
          previousPeriod &&
          previousPeriod.status !== AccountingPeriodStatus.CLOSED
        )
          throw new ConflictException(
            `Previous fiscal period "${previousPeriod.label}" must be closed first.`,
          );
        const updated = await tx.fiscalPeriod.findFirstOrThrow({
          where: { id, tenantId: actor.tenantId },
        });
        await this.auditService.record(
          {
            action: 'close',
            resource: 'fiscal_period',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            before: { status: period.status },
            after: { status: updated.status, reason: dto.reason },
          },
          tx,
        );
        return updated;
      },
    );
  }

  async getFiscalPeriodCloseReadiness(
    id: string,
    actor: AuthContext,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const period = await client.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { fiscalYear: { select: { name: true } } },
    });
    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    const sourceTypes = [
      JournalSourceType.INVOICE,
      JournalSourceType.FEE_PAYMENT,
      JournalSourceType.PAYMENT_REFUND,
      JournalSourceType.PAYROLL,
      JournalSourceType.PAYROLL_RUN,
      JournalSourceType.PAYROLL_DISBURSEMENT,
      JournalSourceType.ADJUSTMENT,
    ];
    const [
      journalStatuses,
      postedSourceWithoutMapping,
      unreconciledBankItems,
      unresolvedReconciliations,
      trialBalance,
      unbalancedRows,
    ] = await Promise.all([
      client.journalEntry.groupBy({
        by: ['status'],
        where: {
          tenantId: actor.tenantId,
          fiscalPeriodId: period.id,
        },
        _count: { _all: true },
      }),
      client.journalEntry.count({
        where: {
          tenantId: actor.tenantId,
          fiscalPeriodId: period.id,
          status: JournalEntryStatus.POSTED,
          sourceType: { in: sourceTypes },
          sourceMappingId: null,
        },
      }),
      client.bankStatement.count({
        where: {
          tenantId: actor.tenantId,
          isReconciled: false,
          statementDate: { gte: period.startDate, lte: period.endDate },
        },
      }),
      new BankReconciliationService(
        this.prisma,
        this.auditService,
        this.postingService,
      ).unresolvedForPeriodClose(period.id, actor, client),
      client.journalLine.aggregate({
        where: {
          tenantId: actor.tenantId,
          journalEntry: {
            tenantId: actor.tenantId,
            fiscalPeriodId: period.id,
            status: JournalEntryStatus.POSTED,
          },
        },
        _sum: { debit: true, credit: true },
      }),
      client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::INTEGER AS "count"
        FROM (
          SELECT journal."id"
          FROM "JournalEntry" AS journal
          INNER JOIN "JournalLine" AS line
            ON line."journalEntryId" = journal."id"
            AND line."tenantId" = ${actor.tenantId}
          WHERE journal."tenantId" = ${actor.tenantId}
            AND journal."fiscalPeriodId" = ${period.id}
            AND journal."status" = ${JournalEntryStatus.POSTED}::"JournalEntryStatus"
          GROUP BY journal."id"
          HAVING COALESCE(SUM(line."debit"), 0) <> COALESCE(SUM(line."credit"), 0)
        ) AS unbalanced
      `),
    ]);

    const statusCount = (status: JournalEntryStatus) =>
      journalStatuses.find((row) => row.status === status)?._count._all ?? 0;
    const debit = new Prisma.Decimal(trialBalance._sum.debit ?? 0);
    const credit = new Prisma.Decimal(trialBalance._sum.credit ?? 0);
    const unbalancedPosted = unbalancedRows[0]?.count ?? 0;
    const blockers: Array<{
      code:
        | 'DRAFT_JOURNALS'
        | 'SUBMITTED_JOURNALS'
        | 'APPROVED_UNPOSTED_JOURNALS'
        | 'POSTED_SOURCE_WITHOUT_MAPPING'
        | 'UNRECONCILED_BANK_ITEMS'
        | 'UNFINALIZED_RECONCILIATIONS'
        | 'UNBALANCED_POSTED_JOURNALS'
        | 'UNBALANCED_TRIAL_BALANCE';
      count: number;
      safeMessage: string;
      resolutionRoute: string;
    }> = [];
    const addBlocker = (
      code: (typeof blockers)[number]['code'],
      count: number,
      safeMessage: string,
      resolutionRoute: string,
    ) => {
      if (count > 0) {
        blockers.push({ code, count, safeMessage, resolutionRoute });
      }
    };
    addBlocker(
      'DRAFT_JOURNALS',
      statusCount(JournalEntryStatus.DRAFT),
      'Draft journals must be completed or cancelled.',
      '/dashboard/accounting/journals?status=DRAFT',
    );
    addBlocker(
      'SUBMITTED_JOURNALS',
      statusCount(JournalEntryStatus.SUBMITTED),
      'Submitted journals are still awaiting a decision.',
      '/dashboard/accounting/journals?status=SUBMITTED',
    );
    addBlocker(
      'APPROVED_UNPOSTED_JOURNALS',
      statusCount(JournalEntryStatus.APPROVED),
      'Approved journals must be posted or returned through the approved workflow.',
      '/dashboard/accounting/journals?status=APPROVED',
    );
    addBlocker(
      'POSTED_SOURCE_WITHOUT_MAPPING',
      postedSourceWithoutMapping,
      'Posted source journals without mapping evidence require review.',
      '/dashboard/accounting/source-mappings',
    );
    addBlocker(
      'UNFINALIZED_RECONCILIATIONS',
      unresolvedReconciliations,
      'Reconciliation sessions must be independently reviewed, finalized, and current before period close.',
      '/dashboard/accounting/reconciliation',
    );
    addBlocker(
      'UNRECONCILED_BANK_ITEMS',
      unreconciledBankItems,
      'Bank statement items in this period remain unreconciled.',
      '/dashboard/accounting/reconciliation',
    );
    addBlocker(
      'UNBALANCED_POSTED_JOURNALS',
      unbalancedPosted,
      'One or more posted journals are unbalanced.',
      '/dashboard/accounting/journals?status=POSTED',
    );
    addBlocker(
      'UNBALANCED_TRIAL_BALANCE',
      debit.equals(credit) ? 0 : 1,
      'The period trial balance is not balanced.',
      '/dashboard/accounting/reports?report=trial-balance',
    );

    return {
      checkedAt: new Date().toISOString(),
      period: {
        id: period.id,
        fiscalYearId: period.fiscalYearId,
        fiscalYearName: period.fiscalYear.name,
        label: period.label,
        periodNumber: period.periodNumber,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
      },
      journals: {
        draft: statusCount(JournalEntryStatus.DRAFT),
        submitted: statusCount(JournalEntryStatus.SUBMITTED),
        approvedUnposted: statusCount(JournalEntryStatus.APPROVED),
        posted: statusCount(JournalEntryStatus.POSTED),
        postedSourceWithoutMapping,
        unbalancedPosted,
      },
      unreconciledBankItems,
      trialBalance: {
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        balanced: debit.equals(credit),
      },
      blockers,
      unavailableChecks: [
        'NEEDS_POSTING_FAILURE_CONTRACT' as const,
        'NEEDS_REPORT_SNAPSHOT_POLICY' as const,
      ],
      readyToClose: blockers.length === 0,
    };
  }

  async reopenFiscalPeriod(
    id: string,
    dto: ReopenFiscalPeriodDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'accounting:fiscal:reopen');
    if (!dto.reason?.trim() || dto.reason.trim().length < 10)
      throw new BadRequestException(
        'A fiscal reopen reason of at least ten characters is required',
      );
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
    if (period.status !== AccountingPeriodStatus.CLOSED) {
      throw new ConflictException(
        'Only a closed fiscal period can enter the reopen approval workflow.',
      );
    }
    if (!this.approvalWorkflowService) {
      throw new ConflictException(
        'Fiscal-period reopen approval is temporarily unavailable.',
      );
    }

    return this.approvalWorkflowService.createRequest(
      {
        workflowType: ApprovalWorkflowType.FISCAL_PERIOD_REOPEN,
        title: `Reopen fiscal period ${period.label}`,
        reason: dto.reason.trim(),
        targetModule: 'accounting',
        targetType: 'fiscal_period',
        targetId: period.id,
        beforeContext: { status: period.status, label: period.label },
        afterContext: {
          requestedStatus: AccountingPeriodStatus.OPEN,
          reopenedWarning: true,
        },
        safeContext: { fiscalPeriodId: period.id, label: period.label },
        finalActionKey: 'accounting.fiscal_period.reopen',
        finalActionPayload: { reason: dto.reason.trim() },
        idempotencyKey: dto.idempotencyKey,
      },
      actor,
    );
  }

  private async applyApprovedFiscalPeriodReopen(
    id: string,
    reason: string,
    actor: AuthContext,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT p."id" FROM "FiscalPeriod" p JOIN "FiscalYear" y ON y."id" = p."fiscalYearId"
      WHERE p."id" = ${id} AND p."tenantId" = ${actor.tenantId} AND y."tenantId" = ${actor.tenantId}
      FOR UPDATE OF y, p
    `);
    const period = await tx.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { fiscalYear: true },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (
      period.status !== AccountingPeriodStatus.CLOSED ||
      period.fiscalYear.status !== 'OPEN'
    )
      throw new ConflictException(
        'Fiscal period is no longer eligible for reopening',
      );
    const claim = await tx.fiscalPeriod.updateMany({
      where: {
        id,
        tenantId: actor.tenantId,
        status: AccountingPeriodStatus.CLOSED,
        fiscalYear: { tenantId: actor.tenantId, status: 'OPEN' },
      },
      data: {
        status: AccountingPeriodStatus.OPEN,
        reopenedAt: new Date(),
        reopenedById: actor.userId,
        reopenReason: reason,
        reopenedWarning: true,
      },
    });
    if (claim.count !== 1)
      throw new ConflictException(
        'Fiscal period changed during approved reopening',
      );
    await this.auditService.record(
      {
        action: 'reopen',
        resource: 'fiscal_period',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: id,
        before: { status: period.status },
        after: {
          status: AccountingPeriodStatus.OPEN,
          reason,
          reopenedWarning: true,
        },
      },
      tx,
    );
    return tx.fiscalPeriod.findFirstOrThrow({
      where: { id, tenantId: actor.tenantId },
    });
  }

  private async applyApprovedFiscalYearReopen(
    id: string,
    reason: string,
    actor: AuthContext,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "FiscalYear" WHERE "id" = ${id} AND "tenantId" = ${actor.tenantId} FOR UPDATE
    `);
    const year = await tx.fiscalYear.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { periods: true },
    });
    if (!year) throw new NotFoundException('Fiscal year not found');
    if (
      year.status !== 'CLOSED' ||
      year.periods.some(
        (period) => period.status !== AccountingPeriodStatus.CLOSED,
      )
    )
      throw new ConflictException(
        'Fiscal year is no longer closed with all periods closed',
      );
    const claim = await tx.fiscalYear.updateMany({
      where: { id, tenantId: actor.tenantId, status: 'CLOSED' },
      data: {
        status: 'OPEN',
        reopenedAt: new Date(),
        reopenedById: actor.userId,
        reopenReason: reason,
      },
    });
    if (claim.count !== 1)
      throw new ConflictException(
        'Fiscal year changed during approved reopening',
      );
    await this.auditService.record(
      {
        action: 'reopen',
        resource: 'fiscal_year',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: id,
        before: { status: year.status },
        after: { status: 'OPEN', reason },
      },
      tx,
    );
    return tx.fiscalYear.findFirstOrThrow({
      where: { id, tenantId: actor.tenantId },
    });
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
    const entries = await this.prisma.journalEntry.findMany({
      where: { tenantId: actor.tenantId },
      include: { lines: { include: { chartAccount: true } } },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return entries.map((entry) => ({
      ...this.journalProjection(entry),
      allowedActions: journalAllowedActions(actor, entry),
    }));
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

  async getFiscalYearCloseReadiness(
    fiscalYearId: string,
    actor: AuthContext,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const fiscalYear = await client.fiscalYear.findFirst({
      where: { id: fiscalYearId, tenantId: actor.tenantId },
      include: { periods: true },
    });
    if (!fiscalYear) {
      throw new NotFoundException('Fiscal year not found');
    }

    const sourceTypes = [
      JournalSourceType.INVOICE,
      JournalSourceType.FEE_PAYMENT,
      JournalSourceType.PAYMENT_REFUND,
      JournalSourceType.PAYROLL,
      JournalSourceType.PAYROLL_RUN,
      JournalSourceType.PAYROLL_DISBURSEMENT,
      JournalSourceType.ADJUSTMENT,
    ];
    const [
      journalStatuses,
      postedSourceWithoutMapping,
      unreconciledBankItems,
      unresolvedReconciliations,
      trialBalance,
      unbalancedRows,
      approvedUnpostedPayrollRuns,
      openingBalanceEntry,
    ] = await Promise.all([
      client.journalEntry.groupBy({
        by: ['status'],
        where: { tenantId: actor.tenantId, fiscalYearId: fiscalYear.id },
        _count: { _all: true },
      }),
      client.journalEntry.count({
        where: {
          tenantId: actor.tenantId,
          fiscalYearId: fiscalYear.id,
          status: JournalEntryStatus.POSTED,
          sourceType: { in: sourceTypes },
          sourceMappingId: null,
        },
      }),
      client.bankStatement.count({
        where: {
          tenantId: actor.tenantId,
          isReconciled: false,
          statementDate: { gte: fiscalYear.startDate, lte: fiscalYear.endDate },
        },
      }),
      Promise.all(
        fiscalYear.periods.map((period) =>
          new BankReconciliationService(
            this.prisma,
            this.auditService,
            this.postingService,
          ).unresolvedForPeriodClose(period.id, actor, client),
        ),
      ).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
      client.journalLine.aggregate({
        where: {
          tenantId: actor.tenantId,
          journalEntry: {
            tenantId: actor.tenantId,
            fiscalYearId: fiscalYear.id,
            status: JournalEntryStatus.POSTED,
          },
        },
        _sum: { debit: true, credit: true },
      }),
      client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::INTEGER AS "count"
        FROM (
          SELECT journal."id"
          FROM "JournalEntry" AS journal
          INNER JOIN "JournalLine" AS line
            ON line."journalEntryId" = journal."id"
            AND line."tenantId" = ${actor.tenantId}
          WHERE journal."tenantId" = ${actor.tenantId}
            AND journal."fiscalYearId" = ${fiscalYear.id}
            AND journal."status" = ${JournalEntryStatus.POSTED}::"JournalEntryStatus"
          GROUP BY journal."id"
          HAVING COALESCE(SUM(line."debit"), 0) <> COALESCE(SUM(line."credit"), 0)
        ) AS unbalanced
      `),
      client.payrollRun.count({
        where: {
          tenantId: actor.tenantId,
          fiscalYearId: fiscalYear.id,
          status: {
            in: [PayrollRunStatus.APPROVED, PayrollRunStatus.FINALIZED],
          },
        },
      }),
      client.journalEntry.findFirst({
        where: {
          tenantId: actor.tenantId,
          sourceType: 'OPENING_BALANCE',
          sourceId: fiscalYear.id,
        },
        select: { status: true },
      }),
    ]);

    const statusCount = (status: JournalEntryStatus) =>
      journalStatuses.find((row) => row.status === status)?._count._all ?? 0;
    const debit = new Prisma.Decimal(trialBalance._sum.debit ?? 0);
    const credit = new Prisma.Decimal(trialBalance._sum.credit ?? 0);
    const unbalancedPosted = unbalancedRows[0]?.count ?? 0;
    const periodsByStatus = {
      open: fiscalYear.periods.filter(
        (p) => p.status === AccountingPeriodStatus.OPEN,
      ).length,
      locked: fiscalYear.periods.filter(
        (p) => p.status === AccountingPeriodStatus.LOCKED,
      ).length,
      closed: fiscalYear.periods.filter(
        (p) => p.status === AccountingPeriodStatus.CLOSED,
      ).length,
    };

    type IssueSeverity = 'BLOCKING' | 'WARNING' | 'INFO';
    type IssueCode =
      | 'OPEN_PERIODS'
      | 'DRAFT_JOURNALS'
      | 'SUBMITTED_JOURNALS'
      | 'APPROVED_UNPOSTED_JOURNALS'
      | 'MISSING_SOURCE_MAPPINGS'
      | 'UNRECONCILED_BANK_ITEMS'
      | 'UNFINALIZED_RECONCILIATIONS'
      | 'UNBALANCED_JOURNALS'
      | 'TRIAL_BALANCE_NOT_READY'
      | 'OPENING_BALANCE_INCOMPLETE'
      | 'PAYROLL_POSTING_INCOMPLETE';
    const issues: Array<{
      code: IssueCode;
      severity: IssueSeverity;
      count: number;
      safeMessage: string;
      resolutionRoute: string;
    }> = [];
    const addIssue = (
      code: IssueCode,
      severity: IssueSeverity,
      count: number,
      safeMessage: string,
      resolutionRoute: string,
    ) => {
      if (count > 0) {
        issues.push({ code, severity, count, safeMessage, resolutionRoute });
      }
    };

    addIssue(
      'OPEN_PERIODS',
      'BLOCKING',
      periodsByStatus.open + periodsByStatus.locked,
      'All fiscal periods must be closed before the fiscal year can be closed.',
      '/dashboard/accounting/fiscal-periods',
    );
    addIssue(
      'DRAFT_JOURNALS',
      'BLOCKING',
      statusCount(JournalEntryStatus.DRAFT),
      'Draft journals must be completed or cancelled.',
      '/dashboard/accounting/journals?status=DRAFT',
    );
    addIssue(
      'SUBMITTED_JOURNALS',
      'BLOCKING',
      statusCount(JournalEntryStatus.SUBMITTED),
      'Submitted journals are still awaiting a decision.',
      '/dashboard/accounting/journals?status=SUBMITTED',
    );
    addIssue(
      'APPROVED_UNPOSTED_JOURNALS',
      'BLOCKING',
      statusCount(JournalEntryStatus.APPROVED),
      'Approved journals must be posted or returned through the approved workflow.',
      '/dashboard/accounting/journals?status=APPROVED',
    );
    addIssue(
      'MISSING_SOURCE_MAPPINGS',
      'BLOCKING',
      postedSourceWithoutMapping,
      'Posted source journals without mapping evidence require review.',
      '/dashboard/accounting/source-mappings',
    );
    addIssue(
      'UNFINALIZED_RECONCILIATIONS',
      'BLOCKING',
      unresolvedReconciliations,
      'Reconciliation sessions must be independently reviewed, finalized, and current before year close.',
      '/dashboard/accounting/reconciliation',
    );
    addIssue(
      'UNRECONCILED_BANK_ITEMS',
      'BLOCKING',
      unreconciledBankItems,
      'Bank statement items in this fiscal year remain unreconciled.',
      '/dashboard/accounting/reconciliation',
    );
    addIssue(
      'UNBALANCED_JOURNALS',
      'BLOCKING',
      unbalancedPosted,
      'One or more posted journals are unbalanced.',
      '/dashboard/accounting/journals?status=POSTED',
    );
    addIssue(
      'TRIAL_BALANCE_NOT_READY',
      'BLOCKING',
      debit.equals(credit) ? 0 : 1,
      'The fiscal year trial balance is not balanced.',
      '/dashboard/accounting/reports?report=trial-balance',
    );
    addIssue(
      'PAYROLL_POSTING_INCOMPLETE',
      'BLOCKING',
      approvedUnpostedPayrollRuns,
      'Approved or finalized payroll runs in this fiscal year have not been posted to the ledger.',
      '/dashboard/payroll/runs',
    );
    addIssue(
      'OPENING_BALANCE_INCOMPLETE',
      'WARNING',
      openingBalanceEntry?.status === JournalEntryStatus.POSTED ? 0 : 1,
      openingBalanceEntry
        ? 'The opening balance entry has not been posted.'
        : 'No opening balance entry has been recorded for this fiscal year.',
      '/dashboard/accounting/opening-balance',
    );

    const blockingCount = issues.filter(
      (issue) => issue.severity === 'BLOCKING',
    ).length;
    const warningCount = issues.filter(
      (issue) => issue.severity === 'WARNING',
    ).length;
    const readyToClose = blockingCount === 0;
    const readinessStatus =
      fiscalYear.status === 'CLOSED'
        ? 'CLOSED'
        : blockingCount > 0
          ? 'BLOCKED'
          : warningCount > 0
            ? 'NEEDS_ACKNOWLEDGEMENT'
            : 'READY';
    const allowedActions: Array<'CLOSE' | 'REOPEN'> =
      fiscalYear.status === 'CLOSED'
        ? ['REOPEN']
        : readyToClose
          ? ['CLOSE']
          : [];

    return {
      checkedAt: new Date().toISOString(),
      lastCalculatedAt: new Date().toISOString(),
      stale: false,
      fiscalYear: {
        id: fiscalYear.id,
        name: fiscalYear.name,
        status: fiscalYear.status,
        startDate: fiscalYear.startDate,
        endDate: fiscalYear.endDate,
        bsStartDate: formatBsDate(fiscalYear.startDate),
        bsEndDate: formatBsDate(fiscalYear.endDate),
      },
      periods: {
        total: fiscalYear.periods.length,
        ...periodsByStatus,
      },
      journals: {
        draft: statusCount(JournalEntryStatus.DRAFT),
        submitted: statusCount(JournalEntryStatus.SUBMITTED),
        approvedUnposted: statusCount(JournalEntryStatus.APPROVED),
        posted: statusCount(JournalEntryStatus.POSTED),
        postedSourceWithoutMapping,
        unbalancedPosted,
      },
      unreconciledBankItems,
      trialBalance: {
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        balanced: debit.equals(credit),
      },
      openingBalance: {
        exists: Boolean(openingBalanceEntry),
        status: openingBalanceEntry?.status ?? null,
      },
      payroll: {
        approvedUnposted: approvedUnpostedPayrollRuns,
      },
      issues,
      blockingIssueCount: blockingCount,
      warningCount,
      readinessStatus,
      allowedActions,
      unavailableChecks: [
        'NEEDS_POSTING_FAILURE_CONTRACT' as const,
        'NEEDS_REPORT_SNAPSHOT_POLICY' as const,
        'NEEDS_EXPORT_JOB_SCOPE_CONFIRMATION' as const,
        'NEEDS_FEE_POSTING_RECONCILIATION_CONTRACT' as const,
        'NEEDS_WARNING_ACKNOWLEDGEMENT_CONTRACT' as const,
      ],
      readyToClose,
    };
  }

  async closeFiscalYear(
    fiscalYearId: string,
    dto: CloseFiscalYearDto,
    actor: AuthContext,
  ) {
    return this.journalTransaction(
      actor,
      'accounting:fiscal:manage',
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "FiscalYear"
      WHERE "id" = ${fiscalYearId} AND "tenantId" = ${actor.tenantId}
      FOR UPDATE
    `);
        if (locked.length !== 1)
          throw new NotFoundException('Fiscal year not found');
        const fiscalYear = await tx.fiscalYear.findFirst({
          where: { id: fiscalYearId, tenantId: actor.tenantId },
          include: { periods: true },
        });

        if (!fiscalYear) {
          throw new NotFoundException('Fiscal year not found');
        }

        if (fiscalYear.status === 'CLOSED') {
          throw new ConflictException('Fiscal year is already closed');
        }

        const readiness = await this.getFiscalYearCloseReadiness(
          fiscalYearId,
          actor,
          tx,
        );
        if (!readiness.readyToClose) {
          throw new ConflictException(
            `Fiscal year cannot be closed until these issues are resolved: ${readiness.issues
              .filter((issue) => issue.severity === 'BLOCKING')
              .map((issue) => issue.code)
              .join(', ')}`,
          );
        }

        // Calculate net Revenue and Expense balances
        const linesGrouped = await tx.journalLine.groupBy({
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

        const accounts = await tx.chartAccount.findMany({
          where: {
            tenantId: actor.tenantId,
            type: { in: [ChartAccountType.REVENUE, ChartAccountType.EXPENSE] },
          },
        });

        // Find retained earnings account via mapping
        const retainedEarningsMapping =
          await tx.accountingReportAccountMapping.findFirst({
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
          const retainedAccount = await tx.chartAccount.findFirst({
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
            // All fiscal periods are required to be CLOSED before this point
            // (enforced by readiness), so the closing entry itself must be
            // allowed to post into an already-closed period.
            allowClosedPeriod: true,
          },
          actor,
          tx,
        );

        // Update fiscal year status
        const claim = await tx.fiscalYear.updateMany({
          where: { id: fiscalYearId, tenantId: actor.tenantId, status: 'OPEN' },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedById: actor.userId,
            closeReason: dto.reason,
          },
        });
        if (claim.count !== 1)
          throw new ConflictException('Fiscal year changed before close');

        await this.auditService.record(
          {
            action: 'close',
            resource: 'fiscal_year',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: fiscalYearId,
            before: { status: fiscalYear.status },
            after: {
              status: 'CLOSED',
              reason: dto.reason,
              closingEntryId: closingEntry.id,
              closingEntryNumber: closingEntry.entryNumber,
              netResult: netResult.toString(),
              retainedEarningsAccountId,
            },
          },
          tx,
        );

        return {
          fiscalYear: await tx.fiscalYear.findFirstOrThrow({
            where: { id: fiscalYearId, tenantId: actor.tenantId },
          }),
          closingEntry,
        };
      },
    );
  }

  async reopenFiscalYear(
    fiscalYearId: string,
    dto: ReopenFiscalPeriodDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'accounting:fiscal:reopen');
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 10 || reason.length > 500)
      throw new BadRequestException(
        'A fiscal reopen reason of 10–500 characters is required',
      );
    const year = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, tenantId: actor.tenantId },
      include: { periods: true },
    });
    if (!year) throw new NotFoundException('Fiscal year not found');
    if (
      year.status !== 'CLOSED' ||
      year.periods.some(
        (period) => period.status !== AccountingPeriodStatus.CLOSED,
      )
    )
      throw new ConflictException(
        'Fiscal year is not closed with all periods closed',
      );
    if (!this.approvalWorkflowService)
      throw new ConflictException(
        'Fiscal-year reopen approval is temporarily unavailable',
      );
    return this.approvalWorkflowService.createRequest(
      {
        workflowType: ApprovalWorkflowType.FISCAL_YEAR_REOPEN,
        title: `Reopen fiscal year ${year.name}`,
        reason,
        targetModule: 'accounting',
        targetType: 'fiscal_year',
        targetId: year.id,
        beforeContext: { status: year.status, name: year.name },
        afterContext: { requestedStatus: 'OPEN' },
        safeContext: { fiscalYearId: year.id, name: year.name },
        finalActionKey: 'accounting.fiscal_year.reopen',
        finalActionPayload: { reason },
        idempotencyKey: dto.idempotencyKey,
      },
      actor,
    );
  }

  // ─── Slice 5: Bank Reconciliation ──────────────────────────────────

  private get bankStatements() {
    return this.prisma.bankStatement;
  }

  async importBankStatement(
    accountId: string,
    lines: ImportBankStatementLineDto[],
    actor: AuthContext,
    expectedFingerprint?: string,
  ) {
    requireDomainPermission(actor, 'accounting:reconciliation:manage');
    const preparation = await this.prepareBankStatementImport(
      accountId,
      lines,
      actor,
    );
    if (
      expectedFingerprint &&
      expectedFingerprint !== preparation.fingerprint
    ) {
      throw new BadRequestException(
        'Bank statement data changed after preview. Preview the file again before committing.',
      );
    }
    const importBatchId = `IMPORT-${preparation.fingerprint}`;

    let imported: { statements: UnsafeBankStatement[]; idempotent: boolean };
    try {
      imported = await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        'accounting:reconciliation:manage',
        [],
        async (tx) => {
          const activeAccount = await tx.chartAccount.findFirst({
            where: {
              id: accountId,
              tenantId: actor.tenantId,
              type: ChartAccountType.ASSET,
              isActive: true,
            },
            select: { id: true },
          });
          if (!activeAccount)
            throw new ConflictException('Bank account is no longer active');
          const existingBatch = await tx.bankStatementImportBatch.findFirst({
            where: {
              tenantId: actor.tenantId,
              accountId,
              fingerprint: preparation.fingerprint,
            },
          });
          if (existingBatch) {
            const statements = (await tx.bankStatement.findMany({
              where: { tenantId: actor.tenantId, accountId, importBatchId },
              orderBy: [{ statementDate: 'asc' }, { id: 'asc' }],
              take: 500,
            })) as UnsafeBankStatement[];
            if (statements.length === 0)
              throw new ConflictException(
                'A matching bank import exists but its statement lines are unavailable',
              );
            return { statements, idempotent: true };
          }
          await tx.bankStatementImportBatch.create({
            data: {
              id: importBatchId,
              tenantId: actor.tenantId,
              accountId,
              fingerprint: preparation.fingerprint,
              lineCount: preparation.lines.length,
              createdById: actor.userId,
            },
          });
          const inserted = (await Promise.all(
            preparation.lines.map((line) =>
              tx.bankStatement.create({
                data: {
                  tenantId: actor.tenantId,
                  accountId,
                  statementDate: line.statementDate,
                  description: line.description,
                  reference: line.reference,
                  debitAmount: line.debitAmount,
                  creditAmount: line.creditAmount,
                  importBatchId,
                },
              }),
            ),
          )) as UnsafeBankStatement[];
          await this.auditService.record(
            {
              action: 'import',
              resource: 'bank_statement',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: importBatchId,
              after: { accountId, lineCount: inserted.length },
            },
            tx,
          );
          return { statements: inserted, idempotent: false };
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.readExistingBankStatementImport(
          importBatchId,
          accountId,
          actor,
        );
      }
      throw error;
    }

    return {
      importBatchId,
      count: imported.statements.length,
      idempotent: imported.idempotent,
      statements: imported.statements,
    };
  }

  async previewBankStatementImport(
    accountId: string,
    lines: ImportBankStatementLineDto[],
    actor: AuthContext,
  ) {
    const preparation = await this.prepareBankStatementImport(
      accountId,
      lines,
      actor,
    );
    return {
      account: preparation.account,
      fingerprint: preparation.fingerprint,
      lineCount: preparation.lines.length,
      rows: preparation.lines.map((line) => ({
        statementDate: line.statementDate.toISOString().slice(0, 10),
        description: line.description,
        reference: line.reference,
        debitAmount: line.debitAmount.toFixed(2),
        creditAmount: line.creditAmount.toFixed(2),
      })),
      readyToCommit: true,
    };
  }

  private async prepareBankStatementImport(
    accountId: string,
    lines: ImportBankStatementLineDto[],
    actor: AuthContext,
  ) {
    const sanitizedLines = validateBankStatementImportLines(lines);
    const account = await this.prisma.chartAccount.findFirst({
      where: {
        id: accountId,
        tenantId: actor.tenantId,
        type: ChartAccountType.ASSET,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!account) {
      throw new NotFoundException(
        'Active bank or cash account not found in this tenant',
      );
    }

    return {
      account,
      lines: sanitizedLines,
      fingerprint: bankStatementImportFingerprint(accountId, sanitizedLines),
    };
  }

  private async readExistingBankStatementImport(
    importBatchId: string,
    accountId: string,
    actor: AuthContext,
  ) {
    const statements = (await this.bankStatements.findMany({
      where: {
        tenantId: actor.tenantId,
        accountId,
        importBatchId,
      },
      orderBy: [{ statementDate: 'asc' }, { id: 'asc' }],
      take: 500,
    })) as UnsafeBankStatement[];
    if (statements.length === 0) {
      throw new ConflictException(
        'A matching bank import exists but its statement lines are unavailable',
      );
    }
    return {
      importBatchId,
      count: statements.length,
      idempotent: true,
      statements,
    };
  }

  getUnreconciledStatements(accountId: string, actor: AuthContext) {
    return this.bankStatements.findMany({
      where: {
        tenantId: actor.tenantId,
        accountId,
        isReconciled: false,
      },
      orderBy: [{ statementDate: 'asc' }, { id: 'asc' }],
      take: 200,
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
          (item) => item.score === topScore,
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
    sessionId?: string,
  ) {
    if (!sessionId)
      throw new BadRequestException('A reconciliation session is required');
    return new BankReconciliationService(
      this.prisma,
      this.auditService,
      this.postingService,
    ).match(sessionId, statementId, journalLineId, actor);
  }

  async unreconcileStatement(
    statementId: string,
    reason: string,
    actor: AuthContext,
    sessionId?: string,
  ) {
    if (!sessionId)
      throw new BadRequestException('A reconciliation session is required');
    return new BankReconciliationService(
      this.prisma,
      this.auditService,
      this.postingService,
    ).unmatch(sessionId, statementId, reason, actor);
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

function readRequiredReason(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new BadRequestException('Fiscal-period reopen reason is required');
  }
  const reason: unknown = Reflect.get(payload, 'reason');
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new BadRequestException('Fiscal-period reopen reason is required');
  }
  return reason.trim();
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
  return (value ?? '')
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

function incomeAccountCodeForFeeHead(feeHeadCode: string) {
  switch (feeHeadCode) {
    case 'ADMISSION':
      return '4010';
    case 'EXAM':
      return '4020';
    case 'TRANSPORT':
      return '4030';
    case 'LIBFINE':
      return '4040';
    case 'MEALPLAN':
      return '4050';
    default:
      return '4000';
  }
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
        value instanceof Prisma.Decimal &&
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
