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
  Prisma,
} from '@prisma/client';
import { buildResourceAuthorization, formatBsDate } from '@schoolos/core';
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
import {
  AccountingSourceResolverService,
  resolveActorNames,
} from './accounting-source-resolver.service';
import {
  isIncomeAccountType,
  LEDGER_EFFECTIVE_STATUSES,
  ledgerEntryWhere,
  PROFIT_AND_LOSS_ACCOUNT_TYPES,
} from './ledger-scope';
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
import {
  assertClosePreviewAccepted,
  buildClosingLines,
  closePreviewFingerprint,
  closingPostingType,
  loadOperationalCloseItems,
  projectCloseItems,
  scopeJournalWhere,
  toReadinessIssue,
  type CloseItem,
  type CloseScope,
  type ProfitAndLossBalance,
} from './fiscal-close-inventory';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import {
  hasDomainPermission,
  requireDomainPermission,
  requireIndependentActor,
} from '../authorization/policies/domain-permission';
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
    @Optional()
    private readonly sourceResolverService?: AccountingSourceResolverService,
  ) {}

  private get sourceResolver(): AccountingSourceResolverService {
    return (
      this.sourceResolverService ??
      new AccountingSourceResolverService(this.prisma)
    );
  }

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
          journalEntry: { status: { in: LEDGER_EFFECTIVE_STATUSES } },
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

    // Phase 7.11a drill-down: who did what, the posting batch, the linked
    // reversal/correction and the resolved business source.
    const [sources, postingBatch, reversedBy, correctedBy] = await Promise.all([
      this.sourceResolver.resolve(actor, [entry]),
      this.prisma.accountingPostingBatch.findFirst({
        where: { tenantId: actor.tenantId, journalEntryId: entry.id },
        select: {
          id: true,
          sourceModule: true,
          sourceType: true,
          sourceBatchId: true,
          postingType: true,
          status: true,
        },
      }),
      this.prisma.journalEntry.findFirst({
        where: { tenantId: actor.tenantId, reversalOfId: entry.id },
        select: { id: true, entryNumber: true },
      }),
      this.prisma.journalEntry.findFirst({
        where: { tenantId: actor.tenantId, correctionOfId: entry.id },
        select: { id: true, entryNumber: true },
      }),
    ]);
    const actorIds = [
      entry.createdById,
      entry.submittedById,
      entry.reviewedById,
      entry.approvedById,
      entry.rejectedById,
      entry.cancelledById,
      entry.postedById,
      entry.reversedById,
    ].filter((userId): userId is string => Boolean(userId));
    const names = await resolveActorNames(this.prisma, actor.tenantId, [
      ...new Set(actorIds),
    ]);
    const step = (duty: string, userId: string | null, at: Date | null) =>
      userId
        ? [
            {
              duty,
              actor: { id: userId, name: names.get(userId) ?? 'Unknown user' },
              at,
            },
          ]
        : [];

    return {
      ...this.journalProjection(entry),
      lines: entry.lines
        .slice()
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map((line) => ({
          ...line,
          accountCode: line.chartAccount.code,
          accountName: line.chartAccount.name,
        })),
      actors: [
        ...step('CREATE', entry.createdById, entry.createdAt),
        ...step('SUBMIT', entry.submittedById, entry.submittedAt),
        ...step('REVIEW', entry.reviewedById, entry.reviewedAt),
        ...step('APPROVE', entry.approvedById, entry.approvedAt),
        ...step('REJECT', entry.rejectedById, entry.rejectedAt),
        ...step('CANCEL', entry.cancelledById, entry.cancelledAt),
        ...step('POST', entry.postedById, entry.postedAt),
        ...step('REVERSE', entry.reversedById, entry.reversedAt),
      ],
      source: sources.get(entry.id) ?? null,
      postingBatch,
      reversedBy,
      correctedBy,
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

    // Server-side duty: roles cannot bypass it.
    requireDomainPermission(actor, 'accounting:journals:reverse');

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

    // Maker-checker: the person who created (made) a journal may not reverse
    // it on their own. Checked after the state rules so an impossible
    // reversal still reports why it is impossible.
    requireIndependentActor(actor, [original.createdById]);

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
        status: { in: LEDGER_EFFECTIVE_STATUSES },
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
      .filter((row) => isIncomeAccountType(row.type))
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
          revenue: trialBalance.filter((r) => isIncomeAccountType(r.type)),
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

  /**
   * Phase 7.11d: lock and unlock run in the live-authorized serializable
   * journal transaction, as a compare-and-set on the period status, with the
   * audit record in the same transaction.
   */
  async lockFiscalPeriod(
    id: string,
    dto: LockFiscalPeriodDto,
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
          throw new ConflictException('Cannot lock a closed fiscal period');
        if (period.status === AccountingPeriodStatus.LOCKED) return period;
        const claim = await tx.fiscalPeriod.updateMany({
          where: {
            id: period.id,
            tenantId: actor.tenantId,
            status: AccountingPeriodStatus.OPEN,
          },
          data: {
            status: AccountingPeriodStatus.LOCKED,
            lockedAt: new Date(),
            lockedById: actor.userId,
            lockReason: dto.reason,
            reopenedWarning: false,
          },
        });
        if (claim.count !== 1)
          throw new ConflictException('Fiscal period changed before lock');
        await this.auditService.record(
          {
            action: 'lock',
            resource: 'fiscal_period',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: period.id,
            before: { status: period.status },
            after: {
              status: AccountingPeriodStatus.LOCKED,
              reason: dto.reason,
            },
          },
          tx,
        );
        return tx.fiscalPeriod.findFirstOrThrow({
          where: { id: period.id, tenantId: actor.tenantId },
        });
      },
    );
  }

  async unlockFiscalPeriod(
    id: string,
    dto: UnlockFiscalPeriodDto,
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
          throw new ConflictException('Cannot unlock a closed fiscal period');
        if (period.status === AccountingPeriodStatus.OPEN) return period;
        const claim = await tx.fiscalPeriod.updateMany({
          where: {
            id: period.id,
            tenantId: actor.tenantId,
            status: AccountingPeriodStatus.LOCKED,
          },
          data: {
            status: AccountingPeriodStatus.OPEN,
            unlockedAt: new Date(),
            unlockedById: actor.userId,
            unlockReason: dto.reason,
          },
        });
        if (claim.count !== 1)
          throw new ConflictException('Fiscal period changed before unlock');
        await this.auditService.record(
          {
            action: 'unlock',
            resource: 'fiscal_period',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: period.id,
            before: { status: period.status },
            after: { status: AccountingPeriodStatus.OPEN, reason: dto.reason },
          },
          tx,
        );
        return tx.fiscalPeriod.findFirstOrThrow({
          where: { id: period.id, tenantId: actor.tenantId },
        });
      },
    );
  }

  /**
   * Phase 7.11d: closing a period requires the fingerprint of the preview the
   * user reviewed and an acknowledgement of every warning in it. The preview
   * is recomputed inside the close transaction, so what was reviewed is what
   * is closed.
   */
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
        const preview = await this.getFiscalPeriodClosePreview(id, actor, tx);
        assertClosePreviewAccepted(preview, dto);
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
            after: {
              status: updated.status,
              reason: dto.reason,
              previewFingerprint: preview.previewFingerprint,
              acknowledgedWarningCodes: preview.requiredAcknowledgements,
            },
          },
          tx,
        );
        return updated;
      },
    );
  }

  /**
   * The ledger checks plus the shared operational inventory for one scope.
   * Codes keep their established period/year spellings.
   */
  private async collectCloseState(
    client: Prisma.TransactionClient | PrismaService,
    actor: AuthContext,
    scope: CloseScope,
  ) {
    const sourceTypes = [
      JournalSourceType.INVOICE,
      JournalSourceType.FEE_PAYMENT,
      JournalSourceType.PAYMENT_REFUND,
      JournalSourceType.PAYROLL,
      JournalSourceType.PAYROLL_RUN,
      JournalSourceType.PAYROLL_DISBURSEMENT,
      JournalSourceType.ADJUSTMENT,
    ];
    const year = scope.kind === 'YEAR';
    const journalScope = scopeJournalWhere(scope);
    const reconciliation = new BankReconciliationService(
      this.prisma,
      this.auditService,
      this.postingService,
    );
    const [
      operational,
      postedJournals,
      postedSourceWithoutMapping,
      unreconciledBankItems,
      unresolvedReconciliations,
      trialBalance,
      unbalancedRows,
    ] = await Promise.all([
      loadOperationalCloseItems(client, scope),
      client.journalEntry.count({
        where: { ...journalScope, status: JournalEntryStatus.POSTED },
      }),
      client.journalEntry.count({
        where: {
          ...journalScope,
          status: JournalEntryStatus.POSTED,
          sourceType: { in: sourceTypes },
          sourceMappingId: null,
        },
      }),
      client.bankStatement.count({
        where: {
          tenantId: actor.tenantId,
          isReconciled: false,
          statementDate: { gte: scope.start, lte: scope.end },
        },
      }),
      Promise.all(
        scope.periodIds.map((periodId) =>
          reconciliation.unresolvedForPeriodClose(periodId, actor, client),
        ),
      ).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
      client.journalLine.aggregate({
        where: {
          tenantId: actor.tenantId,
          journalEntry: {
            ...journalScope,
            status: { in: LEDGER_EFFECTIVE_STATUSES },
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
            AND journal."status" = ${JournalEntryStatus.POSTED}::"JournalEntryStatus"
            AND (
              ${year}::boolean AND journal."fiscalYearId" = ${scope.fiscalYearId}
              OR NOT ${year}::boolean AND journal."fiscalPeriodId" = ANY(${scope.periodIds}::text[])
            )
          GROUP BY journal."id"
          HAVING COALESCE(SUM(line."debit"), 0) <> COALESCE(SUM(line."credit"), 0)
        ) AS unbalanced
      `),
    ]);
    const debit = new Prisma.Decimal(trialBalance._sum.debit ?? 0);
    const credit = new Prisma.Decimal(trialBalance._sum.credit ?? 0);
    const unbalancedPosted = unbalancedRows[0]?.count ?? 0;
    const label = year ? 'fiscal year' : 'period';
    const ledger: CloseItem[] = [];
    const add = (item: Omit<CloseItem, 'amount'>) => {
      if (item.count > 0) ledger.push({ amount: null, ...item });
    };
    add({
      code: year ? 'MISSING_SOURCE_MAPPINGS' : 'POSTED_SOURCE_WITHOUT_MAPPING',
      severity: 'BLOCKING',
      count: postedSourceWithoutMapping,
      message:
        'Posted source journals without mapping evidence require review.',
      consequence: `The ${label} would close with postings whose account mapping was never evidenced.`,
      resolutionRoute: '/dashboard/accounting/source-mappings',
      readPermissions: null,
    });
    add({
      code: 'UNFINALIZED_RECONCILIATIONS',
      severity: 'BLOCKING',
      count: unresolvedReconciliations,
      message: `Reconciliation sessions must be independently reviewed, finalized, and current before ${year ? 'year' : 'period'} close.`,
      consequence:
        'Bank balances would be closed without a finalized reconciliation.',
      resolutionRoute: '/dashboard/accounting/reconciliation',
      readPermissions: null,
    });
    add({
      code: 'UNRECONCILED_BANK_ITEMS',
      severity: 'BLOCKING',
      count: unreconciledBankItems,
      message: `Bank statement items in this ${label} remain unreconciled.`,
      consequence:
        'Unmatched bank activity would be left outside the closed books.',
      resolutionRoute: '/dashboard/accounting/reconciliation',
      readPermissions: null,
    });
    add({
      code: year ? 'UNBALANCED_JOURNALS' : 'UNBALANCED_POSTED_JOURNALS',
      severity: 'BLOCKING',
      count: unbalancedPosted,
      message: 'One or more posted journals are unbalanced.',
      consequence: 'Statements for this period would not balance.',
      resolutionRoute: '/dashboard/accounting/journals?status=POSTED',
      readPermissions: null,
    });
    add({
      code: year ? 'TRIAL_BALANCE_NOT_READY' : 'UNBALANCED_TRIAL_BALANCE',
      severity: 'BLOCKING',
      count: debit.equals(credit) ? 0 : 1,
      message: `The ${label} trial balance is not balanced.`,
      consequence: 'Statements for this period would not balance.',
      resolutionRoute: '/dashboard/accounting/reports?report=trial-balance',
      readPermissions: null,
    });
    const items = [...ledger, ...operational];
    const countOf = (code: string) =>
      items.find((item) => item.code === code)?.count ?? 0;
    return {
      items,
      facts: {
        journals: {
          draft: countOf('DRAFT_JOURNALS'),
          submitted: countOf('SUBMITTED_JOURNALS'),
          reviewed: countOf('REVIEWED_JOURNALS'),
          approvedUnposted: countOf('APPROVED_UNPOSTED_JOURNALS'),
          posted: postedJournals,
          postedSourceWithoutMapping,
          unbalancedPosted,
        },
        unreconciledBankItems,
        trialBalance: {
          debit: debit.toFixed(2),
          credit: credit.toFixed(2),
          balanced: debit.equals(credit),
        },
        payrollApprovedUnposted: countOf('PAYROLL_POSTING_INCOMPLETE'),
      },
    };
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
    const { items, facts } = await this.collectCloseState(client, actor, {
      kind: 'PERIOD',
      tenantId: actor.tenantId,
      fiscalYearId: period.fiscalYearId,
      periodIds: [period.id],
      start: period.startDate,
      end: period.endDate,
    });
    const views = projectCloseItems(items, actor);
    const blockers = views
      .filter((item) => item.severity === 'BLOCKING')
      .map(toReadinessIssue);
    const warnings = views
      .filter((item) => item.severity === 'WARNING')
      .map(toReadinessIssue);

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
      journals: facts.journals,
      unreconciledBankItems: facts.unreconciledBankItems,
      trialBalance: facts.trialBalance,
      blockers,
      warnings,
      unavailableChecks: ['NEEDS_REPORT_SNAPSHOT_POLICY' as const],
      readyToClose: blockers.length === 0,
    };
  }

  /**
   * Phase 7.11d: everything a period close depends on, what closing will
   * mean, and the fingerprint the close must present.
   */
  async getFiscalPeriodClosePreview(
    id: string,
    actor: AuthContext,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const period = await client.fiscalPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { fiscalYear: { select: { name: true, status: true } } },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    const [previous, next] = await Promise.all([
      client.fiscalPeriod.findFirst({
        where: {
          tenantId: actor.tenantId,
          fiscalYearId: period.fiscalYearId,
          periodNumber: period.periodNumber - 1,
        },
        select: { id: true, label: true, status: true },
      }),
      client.fiscalPeriod.findFirst({
        where: {
          tenantId: actor.tenantId,
          fiscalYearId: period.fiscalYearId,
          periodNumber: period.periodNumber + 1,
        },
        select: { id: true, label: true, status: true },
      }),
    ]);
    const { items } = await this.collectCloseState(client, actor, {
      kind: 'PERIOD',
      tenantId: actor.tenantId,
      fiscalYearId: period.fiscalYearId,
      periodIds: [period.id],
      start: period.startDate,
      end: period.endDate,
    });
    const state: CloseItem[] = [];
    const stateItem = (
      code: string,
      message: string,
      consequence: string,
      route = '/dashboard/accounting/fiscal-periods',
    ) =>
      state.push({
        code,
        severity: 'BLOCKING',
        count: 1,
        amount: null,
        message,
        consequence,
        resolutionRoute: route,
        readPermissions: null,
      });
    if (period.status === AccountingPeriodStatus.CLOSED)
      stateItem(
        'PERIOD_ALREADY_CLOSED',
        'This period is already closed.',
        'Nothing to do.',
      );
    else if (period.status !== AccountingPeriodStatus.LOCKED)
      stateItem(
        'PERIOD_NOT_LOCKED',
        'Lock the period before closing it.',
        'Locking stops new postings so the figures you review stay fixed.',
      );
    if (previous && previous.status !== AccountingPeriodStatus.CLOSED)
      stateItem(
        'PREVIOUS_PERIOD_NOT_CLOSED',
        `Close the previous period "${previous.label}" first.`,
        'Periods close in order.',
      );
    if (period.fiscalYear.status === 'CLOSED')
      stateItem(
        'FISCAL_YEAR_CLOSED',
        'The fiscal year is closed.',
        'Reopen the fiscal year through approval first.',
      );
    const views = projectCloseItems([...state, ...items], actor);
    const blockers = views.filter((item) => item.severity === 'BLOCKING');
    const warnings = views.filter((item) => item.severity === 'WARNING');
    const previewFingerprint = closePreviewFingerprint({
      kind: 'PERIOD',
      targetId: period.id,
      status: period.status,
      items: views,
    });
    const readyToClose = blockers.length === 0;
    const range = `${formatBsDate(period.startDate)} – ${formatBsDate(period.endDate)} BS (${period.startDate.toISOString().slice(0, 10)} – ${period.endDate.toISOString().slice(0, 10)})`;
    return {
      kind: 'PERIOD' as const,
      checkedAt: new Date().toISOString(),
      period: {
        id: period.id,
        fiscalYearId: period.fiscalYearId,
        fiscalYearName: period.fiscalYear.name,
        label: period.label,
        periodNumber: period.periodNumber,
        startDate: period.startDate,
        endDate: period.endDate,
        bsStartDate: formatBsDate(period.startDate),
        bsEndDate: formatBsDate(period.endDate),
        status: period.status,
      },
      previousPeriod: previous,
      nextPeriod: next,
      blockers,
      warnings,
      consequences: [
        `After close, nothing dated ${range} can post: fee, payroll, vendor bill and manual journals for these dates are refused.`,
        'Correcting a closed period needs an approved reopen request.',
        next
          ? `The next period, "${next.label}", is ${next.status.toLowerCase()} and stays as it is.`
          : 'This is the last period of the fiscal year; the year can be closed once every period is closed.',
      ],
      requiredAcknowledgements: warnings.map((item) => item.code),
      readyToClose,
      previewFingerprint,
      authorization: buildResourceAuthorization({
        actions: {
          close:
            readyToClose &&
            hasDomainPermission(actor, 'accounting:fiscal:manage'),
        },
        sections: { inventory: true },
        lifecycleState: period.status,
        entitlementState: { module: 'accounting', state: 'ENABLED' },
      }),
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

    // A correction reverses the original: same duty.
    requireDomainPermission(actor, 'accounting:journals:reverse');

    await this.ensureJournalIsMutable(original.id, actor.tenantId);

    if (original.status === JournalEntryStatus.REVERSED) {
      throw new ConflictException(
        'Cannot correct a reversed journal entry. Reverse the reversal first (if applicable) or post a new entry.',
      );
    }

    const correctionDate = dto.reversalDate
      ? new Date(dto.reversalDate)
      : new Date();

    // Same maker-checker rule as a reversal.
    requireIndependentActor(actor, [original.createdById]);

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
        status: { in: LEDGER_EFFECTIVE_STATUSES },
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
    const { items, facts, periodsByStatus, openingBalanceEntry } =
      await this.collectYearCloseState(client, actor, fiscalYear);
    const issues = projectCloseItems(items, actor).map((item) => ({
      ...toReadinessIssue(item),
      severity: item.severity,
    }));
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
    // Actor-aware: readiness is readable with accounting:reports:read, so the
    // advertised actions must reflect what THIS actor may do, not only the
    // lifecycle (close needs fiscal:manage, reopen needs fiscal:reopen).
    const allowedActions: Array<'CLOSE' | 'REOPEN'> =
      fiscalYear.status === 'CLOSED'
        ? hasDomainPermission(actor, 'accounting:fiscal:reopen')
          ? ['REOPEN']
          : []
        : readyToClose && hasDomainPermission(actor, 'accounting:fiscal:manage')
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
      journals: facts.journals,
      unreconciledBankItems: facts.unreconciledBankItems,
      trialBalance: facts.trialBalance,
      openingBalance: {
        exists: Boolean(openingBalanceEntry),
        status: openingBalanceEntry?.status ?? null,
      },
      payroll: {
        approvedUnposted: facts.payrollApprovedUnposted,
      },
      issues,
      blockingIssueCount: blockingCount,
      warningCount,
      readinessStatus,
      allowedActions,
      unavailableChecks: [
        'NEEDS_REPORT_SNAPSHOT_POLICY' as const,
        'NEEDS_EXPORT_JOB_SCOPE_CONFIRMATION' as const,
        'NEEDS_FEE_POSTING_RECONCILIATION_CONTRACT' as const,
      ],
      readyToClose,
    };
  }

  private async collectYearCloseState(
    client: Prisma.TransactionClient | PrismaService,
    actor: AuthContext,
    fiscalYear: {
      id: string;
      startDate: Date;
      endDate: Date;
      periods: Array<{ id: string; status: AccountingPeriodStatus }>;
    },
  ) {
    const [state, openingBalanceEntry] = await Promise.all([
      this.collectCloseState(client, actor, {
        kind: 'YEAR',
        tenantId: actor.tenantId,
        fiscalYearId: fiscalYear.id,
        periodIds: fiscalYear.periods.map((period) => period.id),
        start: fiscalYear.startDate,
        end: fiscalYear.endDate,
      }),
      client.journalEntry.findFirst({
        where: {
          tenantId: actor.tenantId,
          sourceType: JournalSourceType.OPENING_BALANCE,
          sourceId: fiscalYear.id,
        },
        select: { status: true },
      }),
    ]);
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
    const extra: CloseItem[] = [];
    if (periodsByStatus.open + periodsByStatus.locked > 0)
      extra.push({
        code: 'OPEN_PERIODS',
        severity: 'BLOCKING',
        count: periodsByStatus.open + periodsByStatus.locked,
        amount: null,
        message:
          'All fiscal periods must be closed before the fiscal year can be closed.',
        consequence: 'Each period is reviewed and closed on its own first.',
        resolutionRoute: '/dashboard/accounting/fiscal-periods',
        readPermissions: null,
      });
    if (openingBalanceEntry?.status !== JournalEntryStatus.POSTED)
      extra.push({
        code: 'OPENING_BALANCE_INCOMPLETE',
        severity: 'WARNING',
        count: 1,
        amount: null,
        message: openingBalanceEntry
          ? 'The opening balance entry has not been posted.'
          : 'No opening balance entry has been recorded for this fiscal year.',
        consequence:
          'Balances carry forward from earlier years automatically; record an opening balance only for a first year in SchoolOS.',
        resolutionRoute: '/dashboard/accounting/opening-balance',
        readPermissions: null,
      });
    return {
      items: [...extra, ...state.items],
      facts: state.facts,
      periodsByStatus,
      openingBalanceEntry,
    };
  }

  /**
   * The closing entry a year close would post now: every income and expense
   * balance still open after any earlier closing entry of the year (a re-close
   * after reopening closes only the change), into retained earnings.
   */
  private async planYearClose(
    client: Prisma.TransactionClient | PrismaService,
    actor: AuthContext,
    fiscalYear: { id: string; endDate: Date },
  ) {
    const [grouped, accounts, retainedMapping, previous] = await Promise.all([
      client.journalLine.groupBy({
        by: ['chartAccountId'],
        _sum: { debit: true, credit: true },
        where: {
          tenantId: actor.tenantId,
          journalEntry: ledgerEntryWhere({
            tenantId: actor.tenantId,
            stage: 'POST_CLOSING',
            fiscalYearId: fiscalYear.id,
          }),
        },
      }),
      client.chartAccount.findMany({
        where: {
          tenantId: actor.tenantId,
          type: { in: PROFIT_AND_LOSS_ACCOUNT_TYPES },
        },
        select: { id: true, code: true, name: true, type: true },
      }),
      client.accountingReportAccountMapping.findFirst({
        where: { tenantId: actor.tenantId, mappingType: 'RETAINED_EARNINGS' },
        include: { account: { select: { id: true, code: true, name: true } } },
      }),
      client.journalEntry.findMany({
        where: {
          tenantId: actor.tenantId,
          sourceType: JournalSourceType.CLOSING_ENTRY,
          sourceId: fiscalYear.id,
        },
        select: {
          id: true,
          entryNumber: true,
          postingType: true,
          status: true,
          postedAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const retainedEarnings =
      retainedMapping?.account ??
      (await client.chartAccount.findFirst({
        where: { tenantId: actor.tenantId, code: '3100' },
        select: { id: true, code: true, name: true },
      }));
    const byAccount = new Map(grouped.map((row) => [row.chartAccountId, row]));
    const balances: ProfitAndLossBalance[] = accounts.flatMap((account) => {
      const row = byAccount.get(account.id);
      return row
        ? [
            {
              accountId: account.id,
              code: account.code,
              name: account.name,
              type: account.type,
              debit: new Prisma.Decimal(row._sum.debit ?? 0),
              credit: new Prisma.Decimal(row._sum.credit ?? 0),
            },
          ]
        : [];
    });
    const { lines, netResult } = retainedEarnings
      ? buildClosingLines(balances, retainedEarnings)
      : buildClosingLines(balances, { id: '', code: '', name: '' });
    return {
      lines,
      netResult,
      retainedEarnings,
      previous,
      postingType: closingPostingType(previous.length),
      entryDate: fiscalYear.endDate,
    };
  }

  /**
   * Phase 7.11d: everything a year close depends on, the exact closing lines
   * it will post, and the fingerprint the close must present.
   */
  async getFiscalYearClosePreview(
    fiscalYearId: string,
    actor: AuthContext,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const fiscalYear = await client.fiscalYear.findFirst({
      where: { id: fiscalYearId, tenantId: actor.tenantId },
      include: { periods: true },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');
    const [{ items }, plan] = await Promise.all([
      this.collectYearCloseState(client, actor, fiscalYear),
      this.planYearClose(client, actor, fiscalYear),
    ]);
    const state: CloseItem[] = [];
    const blocker = (code: string, message: string, consequence: string) =>
      state.push({
        code,
        severity: 'BLOCKING',
        count: 1,
        amount: null,
        message,
        consequence,
        resolutionRoute: '/dashboard/accounting/fiscal-periods',
        readPermissions: null,
      });
    if (fiscalYear.status === 'CLOSED')
      blocker(
        'FISCAL_YEAR_ALREADY_CLOSED',
        'This fiscal year is already closed.',
        'Nothing to do.',
      );
    if (plan.lines.length === 0 && plan.previous.length === 0)
      blocker(
        'NOTHING_TO_CLOSE',
        'No revenue or expense balances to close for this fiscal year.',
        'A year with no income or expense activity has nothing to transfer to retained earnings.',
      );
    if (plan.lines.length > 0 && !plan.retainedEarnings)
      blocker(
        'RETAINED_EARNINGS_MISSING',
        'Retained Earnings account not found. Configure RETAINED_EARNINGS mapping or create account with code 3100.',
        'The year result has no account to go to.',
      );
    const views = projectCloseItems([...state, ...items], actor);
    const blockers = views.filter((item) => item.severity === 'BLOCKING');
    const warnings = views.filter((item) => item.severity === 'WARNING');
    const closingLines = plan.lines.map((line) => ({
      chartAccountId: line.chartAccountId,
      code: line.code,
      name: line.name,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
      description: line.description,
    }));
    const previewFingerprint = closePreviewFingerprint({
      kind: 'YEAR',
      targetId: fiscalYear.id,
      status: fiscalYear.status,
      items: views,
      closing: { postingType: plan.postingType, lines: closingLines },
    });
    const readyToClose = blockers.length === 0;
    return {
      kind: 'YEAR' as const,
      checkedAt: new Date().toISOString(),
      fiscalYear: {
        id: fiscalYear.id,
        name: fiscalYear.name,
        status: fiscalYear.status,
        startDate: fiscalYear.startDate,
        endDate: fiscalYear.endDate,
        bsStartDate: formatBsDate(fiscalYear.startDate),
        bsEndDate: formatBsDate(fiscalYear.endDate),
      },
      blockers,
      warnings,
      closing: {
        postingType: plan.postingType,
        supplementary: plan.previous.length > 0,
        previousClosingEntries: plan.previous,
        entryDate: plan.entryDate.toISOString().slice(0, 10),
        bsEntryDate: formatBsDate(plan.entryDate),
        lines: closingLines,
        netResult: plan.netResult.toFixed(2),
        resultType: plan.netResult.gt(0)
          ? ('SURPLUS' as const)
          : plan.netResult.lt(0)
            ? ('DEFICIT' as const)
            : ('NONE' as const),
        retainedEarningsAccount: plan.retainedEarnings,
      },
      consequences: [
        plan.lines.length > 0
          ? `A ${plan.previous.length > 0 ? 'supplementary ' : ''}closing entry dated ${formatBsDate(plan.entryDate)} BS (${plan.entryDate.toISOString().slice(0, 10)}) moves the lines below into retained earnings.`
          : 'The income and expense accounts are already closed; no new closing entry is needed.',
        'After close, nothing dated in this fiscal year can post, and the year needs an approved reopen request to change.',
      ],
      requiredAcknowledgements: warnings.map((item) => item.code),
      readyToClose,
      previewFingerprint,
      authorization: buildResourceAuthorization({
        actions: {
          close:
            readyToClose &&
            hasDomainPermission(actor, 'accounting:fiscal:manage'),
        },
        sections: { inventory: true, closingLines: true },
        lifecycleState: fiscalYear.status,
        entitlementState: { module: 'accounting', state: 'ENABLED' },
      }),
    };
  }

  /**
   * Phase 7.11d: the year close posts exactly the closing lines of the
   * reviewed preview (fingerprint-bound, every warning acknowledged). After
   * a reopen it posts a supplementary closing entry for the change only; if
   * nothing changed it closes without a new entry.
   */
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
        });
        if (!fiscalYear) throw new NotFoundException('Fiscal year not found');
        if (fiscalYear.status === 'CLOSED')
          throw new ConflictException('Fiscal year is already closed');

        const preview = await this.getFiscalYearClosePreview(
          fiscalYearId,
          actor,
          tx,
        );
        assertClosePreviewAccepted(preview, dto);

        const closingEntry =
          preview.closing.lines.length > 0
            ? await this.postingService.postManualJournal(
                {
                  tenantId: actor.tenantId,
                  entryDate: fiscalYear.endDate,
                  narration: preview.closing.supplementary
                    ? `Supplementary closing entries for fiscal year ${fiscalYear.name}`
                    : `Closing entries for fiscal year ${fiscalYear.name}`,
                  sourceModule: 'ACCOUNTING',
                  sourceType: JournalSourceType.CLOSING_ENTRY,
                  sourceId: fiscalYearId,
                  postingType: preview.closing.postingType,
                  lines: preview.closing.lines.map((line) => ({
                    chartAccountId: line.chartAccountId,
                    debit: line.debit,
                    credit: line.credit,
                    description: line.description,
                  })),
                  // Every period is closed by now (a blocker otherwise), so
                  // the closing entry itself posts into a closed period.
                  allowClosedPeriod: true,
                },
                actor,
                tx,
              )
            : null;

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
              closingEntryId: closingEntry?.id ?? null,
              closingEntryNumber: closingEntry?.entryNumber ?? null,
              postingType: closingEntry ? preview.closing.postingType : null,
              supplementary: preview.closing.supplementary,
              netResult: preview.closing.netResult,
              retainedEarningsAccountId:
                preview.closing.retainedEarningsAccount?.id ?? null,
              previewFingerprint: preview.previewFingerprint,
              acknowledgedWarningCodes: preview.requiredAcknowledgements,
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
        journalEntry: { status: { in: LEDGER_EFFECTIVE_STATUSES } },
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

    // Ledger book balance: reversed originals and their reversals both count.
    const ledgerAgg = await this.prisma.journalLine.aggregate({
      where: {
        tenantId: actor.tenantId,
        chartAccountId: accountId,
        journalEntry: { status: { in: LEDGER_EFFECTIVE_STATUSES } },
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
