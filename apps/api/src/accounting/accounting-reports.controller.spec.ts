import { Test, TestingModule } from '@nestjs/testing';
import { AccountingReportsController } from './accounting-reports.controller';
import { AccountingReportsService } from './accounting-reports.service';
import { AccountingReportExportsService } from './accounting-report-exports.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Reflector } from '@nestjs/core';
import { PlansService } from '../plans/plans.service';
import { EntitlementsService } from '../plans/entitlements.service';
import { Response } from 'express';

describe('AccountingReportsController', () => {
  let controller: AccountingReportsController;
  let exportsService: jest.Mocked<AccountingReportExportsService>;
  let auditService: jest.Mocked<AuditService>;

  const mockAuth = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    permissions: ['accounting:exports:create', 'accounting:reports:read'],
  };

  let mockRes: Response;

  beforeEach(async () => {
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    const mockReportsService = {};
    const mockExportsService = {
      exportTrialBalanceCsv: jest.fn(),
      exportGeneralLedgerCsv: jest.fn(),
      exportCashBookCsv: jest.fn(),
      exportIncomeStatementCsv: jest.fn(),
      exportBalanceSheetCsv: jest.fn(),
      exportTaxSummaryCsv: jest.fn(),
    };
    const mockAuditService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountingReportsController],
      providers: [
        { provide: AccountingReportsService, useValue: mockReportsService },
        {
          provide: AccountingReportExportsService,
          useValue: mockExportsService,
        },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: PlansService,
          useValue: {
            checkFeatureEnabled: jest.fn().mockResolvedValue({ allowed: true }),
          },
        },
        {
          provide: EntitlementsService,
          useValue: {
            checkFeatureEnabled: jest.fn().mockResolvedValue(true),
            checkModuleEnabled: jest.fn().mockResolvedValue(true),
          },
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccountingReportsController>(
      AccountingReportsController,
    );
    exportsService = module.get(AccountingReportExportsService);
    auditService = module.get(AuditService);
  });

  it('exports Trial Balance CSV, sets correct headers, and records audit', async () => {
    exportsService.exportTrialBalanceCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportTrialBalance(mockAuth as any, query as any, mockRes);

    expect(exportsService.exportTrialBalanceCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export_accounting_report',
        resource: 'accounting_report',
        resourceId: 'trial_balance',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(
        /^attachment; filename="trial-balance-\d{4}-\d{2}-\d{2}\.csv"$/,
      ),
    );
    expect(mockRes.send).toHaveBeenCalledWith('csv-data');
  });

  it('exports General Ledger and records audit', async () => {
    exportsService.exportGeneralLedgerCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportGeneralLedger(
      mockAuth as any,
      query as any,
      mockRes,
    );

    expect(exportsService.exportGeneralLedgerCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'general_ledger',
      }),
    );
    expect(mockRes.send).toHaveBeenCalledWith('csv-data');
  });

  it('exports Cash Book and records audit', async () => {
    exportsService.exportCashBookCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportCashBook(mockAuth as any, query as any, mockRes);

    expect(exportsService.exportCashBookCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'cash_book',
      }),
    );
    expect(mockRes.send).toHaveBeenCalledWith('csv-data');
  });

  it('exports Income Statement and records audit', async () => {
    exportsService.exportIncomeStatementCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportIncomeStatement(
      mockAuth as any,
      query as any,
      mockRes,
    );

    expect(exportsService.exportIncomeStatementCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'income_statement',
      }),
    );
    expect(mockRes.send).toHaveBeenCalledWith('csv-data');
  });

  it('exports Balance Sheet and records audit', async () => {
    exportsService.exportBalanceSheetCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportBalanceSheet(mockAuth as any, query as any, mockRes);

    expect(exportsService.exportBalanceSheetCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'balance_sheet',
      }),
    );
    expect(mockRes.send).toHaveBeenCalledWith('csv-data');
  });

  it('exports Tax Summary and records audit', async () => {
    exportsService.exportTaxSummaryCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportTaxSummary(mockAuth as any, query as any, mockRes);

    expect(exportsService.exportTaxSummaryCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'tax_summary',
      }),
    );
    expect(mockRes.send).toHaveBeenCalledWith('csv-data');
  });

  it('audit includes report name, format, filters, and generatedAt', async () => {
    exportsService.exportTrialBalanceCsv.mockResolvedValue('csv-data');
    const query = {
      fiscalYearId: 'fy-1',
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
    };

    await controller.exportTrialBalance(mockAuth as any, query as any, mockRes);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          reportName: 'Trial Balance',
          format: 'csv',
          filters: query,
          generatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('content-disposition filename contains current date', async () => {
    exportsService.exportBalanceSheetCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportBalanceSheet(mockAuth as any, query as any, mockRes);

    const today = new Date().toISOString().split('T')[0];
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="balance-sheet-${today}.csv"`,
    );
  });

  it('uses tenantId from auth context, not query/body', async () => {
    exportsService.exportGeneralLedgerCsv.mockResolvedValue('csv-data');
    const query = { fiscalYearId: 'fy-1' };

    await controller.exportGeneralLedger(
      mockAuth as any,
      query as any,
      mockRes,
    );

    // tenantId must come from auth, not from query
    expect(exportsService.exportGeneralLedgerCsv).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    );
  });
});
