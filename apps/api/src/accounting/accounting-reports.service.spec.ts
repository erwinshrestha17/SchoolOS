import { Test, TestingModule } from '@nestjs/testing';
import { AccountingReportsService } from './accounting-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChartAccountType, JournalLineSide } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('AccountingReportsService', () => {
  let service: AccountingReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      fiscalYear: { findUnique: jest.fn() },
      fiscalPeriod: { findUnique: jest.fn() },
      chartAccount: { findMany: jest.fn(), findFirst: jest.fn() },
      journalLine: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingReportsService,
        { provide: PrismaService, useValue: prisma },
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
        { chartAccountId: 'a1', _sum: { debit: new Decimal(100), credit: new Decimal(0) } },
        { chartAccountId: 'a2', _sum: { debit: new Decimal(0), credit: new Decimal(100) } },
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
        { chartAccountId: 'a1', _sum: { debit: new Decimal(100), credit: new Decimal(150) } },
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
          debit: new Decimal(200),
          credit: new Decimal(0),
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
});
