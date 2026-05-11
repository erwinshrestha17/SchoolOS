import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
} from './types/accounting-reports.types';
import { CashBookQueryDto } from './dto/cash-book-query.dto';
import { IncomeStatementQueryDto } from './dto/income-statement-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import {
  TaxSummaryQueryDto,
  TaxSummaryType,
} from './dto/tax-summary-query.dto';
import { UpdateAccountingReportMappingsDto } from './dto/report-account-mapping.dto';
import { ChartAccountType, JournalLineSide, Prisma } from '@prisma/client';

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

@Injectable()
export class AccountingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private toDecimal(value: unknown): Prisma.Decimal {
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

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    if (fiscalPeriodId) {
      const fiscalPeriod = await this.prisma.fiscalPeriod.findUnique({
        where: { id: fiscalPeriodId, tenantId, fiscalYearId },
      });
      if (!fiscalPeriod) {
        throw new BadRequestException('Invalid fiscal period for this year');
      }
    }

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    const journalWhere: Prisma.JournalEntryWhereInput = {
      tenantId,
      status: 'POSTED',
      fiscalYearId,
    };

    if (fiscalPeriodId) journalWhere.fiscalPeriodId = fiscalPeriodId;
    if (fromDate || toDate) {
      journalWhere.entryDate = {};
      if (fromDate) journalWhere.entryDate.gte = new Date(fromDate);
      if (toDate) journalWhere.entryDate.lte = new Date(toDate);
    }

    const linesGrouped = await this.prisma.journalLine.groupBy({
      by: ['chartAccountId'],
      _sum: {
        debit: true,
        credit: true,
      },
      where: {
        tenantId,
        journalEntry: journalWhere,
      },
    });

    const accounts = await this.prisma.chartAccount.findMany({
      where: {
        tenantId,
        ...(accountType ? { type: accountType } : {}),
      },
      orderBy: { code: 'asc' },
    });

    const rows: TrialBalanceRow[] = [];
    const totalOpeningDebit = new Prisma.Decimal(0);
    const totalOpeningCredit = new Prisma.Decimal(0);
    let totalPeriodDebit = new Prisma.Decimal(0);
    let totalPeriodCredit = new Prisma.Decimal(0);
    let totalClosingDebit = new Prisma.Decimal(0);
    let totalClosingCredit = new Prisma.Decimal(0);

    const normalDebitTypes: ChartAccountType[] = [
      ChartAccountType.ASSET,
      ChartAccountType.EXPENSE,
    ];

    for (const account of accounts) {
      const lineData = linesGrouped.find(
        (l) => l.chartAccountId === account.id,
      );

      const pDebit = this.toDecimal(lineData?._sum.debit);
      const pCredit = this.toDecimal(lineData?._sum.credit);

      const net = pDebit.minus(pCredit);
      const normalSide = normalDebitTypes.includes(account.type)
        ? JournalLineSide.DEBIT
        : JournalLineSide.CREDIT;

      let cDebit = new Prisma.Decimal(0);
      let cCredit = new Prisma.Decimal(0);

      if (normalSide === JournalLineSide.DEBIT) {
        if (net.gte(0)) {
          cDebit = net;
        } else {
          cCredit = net.abs();
        }
      } else {
        const creditNet = pCredit.minus(pDebit);
        if (creditNet.gte(0)) {
          cCredit = creditNet;
        } else {
          cDebit = creditNet.abs();
        }
      }

      if (
        !includeZeroBalances &&
        pDebit.isZero() &&
        pCredit.isZero() &&
        cDebit.isZero() &&
        cCredit.isZero()
      ) {
        continue;
      }

      totalPeriodDebit = totalPeriodDebit.plus(pDebit);
      totalPeriodCredit = totalPeriodCredit.plus(pCredit);
      totalClosingDebit = totalClosingDebit.plus(cDebit);
      totalClosingCredit = totalClosingCredit.plus(cCredit);

      rows.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        parentId: account.parentId,
        openingDebit: new Prisma.Decimal(0),
        openingCredit: new Prisma.Decimal(0),
        periodDebit: pDebit,
        periodCredit: pCredit,
        closingDebit: cDebit,
        closingCredit: cCredit,
        netBalance: net.abs(),
        normalBalanceSide: normalSide,
      });
    }

    const imbalanceAmount = totalClosingDebit.minus(totalClosingCredit).abs();
    const isBalanced =
      imbalanceAmount.isZero() && totalPeriodDebit.equals(totalPeriodCredit);

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
      sort,
    } = query;

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    if (fiscalPeriodId) {
      const fiscalPeriod = await this.prisma.fiscalPeriod.findUnique({
        where: { id: fiscalPeriodId, tenantId, fiscalYearId },
      });
      if (!fiscalPeriod) {
        throw new BadRequestException('Invalid fiscal period for this year');
      }
    }

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    if (!accountId && !accountCode) {
      throw new BadRequestException(
        'accountId or accountCode is required for General Ledger',
      );
    }

    const account = await this.prisma.chartAccount.findFirst({
      where: {
        tenantId,
        ...(accountId ? { id: accountId } : {}),
        ...(accountCode ? { code: accountCode } : {}),
      },
    });

    if (!account) throw new NotFoundException('Account not found');

    const journalWhere: Prisma.JournalEntryWhereInput = {
      tenantId,
      status: 'POSTED',
      fiscalYearId,
    };
    if (fiscalPeriodId) journalWhere.fiscalPeriodId = fiscalPeriodId;
    if (fromDate || toDate) {
      journalWhere.entryDate = {};
      if (fromDate) journalWhere.entryDate.gte = new Date(fromDate);
      if (toDate) journalWhere.entryDate.lte = new Date(toDate);
    }
    if (sourceModule) journalWhere.sourceModule = sourceModule;
    if (sourceType) journalWhere.sourceType = sourceType;
    if (sourceId) journalWhere.sourceId = sourceId;

    const normalDebitTypes: ChartAccountType[] = [
      ChartAccountType.ASSET,
      ChartAccountType.EXPENSE,
    ];
    const normalSide = normalDebitTypes.includes(account.type)
      ? JournalLineSide.DEBIT
      : JournalLineSide.CREDIT;

    let openingDebitTotal = new Prisma.Decimal(0);
    let openingCreditTotal = new Prisma.Decimal(0);

    if (fromDate) {
      const priorLinesGrouped = await this.prisma.journalLine.groupBy({
        by: ['chartAccountId'],
        _sum: { debit: true, credit: true },
        where: {
          tenantId,
          chartAccountId: account.id,
          journalEntry: {
            tenantId,
            status: 'POSTED',
            fiscalYearId,
            entryDate: { lt: new Date(fromDate) },
          },
        },
      });

      if (priorLinesGrouped.length > 0) {
        openingDebitTotal = this.toDecimal(priorLinesGrouped[0]._sum.debit);
        openingCreditTotal = this.toDecimal(priorLinesGrouped[0]._sum.credit);
      }
    }

    const openingNet = openingDebitTotal.minus(openingCreditTotal);
    let openingBalance = new Prisma.Decimal(0);
    let openingBalanceSide: JournalLineSide = normalSide;

    if (normalSide === JournalLineSide.DEBIT) {
      if (openingNet.gte(0)) {
        openingBalance = openingNet;
      } else {
        openingBalance = openingNet.abs();
        openingBalanceSide = JournalLineSide.CREDIT;
      }
    } else {
      const openingCreditNet = openingCreditTotal.minus(openingDebitTotal);
      if (openingCreditNet.gte(0)) {
        openingBalance = openingCreditNet;
      } else {
        openingBalance = openingCreditNet.abs();
        openingBalanceSide = JournalLineSide.DEBIT;
      }
    }

    const lineWhere: Prisma.JournalLineWhereInput = {
      tenantId,
      chartAccountId: account.id,
      journalEntry: journalWhere,
    };

    const totalLines = await this.prisma.journalLine.count({
      where: lineWhere,
    });
    const totalPages = Math.ceil(totalLines / limit);
    const skip = (page - 1) * limit;

    const orderBy: Prisma.JournalLineOrderByWithRelationInput[] = [];
    if (sort === 'entryDate:asc,entryNumber:asc') {
      orderBy.push({ journalEntry: { entryDate: 'asc' } });
      orderBy.push({ journalEntry: { entryNumber: 'asc' } });
    } else {
      orderBy.push({ journalEntry: { entryDate: 'asc' } });
      orderBy.push({ journalEntry: { entryNumber: 'asc' } });
    }

    const lines = await this.prisma.journalLine.findMany({
      where: lineWhere,
      include: { journalEntry: true },
      orderBy,
      skip,
      take: limit,
    });

    let runningSignedBalance = openingNet;
    const rows: GeneralLedgerRow[] = [];
    let pageDebitTotal = new Prisma.Decimal(0);
    let pageCreditTotal = new Prisma.Decimal(0);

    for (const line of lines) {
      runningSignedBalance = runningSignedBalance
        .plus(line.debit)
        .minus(line.credit);
      pageDebitTotal = pageDebitTotal.plus(line.debit);
      pageCreditTotal = pageCreditTotal.plus(line.credit);

      let lineRunBalance = new Prisma.Decimal(0);
      let lineRunSide: JournalLineSide = JournalLineSide.DEBIT;

      if (normalSide === JournalLineSide.DEBIT) {
        if (runningSignedBalance.gte(0)) {
          lineRunBalance = runningSignedBalance;
          lineRunSide = JournalLineSide.DEBIT;
        } else {
          lineRunBalance = runningSignedBalance.abs();
          lineRunSide = JournalLineSide.CREDIT;
        }
      } else {
        const creditNet = runningSignedBalance.negated();
        if (creditNet.gte(0)) {
          lineRunBalance = creditNet;
          lineRunSide = JournalLineSide.CREDIT;
        } else {
          lineRunBalance = creditNet.abs();
          lineRunSide = JournalLineSide.DEBIT;
        }
      }

      rows.push({
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
        runningBalance: lineRunBalance,
        runningBalanceSide: lineRunSide,
        createdById: line.journalEntry.createdById,
        postedById: line.journalEntry.postedById,
        reversalOfId: line.journalEntry.reversalOfId,
        correctionOfId: line.journalEntry.correctionOfId,
      });
    }

    let closingBalance = openingBalance;
    let closingBalanceSide = openingBalanceSide;

    if (rows.length > 0) {
      closingBalance = rows[rows.length - 1].runningBalance;
      closingBalanceSide = rows[rows.length - 1].runningBalanceSide;
    }

    return {
      fiscalYearId,
      fiscalPeriodId,
      fromDate,
      toDate,
      accountId: account.id,
      accountCode: account.code,
      openingBalance,
      openingBalanceSide,
      closingBalance,
      closingBalanceSide,
      totals: {
        debit: pageDebitTotal,
        credit: pageCreditTotal,
      },
      rows,
      pagination: {
        page,
        limit,
        total: totalLines,
        totalPages,
      },
      generatedAt: new Date(),
    };
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

  async updateReportMappings(
    tenantId: string,
    userId: string,
    dto: UpdateAccountingReportMappingsDto,
  ) {
    const accountIds = dto.mappings.map((m) => m.accountId);

    if (accountIds.length > 0) {
      const accounts = await this.prisma.chartAccount.findMany({
        where: { tenantId, id: { in: accountIds } },
      });

      if (accounts.length !== new Set(accountIds).size) {
        throw new BadRequestException(
          'One or more accounts do not exist or belong to another tenant',
        );
      }
    }

    const existingMappings =
      await this.prisma.accountingReportAccountMapping.findMany({
        where: { tenantId },
      });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.accountingReportAccountMapping.deleteMany({
        where: { tenantId },
      });

      if (dto.mappings.length > 0) {
        await tx.accountingReportAccountMapping.createMany({
          data: dto.mappings.map((m) => ({
            tenantId,
            mappingType: m.mappingType,
            accountId: m.accountId,
            createdById: userId,
            updatedById: userId,
          })),
        });
      }

      return true;
    });

    await this.auditService.record({
      action: 'update',
      resource: 'accounting_report_mapping',
      tenantId,
      userId,
      after: {
        mappings: dto.mappings,
      },
    });

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

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    if (fiscalPeriodId) {
      const fiscalPeriod = await this.prisma.fiscalPeriod.findUnique({
        where: { id: fiscalPeriodId, tenantId, fiscalYearId },
      });
      if (!fiscalPeriod) {
        throw new BadRequestException('Invalid fiscal period for this year');
      }
    }

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    const cashBankMappings =
      await this.prisma.accountingReportAccountMapping.findMany({
        where: {
          tenantId,
          mappingType: { in: ['CASH', 'BANK'] },
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

    if (targetAccounts.length === 0) {
      return {
        fiscalYearId,
        fiscalPeriodId,
        fromDate,
        toDate,
        openingBalance: new Prisma.Decimal(0),
        openingBalanceSide: JournalLineSide.DEBIT,
        totalReceipts: new Prisma.Decimal(0),
        totalPayments: new Prisma.Decimal(0),
        closingBalance: new Prisma.Decimal(0),
        closingBalanceSide: JournalLineSide.DEBIT,
        rows: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        generatedAt: new Date(),
        setupWarnings,
      };
    }

    const targetAccountIds = targetAccounts.map((a) => a.id);

    const journalWhere: Prisma.JournalEntryWhereInput = {
      tenantId,
      status: 'POSTED',
      fiscalYearId,
    };
    if (fiscalPeriodId) journalWhere.fiscalPeriodId = fiscalPeriodId;
    if (fromDate || toDate) {
      journalWhere.entryDate = {};
      if (fromDate) journalWhere.entryDate.gte = new Date(fromDate);
      if (toDate) journalWhere.entryDate.lte = new Date(toDate);
    }

    let openingBalance = new Prisma.Decimal(0);

    if (fromDate) {
      const priorLinesGrouped = await this.prisma.journalLine.groupBy({
        by: ['chartAccountId'],
        _sum: { debit: true, credit: true },
        where: {
          tenantId,
          chartAccountId: { in: targetAccountIds },
          journalEntry: {
            tenantId,
            status: 'POSTED',
            fiscalYearId,
            entryDate: { lt: new Date(fromDate) },
          },
        },
      });

      for (const group of priorLinesGrouped) {
        const pDebit = this.toDecimal(group._sum.debit);
        const pCredit = this.toDecimal(group._sum.credit);
        openingBalance = openingBalance.plus(pDebit.minus(pCredit));
      }
    }

    let openingBalanceSide: JournalLineSide = JournalLineSide.DEBIT;
    let absoluteOpeningBalance = openingBalance;
    if (openingBalance.lt(0)) {
      absoluteOpeningBalance = openingBalance.abs();
      openingBalanceSide = JournalLineSide.CREDIT;
    }

    const lineWhere: Prisma.JournalLineWhereInput = {
      tenantId,
      chartAccountId: { in: targetAccountIds },
      journalEntry: journalWhere,
    };

    const totalLines = await this.prisma.journalLine.count({
      where: lineWhere,
    });
    const totalPages = Math.ceil(totalLines / limit);
    const skip = (page - 1) * limit;

    const lines: CashBookJournalLine[] = await this.prisma.journalLine.findMany(
      {
        where: lineWhere,
        include: cashBookLineInclude,
        orderBy: [
          { journalEntry: { entryDate: 'asc' } },
          { journalEntry: { entryNumber: 'asc' } },
        ],
        skip,
        take: limit,
      },
    );

    let runningSignedBalance = openingBalance;
    const rows: CashBookRow[] = [];
    let totalReceipts = new Prisma.Decimal(0);
    let totalPayments = new Prisma.Decimal(0);

    for (const line of lines) {
      runningSignedBalance = runningSignedBalance
        .plus(line.debit)
        .minus(line.credit);

      totalReceipts = totalReceipts.plus(line.debit);
      totalPayments = totalPayments.plus(line.credit);

      let lineRunBalance = runningSignedBalance;
      let lineRunSide: JournalLineSide = JournalLineSide.DEBIT;

      if (runningSignedBalance.lt(0)) {
        lineRunBalance = runningSignedBalance.abs();
        lineRunSide = JournalLineSide.CREDIT;
      }

      const rowAccount = targetAccounts.find(
        (a) => a.id === line.chartAccountId,
      )!;

      const otherAccount = line.journalEntry.lines.find(
        (l) => l.chartAccountId !== line.chartAccountId,
      )?.chartAccount;

      const displayAccount = otherAccount || rowAccount;

      rows.push({
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
        runningBalance: lineRunBalance,
        runningBalanceSide: lineRunSide,
        postedById: line.journalEntry.postedById,
      });
    }

    let closingBalance = absoluteOpeningBalance;
    let closingBalanceSide: JournalLineSide = openingBalanceSide;

    if (rows.length > 0) {
      closingBalance = rows[rows.length - 1].runningBalance;
      closingBalanceSide = rows[rows.length - 1].runningBalanceSide;
    }

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
      openingBalance: absoluteOpeningBalance,
      openingBalanceSide,
      totalReceipts,
      totalPayments,
      closingBalance,
      closingBalanceSide,
      rows,
      pagination: {
        page,
        limit,
        total: totalLines,
        totalPages,
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

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    if (fiscalPeriodId) {
      const fiscalPeriod = await this.prisma.fiscalPeriod.findUnique({
        where: { id: fiscalPeriodId, tenantId, fiscalYearId },
      });
      if (!fiscalPeriod) {
        throw new BadRequestException('Invalid fiscal period for this year');
      }
    }

    const journalWhere: Prisma.JournalEntryWhereInput = {
      tenantId,
      status: 'POSTED',
      fiscalYearId,
    };

    if (fiscalPeriodId) journalWhere.fiscalPeriodId = fiscalPeriodId;
    if (fromDate || toDate) {
      journalWhere.entryDate = {};
      if (fromDate) journalWhere.entryDate.gte = new Date(fromDate);
      if (toDate) journalWhere.entryDate.lte = new Date(toDate);
    }

    const linesGrouped = await this.prisma.journalLine.groupBy({
      by: ['chartAccountId'],
      _sum: {
        debit: true,
        credit: true,
      },
      where: {
        tenantId,
        journalEntry: journalWhere,
      },
    });

    const accounts = await this.prisma.chartAccount.findMany({
      where: {
        tenantId,
        type: { in: [ChartAccountType.REVENUE, ChartAccountType.EXPENSE] },
      },
      orderBy: { code: 'asc' },
    });

    const incomeAccounts: IncomeStatementAccount[] = [];
    const expenseAccounts: IncomeStatementAccount[] = [];
    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const account of accounts) {
      const lineData = linesGrouped.find(
        (l) => l.chartAccountId === account.id,
      );
      const debit = this.toDecimal(lineData?._sum.debit);
      const credit = this.toDecimal(lineData?._sum.credit);

      if (!includeZeroBalances && debit.isZero() && credit.isZero()) continue;

      if (account.type === ChartAccountType.REVENUE) {
        const netIncome = credit.minus(debit);
        if (!includeZeroBalances && netIncome.isZero()) continue;
        incomeAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: netIncome,
        });
        totalIncome = totalIncome.plus(netIncome);
      } else if (account.type === ChartAccountType.EXPENSE) {
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

    const journalWhere: Prisma.JournalEntryWhereInput = {
      tenantId,
      status: 'POSTED',
      fiscalYearId,
    };
    if (fiscalPeriodId) journalWhere.fiscalPeriodId = fiscalPeriodId;
    if (asOfDate) {
      journalWhere.entryDate = { lte: new Date(asOfDate) };
    }

    const linesGrouped = await this.prisma.journalLine.groupBy({
      by: ['chartAccountId'],
      _sum: {
        debit: true,
        credit: true,
      },
      where: {
        tenantId,
        journalEntry: journalWhere,
      },
    });

    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    const assetAccounts: BalanceSheetAccount[] = [];
    const liabilityAccounts: BalanceSheetAccount[] = [];
    const equityAccounts: BalanceSheetAccount[] = [];

    let totalAssets = new Prisma.Decimal(0);
    let totalLiabilities = new Prisma.Decimal(0);
    let totalEquity = new Prisma.Decimal(0);

    let currentYearIncome = new Prisma.Decimal(0);
    let currentYearExpense = new Prisma.Decimal(0);

    for (const account of accounts) {
      const lineData = linesGrouped.find(
        (l) => l.chartAccountId === account.id,
      );
      const debit = this.toDecimal(lineData?._sum.debit);
      const credit = this.toDecimal(lineData?._sum.credit);

      if (account.type === ChartAccountType.REVENUE) {
        currentYearIncome = currentYearIncome.plus(credit.minus(debit));
        continue;
      } else if (account.type === ChartAccountType.EXPENSE) {
        currentYearExpense = currentYearExpense.plus(debit.minus(credit));
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

    const currentYearResult = currentYearIncome.minus(currentYearExpense);
    if (currentYearResult.abs().gt(0)) {
      equityAccounts.push({
        accountCode: 'CURRENT_YEAR_RESULT',
        accountName: 'Current Year Surplus / Deficit',
        amount: currentYearResult,
      });
      totalEquity = totalEquity.plus(currentYearResult);
    }

    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
    const imbalanceAmount = totalAssets.minus(totalLiabilitiesAndEquity).abs();
    const isBalanced = imbalanceAmount.isZero();

    return {
      fiscalYearId,
      asOfDate: asOfDate ? new Date(asOfDate) : fiscalYear.endDate,
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

    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    const journalWhere: Prisma.JournalEntryWhereInput = {
      tenantId,
      status: 'POSTED',
      fiscalYearId,
    };
    if (fiscalPeriodId) journalWhere.fiscalPeriodId = fiscalPeriodId;
    if (fromDate || toDate) {
      journalWhere.entryDate = {};
      if (fromDate) journalWhere.entryDate.gte = new Date(fromDate);
      if (toDate) journalWhere.entryDate.lte = new Date(toDate);
    }

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
}
