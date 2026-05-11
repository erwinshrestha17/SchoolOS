import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import {
  TrialBalanceResponse,
  TrialBalanceRow,
  GeneralLedgerResponse,
  GeneralLedgerRow,
} from './types/accounting-reports.types';
import { ChartAccountType, JournalLineSide, Prisma } from '@prisma/client';

@Injectable()
export class AccountingReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
    let totalOpeningDebit = new Prisma.Decimal(0);
    let totalOpeningCredit = new Prisma.Decimal(0);
    let totalPeriodDebit = new Prisma.Decimal(0);
    let totalPeriodCredit = new Prisma.Decimal(0);
    let totalClosingDebit = new Prisma.Decimal(0);
    let totalClosingCredit = new Prisma.Decimal(0);

    const normalDebitTypes = [ChartAccountType.ASSET, ChartAccountType.EXPENSE];

    for (const account of accounts) {
      const lineData = linesGrouped.find((l) => l.chartAccountId === account.id);

      const pDebit = lineData?._sum.debit || new Prisma.Decimal(0);
      const pCredit = lineData?._sum.credit || new Prisma.Decimal(0);

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

    const normalDebitTypes = [ChartAccountType.ASSET, ChartAccountType.EXPENSE];
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
        openingDebitTotal =
          priorLinesGrouped[0]._sum.debit || new Prisma.Decimal(0);
        openingCreditTotal =
          priorLinesGrouped[0]._sum.credit || new Prisma.Decimal(0);
      }
    }

    const openingNet = openingDebitTotal.minus(openingCreditTotal);
    let openingBalance = new Prisma.Decimal(0);
    let openingBalanceSide = normalSide;

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
      let lineRunSide = JournalLineSide.DEBIT;

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
}
