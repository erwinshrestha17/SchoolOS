import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AccountingReportsService } from './accounting-reports.service';
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
  constructor(private readonly reportsService: AccountingReportsService) {}

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance report' })
  @Permissions('accounting:reports:trial-balance', 'accounting:read', 'accounting:reports:read')
  async getTrialBalance(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TrialBalanceQueryDto,
  ) {
    return this.reportsService.getTrialBalance(auth.tenantId, query);
  }

  @Get('general-ledger')
  @ApiOperation({ summary: 'Get general ledger report' })
  @Permissions('accounting:reports:general-ledger', 'accounting:read', 'accounting:reports:read')
  async getGeneralLedger(
    @CurrentAuth() auth: AuthContext,
    @Query() query: GeneralLedgerQueryDto,
  ) {
    return this.reportsService.getGeneralLedger(auth.tenantId, query);
  }

  @Get('cash-book')
  @ApiOperation({ summary: 'Get cash book report' })
  @Permissions('accounting:reports:cash-book', 'accounting:read', 'accounting:reports:read')
  async getCashBook(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CashBookQueryDto,
  ) {
    return this.reportsService.getCashBook(auth.tenantId, query);
  }

  @Get('income-statement')
  @ApiOperation({ summary: 'Get income statement report' })
  @Permissions('accounting:reports:income-statement', 'accounting:read', 'accounting:reports:read')
  async getIncomeStatement(
    @CurrentAuth() auth: AuthContext,
    @Query() query: IncomeStatementQueryDto,
  ) {
    return this.reportsService.getIncomeStatement(auth.tenantId, query);
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Get balance sheet report' })
  @Permissions('accounting:reports:balance-sheet', 'accounting:read', 'accounting:reports:read')
  async getBalanceSheet(
    @CurrentAuth() auth: AuthContext,
    @Query() query: BalanceSheetQueryDto,
  ) {
    return this.reportsService.getBalanceSheet(auth.tenantId, query);
  }

  @Get('tax-summary')
  @ApiOperation({ summary: 'Get tax summary report' })
  @Permissions('accounting:reports:tax-summary', 'accounting:read', 'accounting:reports:read')
  async getTaxSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TaxSummaryQueryDto,
  ) {
    return this.reportsService.getTaxSummary(auth.tenantId, query);
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
    return this.reportsService.updateReportMappings(auth.tenantId, auth.userId, dto);
  }
}
