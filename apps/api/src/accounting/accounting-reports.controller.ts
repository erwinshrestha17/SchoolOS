import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AccountingReportsService } from './accounting-reports.service';
import { AccountingReportExportsService } from './accounting-report-exports.service';
import { AuditService } from '../audit/audit.service';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import { CashBookQueryDto } from './dto/cash-book-query.dto';
import { IncomeStatementQueryDto } from './dto/income-statement-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { TaxSummaryQueryDto } from './dto/tax-summary-query.dto';
import { UpdateAccountingReportMappingsDto } from './dto/report-account-mapping.dto';

@ApiTags('Accounting Reports')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
@Controller('accounting/reports')
export class AccountingReportsController {
  constructor(
    private readonly reportsService: AccountingReportsService,
    private readonly exportsService: AccountingReportExportsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance report' })
  @Permissions(
    'accounting:reports:trial-balance',
    'accounting:read',
    'accounting:reports:read',
  )
  async getTrialBalance(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TrialBalanceQueryDto,
  ) {
    return this.reportsService.getTrialBalance(auth.tenantId, query);
  }

  @Get('general-ledger')
  @ApiOperation({ summary: 'Get general ledger report' })
  @Permissions(
    'accounting:reports:general-ledger',
    'accounting:read',
    'accounting:reports:read',
  )
  async getGeneralLedger(
    @CurrentAuth() auth: AuthContext,
    @Query() query: GeneralLedgerQueryDto,
  ) {
    return this.reportsService.getGeneralLedger(auth.tenantId, query);
  }

  @Get('cash-book')
  @ApiOperation({ summary: 'Get cash book report' })
  @Permissions(
    'accounting:reports:cash-book',
    'accounting:read',
    'accounting:reports:read',
  )
  async getCashBook(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CashBookQueryDto,
  ) {
    return this.reportsService.getCashBook(auth.tenantId, query);
  }

  @Get('income-statement')
  @ApiOperation({ summary: 'Get income statement report' })
  @Permissions(
    'accounting:reports:income-statement',
    'accounting:read',
    'accounting:reports:read',
  )
  async getIncomeStatement(
    @CurrentAuth() auth: AuthContext,
    @Query() query: IncomeStatementQueryDto,
  ) {
    return this.reportsService.getIncomeStatement(auth.tenantId, query);
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Get balance sheet report' })
  @Permissions(
    'accounting:reports:balance-sheet',
    'accounting:read',
    'accounting:reports:read',
  )
  async getBalanceSheet(
    @CurrentAuth() auth: AuthContext,
    @Query() query: BalanceSheetQueryDto,
  ) {
    return this.reportsService.getBalanceSheet(auth.tenantId, query);
  }

  @Get('tax-summary')
  @ApiOperation({ summary: 'Get tax summary report' })
  @Permissions(
    'accounting:reports:tax-summary',
    'accounting:read',
    'accounting:reports:read',
  )
  async getTaxSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TaxSummaryQueryDto,
  ) {
    return this.reportsService.getTaxSummary(auth.tenantId, query);
  }

  @Get('trial-balance/export')
  @ApiOperation({ summary: 'Export trial balance to CSV' })
  @Permissions('accounting:exports:create', 'accounting:reports:trial-balance')
  async exportTrialBalance(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TrialBalanceQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportTrialBalanceCsv(
      auth.tenantId,
      query,
    );
    await this.recordExportAudit(auth, 'Trial Balance', query);
    this.sendCsvResponse(res, csv, 'trial-balance');
  }

  @Get('general-ledger/export')
  @ApiOperation({ summary: 'Export general ledger to CSV' })
  @Permissions('accounting:exports:create', 'accounting:reports:general-ledger')
  async exportGeneralLedger(
    @CurrentAuth() auth: AuthContext,
    @Query() query: GeneralLedgerQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportGeneralLedgerCsv(
      auth.tenantId,
      query,
    );
    await this.recordExportAudit(auth, 'General Ledger', query);
    this.sendCsvResponse(res, csv, 'general-ledger');
  }

  @Get('cash-book/export')
  @ApiOperation({ summary: 'Export cash book to CSV' })
  @Permissions('accounting:exports:create', 'accounting:reports:cash-book')
  async exportCashBook(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CashBookQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportCashBookCsv(
      auth.tenantId,
      query,
    );
    await this.recordExportAudit(auth, 'Cash Book', query);
    this.sendCsvResponse(res, csv, 'cash-book');
  }

  @Get('income-statement/export')
  @ApiOperation({ summary: 'Export income statement to CSV' })
  @Permissions(
    'accounting:exports:create',
    'accounting:reports:income-statement',
  )
  async exportIncomeStatement(
    @CurrentAuth() auth: AuthContext,
    @Query() query: IncomeStatementQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportIncomeStatementCsv(
      auth.tenantId,
      query,
    );
    await this.recordExportAudit(auth, 'Income Statement', query);
    this.sendCsvResponse(res, csv, 'income-statement');
  }

  @Get('balance-sheet/export')
  @ApiOperation({ summary: 'Export balance sheet to CSV' })
  @Permissions('accounting:exports:create', 'accounting:reports:balance-sheet')
  async exportBalanceSheet(
    @CurrentAuth() auth: AuthContext,
    @Query() query: BalanceSheetQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportBalanceSheetCsv(
      auth.tenantId,
      query,
    );
    await this.recordExportAudit(auth, 'Balance Sheet', query);
    this.sendCsvResponse(res, csv, 'balance-sheet');
  }

  @Get('tax-summary/export')
  @ApiOperation({ summary: 'Export tax summary to CSV' })
  @Permissions('accounting:exports:create', 'accounting:reports:tax-summary')
  async exportTaxSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TaxSummaryQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.exportTaxSummaryCsv(
      auth.tenantId,
      query,
    );
    await this.recordExportAudit(auth, 'Tax Summary', query);
    this.sendCsvResponse(res, csv, 'tax-summary');
  }

  private async recordExportAudit(
    auth: AuthContext,
    reportName: string,
    filters: object,
  ) {
    await this.auditService.record({
      action: 'export_accounting_report',
      resource: 'accounting_report',
      resourceId: reportName.toLowerCase().replace(/\s+/g, '_'),
      tenantId: auth.tenantId,
      userId: auth.userId,
      after: {
        reportName,
        format: 'csv',
        filters,
        generatedAt: new Date(),
      },
    });
  }

  private sendCsvResponse(res: Response, csv: string, fileNamePrefix: string) {
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileNamePrefix}-${date}.csv"`,
    );
    res.send(csv);
  }

  @Get('mappings')
  @ApiOperation({ summary: 'Get accounting report account mappings' })
  @Permissions('accounting:settings:read', 'accounting:reports:read')
  async getReportMappings(@CurrentAuth() auth: AuthContext) {
    return this.reportsService.getReportMappings(auth.tenantId);
  }

  @Put('mappings')
  @ApiOperation({ summary: 'Update accounting report account mappings' })
  @Permissions('accounting:settings:update')
  async updateReportMappings(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateAccountingReportMappingsDto,
  ) {
    return this.reportsService.updateReportMappings(
      auth.tenantId,
      auth.userId,
      dto,
    );
  }
}
