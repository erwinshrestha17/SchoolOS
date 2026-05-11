import { Test, TestingModule } from '@nestjs/testing';
import { AccountingReportsService } from './accounting-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChartAccountType, JournalLineSide } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

describe('AccountingReportsService', () => {
  let service: AccountingReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      fiscalYear: { findUnique: jest.fn() },
      fiscalPeriod: { findUnique: jest.fn() },
      chartAccount: { findMany: jest.fn(), findFirst: jest.fn() },
      journalLine: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      accountingReportAccountMapping: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const auditService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AccountingReportsService>(AccountingReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTrialBalance', () => {
    it('returns balanced trial balance for simple posted journal', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET, parentId: null },
        { id: 'a2', code: '4000', name: 'Sales', type: ChartAccountType.REVENUE, parentId: null },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: new Prisma.Decimal(100), credit: new Prisma.Decimal(0) } },
        { chartAccountId: 'a2', _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(100) } },
      ]);

      const result = await service.getTrialBalance('tenant1', { fiscalYearId: 'fy1' });

      expect(result.isBalanced).toBe(true);
      expect(result.totalClosingDebit.toString()).toBe('100');
      expect(result.totalClosingCredit.toString()).toBe('100');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].closingDebit.toString()).toBe('100');
      expect(result.rows[1].closingCredit.toString()).toBe('100');
    });

    it('rejects cross-tenant fiscalYearId', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(null);
      await expect(service.getTrialBalance('tenant1', { fiscalYearId: 'fy1' })).rejects.toThrow(NotFoundException);
    });

    it('calculates asset debit balances correctly when credit exceeds debit', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET, parentId: null },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: new Prisma.Decimal(100), credit: new Prisma.Decimal(150) } },
      ]);

      const result = await service.getTrialBalance('tenant1', { fiscalYearId: 'fy1' });
      expect(result.rows[0].closingCredit.toString()).toBe('50');
      expect(result.rows[0].closingDebit.toString()).toBe('0');
      expect(result.rows[0].normalBalanceSide).toBe(JournalLineSide.DEBIT);
    });
  });

  describe('getGeneralLedger', () => {
    it('returns ledger rows for selected account', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.chartAccount.findFirst.mockResolvedValue({ id: 'a1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET });
      prisma.journalLine.count.mockResolvedValue(1);
      prisma.journalLine.findMany.mockResolvedValue([
        {
          id: 'l1',
          debit: new Prisma.Decimal(200),
          credit: new Prisma.Decimal(0),
          journalEntryId: 'je1',
          description: 'test',
          journalEntry: {
            entryDate: new Date('2023-01-01'),
            postedAt: new Date('2023-01-01'),
            entryNumber: 'JE-001',
            narration: 'test',
          }
        }
      ]);

      const result = await service.getGeneralLedger('tenant1', { fiscalYearId: 'fy1', accountId: 'a1' });
      expect(result.rows).toHaveLength(1);
      expect(result.totals.debit.toString()).toBe('200');
      expect(result.closingBalance.toString()).toBe('200');
      expect(result.closingBalanceSide).toBe(JournalLineSide.DEBIT);
    });

    it('rejects if no account is provided', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      await expect(service.getGeneralLedger('tenant1', { fiscalYearId: 'fy1' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCashBook', () => {
    it('returns cash receipts and payments', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([
        { accountId: 'a1', mappingType: 'CASH', account: { id: 'a1', code: '1000', name: 'Cash' } }
      ]);
      prisma.chartAccount.findFirst.mockResolvedValue({ id: 'a1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET });
      prisma.journalLine.count.mockResolvedValue(2);
      prisma.journalLine.findMany.mockResolvedValue([
        {
          id: 'l1',
          debit: new Prisma.Decimal(200),
          credit: new Prisma.Decimal(0),
          journalEntryId: 'je1',
          journalEntry: {
            entryDate: new Date('2023-01-01'),
            postedAt: new Date('2023-01-01'),
            entryNumber: 'JE-001',
          }
        },
        {
          id: 'l2',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(50),
          journalEntryId: 'je2',
          journalEntry: {
            entryDate: new Date('2023-01-02'),
            postedAt: new Date('2023-01-02'),
            entryNumber: 'JE-002',
          }
        }
      ]);

      const result = await service.getCashBook('tenant1', { fiscalYearId: 'fy1', accountId: 'a1' });
      expect(result.rows).toHaveLength(2);
      expect(result.totalReceipts.toString()).toBe('200');
      expect(result.totalPayments.toString()).toBe('50');
      expect(result.closingBalance.toString()).toBe('150');
      expect(result.closingBalanceSide).toBe(JournalLineSide.DEBIT);
    });

    it('rejects if account is not ASSET', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([
        { accountId: 'a1', mappingType: 'CASH', account: { id: 'a1', code: '4000', name: 'Sales' } }
      ]);
      prisma.chartAccount.findFirst.mockResolvedValue({ id: 'a1', code: '4000', name: 'Sales', type: ChartAccountType.REVENUE });
      await expect(service.getCashBook('tenant1', { fiscalYearId: 'fy1', accountId: 'a1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getIncomeStatement', () => {
    it('calculates income and expense correctly', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: '4000', name: 'Sales', type: ChartAccountType.REVENUE },
        { id: 'a2', code: '5000', name: 'Rent', type: ChartAccountType.EXPENSE },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(500) } },
        { chartAccountId: 'a2', _sum: { debit: new Prisma.Decimal(200), credit: new Prisma.Decimal(0) } },
      ]);

      const result = await service.getIncomeStatement('tenant1', { fiscalYearId: 'fy1' });
      expect(result.totalIncome.toString()).toBe('500');
      expect(result.totalExpense.toString()).toBe('200');
      expect(result.netSurplusOrDeficit.toString()).toBe('300');
      expect(result.resultType).toBe('SURPLUS');
      expect(result.sections).toHaveLength(2);
    });
  });

  describe('getBalanceSheet', () => {
    it('calculates assets, liabilities, equity, and includes surplus if unclosed', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1', endDate: new Date('2023-12-31') });
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET },
        { id: 'a2', code: '2000', name: 'Payable', type: ChartAccountType.LIABILITY },
        { id: 'a3', code: '3000', name: 'Equity', type: ChartAccountType.EQUITY },
        { id: 'a4', code: '4000', name: 'Sales', type: ChartAccountType.REVENUE }, // for surplus
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: new Prisma.Decimal(1000), credit: new Prisma.Decimal(0) } },
        { chartAccountId: 'a2', _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(300) } },
        { chartAccountId: 'a3', _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(200) } },
        { chartAccountId: 'a4', _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(500) } }, // 500 surplus
      ]);

      const result = await service.getBalanceSheet('tenant1', { fiscalYearId: 'fy1' });
      expect(result.totalAssets.toString()).toBe('1000');
      expect(result.totalLiabilities.toString()).toBe('300');
      
      // Total equity should be original equity (200) + surplus (500) = 700
      expect(result.totalEquity.toString()).toBe('700');
      
      expect(result.totalLiabilitiesAndEquity.toString()).toBe('1000');
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('getTaxSummary', () => {
    it('calculates VAT and returns setup warnings if missing mappings', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue({ id: 'fy1' });
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([
        { mappingType: 'VAT', accountId: 'a1', account: { id: 'a1', code: 'VAT-PAY-1', name: 'VAT Payable' } },
        { mappingType: 'VAT', accountId: 'a2', account: { id: 'a2', code: 'VAT-IN-1', name: 'VAT Input' } },
      ]);
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: 'VAT-PAY-1', name: 'VAT Payable' },
        { id: 'a2', code: 'VAT-IN-1', name: 'VAT Input' },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(100) } }, // 100 Output
        { chartAccountId: 'a2', _sum: { debit: new Prisma.Decimal(60), credit: new Prisma.Decimal(0) } }, // 60 Input
      ]);

      const result = await service.getTaxSummary('tenant1', { fiscalYearId: 'fy1' } as any);
      expect(result.vat?.outputVat.toString()).toBe('100');
      expect(result.vat?.inputVat.toString()).toBe('60');
      expect(result.vat?.netVat.toString()).toBe('40');
      expect(result.vat?.status).toBe('PAYABLE');
    });
  });
});
