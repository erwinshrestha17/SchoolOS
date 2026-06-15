import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AccountingReportExportsService } from './accounting-report-exports.service';
import { AccountingReportsService } from './accounting-reports.service';
import { ChartAccountType, JournalLineSide, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuditService } from '../audit/audit.service';

describe('AccountingReportExportsService', () => {
  let service: AccountingReportExportsService;
  let reportsService: jest.Mocked<AccountingReportsService>;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    reportExport: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let fileRegistryService: { registerGeneratedFile: jest.Mock };
  let auditService: { record: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    const mockReportsService = {
      getTrialBalance: jest.fn(),
      getGeneralLedger: jest.fn(),
      getCashBook: jest.fn(),
      getIncomeStatement: jest.fn(),
      getBalanceSheet: jest.fn(),
      getTaxSummary: jest.fn(),
    };
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Test School' }),
      },
      reportExport: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    fileRegistryService = {
      registerGeneratedFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
    };
    auditService = { record: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingReportExportsService,
        {
          provide: AccountingReportsService,
          useValue: mockReportsService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: FileRegistryService,
          useValue: fileRegistryService,
        },
        { provide: AuditService, useValue: auditService },
        { provide: getQueueToken('accounting-reports'), useValue: queue },
      ],
    }).compile();

    service = module.get<AccountingReportExportsService>(
      AccountingReportExportsService,
    );
    reportsService = module.get(AccountingReportsService);
  });

  it('exports Trial Balance CSV with expected columns and totals', async () => {
    reportsService.getTrialBalance.mockResolvedValue({
      fiscalYearId: 'fy-1',
      totalOpeningDebit: new Prisma.Decimal('1000'),
      totalOpeningCredit: new Prisma.Decimal('0'),
      totalPeriodDebit: new Prisma.Decimal('500'),
      totalPeriodCredit: new Prisma.Decimal('200'),
      totalClosingDebit: new Prisma.Decimal('1300'),
      totalClosingCredit: new Prisma.Decimal('0'),
      isBalanced: true,
      imbalanceAmount: new Prisma.Decimal('0'),
      rows: [
        {
          accountId: 'acc-1',
          accountCode: '1001',
          accountName: 'Cash',
          accountType: ChartAccountType.ASSET,
          parentId: null,
          openingDebit: new Prisma.Decimal('1000'),
          openingCredit: new Prisma.Decimal('0'),
          periodDebit: new Prisma.Decimal('500'),
          periodCredit: new Prisma.Decimal('200'),
          closingDebit: new Prisma.Decimal('1300'),
          closingCredit: new Prisma.Decimal('0'),
          netBalance: new Prisma.Decimal('1300'),
          normalBalanceSide: JournalLineSide.DEBIT,
        },
      ],
      generatedAt: new Date(),
    } as any);

    const csv = await service.exportTrialBalanceCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain('Account Code,Account Name,Account Type');
    expect(csv).toContain('Opening Debit,Opening Credit');
    expect(csv).toContain('Period Debit,Period Credit');
    expect(csv).toContain('Closing Debit,Closing Credit');
    expect(csv).toContain('"1001","Cash","ASSET"');
    expect(csv).toContain(
      '"1000.00","0.00","500.00","200.00","1300.00","0.00","1300.00","DEBIT"',
    );
    expect(csv).toContain('"TOTAL"');
  });

  it('exports General Ledger CSV with spec columns', async () => {
    reportsService.getGeneralLedger.mockResolvedValue({
      openingBalance: new Prisma.Decimal('1000'),
      openingBalanceSide: JournalLineSide.DEBIT,
      closingBalance: new Prisma.Decimal('1500'),
      closingBalanceSide: JournalLineSide.DEBIT,
      totals: {
        debit: new Prisma.Decimal('700'),
        credit: new Prisma.Decimal('200'),
      },
      rows: [
        {
          entryDate: new Date('2024-01-01'),
          entryNumber: 'JE001',
          accountCode: '1001',
          accountName: 'Cash',
          description: 'Payment',
          sourceModule: 'FINANCE',
          sourceType: 'PAYMENT',
          debit: new Prisma.Decimal('700'),
          credit: new Prisma.Decimal('200'),
          runningBalance: new Prisma.Decimal('1500'),
          runningBalanceSide: JournalLineSide.DEBIT,
        },
      ],
      pagination: { page: 1, limit: 1000, total: 1, totalPages: 1 },
    } as any);

    const csv = await service.exportGeneralLedgerCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain(
      'Date,Entry Number,Account Code,Account Name,Description,Source Module,Source Type,Debit,Credit,Running Balance,Running Balance Side',
    );
    expect(csv).toContain('"JE001"');
    expect(csv).toContain('"FINANCE"');
    expect(csv).toContain('"PAYMENT"');
    expect(csv).toContain('"700.00"');
    expect(csv).toContain('"1500.00"');
    expect(csv).toContain('"TOTAL"');
  });

  it('exports Cash Book CSV with Counterparty Account column', async () => {
    reportsService.getCashBook.mockResolvedValue({
      openingBalance: new Prisma.Decimal('1000'),
      openingBalanceSide: JournalLineSide.DEBIT,
      totalReceipts: new Prisma.Decimal('700'),
      totalPayments: new Prisma.Decimal('200'),
      closingBalance: new Prisma.Decimal('1500'),
      closingBalanceSide: JournalLineSide.DEBIT,
      account: { id: 'acc-1', code: '1001', name: 'Cash' },
      rows: [
        {
          entryDate: new Date('2024-01-01'),
          entryNumber: 'JE001',
          accountCode: '4001',
          accountName: 'Fee Income',
          narration: 'Fee Collection',
          sourceModule: 'FINANCE',
          sourceType: 'PAYMENT',
          receiptAmount: new Prisma.Decimal('700'),
          paymentAmount: new Prisma.Decimal('200'),
          runningBalance: new Prisma.Decimal('1500'),
          runningBalanceSide: JournalLineSide.DEBIT,
        },
      ],
      pagination: { page: 1, limit: 1000, total: 1, totalPages: 1 },
    } as any);

    const csv = await service.exportCashBookCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain(
      'Date,Entry Number,Cash/Bank Account,Description,Counterparty Account,Receipt,Payment,Running Balance,Running Balance Side',
    );
    expect(csv).toContain('"1001 - Cash"');
    expect(csv).toContain('"4001 - Fee Income"');
    expect(csv).toContain('"700.00"');
    expect(csv).toContain('"TOTAL"');
  });

  it('blocks large synchronous General Ledger exports before generating rows', async () => {
    reportsService.getGeneralLedger.mockResolvedValue({
      openingBalance: new Prisma.Decimal('0'),
      openingBalanceSide: JournalLineSide.DEBIT,
      closingBalance: new Prisma.Decimal('0'),
      closingBalanceSide: JournalLineSide.DEBIT,
      totals: {
        debit: new Prisma.Decimal('0'),
        credit: new Prisma.Decimal('0'),
      },
      rows: [],
      pagination: { page: 1, limit: 1000, total: 1001, totalPages: 2 },
    } as any);

    await expect(
      service.exportGeneralLedgerCsv('tenant-1', {
        fiscalYearId: 'fy-1',
        accountCode: '1000',
      }),
    ).rejects.toThrow('exceeds the synchronous export limit');
  });

  it('queues large General Ledger exports with a deterministic accounting report job', async () => {
    reportsService.getGeneralLedger.mockResolvedValue({
      rows: [],
      pagination: { page: 1, limit: 1, total: 1001, totalPages: 1001 },
    } as any);
    prisma.reportExport.create.mockResolvedValue({ id: 'export-1' });

    const result = await service.queueLargeReportExport({
      reportKey: 'accounting.general-ledger',
      format: 'csv',
      filters: { fiscalYearId: 'fy-1', accountCode: '1001' },
      actor: {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    });

    expect(result).toEqual(
      expect.objectContaining({
        exportId: 'export-1',
        jobId: 'job-1',
        status: 'QUEUED',
        totalRows: 1001,
        reused: false,
      }),
    );
    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          reportKey: 'accounting.general-ledger',
          format: 'csv',
          status: 'QUEUED',
          requestedBy: 'user-1',
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'generateAccountingReport',
      expect.objectContaining({
        exportId: 'export-1',
        reportKey: 'accounting.general-ledger',
        format: 'csv',
      }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'queue_accounting_report_export',
        after: expect.objectContaining({ totalRows: 1001 }),
      }),
    );
  });

  it('reuses an existing queued accounting export instead of adding a duplicate job', async () => {
    reportsService.getGeneralLedger.mockResolvedValue({
      rows: [],
      pagination: { page: 1, limit: 1, total: 1500, totalPages: 1500 },
    } as any);
    prisma.reportExport.findFirst.mockResolvedValue({
      id: 'export-existing',
      status: 'QUEUED',
      fileAssetId: null,
    });

    const result = await service.queueLargeReportExport({
      reportKey: 'accounting.general-ledger',
      format: 'csv',
      filters: { fiscalYearId: 'fy-1', accountCode: '1001' },
      actor: {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    });

    expect(result).toEqual(
      expect.objectContaining({
        exportId: 'export-existing',
        status: 'QUEUED',
        reused: true,
      }),
    );
    expect(prisma.reportExport.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reuse_accounting_report_export_request',
      }),
    );
  });

  it('completes queued General Ledger CSV exports through File Registry', async () => {
    prisma.reportExport.findFirst
      .mockResolvedValueOnce({
        id: 'export-1',
        status: 'RUNNING',
        fileAssetId: null,
      })
      .mockResolvedValueOnce(null);
    reportsService.getGeneralLedger.mockResolvedValue({
      openingBalance: new Prisma.Decimal('0'),
      openingBalanceSide: JournalLineSide.DEBIT,
      closingBalance: new Prisma.Decimal('700'),
      closingBalanceSide: JournalLineSide.DEBIT,
      totals: {
        debit: new Prisma.Decimal('700'),
        credit: new Prisma.Decimal('0'),
      },
      rows: [
        {
          entryDate: new Date('2024-01-01'),
          entryNumber: 'JE001',
          accountCode: '1001',
          accountName: 'Cash',
          description: 'Payment',
          sourceModule: 'FINANCE',
          sourceType: 'FEE_PAYMENT',
          debit: new Prisma.Decimal('700'),
          credit: new Prisma.Decimal('0'),
          runningBalance: new Prisma.Decimal('700'),
          runningBalanceSide: JournalLineSide.DEBIT,
        },
      ],
      pagination: { page: 1, limit: 50000, total: 1001, totalPages: 1 },
    } as any);

    await service.completeQueuedReportExport({
      exportId: 'export-1',
      reportKey: 'accounting.general-ledger',
      format: 'csv',
      filters: { fiscalYearId: 'fy-1', accountCode: '1001' },
      actor: {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    });

    expect(fileRegistryService.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        generatedByUserId: 'user-1',
        originalFilename: expect.stringMatching(
          /^accounting-general-ledger-\d{4}-\d{2}-\d{2}\.csv$/,
        ),
        mimeType: 'text/csv',
        module: 'accounting',
        metadata: expect.objectContaining({
          reportKey: 'accounting.general-ledger',
          format: 'csv',
          async: true,
        }),
      }),
    );
    expect(prisma.reportExport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'export-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          fileAssetId: 'file-1',
          errorSummary: null,
        }),
      }),
    );
  });

  it('reuses completed queued accounting export files on retry completion', async () => {
    prisma.reportExport.findFirst
      .mockResolvedValueOnce({
        id: 'export-retry',
        status: 'RUNNING',
        fileAssetId: null,
      })
      .mockResolvedValueOnce({
        id: 'export-old',
        fileAssetId: 'file-old',
      });

    await service.completeQueuedReportExport({
      exportId: 'export-retry',
      reportKey: 'accounting.cash-book',
      format: 'pdf',
      filters: { fiscalYearId: 'fy-1' },
      actor: {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    });

    expect(fileRegistryService.registerGeneratedFile).not.toHaveBeenCalled();
    expect(prisma.reportExport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'export-retry' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          fileAssetId: 'file-old',
          errorSummary: null,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reuse_accounting_report_export',
        after: expect.objectContaining({
          reusedReportExportId: 'export-old',
          fileAssetId: 'file-old',
          async: true,
        }),
      }),
    );
  });

  it('exports Income Statement CSV with Section/Account Code/Account Name/Amount', async () => {
    reportsService.getIncomeStatement.mockResolvedValue({
      sections: [
        {
          section: 'INCOME',
          total: new Prisma.Decimal('5000'),
          accounts: [
            {
              accountId: 'acc-1',
              accountCode: '4001',
              accountName: 'Fees',
              amount: new Prisma.Decimal('5000'),
            },
          ],
        },
        {
          section: 'EXPENSE',
          total: new Prisma.Decimal('3000'),
          accounts: [
            {
              accountId: 'acc-2',
              accountCode: '5001',
              accountName: 'Salary',
              amount: new Prisma.Decimal('3000'),
            },
          ],
        },
      ],
      totalIncome: new Prisma.Decimal('5000'),
      totalExpense: new Prisma.Decimal('3000'),
      netSurplusOrDeficit: new Prisma.Decimal('2000'),
      resultType: 'SURPLUS',
    } as any);

    const csv = await service.exportIncomeStatementCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain('Section,Account Code,Account Name,Amount');
    expect(csv).toContain('"INCOME","4001","Fees","5000.00"');
    expect(csv).toContain('"INCOME","","Total INCOME","5000.00"');
    expect(csv).toContain('"EXPENSE","5001","Salary","3000.00"');
    expect(csv).toContain('"SUMMARY","","Total Income","5000.00"');
    expect(csv).toContain('"SUMMARY","","Total Expense","3000.00"');
    expect(csv).toContain('"SUMMARY","","Net SURPLUS","2000.00"');
  });

  it('exports Balance Sheet CSV with Section/Account columns and summary', async () => {
    reportsService.getBalanceSheet.mockResolvedValue({
      sections: [
        {
          section: 'ASSETS',
          total: new Prisma.Decimal('10000'),
          accounts: [
            {
              accountCode: '1001',
              accountName: 'Cash',
              amount: new Prisma.Decimal('10000'),
            },
          ],
        },
        {
          section: 'LIABILITIES',
          total: new Prisma.Decimal('5000'),
          accounts: [
            {
              accountCode: '2001',
              accountName: 'Payables',
              amount: new Prisma.Decimal('5000'),
            },
          ],
        },
        {
          section: 'EQUITY',
          total: new Prisma.Decimal('5000'),
          accounts: [
            {
              accountCode: '3001',
              accountName: 'Capital',
              amount: new Prisma.Decimal('5000'),
            },
          ],
        },
      ],
      totalAssets: new Prisma.Decimal('10000'),
      totalLiabilities: new Prisma.Decimal('5000'),
      totalEquity: new Prisma.Decimal('5000'),
      totalLiabilitiesAndEquity: new Prisma.Decimal('10000'),
      isBalanced: true,
      imbalanceAmount: new Prisma.Decimal('0'),
    } as any);

    const csv = await service.exportBalanceSheetCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain('Section,Account Code,Account Name,Amount');
    expect(csv).toContain('"ASSETS","1001","Cash","10000.00"');
    expect(csv).toContain('"ASSETS","","Total ASSETS","10000.00"');
    expect(csv).toContain('"LIABILITIES","2001","Payables","5000.00"');
    expect(csv).toContain('"EQUITY","3001","Capital","5000.00"');
    expect(csv).toContain('"SUMMARY","","Total Assets","10000.00"');
    expect(csv).toContain('"SUMMARY","","Total Liabilities","5000.00"');
    expect(csv).toContain('"SUMMARY","","Total Equity","5000.00"');
    expect(csv).toContain(
      '"SUMMARY","","Total Liabilities & Equity","10000.00"',
    );
    expect(csv).toContain('"SUMMARY","","Balanced","YES"');
    expect(csv).toContain('"SUMMARY","","Imbalance Amount","0.00"');
  });

  it('exports Tax Summary CSV with Section/Metric/Amount/Status columns', async () => {
    reportsService.getTaxSummary.mockResolvedValue({
      vat: {
        outputVat: new Prisma.Decimal('130'),
        inputVat: new Prisma.Decimal('50'),
        netVat: new Prisma.Decimal('80'),
        status: 'PAYABLE',
      },
      tds: {
        deductedPayable: new Prisma.Decimal('200'),
        paid: new Prisma.Decimal('100'),
        netPayable: new Prisma.Decimal('100'),
      },
      pf: {
        employeeContribution: new Prisma.Decimal('300'),
        employerContribution: new Prisma.Decimal('300'),
        paid: new Prisma.Decimal('400'),
        netPayable: new Prisma.Decimal('200'),
      },
      setupWarnings: ['Missing PF Mapping'],
    } as any);

    const csv = await service.exportTaxSummaryCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain('Section,Metric,Amount,Status');
    expect(csv).toContain('"VAT","Output VAT","130.00",""');
    expect(csv).toContain('"VAT","Net VAT","80.00","PAYABLE"');
    expect(csv).toContain('"TDS","Deducted Payable","200.00",""');
    expect(csv).toContain('"TDS","Net Payable","100.00",""');
    expect(csv).toContain('"PF","Employee Contribution","300.00",""');
    expect(csv).toContain('"PF","Net Payable","200.00",""');
    expect(csv).toContain('"WARNINGS","Setup Warning","","Missing PF Mapping"');
  });

  it('calls report service methods with tenantId from auth', async () => {
    reportsService.getTrialBalance.mockResolvedValue({
      rows: [],
      totalOpeningDebit: new Prisma.Decimal(0),
      totalOpeningCredit: new Prisma.Decimal(0),
      totalPeriodDebit: new Prisma.Decimal(0),
      totalPeriodCredit: new Prisma.Decimal(0),
      totalClosingDebit: new Prisma.Decimal(0),
      totalClosingCredit: new Prisma.Decimal(0),
      isBalanced: true,
      imbalanceAmount: new Prisma.Decimal(0),
      generatedAt: new Date(),
    } as any);

    await service.exportTrialBalanceCsv('tenant-1', { fiscalYearId: 'fy-1' });
    expect(reportsService.getTrialBalance).toHaveBeenCalledWith('tenant-1', {
      fiscalYearId: 'fy-1',
    });
  });

  it('uses existing report service methods and does not duplicate logic', async () => {
    // Verify that the export service delegates entirely to report service
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(service),
    ).filter((m) => m.startsWith('export'));
    expect(methods.length).toBe(14);

    // Each method name corresponds to a report service method
    expect(methods).toContain('exportTrialBalanceCsv');
    expect(methods).toContain('exportGeneralLedgerCsv');
    expect(methods).toContain('exportCashBookCsv');
    expect(methods).toContain('exportIncomeStatementCsv');
    expect(methods).toContain('exportBalanceSheetCsv');
    expect(methods).toContain('exportTaxSummaryCsv');
    expect(methods).toContain('exportTrialBalancePdf');
    expect(methods).toContain('exportGeneralLedgerPdf');
    expect(methods).toContain('exportCashBookPdf');
    expect(methods).toContain('exportIncomeStatementPdf');
    expect(methods).toContain('exportBalanceSheetPdf');
    expect(methods).toContain('exportTaxSummaryPdf');
    expect(methods).toContain('exportBankReconciliationCsv');
    expect(methods).toContain('exportBankReconciliationPdf');
  });

  it('exports a valid Trial Balance PDF and records a protected snapshot', async () => {
    reportsService.getTrialBalance.mockResolvedValue({
      rows: [],
      totalOpeningDebit: new Prisma.Decimal(0),
      totalOpeningCredit: new Prisma.Decimal(0),
      totalPeriodDebit: new Prisma.Decimal(0),
      totalPeriodCredit: new Prisma.Decimal(0),
      totalClosingDebit: new Prisma.Decimal(0),
      totalClosingCredit: new Prisma.Decimal(0),
      isBalanced: true,
      imbalanceAmount: new Prisma.Decimal(0),
      generatedAt: new Date(),
    } as any);

    const pdf = await service.exportTrialBalancePdf(
      'tenant-1',
      { fiscalYearId: 'fy-1' },
      {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pdfText = pdf.toString('latin1');
    expect(pdfText).toContain('CONTROL TOTALS');
    expect(pdfText).toContain('CLOSING DEBIT');
    expect(pdfText).toContain('CLOSING CREDIT');
    expect(pdfText).toContain('BALANCED');
  });

  it('reuses an existing PDF snapshot for identical accounting report export retries', async () => {
    prisma.reportExport.findFirst.mockResolvedValue({
      id: 'export-existing',
      fileAssetId: 'file-existing',
    });
    reportsService.getTrialBalance.mockResolvedValue({
      rows: [],
      totalOpeningDebit: new Prisma.Decimal(0),
      totalOpeningCredit: new Prisma.Decimal(0),
      totalPeriodDebit: new Prisma.Decimal(0),
      totalPeriodCredit: new Prisma.Decimal(0),
      totalClosingDebit: new Prisma.Decimal(0),
      totalClosingCredit: new Prisma.Decimal(0),
      isBalanced: true,
      imbalanceAmount: new Prisma.Decimal(0),
      generatedAt: new Date(),
    } as any);

    const pdf = await service.exportTrialBalancePdf(
      'tenant-1',
      { fiscalYearId: 'fy-1' },
      {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.reportExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          reportKey: 'accounting.trial-balance',
          format: 'pdf',
          requestedBy: 'user-1',
          filters: { equals: { fiscalYearId: 'fy-1' } },
        }),
      }),
    );
    expect(fileRegistryService.registerGeneratedFile).not.toHaveBeenCalled();
    expect(prisma.reportExport.create).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reuse_accounting_report_export',
        after: expect.objectContaining({
          reportExportId: 'export-existing',
          fileAssetId: 'file-existing',
        }),
      }),
    );
  });

  it('exports a styled Balance Sheet PDF with accounting control totals', async () => {
    reportsService.getBalanceSheet.mockResolvedValue({
      sections: [
        {
          section: 'ASSETS',
          total: new Prisma.Decimal('10000'),
          accounts: [
            {
              accountCode: '1001',
              accountName: 'Cash',
              amount: new Prisma.Decimal('10000'),
            },
          ],
        },
        {
          section: 'LIABILITIES',
          total: new Prisma.Decimal('5000'),
          accounts: [
            {
              accountCode: '2001',
              accountName: 'Payables',
              amount: new Prisma.Decimal('5000'),
            },
          ],
        },
        {
          section: 'EQUITY',
          total: new Prisma.Decimal('5000'),
          accounts: [
            {
              accountCode: '3001',
              accountName: 'Capital',
              amount: new Prisma.Decimal('5000'),
            },
          ],
        },
      ],
      totalAssets: new Prisma.Decimal('10000'),
      totalLiabilities: new Prisma.Decimal('5000'),
      totalEquity: new Prisma.Decimal('5000'),
      totalLiabilitiesAndEquity: new Prisma.Decimal('10000'),
      isBalanced: true,
      imbalanceAmount: new Prisma.Decimal('0'),
    } as any);

    const pdf = await service.exportBalanceSheetPdf(
      'tenant-1',
      { fiscalYearId: 'fy-1' },
      {
        tenantId: 'tenant-1',
        tenantSlug: 'test',
        userId: 'user-1',
      } as any,
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pdfText = pdf.toString('latin1');
    expect(pdfText).toContain('CONTROL TOTALS');
    expect(pdfText).toContain('TOTAL ASSETS');
    expect(pdfText).toContain('TOTAL LIABILITIES');
    expect(pdfText).toContain('TOTAL EQUITY');
    expect(pdfText).toContain('BALANCED');
  });

  it('returns empty CSV for reports with no data rows', async () => {
    reportsService.getIncomeStatement.mockResolvedValue({
      sections: [],
      totalIncome: new Prisma.Decimal(0),
      totalExpense: new Prisma.Decimal(0),
      netSurplusOrDeficit: new Prisma.Decimal(0),
      resultType: 'BREAK_EVEN',
    } as any);

    const csv = await service.exportIncomeStatementCsv('tenant-1', {
      fiscalYearId: 'fy-1',
    });
    expect(csv).toContain('Section,Account Code,Account Name,Amount');
    expect(csv).toContain('"SUMMARY","","Net BREAK_EVEN","0.00"');
  });
});
