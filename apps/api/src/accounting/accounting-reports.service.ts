import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';
import { AuditService } from '../audit/audit.service';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import {
  TrialBalanceResponse,
  TrialBalanceRow,
  GeneralLedgerResponse,
  GeneralLedgerRow,
  CashBookResponse,
  CashBookRow,
  IncomeStatementResponse,
  IncomeStatementAccount,
  BalanceSheetResponse,
  BalanceSheetAccount,
  TaxSummaryResponse,
  JournalRegisterResponse,
  JournalRegisterRow,
  FailedUnpostedTransactionsResponse,
  FailedUnpostedTransactionRow,
  BankBookResponse,
  CashFlowStatementResponse,
  CashFlowSection,
  CashFlowLineItem,
  CashFlowSectionKind,
  BudgetVsActualResponse,
  BudgetVsActualRow,
} from './types/accounting-reports.types';
import {
  CashBookQueryDto,
  CashBookAccountKind,
} from './dto/cash-book-query.dto';
import { JournalRegisterQueryDto } from './dto/journal-register-query.dto';
import { IncomeStatementQueryDto } from './dto/income-statement-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { BudgetVsActualQueryDto } from './dto/budget-vs-actual-query.dto';
import {
  TaxSummaryQueryDto,
  TaxSummaryType,
} from './dto/tax-summary-query.dto';
import { UpdateAccountingReportMappingsDto } from './dto/report-account-mapping.dto';
import {
  ChartAccountType,
  JournalLineSide,
  Prisma,
  JournalEntryStatus,
  JournalSourceType,
  PaymentStatus,
  PayrollRunStatus,
  PayrollExceptionCode,
  PayrollExceptionStatus,
  AccountingReportMappingType,
  InvoiceStatus,
} from '@prisma/client';
import {
  loadReceivables,
  resolveAgingAsOf,
  summarizeAging,
} from '../finance/receivables-aging';
import {
  ReceivablesAgingQueryDto,
  ReceivablesReconciliationQueryDto,
} from './dto/receivables-query.dto';
import {
  CLOSING_SOURCE_TYPES,
  dayAfter,
  isIncomeAccountType,
  isProfitAndLossAccountType,
  ledgerEntryWhere,
  normalBalanceSide,
  presentBalance,
  PROFIT_AND_LOSS_ACCOUNT_TYPES,
  reportRangeEndExclusive,
  reportRangeStart,
  splitSigned,
  startOfUtcDay,
  type LedgerStage,
} from './ledger-scope';

const cashBookLineInclude = Prisma.validator<Prisma.JournalLineInclude>()({
  chartAccount: {
    select: { id: true, code: true, name: true },
  },
  journalEntry: {
    include: {
      lines: {
        include: {
          chartAccount: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  },
});

type CashBookJournalLine = Prisma.JournalLineGetPayload<{
  include: typeof cashBookLineInclude;
}>;

/** Total, deterministic order so pages never overlap or skip a line. */
const LEDGER_LINE_ORDER: Prisma.JournalLineOrderByWithRelationInput[] = [
  { journalEntry: { entryDate: 'asc' } },
  { journalEntry: { entryNumber: 'asc' } },
  { journalEntryId: 'asc' },
  { lineNumber: 'asc' },
  { id: 'asc' },
];

@Injectable()
export class AccountingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private toDecimal(
    value: Prisma.Decimal | string | number | null | undefined,
  ): Prisma.Decimal {
    const val = value === null || value === undefined ? 0 : value;
    return new Prisma.Decimal(val.toString());
  }

  async getTrialBalance(
    tenantId: string,
    query: TrialBalanceQueryDto,
  ): Promise<TrialBalanceResponse> {
    const {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      accountType,
      includeZeroBalances,
    } = query;
    const stage: LedgerStage = query.stage ?? 'PRE_CLOSING';

    const { fiscalYear, window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });

    // Opening: every ledger line dated before the window, across fiscal
    // years. Prior-year closing entries are included, so income and expense
    // accounts open at zero once the earlier year was closed (decision R1).
    const [openingGrouped, movementGrouped, accounts, setupWarnings] =
      await Promise.all([
        this.prisma.journalLine.groupBy({
          by: ['chartAccountId'],
          _sum: { debit: true, credit: true },
          where: {
            tenantId,
            journalEntry: ledgerEntryWhere({
              tenantId,
              stage: 'POST_CLOSING',
              toExclusive: window.from,
            }),
          },
        }),
        this.prisma.journalLine.groupBy({
          by: ['chartAccountId'],
          _sum: { debit: true, credit: true },
          where: {
            tenantId,
            journalEntry: ledgerEntryWhere({
              tenantId,
              stage,
              fiscalYearId,
              fiscalPeriodId,
              from: window.from,
              toExclusive: window.toExclusive,
            }),
          },
        }),
        this.prisma.chartAccount.findMany({
          where: {
            tenantId,
            ...(accountType ? { type: accountType } : {}),
          },
          orderBy: { code: 'asc' },
        }),
        this.openingBalanceWarnings(tenantId, fiscalYear),
      ]);

    const openingById = new Map(
      openingGrouped.map((row) => [row.chartAccountId, row._sum]),
    );
    const movementById = new Map(
      movementGrouped.map((row) => [row.chartAccountId, row._sum]),
    );

    const rows: TrialBalanceRow[] = [];
    let totalOpeningDebit = new Prisma.Decimal(0);
    let totalOpeningCredit = new Prisma.Decimal(0);
    let totalPeriodDebit = new Prisma.Decimal(0);
    let totalPeriodCredit = new Prisma.Decimal(0);
    let totalClosingDebit = new Prisma.Decimal(0);
    let totalClosingCredit = new Prisma.Decimal(0);

    for (const account of accounts) {
      const opening = openingById.get(account.id);
      const movement = movementById.get(account.id);
      const openingSigned = this.toDecimal(opening?.debit).minus(
        this.toDecimal(opening?.credit),
      );
      const pDebit = this.toDecimal(movement?.debit);
      const pCredit = this.toDecimal(movement?.credit);
      const closingSigned = openingSigned.plus(pDebit).minus(pCredit);
      const openingCols = splitSigned(openingSigned);
      const closingCols = splitSigned(closingSigned);

      if (
        !includeZeroBalances &&
        openingSigned.isZero() &&
        pDebit.isZero() &&
        pCredit.isZero() &&
        closingSigned.isZero()
      ) {
        continue;
      }

      totalOpeningDebit = totalOpeningDebit.plus(openingCols.debit);
      totalOpeningCredit = totalOpeningCredit.plus(openingCols.credit);
      totalPeriodDebit = totalPeriodDebit.plus(pDebit);
      totalPeriodCredit = totalPeriodCredit.plus(pCredit);
      totalClosingDebit = totalClosingDebit.plus(closingCols.debit);
      totalClosingCredit = totalClosingCredit.plus(closingCols.credit);

      rows.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        parentId: account.parentId,
        openingDebit: openingCols.debit,
        openingCredit: openingCols.credit,
        periodDebit: pDebit,
        periodCredit: pCredit,
        closingDebit: closingCols.debit,
        closingCredit: closingCols.credit,
        netBalance: closingSigned.abs(),
        normalBalanceSide: normalBalanceSide(account.type),
      });
    }

    const imbalanceAmount = totalClosingDebit.minus(totalClosingCredit).abs();
    const isBalanced =
      imbalanceAmount.isZero() &&
      totalPeriodDebit.equals(totalPeriodCredit) &&
      totalOpeningDebit.equals(totalOpeningCredit);

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      totalOpeningDebit,
      totalOpeningCredit,
      totalPeriodDebit,
      totalPeriodCredit,
      totalClosingDebit,
      totalClosingCredit,
      isBalanced,
      imbalanceAmount,
      rows,
      stage,
      setupWarnings,
      generatedAt: new Date(),
    };
  }

  async getGeneralLedger(
    tenantId: string,
    query: GeneralLedgerQueryDto,
  ): Promise<GeneralLedgerResponse> {
    const {
      fiscalYearId,
      accountId,
      accountCode,
      fromDate,
      toDate,
      fiscalPeriodId,
      sourceModule,
      sourceType,
      sourceId,
      page = 1,
      limit = 50,
    } = query;
    const stage: LedgerStage = query.stage ?? 'POST_CLOSING';

    if (!accountId && !accountCode) {
      throw new BadRequestException(
        'accountId or accountCode is required for General Ledger',
      );
    }

    const { window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });

    const account = await this.prisma.chartAccount.findFirst({
      where: {
        tenantId,
        ...(accountId ? { id: accountId } : {}),
        ...(accountCode ? { code: accountCode } : {}),
      },
    });

    if (!account) throw new NotFoundException('Account not found');

    const journalWhere = ledgerEntryWhere({
      tenantId,
      stage,
      fiscalYearId,
      fiscalPeriodId,
      from: window.from,
      toExclusive: window.toExclusive,
    });
    if (sourceModule) journalWhere.sourceModule = sourceModule;
    if (sourceType) {
      if (
        stage === 'PRE_CLOSING' &&
        CLOSING_SOURCE_TYPES.includes(sourceType)
      ) {
        journalWhere.sourceType = { in: [] };
      } else {
        journalWhere.sourceType = sourceType;
      }
    }
    if (sourceId) journalWhere.sourceId = sourceId;

    const normalSide = normalBalanceSide(account.type);
    const lineWhere: Prisma.JournalLineWhereInput = {
      tenantId,
      chartAccountId: account.id,
      journalEntry: journalWhere,
    };
    const skip = (page - 1) * limit;

    const [openingAgg, totalsAgg, totalLines, priorPageLines, lines] =
      await Promise.all([
        this.prisma.journalLine.aggregate({
          _sum: { debit: true, credit: true },
          where: {
            tenantId,
            chartAccountId: account.id,
            journalEntry: ledgerEntryWhere({
              tenantId,
              stage: 'POST_CLOSING',
              toExclusive: window.from,
            }),
          },
        }),
        this.prisma.journalLine.aggregate({
          _sum: { debit: true, credit: true },
          where: lineWhere,
        }),
        this.prisma.journalLine.count({ where: lineWhere }),
        skip > 0
          ? this.prisma.journalLine.findMany({
              where: lineWhere,
              select: { debit: true, credit: true },
              orderBy: LEDGER_LINE_ORDER,
              take: skip,
            })
          : Promise.resolve(
              [] as Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>,
            ),
        this.prisma.journalLine.findMany({
          where: lineWhere,
          include: { journalEntry: true },
          orderBy: LEDGER_LINE_ORDER,
          skip,
          take: limit,
        }),
      ]);

    const openingSigned = this.toDecimal(openingAgg._sum.debit).minus(
      this.toDecimal(openingAgg._sum.credit),
    );
    const totalDebit = this.toDecimal(totalsAgg._sum.debit);
    const totalCredit = this.toDecimal(totalsAgg._sum.credit);
    const pageOpeningSigned = priorPageLines.reduce(
      (sum, line) => sum.plus(line.debit).minus(line.credit),
      openingSigned,
    );

    let runningSignedBalance = pageOpeningSigned;
    const rows: GeneralLedgerRow[] = lines.map((line) => {
      runningSignedBalance = runningSignedBalance
        .plus(line.debit)
        .minus(line.credit);
      const running = presentBalance(runningSignedBalance, normalSide);
      return {
        journalEntryId: line.journalEntryId,
        journalLineId: line.id,
        entryDate: line.journalEntry.entryDate,
        postedAt: line.journalEntry.postedAt,
        entryNumber: line.journalEntry.entryNumber,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        description: line.description || line.journalEntry.narration,
        sourceModule: line.journalEntry.sourceModule,
        sourceType: line.journalEntry.sourceType,
        sourceId: line.journalEntry.sourceId,
        debit: line.debit,
        credit: line.credit,
        runningBalance: running.amount,
        runningBalanceSide: running.side,
        createdById: line.journalEntry.createdById,
        postedById: line.journalEntry.postedById,
        reversalOfId: line.journalEntry.reversalOfId,
        correctionOfId: line.journalEntry.correctionOfId,
        entryStatus: line.journalEntry.status,
      };
    });

    const opening = presentBalance(openingSigned, normalSide);
    const pageOpening = presentBalance(pageOpeningSigned, normalSide);
    const closing = presentBalance(
      openingSigned.plus(totalDebit).minus(totalCredit),
      normalSide,
    );

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      accountId: account.id,
      accountCode: account.code,
      openingBalance: opening.amount,
      openingBalanceSide: opening.side,
      closingBalance: closing.amount,
      closingBalanceSide: closing.side,
      totals: { debit: totalDebit, credit: totalCredit },
      pageOpeningBalance: pageOpening.amount,
      pageOpeningBalanceSide: pageOpening.side,
      stage,
      rows,
      pagination: {
        page,
        limit,
        total: totalLines,
        totalPages: Math.ceil(totalLines / limit),
      },
      generatedAt: new Date(),
    };
  }

  /**
   * The date window a report covers. Explicit dates win; otherwise the fiscal
   * period, otherwise the fiscal year. Bounds are inclusive-start /
   * exclusive-end on the UTC accounting date (see ledger-scope.ts).
   */
  private async resolveReportWindow(
    tenantId: string,
    input: {
      fiscalYearId: string;
      fiscalPeriodId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: input.fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    const fiscalPeriod = input.fiscalPeriodId
      ? await this.prisma.fiscalPeriod.findUnique({
          where: {
            id: input.fiscalPeriodId,
            tenantId,
            fiscalYearId: input.fiscalYearId,
          },
        })
      : null;
    if (input.fiscalPeriodId && !fiscalPeriod) {
      throw new BadRequestException('Invalid fiscal period for this year');
    }

    const bounded = fiscalPeriod ?? fiscalYear;
    const naturalFrom = startOfUtcDay(bounded.startDate);
    const naturalTo = dayAfter(bounded.endDate);
    const explicitFrom = input.fromDate
      ? reportRangeStart(input.fromDate)
      : undefined;
    const explicitTo = input.toDate
      ? reportRangeEndExclusive(input.toDate)
      : undefined;
    if (
      (explicitFrom && Number.isNaN(explicitFrom.getTime())) ||
      (explicitTo && Number.isNaN(explicitTo.getTime()))
    ) {
      throw new BadRequestException('Invalid report date');
    }
    const from =
      explicitFrom && explicitFrom > naturalFrom ? explicitFrom : naturalFrom;
    const toExclusive =
      explicitTo && explicitTo < naturalTo ? explicitTo : naturalTo;
    if (explicitFrom && explicitTo && explicitFrom >= explicitTo) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }
    return { fiscalYear, fiscalPeriod, window: { from, toExclusive } };
  }

  /**
   * Balances carry forward automatically (decision R1). A later year that
   * also has an opening-balance journal may therefore count them twice.
   */
  private async openingBalanceWarnings(
    tenantId: string,
    fiscalYear: { id: string; startDate: Date },
  ): Promise<string[]> {
    const [openingJournal, earlierActivity] = await Promise.all([
      this.prisma.journalEntry.findFirst({
        where: {
          ...ledgerEntryWhere({
            tenantId,
            stage: 'POST_CLOSING',
            fiscalYearId: fiscalYear.id,
          }),
          sourceType: JournalSourceType.OPENING_BALANCE,
        },
        select: { id: true },
      }),
      this.prisma.journalEntry.findFirst({
        where: ledgerEntryWhere({
          tenantId,
          stage: 'POST_CLOSING',
          toExclusive: startOfUtcDay(fiscalYear.startDate),
        }),
        select: { id: true },
      }),
    ]);
    return openingJournal && earlierActivity
      ? [
          'This fiscal year has an opening-balance journal and earlier years also have ledger entries. Balances carry forward automatically, so the opening-balance journal may count them twice.',
        ]
      : [];
  }

  async getReportMappings(tenantId: string) {
    return this.prisma.accountingReportAccountMapping.findMany({
      where: { tenantId },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Phase 7.12: the mapping set decides where payables, cash, tax and the
   * year-end result post, so saving it is a live-authorized, serializable
   * write with validation and its audit in the same transaction.
   */
  async updateReportMappings(
    actor: AuthContext,
    dto: UpdateAccountingReportMappingsDto,
  ) {
    requireDomainPermission(actor, 'accounting:settings:update');
    const tenantId = actor.tenantId;
    const pairs = new Set<string>();
    for (const mapping of dto.mappings) {
      const key = `${mapping.mappingType}:${mapping.accountId}`;
      if (pairs.has(key))
        throw new BadRequestException(
          `The same account is mapped twice as ${mapping.mappingType}`,
        );
      pairs.add(key);
    }
    for (const single of [
      AccountingReportMappingType.ACCOUNTS_PAYABLE,
      AccountingReportMappingType.RETAINED_EARNINGS,
    ]) {
      if (dto.mappings.filter((m) => m.mappingType === single).length > 1)
        throw new BadRequestException(
          `Map exactly one ${single === AccountingReportMappingType.ACCOUNTS_PAYABLE ? 'Accounts Payable' : 'Retained Earnings'} account`,
        );
    }
    const allowedTypes: Partial<
      Record<AccountingReportMappingType, ChartAccountType[]>
    > = {
      [AccountingReportMappingType.CASH]: [ChartAccountType.ASSET],
      [AccountingReportMappingType.BANK]: [ChartAccountType.ASSET],
      [AccountingReportMappingType.ACCOUNTS_PAYABLE]: [
        ChartAccountType.LIABILITY,
      ],
      [AccountingReportMappingType.TDS_PAYABLE]: [ChartAccountType.LIABILITY],
      [AccountingReportMappingType.VAT_INPUT]: [
        ChartAccountType.ASSET,
        ChartAccountType.LIABILITY,
      ],
      [AccountingReportMappingType.RETAINED_EARNINGS]: [
        ChartAccountType.EQUITY,
      ],
    };

    try {
      await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        'accounting:settings:update',
        [],
        async (tx) => {
          const accountIds = [...new Set(dto.mappings.map((m) => m.accountId))];
          const accounts = accountIds.length
            ? await tx.chartAccount.findMany({
                where: { tenantId, id: { in: accountIds } },
              })
            : [];
          if (accounts.length !== accountIds.length)
            throw new BadRequestException(
              'One or more accounts do not exist or belong to another tenant',
            );
          const byId = new Map(
            accounts.map((account) => [account.id, account]),
          );
          for (const mapping of dto.mappings) {
            const account = byId.get(mapping.accountId);
            if (!account) continue;
            if (!account.isActive || account.archivedAt)
              throw new BadRequestException(
                `Account ${account.code} is inactive and cannot be mapped`,
              );
            const allowed = allowedTypes[mapping.mappingType];
            if (allowed && !allowed.includes(account.type))
              throw new BadRequestException(
                `${mapping.mappingType} must map to ${allowed.join(' or ')} accounts (account ${account.code} is ${account.type})`,
              );
          }
          const before = await tx.accountingReportAccountMapping.findMany({
            where: { tenantId },
            select: { mappingType: true, accountId: true },
            orderBy: [{ mappingType: 'asc' }, { accountId: 'asc' }],
          });
          await tx.accountingReportAccountMapping.deleteMany({
            where: { tenantId },
          });
          if (dto.mappings.length > 0) {
            await tx.accountingReportAccountMapping.createMany({
              data: dto.mappings.map((m) => ({
                tenantId,
                mappingType: m.mappingType,
                accountId: m.accountId,
                createdById: actor.userId,
                updatedById: actor.userId,
              })),
            });
          }
          await this.auditService.record(
            {
              action: 'update',
              resource: 'accounting_report_mapping',
              tenantId,
              userId: actor.userId,
              before: { mappings: before },
              after: {
                mappings: dto.mappings.map((m) => ({
                  mappingType: m.mappingType,
                  accountId: m.accountId,
                })),
              },
            },
            tx,
          );
        },
        false,
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isFinancialTransactionConflict(error))
        throw new ConflictException(
          'The account mappings changed while saving. Reload and try again.',
        );
      throw error;
    }

    return { success: true, count: dto.mappings.length };
  }

  async getCashBook(
    tenantId: string,
    query: CashBookQueryDto,
  ): Promise<CashBookResponse> {
    const {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      accountId,
      accountCode,
      page = 1,
      limit = 50,
    } = query;

    const { window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });

    const mappingTypes =
      query.accountKind === CashBookAccountKind.CASH
        ? (['CASH'] as const)
        : query.accountKind === CashBookAccountKind.BANK
          ? (['BANK'] as const)
          : (['CASH', 'BANK'] as const);

    const cashBankMappings =
      await this.prisma.accountingReportAccountMapping.findMany({
        where: {
          tenantId,
          mappingType: { in: [...mappingTypes] },
        },
        include: { account: true },
      });

    let targetAccounts: Array<{ id: string; code: string; name: string }> = [];
    const setupWarnings: string[] = [];

    if (accountId || accountCode) {
      const account = await this.prisma.chartAccount.findFirst({
        where: {
          tenantId,
          ...(accountId ? { id: accountId } : {}),
          ...(accountCode ? { code: accountCode } : {}),
        },
      });

      if (!account) throw new NotFoundException('Account not found');
      if (account.type !== ChartAccountType.ASSET) {
        throw new BadRequestException(
          'Cash Book account must be of type ASSET',
        );
      }

      const isMapped = cashBankMappings.some((m) => m.accountId === account.id);
      if (!isMapped) {
        throw new BadRequestException(
          'Account is not explicitly mapped as CASH or BANK in report settings.',
        );
      }
      targetAccounts = [account];
    } else {
      if (cashBankMappings.length === 0) {
        setupWarnings.push(
          'No cash or bank accounts are mapped. Configure Accounting report account mappings.',
        );
      } else {
        targetAccounts = cashBankMappings.map((m) => m.account);
      }
    }

    const zero = new Prisma.Decimal(0);
    if (targetAccounts.length === 0) {
      return {
        fiscalYearId,
        fiscalPeriodId,
        fromDate,
        toDate,
        openingBalance: zero,
        openingBalanceSide: JournalLineSide.DEBIT,
        totalReceipts: zero,
        totalPayments: zero,
        closingBalance: zero,
        closingBalanceSide: JournalLineSide.DEBIT,
        pageOpeningBalance: zero,
        pageOpeningBalanceSide: JournalLineSide.DEBIT,
        rows: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        generatedAt: new Date(),
        setupWarnings,
      };
    }

    const targetAccountIds = targetAccounts.map((a) => a.id);
    const lineWhere: Prisma.JournalLineWhereInput = {
      tenantId,
      chartAccountId: { in: targetAccountIds },
      journalEntry: ledgerEntryWhere({
        tenantId,
        stage: 'POST_CLOSING',
        fiscalYearId,
        fiscalPeriodId,
        from: window.from,
        toExclusive: window.toExclusive,
      }),
    };
    const skip = (page - 1) * limit;

    const [openingAgg, totalsAgg, totalLines, priorPageLines, lines] =
      await Promise.all([
        this.prisma.journalLine.aggregate({
          _sum: { debit: true, credit: true },
          where: {
            tenantId,
            chartAccountId: { in: targetAccountIds },
            journalEntry: ledgerEntryWhere({
              tenantId,
              stage: 'POST_CLOSING',
              toExclusive: window.from,
            }),
          },
        }),
        this.prisma.journalLine.aggregate({
          _sum: { debit: true, credit: true },
          where: lineWhere,
        }),
        this.prisma.journalLine.count({ where: lineWhere }),
        skip > 0
          ? this.prisma.journalLine.findMany({
              where: lineWhere,
              select: { debit: true, credit: true },
              orderBy: LEDGER_LINE_ORDER,
              take: skip,
            })
          : Promise.resolve(
              [] as Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>,
            ),
        this.prisma.journalLine.findMany({
          where: lineWhere,
          include: cashBookLineInclude,
          orderBy: LEDGER_LINE_ORDER,
          skip,
          take: limit,
        }) as Promise<CashBookJournalLine[]>,
      ]);

    const openingSigned = this.toDecimal(openingAgg._sum.debit).minus(
      this.toDecimal(openingAgg._sum.credit),
    );
    const totalReceipts = this.toDecimal(totalsAgg._sum.debit);
    const totalPayments = this.toDecimal(totalsAgg._sum.credit);
    const pageOpeningSigned = priorPageLines.reduce(
      (sum, line) => sum.plus(line.debit).minus(line.credit),
      openingSigned,
    );

    let runningSignedBalance = pageOpeningSigned;
    const rows: CashBookRow[] = lines.map((line) => {
      runningSignedBalance = runningSignedBalance
        .plus(line.debit)
        .minus(line.credit);
      const running = presentBalance(
        runningSignedBalance,
        JournalLineSide.DEBIT,
      );
      const rowAccount = targetAccounts.find(
        (a) => a.id === line.chartAccountId,
      );
      const otherAccount = line.journalEntry.lines.find(
        (l) => l.chartAccountId !== line.chartAccountId,
      )?.chartAccount;
      const displayAccount = otherAccount || rowAccount;

      return {
        journalEntryId: line.journalEntryId,
        journalLineId: line.id,
        entryDate: line.journalEntry.entryDate,
        postedAt: line.journalEntry.postedAt,
        entryNumber: line.journalEntry.entryNumber,
        accountId: displayAccount?.id || line.chartAccountId,
        accountCode: displayAccount?.code || 'UNKNOWN',
        accountName: displayAccount?.name || 'Other Side',
        narration: line.description || line.journalEntry.narration,
        sourceModule: line.journalEntry.sourceModule,
        sourceType: line.journalEntry.sourceType,
        sourceId: line.journalEntry.sourceId,
        receiptAmount: line.debit,
        paymentAmount: line.credit,
        runningBalance: running.amount,
        runningBalanceSide: running.side,
        postedById: line.journalEntry.postedById,
      };
    });

    const opening = presentBalance(openingSigned, JournalLineSide.DEBIT);
    const pageOpening = presentBalance(
      pageOpeningSigned,
      JournalLineSide.DEBIT,
    );
    const closing = presentBalance(
      openingSigned.plus(totalReceipts).minus(totalPayments),
      JournalLineSide.DEBIT,
    );

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      account:
        targetAccounts.length === 1
          ? {
              id: targetAccounts[0].id,
              code: targetAccounts[0].code,
              name: targetAccounts[0].name,
            }
          : undefined,
      openingBalance: opening.amount,
      openingBalanceSide: opening.side,
      totalReceipts,
      totalPayments,
      closingBalance: closing.amount,
      closingBalanceSide: closing.side,
      pageOpeningBalance: pageOpening.amount,
      pageOpeningBalanceSide: pageOpening.side,
      rows,
      pagination: {
        page,
        limit,
        total: totalLines,
        totalPages: Math.ceil(totalLines / limit),
      },
      generatedAt: new Date(),
      setupWarnings,
    };
  }

  async getIncomeStatement(
    tenantId: string,
    query: IncomeStatementQueryDto,
  ): Promise<IncomeStatementResponse> {
    const {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      includeZeroBalances,
    } = query;

    const { window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });

    const [linesGrouped, accounts] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ['chartAccountId'],
        _sum: { debit: true, credit: true },
        where: {
          tenantId,
          journalEntry: ledgerEntryWhere({
            tenantId,
            stage: 'PRE_CLOSING',
            fiscalYearId,
            fiscalPeriodId,
            from: window.from,
            toExclusive: window.toExclusive,
          }),
        },
      }),
      this.prisma.chartAccount.findMany({
        where: {
          tenantId,
          type: { in: PROFIT_AND_LOSS_ACCOUNT_TYPES },
        },
        orderBy: { code: 'asc' },
      }),
    ]);
    const sums = new Map(
      linesGrouped.map((row) => [row.chartAccountId, row._sum]),
    );

    const incomeAccounts: IncomeStatementAccount[] = [];
    const expenseAccounts: IncomeStatementAccount[] = [];
    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const account of accounts) {
      const lineData = sums.get(account.id);
      const debit = this.toDecimal(lineData?.debit);
      const credit = this.toDecimal(lineData?.credit);

      if (!includeZeroBalances && debit.isZero() && credit.isZero()) continue;

      if (isIncomeAccountType(account.type)) {
        const netIncome = credit.minus(debit);
        if (!includeZeroBalances && netIncome.isZero()) continue;
        incomeAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: netIncome,
        });
        totalIncome = totalIncome.plus(netIncome);
      } else {
        const netExpense = debit.minus(credit);
        if (!includeZeroBalances && netExpense.isZero()) continue;
        expenseAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: netExpense,
        });
        totalExpense = totalExpense.plus(netExpense);
      }
    }

    const netSurplusOrDeficit = totalIncome.minus(totalExpense);
    let resultType: 'SURPLUS' | 'DEFICIT' | 'BREAK_EVEN' = 'BREAK_EVEN';

    if (netSurplusOrDeficit.gt(0)) {
      resultType = 'SURPLUS';
    } else if (netSurplusOrDeficit.lt(0)) {
      resultType = 'DEFICIT';
    }

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      sections: [
        {
          section: 'INCOME',
          total: totalIncome,
          accounts: incomeAccounts,
        },
        {
          section: 'EXPENSE',
          total: totalExpense,
          accounts: expenseAccounts,
        },
      ],
      totalIncome,
      totalExpense,
      netSurplusOrDeficit: netSurplusOrDeficit.abs(),
      resultType,
      stage: 'PRE_CLOSING',
      comparisonSupported: false,
      generatedAt: new Date(),
    };
  }

  async getBalanceSheet(
    tenantId: string,
    query: BalanceSheetQueryDto,
  ): Promise<BalanceSheetResponse> {
    const { fiscalYearId, fiscalPeriodId, asOfDate, includeZeroBalances } =
      query;

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');
    const fiscalPeriod = fiscalPeriodId
      ? await this.prisma.fiscalPeriod.findUnique({
          where: { id: fiscalPeriodId, tenantId, fiscalYearId },
        })
      : null;
    if (fiscalPeriodId && !fiscalPeriod) {
      throw new BadRequestException('Invalid fiscal period for this year');
    }

    // A balance sheet is a position: everything up to the as-of date, across
    // fiscal years, closing entries included (decision R1). A fiscal period
    // means "as of that period's end".
    const asOfExclusive = asOfDate
      ? reportRangeEndExclusive(asOfDate)
      : dayAfter((fiscalPeriod ?? fiscalYear).endDate);
    if (Number.isNaN(asOfExclusive.getTime())) {
      throw new BadRequestException('Invalid asOfDate');
    }

    const [cumulative, currentYear, accounts, setupWarnings] =
      await Promise.all([
        this.prisma.journalLine.groupBy({
          by: ['chartAccountId'],
          _sum: { debit: true, credit: true },
          where: {
            tenantId,
            journalEntry: ledgerEntryWhere({
              tenantId,
              stage: 'POST_CLOSING',
              toExclusive: asOfExclusive,
            }),
          },
        }),
        this.prisma.journalLine.groupBy({
          by: ['chartAccountId'],
          _sum: { debit: true, credit: true },
          where: {
            tenantId,
            journalEntry: ledgerEntryWhere({
              tenantId,
              stage: 'POST_CLOSING',
              fiscalYearId,
              toExclusive: asOfExclusive,
            }),
          },
        }),
        this.prisma.chartAccount.findMany({
          where: { tenantId },
          orderBy: { code: 'asc' },
        }),
        this.openingBalanceWarnings(tenantId, fiscalYear),
      ]);
    const cumulativeById = new Map(
      cumulative.map((row) => [row.chartAccountId, row._sum]),
    );
    const currentById = new Map(
      currentYear.map((row) => [row.chartAccountId, row._sum]),
    );

    const assetAccounts: BalanceSheetAccount[] = [];
    const liabilityAccounts: BalanceSheetAccount[] = [];
    const equityAccounts: BalanceSheetAccount[] = [];

    let totalAssets = new Prisma.Decimal(0);
    let totalLiabilities = new Prisma.Decimal(0);
    let totalEquity = new Prisma.Decimal(0);
    let unclosedResult = new Prisma.Decimal(0);
    let currentYearResult = new Prisma.Decimal(0);

    for (const account of accounts) {
      const sums = cumulativeById.get(account.id);
      const debit = this.toDecimal(sums?.debit);
      const credit = this.toDecimal(sums?.credit);

      if (isProfitAndLossAccountType(account.type)) {
        // Income and expense not yet closed into retained earnings.
        unclosedResult = unclosedResult.plus(credit.minus(debit));
        const current = currentById.get(account.id);
        currentYearResult = currentYearResult.plus(
          this.toDecimal(current?.credit).minus(this.toDecimal(current?.debit)),
        );
        continue;
      }

      if (!includeZeroBalances && debit.isZero() && credit.isZero()) continue;

      if (account.type === ChartAccountType.ASSET) {
        const netAsset = debit.minus(credit);
        if (!includeZeroBalances && netAsset.isZero()) continue;
        assetAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: netAsset,
        });
        totalAssets = totalAssets.plus(netAsset);
      } else if (account.type === ChartAccountType.LIABILITY) {
        const netLiability = credit.minus(debit);
        if (!includeZeroBalances && netLiability.isZero()) continue;
        liabilityAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: netLiability,
        });
        totalLiabilities = totalLiabilities.plus(netLiability);
      } else if (account.type === ChartAccountType.EQUITY) {
        const netEquity = credit.minus(debit);
        if (!includeZeroBalances && netEquity.isZero()) continue;
        equityAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: netEquity,
        });
        totalEquity = totalEquity.plus(netEquity);
      }
    }

    if (!currentYearResult.isZero()) {
      equityAccounts.push({
        accountCode: 'CURRENT_YEAR_RESULT',
        accountName: 'Current Year Surplus / Deficit',
        amount: currentYearResult,
      });
      totalEquity = totalEquity.plus(currentYearResult);
    }
    const priorUnclosed = unclosedResult.minus(currentYearResult);
    if (!priorUnclosed.isZero()) {
      equityAccounts.push({
        accountCode: 'PRIOR_YEARS_UNCLOSED_RESULT',
        accountName: 'Earlier Years Surplus / Deficit (not yet closed)',
        amount: priorUnclosed,
      });
      totalEquity = totalEquity.plus(priorUnclosed);
    }

    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
    const imbalanceAmount = totalAssets.minus(totalLiabilitiesAndEquity).abs();
    const isBalanced = imbalanceAmount.isZero();

    return {
      fiscalYearId,
      fiscalPeriodId,
      asOfDate: asOfDate
        ? new Date(asOfDate)
        : (fiscalPeriod ?? fiscalYear).endDate,
      sections: [
        { section: 'ASSETS', total: totalAssets, accounts: assetAccounts },
        {
          section: 'LIABILITIES',
          total: totalLiabilities,
          accounts: liabilityAccounts,
        },
        { section: 'EQUITY', total: totalEquity, accounts: equityAccounts },
      ],
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
      imbalanceAmount,
      stage: 'POST_CLOSING',
      setupWarnings,
      generatedAt: new Date(),
    };
  }

  async getTaxSummary(
    tenantId: string,
    query: TaxSummaryQueryDto,
  ): Promise<TaxSummaryResponse> {
    const {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      summaryType = TaxSummaryType.ALL,
    } = query;

    const { window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });
    const journalWhere = ledgerEntryWhere({
      tenantId,
      stage: 'PRE_CLOSING',
      fiscalYearId,
      fiscalPeriodId,
      from: window.from,
      toExclusive: window.toExclusive,
    });

    const linesGrouped = await this.prisma.journalLine.groupBy({
      by: ['chartAccountId'],
      _sum: { debit: true, credit: true },
      where: { tenantId, journalEntry: journalWhere },
    });

    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId },
    });

    const mappings = await this.prisma.accountingReportAccountMapping.findMany({
      where: { tenantId },
    });

    const getAccountsByMapping = (types: string[]) => {
      const mappedIds = mappings
        .filter((m) => types.includes(m.mappingType))
        .map((m) => m.accountId);
      return accounts.filter((a) => mappedIds.includes(a.id));
    };

    const vatPayableAccounts = getAccountsByMapping(['VAT_OUTPUT']);
    const vatInputAccounts = getAccountsByMapping(['VAT_INPUT']);
    const tdsPayableAccounts = getAccountsByMapping(['TDS_PAYABLE']);
    const pfEmployeeAccounts = getAccountsByMapping(['PF_EMPLOYEE_PAYABLE']);
    const pfEmployerAccounts = getAccountsByMapping(['PF_EMPLOYER_PAYABLE']);
    const pfPayableAccounts = getAccountsByMapping(['PF_PAYABLE']);

    const setupWarnings: string[] = [];

    const getNetCredit = (accs: Array<{ id: string }>) => {
      let total = new Prisma.Decimal(0);
      for (const a of accs) {
        const line = linesGrouped.find((l) => l.chartAccountId === a.id);
        if (line) {
          total = total
            .plus(this.toDecimal(line._sum.credit))
            .minus(this.toDecimal(line._sum.debit));
        }
      }
      return total;
    };

    const getNetDebit = (accs: Array<{ id: string }>) => {
      let total = new Prisma.Decimal(0);
      for (const a of accs) {
        const line = linesGrouped.find((l) => l.chartAccountId === a.id);
        if (line) {
          total = total
            .plus(this.toDecimal(line._sum.debit))
            .minus(this.toDecimal(line._sum.credit));
        }
      }
      return total;
    };

    let vatOutput = new Prisma.Decimal(0);
    let vatInput = new Prisma.Decimal(0);
    let vatNet = new Prisma.Decimal(0);
    let vatStatus: 'PAYABLE' | 'RECEIVABLE' | 'ZERO' = 'ZERO';

    if (
      summaryType === TaxSummaryType.ALL ||
      summaryType === TaxSummaryType.VAT
    ) {
      if (vatPayableAccounts.length === 0)
        setupWarnings.push('VAT_OUTPUT account mapping is missing');
      if (vatInputAccounts.length === 0)
        setupWarnings.push('VAT_INPUT account mapping is missing');

      vatOutput = getNetCredit(vatPayableAccounts);
      vatInput = getNetDebit(vatInputAccounts);
      vatNet = vatOutput.minus(vatInput);
      if (vatNet.gt(0)) vatStatus = 'PAYABLE';
      else if (vatNet.lt(0)) vatStatus = 'RECEIVABLE';
    }

    let tdsDeducted = new Prisma.Decimal(0);
    let tdsPaid = new Prisma.Decimal(0);
    if (
      summaryType === TaxSummaryType.ALL ||
      summaryType === TaxSummaryType.TDS
    ) {
      if (tdsPayableAccounts.length === 0)
        setupWarnings.push('TDS_PAYABLE account mapping is missing');

      let tdsCredits = new Prisma.Decimal(0);
      let tdsDebits = new Prisma.Decimal(0);
      for (const a of tdsPayableAccounts) {
        const line = linesGrouped.find((l) => l.chartAccountId === a.id);
        if (line) {
          tdsCredits = tdsCredits.plus(this.toDecimal(line._sum.credit));
          tdsDebits = tdsDebits.plus(this.toDecimal(line._sum.debit));
        }
      }
      tdsDeducted = tdsCredits;
      tdsPaid = tdsDebits;
    }

    let pfEmp = new Prisma.Decimal(0);
    let pfEmpr = new Prisma.Decimal(0);
    let pfPaid = new Prisma.Decimal(0);
    let netPfPayable = new Prisma.Decimal(0);
    if (
      summaryType === TaxSummaryType.ALL ||
      summaryType === TaxSummaryType.PF
    ) {
      if (pfPayableAccounts.length === 0)
        setupWarnings.push('PF_PAYABLE account mapping is missing');

      let pfCredits = new Prisma.Decimal(0);
      let pfDebits = new Prisma.Decimal(0);
      for (const a of pfPayableAccounts) {
        const line = linesGrouped.find((l) => l.chartAccountId === a.id);
        if (line) {
          pfCredits = pfCredits.plus(this.toDecimal(line._sum.credit));
          pfDebits = pfDebits.plus(this.toDecimal(line._sum.debit));
        }
      }

      pfPaid = pfDebits;
      netPfPayable = pfCredits.minus(pfDebits);

      pfEmp = pfCredits.dividedBy(2);
      pfEmpr = pfCredits.dividedBy(2);
      if (pfEmployeeAccounts.length > 0)
        pfEmp = getNetCredit(pfEmployeeAccounts);
      if (pfEmployerAccounts.length > 0)
        pfEmpr = getNetCredit(pfEmployerAccounts);
    }

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      ...(summaryType === TaxSummaryType.ALL ||
      summaryType === TaxSummaryType.VAT
        ? {
            vat: {
              outputVat: vatOutput,
              inputVat: vatInput,
              netVat: vatNet.abs(),
              status: vatStatus,
            },
          }
        : {}),
      ...(summaryType === TaxSummaryType.ALL ||
      summaryType === TaxSummaryType.TDS
        ? {
            tds: {
              deductedPayable: tdsDeducted,
              paid: tdsPaid,
              netPayable: tdsDeducted.minus(tdsPaid),
            },
          }
        : {}),
      ...(summaryType === TaxSummaryType.ALL ||
      summaryType === TaxSummaryType.PF
        ? {
            pf: {
              employeeContribution: pfEmp,
              employerContribution: pfEmpr,
              paid: pfPaid,
              netPayable: netPfPayable,
            },
          }
        : {}),
      setupWarnings,
      generatedAt: new Date(),
    };
  }

  async getBankBook(
    tenantId: string,
    query: CashBookQueryDto,
  ): Promise<BankBookResponse> {
    if (!query.accountId && !query.accountCode) {
      throw new BadRequestException(
        'Bank book requires a bank account to be selected.',
      );
    }

    return this.getCashBook(
      tenantId,
      Object.assign({}, query, { accountKind: CashBookAccountKind.BANK }),
    );
  }

  async getJournalRegister(
    tenantId: string,
    query: JournalRegisterQueryDto,
  ): Promise<JournalRegisterResponse> {
    const {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      status,
      sourceType,
      voucherType,
      page = 1,
      limit = 50,
    } = query;

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    const sourceTypes = voucherType
      ? [voucherType as JournalSourceType]
      : sourceType
        ? [sourceType]
        : undefined;

    const where: Prisma.JournalEntryWhereInput = {
      tenantId,
      fiscalYearId,
      ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
      ...(status ? { status } : {}),
      ...(sourceTypes ? { sourceType: { in: sourceTypes } } : {}),
    };

    if (fromDate || toDate) {
      where.entryDate = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    const total = await this.prisma.journalEntry.count({ where });
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            chartAccount: {
              select: { code: true, name: true },
            },
          },
        },
      },
      orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
      skip,
      take: limit,
    });

    const rows: JournalRegisterRow[] = entries.map((entry) => {
      const debitedAccounts = entry.lines
        .filter((line) => line.debit.gt(0))
        .map((line) => `${line.chartAccount.code} ${line.chartAccount.name}`)
        .join('; ');
      const creditedAccounts = entry.lines
        .filter((line) => line.credit.gt(0))
        .map((line) => `${line.chartAccount.code} ${line.chartAccount.name}`)
        .join('; ');
      const totalDebit = entry.lines.reduce(
        (sum, line) => sum.add(line.debit),
        new Prisma.Decimal(0),
      );
      const totalCredit = entry.lines.reduce(
        (sum, line) => sum.add(line.credit),
        new Prisma.Decimal(0),
      );

      return {
        journalEntryId: entry.id,
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        narration: entry.narration,
        sourceModule: entry.sourceModule,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        debitedAccounts,
        creditedAccounts,
        totalDebit,
        totalCredit,
        status: entry.status,
        approvalStatus: entry.approvedAt
          ? 'APPROVED'
          : entry.rejectedAt
            ? 'REJECTED'
            : entry.submittedAt
              ? 'SUBMITTED'
              : 'DRAFT',
        reversalStatus: entry.reversalOfId
          ? 'REVERSAL'
          : entry.reversedAt
            ? 'REVERSED'
            : entry.correctionOfId
              ? 'CORRECTION'
              : 'NONE',
        createdById: entry.createdById,
        approvedById: entry.approvedById,
        postedById: entry.postedById,
        reversalOfId: entry.reversalOfId,
        correctionOfId: entry.correctionOfId,
      };
    });

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      rows,
      pagination: { page, limit, total, totalPages },
      generatedAt: new Date(),
    };
  }

  async getVoucherRegister(
    tenantId: string,
    query: JournalRegisterQueryDto,
  ): Promise<JournalRegisterResponse> {
    if (!query.voucherType) {
      throw new BadRequestException(
        'voucherType is required for voucher registers.',
      );
    }
    return this.getJournalRegister(tenantId, query);
  }

  async getFailedUnpostedTransactions(
    tenantId: string,
  ): Promise<FailedUnpostedTransactionsResponse> {
    const rows: FailedUnpostedTransactionRow[] = [];
    const now = new Date();

    const approvedUnposted = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        status: JournalEntryStatus.APPROVED,
      },
      select: {
        id: true,
        entryNumber: true,
        sourceModule: true,
        sourceType: true,
        entryDate: true,
        lines: {
          select: { debit: true },
        },
      },
      orderBy: [{ entryDate: 'desc' }],
      take: 200,
    });

    for (const entry of approvedUnposted) {
      const amount = entry.lines.reduce(
        (sum, line) => sum.add(line.debit),
        new Prisma.Decimal(0),
      );
      rows.push({
        sourceModule: entry.sourceModule ?? 'M11',
        sourceType: entry.sourceType,
        resourceId: entry.id,
        reference: entry.entryNumber ?? entry.id,
        amount,
        issueType: 'APPROVED_UNPOSTED_JOURNAL',
        details:
          'Journal entry is approved but not posted to the general ledger.',
        detectedAt: now,
      });
    }

    const payrollRunsMissingJournal = await this.prisma.payrollRun.findMany({
      where: {
        tenantId,
        status: { in: [PayrollRunStatus.POSTED, PayrollRunStatus.PAID] },
        journalEntryId: null,
      },
      select: {
        id: true,
        periodMonth: true,
        periodYear: true,
        grossAmount: true,
      },
      take: 100,
    });

    for (const run of payrollRunsMissingJournal) {
      rows.push({
        sourceModule: 'PAYROLL',
        sourceType: 'PAYROLL_RUN',
        resourceId: run.id,
        reference: `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
        amount: run.grossAmount,
        issueType: 'MISSING_GL_POSTING',
        details: 'Posted payroll run has no linked accrual journal entry.',
        detectedAt: now,
      });
    }

    const payrollExceptions = await this.prisma.payrollException.findMany({
      where: {
        tenantId,
        code: PayrollExceptionCode.ACCOUNTING_POSTING_FAILED,
        status: PayrollExceptionStatus.OPEN,
      },
      include: {
        payrollRun: {
          select: {
            id: true,
            periodMonth: true,
            periodYear: true,
          },
        },
      },
      take: 100,
    });

    for (const exception of payrollExceptions) {
      rows.push({
        sourceModule: 'PAYROLL',
        sourceType: 'PAYROLL_RUN',
        resourceId: exception.payrollRunId ?? exception.id,
        reference: exception.payrollRun
          ? `${exception.payrollRun.periodYear}-${String(exception.payrollRun.periodMonth).padStart(2, '0')}`
          : (exception.payrollRunId ?? exception.id),
        amount: null,
        issueType: 'ACCOUNTING_POSTING_FAILED',
        details: exception.safeMessage,
        detectedAt: exception.detectedAt,
      });
    }

    const recentPayments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: { not: PaymentStatus.REVERSED },
        paidAt: {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        receipt: { select: { receiptNumber: true } },
      },
      take: 500,
    });

    if (recentPayments.length > 0) {
      const paymentJournals = await this.prisma.journalEntry.findMany({
        where: {
          tenantId,
          sourceType: JournalSourceType.FEE_PAYMENT,
          sourceId: { in: recentPayments.map((payment) => payment.id) },
        },
        select: { sourceId: true },
      });
      const postedPaymentIds = new Set(
        paymentJournals.map((entry) => entry.sourceId).filter(Boolean),
      );

      for (const payment of recentPayments) {
        if (!postedPaymentIds.has(payment.id)) {
          rows.push({
            sourceModule: 'FEES',
            sourceType: 'FEE_PAYMENT',
            resourceId: payment.id,
            reference: payment.receipt?.receiptNumber ?? payment.id,
            amount: payment.amount,
            issueType: 'MISSING_GL_POSTING',
            details: 'Fee payment has no matching posted journal entry.',
            detectedAt: payment.paidAt,
          });
        }
      }
    }

    return {
      rows,
      summary: {
        totalIssues: rows.length,
        approvedUnpostedJournals: rows.filter(
          (row) => row.issueType === 'APPROVED_UNPOSTED_JOURNAL',
        ).length,
        missingGlPostings: rows.filter(
          (row) => row.issueType === 'MISSING_GL_POSTING',
        ).length,
        payrollPostingFailures: rows.filter(
          (row) => row.issueType === 'ACCOUNTING_POSTING_FAILED',
        ).length,
      },
      generatedAt: now,
    };
  }

  private classifyCashFlowSection(
    counterparty:
      | { id: string; type: ChartAccountType; code: string }
      | undefined,
    sourceType: JournalSourceType,
    mappings: Array<{
      mappingType: AccountingReportMappingType;
      accountId: string;
    }>,
    setupWarnings: string[],
  ): CashFlowSectionKind {
    if (counterparty) {
      const operatingIds = mappings
        .filter(
          (m) =>
            m.mappingType === AccountingReportMappingType.CASH_FLOW_OPERATING,
        )
        .map((m) => m.accountId);
      const investingIds = mappings
        .filter(
          (m) =>
            m.mappingType === AccountingReportMappingType.CASH_FLOW_INVESTING,
        )
        .map((m) => m.accountId);
      const financingIds = mappings
        .filter(
          (m) =>
            m.mappingType === AccountingReportMappingType.CASH_FLOW_FINANCING,
        )
        .map((m) => m.accountId);

      if (operatingIds.includes(counterparty.id)) return 'OPERATING';
      if (investingIds.includes(counterparty.id)) return 'INVESTING';
      if (financingIds.includes(counterparty.id)) return 'FINANCING';
    }

    const operatingSources: JournalSourceType[] = [
      JournalSourceType.FEE_PAYMENT,
      JournalSourceType.INVOICE,
      JournalSourceType.PAYMENT_REFUND,
      JournalSourceType.PAYROLL,
      JournalSourceType.PAYROLL_RUN,
      JournalSourceType.PAYROLL_DISBURSEMENT,
      JournalSourceType.EXPENSE_VOUCHER,
      JournalSourceType.RECEIPT_VOUCHER,
      JournalSourceType.PAYMENT_VOUCHER,
      JournalSourceType.CONTRA_VOUCHER,
    ];
    if (operatingSources.includes(sourceType)) return 'OPERATING';

    if (counterparty) {
      if (
        counterparty.type === ChartAccountType.EQUITY ||
        counterparty.type === ChartAccountType.LIABILITY
      ) {
        return 'FINANCING';
      }
      if (
        counterparty.type === ChartAccountType.ASSET &&
        !counterparty.code.startsWith('11')
      ) {
        return 'INVESTING';
      }
      if (
        counterparty.type === ChartAccountType.REVENUE ||
        counterparty.type === ChartAccountType.INCOME ||
        counterparty.type === ChartAccountType.EXPENSE
      ) {
        return 'OPERATING';
      }
    }

    setupWarnings.push(
      `Unmapped cash movement classified as operating (${sourceType}). Configure cash-flow account mappings for accuracy.`,
    );
    return 'OPERATING';
  }

  /** Cumulative cash/bank balance before `toExclusive`, across fiscal years. */
  private async sumMappedCashBalance(
    tenantId: string,
    cashBankAccountIds: string[],
    toExclusive: Date,
  ): Promise<Prisma.Decimal> {
    if (cashBankAccountIds.length === 0) return new Prisma.Decimal(0);

    const totals = await this.prisma.journalLine.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        tenantId,
        chartAccountId: { in: cashBankAccountIds },
        journalEntry: ledgerEntryWhere({
          tenantId,
          stage: 'POST_CLOSING',
          toExclusive,
        }),
      },
    });

    return this.toDecimal(totals._sum.debit).minus(
      this.toDecimal(totals._sum.credit),
    );
  }

  async getCashFlowStatement(
    tenantId: string,
    query: IncomeStatementQueryDto,
  ): Promise<CashFlowStatementResponse> {
    const { fiscalYearId, fiscalPeriodId, fromDate, toDate } = query;
    const setupWarnings: string[] = [];

    const { window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });

    const mappings = await this.prisma.accountingReportAccountMapping.findMany({
      where: { tenantId },
    });
    const cashBankAccountIds = mappings
      .filter(
        (m) =>
          m.mappingType === AccountingReportMappingType.CASH ||
          m.mappingType === AccountingReportMappingType.BANK,
      )
      .map((m) => m.accountId);

    if (cashBankAccountIds.length === 0) {
      setupWarnings.push(
        'No cash or bank accounts are mapped. Configure Accounting report account mappings.',
      );
      return {
        fiscalYearId,
        fiscalPeriodId,
        fromDate,
        toDate,
        sections: [
          { section: 'OPERATING', lines: [], subtotal: new Prisma.Decimal(0) },
          { section: 'INVESTING', lines: [], subtotal: new Prisma.Decimal(0) },
          { section: 'FINANCING', lines: [], subtotal: new Prisma.Decimal(0) },
        ],
        openingCash: new Prisma.Decimal(0),
        netChange: new Prisma.Decimal(0),
        closingCash: new Prisma.Decimal(0),
        setupWarnings,
        generatedAt: new Date(),
      };
    }

    const journalWhere = ledgerEntryWhere({
      tenantId,
      stage: 'PRE_CLOSING',
      fiscalYearId,
      fiscalPeriodId,
      from: window.from,
      toExclusive: window.toExclusive,
    });

    const [openingCash, closingCash] = await Promise.all([
      this.sumMappedCashBalance(tenantId, cashBankAccountIds, window.from),
      this.sumMappedCashBalance(
        tenantId,
        cashBankAccountIds,
        window.toExclusive,
      ),
    ]);

    const entries = await this.prisma.journalEntry.findMany({
      where: journalWhere,
      include: {
        lines: {
          include: {
            chartAccount: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
      orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
    });

    const cashBankSet = new Set(cashBankAccountIds);
    const sectionLineTotals = new Map<string, Prisma.Decimal>();
    const sectionTotals: Record<CashFlowSectionKind, Prisma.Decimal> = {
      OPERATING: new Prisma.Decimal(0),
      INVESTING: new Prisma.Decimal(0),
      FINANCING: new Prisma.Decimal(0),
    };

    for (const entry of entries) {
      const cashLines = entry.lines.filter((line) =>
        cashBankSet.has(line.chartAccountId),
      );
      if (cashLines.length === 0) continue;

      for (const cashLine of cashLines) {
        const netCash = this.toDecimal(cashLine.debit).minus(
          this.toDecimal(cashLine.credit),
        );
        const counterparties = entry.lines.filter(
          (line) => !cashBankSet.has(line.chartAccountId),
        );
        const primaryCounterparty = counterparties[0]?.chartAccount;
        const section = this.classifyCashFlowSection(
          primaryCounterparty,
          entry.sourceType,
          mappings,
          setupWarnings,
        );
        const label = primaryCounterparty
          ? `${primaryCounterparty.code} - ${primaryCounterparty.name}`
          : entry.sourceType;
        const key = `${section}::${label}`;
        sectionLineTotals.set(
          key,
          (sectionLineTotals.get(key) ?? new Prisma.Decimal(0)).plus(netCash),
        );
        sectionTotals[section] = sectionTotals[section].plus(netCash);
      }
    }

    const buildSection = (section: CashFlowSectionKind): CashFlowSection => {
      const lines: CashFlowLineItem[] = [];
      for (const [key, amount] of sectionLineTotals.entries()) {
        const [sectionKey, label] = key.split('::');
        if (sectionKey !== section || amount.isZero()) continue;
        const [accountCode, ...nameParts] = label.split(' - ');
        lines.push({
          label,
          accountCode: nameParts.length > 0 ? accountCode : undefined,
          accountName: nameParts.length > 0 ? nameParts.join(' - ') : undefined,
          amount,
        });
      }
      lines.sort((a, b) => a.label.localeCompare(b.label));
      return { section, lines, subtotal: sectionTotals[section] };
    };

    const sections = [
      buildSection('OPERATING'),
      buildSection('INVESTING'),
      buildSection('FINANCING'),
    ];
    const netChange = sectionTotals.OPERATING.plus(
      sectionTotals.INVESTING,
    ).plus(sectionTotals.FINANCING);

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      sections,
      openingCash,
      netChange,
      closingCash,
      setupWarnings: [...new Set(setupWarnings)],
      generatedAt: new Date(),
    };
  }

  async getBudgetVsActual(
    tenantId: string,
    query: BudgetVsActualQueryDto,
  ): Promise<BudgetVsActualResponse> {
    const { fiscalYearId, fiscalPeriodId, fromDate, toDate, budgetId } = query;

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    const budget = budgetId
      ? await this.prisma.fiscalBudget.findFirst({
          where: {
            id: budgetId,
            tenantId,
            fiscalYearId,
            status: { in: ['APPROVED', 'LOCKED'] },
          },
          include: {
            lines: {
              include: {
                chartAccount: {
                  select: { id: true, code: true, name: true, type: true },
                },
              },
            },
          },
        })
      : await this.prisma.fiscalBudget.findFirst({
          where: {
            tenantId,
            fiscalYearId,
            status: { in: ['APPROVED', 'LOCKED'] },
          },
          orderBy: { approvedAt: 'desc' },
          include: {
            lines: {
              include: {
                chartAccount: {
                  select: { id: true, code: true, name: true, type: true },
                },
              },
            },
          },
        });

    if (!budget) {
      throw new NotFoundException(
        'No approved fiscal budget found for the selected fiscal year.',
      );
    }

    const { window } = await this.resolveReportWindow(tenantId, {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
    });
    const journalWhere = ledgerEntryWhere({
      tenantId,
      stage: 'PRE_CLOSING',
      fiscalYearId,
      fiscalPeriodId,
      from: window.from,
      toExclusive: window.toExclusive,
    });

    const accountIds = budget.lines.map((line) => line.chartAccountId);
    const linesGrouped =
      accountIds.length > 0
        ? await this.prisma.journalLine.groupBy({
            by: ['chartAccountId'],
            _sum: { debit: true, credit: true },
            where: {
              tenantId,
              chartAccountId: { in: accountIds },
              journalEntry: journalWhere,
            },
          })
        : [];

    const rows: BudgetVsActualRow[] = [];
    let totalBudget = new Prisma.Decimal(0);
    let totalActual = new Prisma.Decimal(0);

    for (const line of budget.lines) {
      const budgetAmount = this.toDecimal(line.amount);
      const grouped = linesGrouped.find(
        (item) => item.chartAccountId === line.chartAccountId,
      );
      const debit = this.toDecimal(grouped?._sum.debit);
      const credit = this.toDecimal(grouped?._sum.credit);
      let actualAmount = new Prisma.Decimal(0);

      if (isIncomeAccountType(line.chartAccount.type)) {
        actualAmount = credit.minus(debit);
      } else if (line.chartAccount.type === ChartAccountType.EXPENSE) {
        actualAmount = debit.minus(credit);
      } else {
        actualAmount = debit.minus(credit);
      }

      const variance = actualAmount.minus(budgetAmount);
      const variancePercent = budgetAmount.isZero()
        ? null
        : variance.div(budgetAmount).times(100);

      rows.push({
        chartAccountId: line.chartAccountId,
        accountCode: line.chartAccount.code,
        accountName: line.chartAccount.name,
        budgetAmount,
        actualAmount,
        variance,
        variancePercent,
        forecastAmount: null,
      });
      totalBudget = totalBudget.plus(budgetAmount);
      totalActual = totalActual.plus(actualAmount);
    }

    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      budgetId: budget.id,
      budgetName: budget.name,
      rows,
      totalBudget,
      totalActual,
      totalVariance: totalActual.minus(totalBudget),
      generatedAt: new Date(),
    };
  }

  /**
   * Phase 7.11b: receivables aging as of a Nepal school day, from the shared
   * loader. Totals and class summaries cover the whole filtered set; only
   * the invoice rows are paged.
   */
  async getReceivablesAging(tenantId: string, query: ReceivablesAgingQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const asOf = resolveAgingAsOf(query.asOfDate);
    const load = await loadReceivables(this.prisma, tenantId, asOf, {
      includeAdvances: true,
      where: {
        ...(query.classId ? { student: { classId: query.classId } } : {}),
        ...(search
          ? {
              AND: [
                {
                  OR: [
                    {
                      invoiceNumber: { contains: search, mode: 'insensitive' },
                    },
                    {
                      student: {
                        is: {
                          OR: [
                            {
                              firstNameEn: {
                                contains: search,
                                mode: 'insensitive',
                              },
                            },
                            {
                              lastNameEn: {
                                contains: search,
                                mode: 'insensitive',
                              },
                            },
                            {
                              studentSystemId: {
                                contains: search,
                                mode: 'insensitive',
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
    });

    const byClassMap = new Map<
      string,
      {
        classId: string | null;
        className: string;
        invoiceCount: number;
        students: Set<string>;
        outstanding: Prisma.Decimal;
        overdueOutstanding: Prisma.Decimal;
      }
    >();
    for (const row of load.rows) {
      const key = row.classId ?? row.className;
      const entry = byClassMap.get(key) ?? {
        classId: row.classId,
        className: row.className,
        invoiceCount: 0,
        students: new Set<string>(),
        outstanding: new Prisma.Decimal(0),
        overdueOutstanding: new Prisma.Decimal(0),
      };
      entry.invoiceCount += 1;
      entry.students.add(row.studentId);
      entry.outstanding = entry.outstanding.plus(row.outstanding);
      if (row.bucket !== 'CURRENT')
        entry.overdueOutstanding = entry.overdueOutstanding.plus(
          row.outstanding,
        );
      byClassMap.set(key, entry);
    }

    const filtered = query.bucket
      ? load.rows.filter((row) => row.bucket === query.bucket)
      : load.rows;
    const ordered = [...filtered].sort(
      (a, b) =>
        b.daysOverdue - a.daysOverdue ||
        a.studentName.localeCompare(b.studentName) ||
        a.invoiceId.localeCompare(b.invoiceId),
    );
    const rows = ordered.slice((page - 1) * limit, page * limit).map((row) => ({
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      studentId: row.studentId,
      studentName: row.studentName,
      studentSystemId: row.studentSystemId,
      className: row.className,
      sectionName: row.sectionName,
      dueDate: row.dueDate,
      totalAmount: row.totalAmount.toFixed(2),
      received: row.received.toFixed(2),
      outstanding: row.outstanding.toFixed(2),
      daysOverdue: row.daysOverdue,
      bucket: row.bucket,
      ledgerHref: `/dashboard/fees/ledgers/${encodeURIComponent(row.studentId)}`,
    }));

    return {
      asOfDate: asOf.asOfDate,
      totals: summarizeAging(load.rows),
      advancesHeld: load.advancesHeld.toFixed(2),
      byClass: [...byClassMap.values()]
        .map((entry) => ({
          classId: entry.classId,
          className: entry.className,
          invoiceCount: entry.invoiceCount,
          studentCount: entry.students.size,
          outstanding: entry.outstanding.toFixed(2),
          overdueOutstanding: entry.overdueOutstanding.toFixed(2),
        }))
        .sort((a, b) => a.className.localeCompare(b.className)),
      rows,
      pagination: {
        page,
        limit,
        total: ordered.length,
        totalPages: Math.ceil(ordered.length / limit),
      },
      basis:
        'Invoices issued by the end of the as-of day, not draft or void. Received amounts are allocations active on that day; invoice totals are current.',
      generatedAt: new Date(),
    };
  }

  /**
   * Phase 7.11b: does the fee subledger (invoices minus what was received)
   * equal the general-ledger receivable control account? Read-only. The
   * difference is explained by known causes; anything left is "unexplained".
   */
  async getReceivablesReconciliation(
    tenantId: string,
    query: ReceivablesReconciliationQueryDto,
  ) {
    const asOf = resolveAgingAsOf(query.asOfDate);
    const zero = () => new Prisma.Decimal(0);

    const [defaultControl, feeMapping] = await Promise.all([
      this.prisma.chartAccount.findFirst({
        where: { tenantId, code: '1200' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.accountingSourceMapping.findFirst({
        where: {
          tenantId,
          sourceModule: { in: ['FINANCE', 'FEES'] },
          sourceType: 'FEE_PAYMENT',
          isActive: true,
          archivedAt: null,
        },
        orderBy: { effectiveFrom: 'desc' },
        select: {
          creditAccount: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);
    const controlAccounts = [
      ...new Map(
        [defaultControl, feeMapping?.creditAccount]
          .filter((account): account is NonNullable<typeof account> =>
            Boolean(account),
          )
          .map((account) => [account.id, account]),
      ).values(),
    ];
    const controlIds = controlAccounts.map((account) => account.id);
    const journalScope = ledgerEntryWhere({
      tenantId,
      stage: 'POST_CLOSING',
      toExclusive: asOf.asOfExclusive,
    });

    const [load, ledger] = await Promise.all([
      loadReceivables(this.prisma, tenantId, asOf),
      controlIds.length
        ? this.prisma.journalLine.aggregate({
            _sum: { debit: true, credit: true },
            where: {
              tenantId,
              chartAccountId: { in: controlIds },
              journalEntry: journalScope,
            },
          })
        : Promise.resolve({ _sum: { debit: null, credit: null } }),
    ]);
    const subledgerTotal = load.rows.reduce(
      (sum, row) => sum.plus(row.outstanding),
      zero(),
    );
    const ledgerBalance = this.toDecimal(ledger._sum.debit).minus(
      this.toDecimal(ledger._sum.credit),
    );
    const difference = ledgerBalance.minus(subledgerTotal);

    interface Item {
      cause: string;
      label: string;
      count: number;
      effect: Prisma.Decimal;
      examples: Array<{ reference: string; amount: string }>;
    }
    const items: Item[] = [];
    const push = (
      cause: string,
      label: string,
      rows: Array<{ reference: string; amount: Prisma.Decimal }>,
    ) => {
      if (rows.length === 0) return;
      items.push({
        cause,
        label,
        count: rows.length,
        effect: rows.reduce((sum, row) => sum.plus(row.amount), zero()),
        examples: rows.slice(0, 5).map((row) => ({
          reference: row.reference,
          amount: row.amount.toFixed(2),
        })),
      });
    };

    // 1. Invoices in the subledger with no posted billing journal.
    const [issuedInvoices, postedBilling] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          issuedAt: { lt: asOf.asOfExclusive },
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.VOID] },
        },
        select: { id: true, invoiceNumber: true, totalAmount: true },
      }),
      this.prisma.journalEntry.findMany({
        where: {
          ...journalScope,
          status: JournalEntryStatus.POSTED,
          sourceModule: 'FINANCE',
          sourceType: JournalSourceType.INVOICE,
          postingType: 'BILLING',
        },
        select: { sourceId: true },
      }),
    ]);
    const billed = new Set(postedBilling.map((row) => row.sourceId));
    push(
      'INVOICE_NOT_POSTED',
      'Invoices with no posted billing journal',
      issuedInvoices
        .filter((invoice) => !billed.has(invoice.id))
        .map((invoice) => ({
          reference: invoice.invoiceNumber,
          amount: invoice.totalAmount.negated(),
        })),
    );

    // Control-account movement of selected journals, keyed by journal.
    const controlNet = async (where: Prisma.JournalEntryWhereInput) => {
      if (controlIds.length === 0) return new Map<string, Prisma.Decimal>();
      const grouped = await this.prisma.journalLine.groupBy({
        by: ['journalEntryId'],
        _sum: { debit: true, credit: true },
        where: {
          tenantId,
          chartAccountId: { in: controlIds },
          journalEntry: { ...journalScope, ...where },
        },
      });
      return new Map(
        grouped.map((row) => [
          row.journalEntryId,
          this.toDecimal(row._sum.debit).minus(this.toDecimal(row._sum.credit)),
        ]),
      );
    };

    // 2. Void invoices whose billing journal was never reversed.
    const voidInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: InvoiceStatus.VOID },
      select: { id: true, invoiceNumber: true },
    });
    if (voidInvoices.length) {
      const numbers = new Map(
        voidInvoices.map((row) => [row.id, row.invoiceNumber]),
      );
      const journals = await this.prisma.journalEntry.findMany({
        where: {
          ...journalScope,
          status: JournalEntryStatus.POSTED,
          sourceModule: 'FINANCE',
          sourceType: JournalSourceType.INVOICE,
          postingType: 'BILLING',
          sourceId: { in: [...numbers.keys()] },
        },
        select: { id: true, sourceId: true },
      });
      const nets = await controlNet({
        id: { in: journals.map((row) => row.id) },
      });
      push(
        'VOID_NOT_REVERSED',
        'Void invoices whose billing journal was not reversed',
        journals.map((row) => ({
          reference: numbers.get(row.sourceId ?? '') ?? row.id,
          amount: nets.get(row.id) ?? zero(),
        })),
      );
    }

    // 3. Late fees added to invoices without a posting.
    const lateFeeLines = await this.prisma.invoiceLine.findMany({
      where: {
        tenantId,
        description: { startsWith: 'Automatic late fee' },
        createdAt: { lt: asOf.asOfExclusive },
        invoice: {
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.VOID] },
        },
      },
      select: {
        id: true,
        totalAmount: true,
        invoice: { select: { invoiceNumber: true } },
      },
    });
    if (lateFeeLines.length) {
      const posted = new Set(
        (
          await this.prisma.journalEntry.findMany({
            where: {
              ...journalScope,
              sourceType: JournalSourceType.ADJUSTMENT,
              postingType: 'ADJUSTMENT',
              sourceId: { in: lateFeeLines.map((line) => line.id) },
            },
            select: { sourceId: true },
          })
        ).map((row) => row.sourceId),
      );
      push(
        'LATE_FEE_NOT_POSTED',
        'Late fees added to invoices without a ledger posting',
        lateFeeLines
          .filter((line) => !posted.has(line.id))
          .map((line) => ({
            reference: line.invoice.invoiceNumber,
            amount: line.totalAmount.negated(),
          })),
      );
    }

    // 4. Waivers posted against receivables but linked to no invoice.
    const unlinkedWaivers = await this.prisma.feeWaiver.findMany({
      where: { tenantId, invoiceId: null },
      select: { id: true },
    });
    if (unlinkedWaivers.length) {
      const nets = await controlNet({
        sourceType: JournalSourceType.ADJUSTMENT,
        postingType: 'WAIVER',
        sourceId: { in: unlinkedWaivers.map((row) => row.id) },
      });
      push(
        'WAIVER_WITHOUT_INVOICE',
        'Waivers posted to receivables without an invoice',
        [...nets.entries()].map(([id, amount]) => ({ reference: id, amount })),
      );
    }

    // 5. Opening balances and manual journals on the control account.
    const opening = await controlNet({
      sourceType: JournalSourceType.OPENING_BALANCE,
    });
    push(
      'OPENING_BALANCE',
      'Opening-balance journals on the receivable account',
      [...opening.entries()].map(([id, amount]) => ({ reference: id, amount })),
    );
    const manual = await controlNet({
      sourceType: {
        in: [
          JournalSourceType.MANUAL,
          JournalSourceType.EXPENSE_VOUCHER,
          JournalSourceType.PAYMENT_VOUCHER,
          JournalSourceType.RECEIPT_VOUCHER,
          JournalSourceType.CONTRA_VOUCHER,
        ],
      },
    });
    push(
      'MANUAL_JOURNAL',
      'Manual journals and vouchers on the receivable account',
      [...manual.entries()].map(([id, amount]) => ({ reference: id, amount })),
    );

    const explained = items.reduce(
      (sum, item) => sum.plus(item.effect),
      zero(),
    );
    const unexplained = difference.minus(explained);
    return {
      asOfDate: asOf.asOfDate,
      controlAccounts,
      subledgerTotal: subledgerTotal.toFixed(2),
      ledgerBalance: ledgerBalance.toFixed(2),
      difference: difference.toFixed(2),
      items: items.map((item) => ({
        ...item,
        effect: item.effect.toFixed(2),
      })),
      unexplained: unexplained.toFixed(2),
      isReconciled: difference.isZero(),
      isFullyExplained: unexplained.isZero(),
      generatedAt: new Date(),
    };
  }
}
