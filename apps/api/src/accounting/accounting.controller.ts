import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountingPeriodStatus } from '@prisma/client';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { FinanceService } from '../finance/finance.service';
import { AccountingService } from './accounting.service';
import { AccountingActionDto } from './dto/accounting-action.dto';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateChartAccountDto } from './dto/create-chart-account.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { ReverseJournalEntryDto } from './dto/reverse-journal-entry.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly financeService: FinanceService,
  ) {}

  @Get('accounts')
  @Permissions('accounting:accounts:read')
  listChartAccounts(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listChartAccounts(auth);
  }

  @Get('chart-accounts')
  @Permissions('accounting:accounts:read')
  listChartAccountsLegacy(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listChartAccounts(auth);
  }

  @Get('accounts/tree')
  @Permissions('accounting:accounts:read')
  listChartAccountTree(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listChartAccountTree(auth);
  }

  @Post('accounts/seed-defaults')
  @Permissions('accounting:accounts:write')
  seedDefaultChart(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.seedDefaultChart(auth);
  }

  @Post('accounts')
  @Permissions('accounting:accounts:write')
  createChartAccount(
    @Body() dto: CreateChartAccountDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createChartAccount(dto, auth);
  }

  @Post('chart-accounts')
  @Permissions('accounting:accounts:write')
  createChartAccountLegacy(
    @Body() dto: CreateChartAccountDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createChartAccount(dto, auth);
  }

  @Patch('accounts/:id')
  @Permissions('accounting:accounts:write')
  updateChartAccount(
    @Param('id') id: string,
    @Body() dto: CreateChartAccountDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.updateChartAccount(id, dto, auth);
  }

  @Post('accounts/:id/archive')
  @Permissions('accounting:accounts:write')
  archiveChartAccount(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.archiveChartAccount(id, auth);
  }

  @Get('periods')
  @Permissions('accounting:reports:read')
  listPeriods(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listPeriods(auth);
  }

  @Post('periods')
  @Permissions('accounting:fiscal:manage')
  createPeriod(
    @Body() dto: CreateAccountingPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createPeriod(dto, auth);
  }

  @Post('fiscal-years')
  @Permissions('accounting:fiscal:manage')
  createFiscalYear(
    @Body() dto: CreateFiscalYearDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createFiscalYear(dto, auth);
  }

  @Get('fiscal-years')
  @Permissions('accounting:reports:read')
  listFiscalYears(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listFiscalYears(auth);
  }

  @Get('fiscal-years/:id/periods')
  @Permissions('accounting:reports:read')
  listFiscalPeriods(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.listFiscalPeriods(id, auth);
  }

  @Post('fiscal-periods/:id/lock')
  @Permissions('accounting:fiscal:manage')
  lockFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: AccountingActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.updateFiscalPeriodStatus(
      id,
      AccountingPeriodStatus.LOCKED,
      dto,
      auth,
    );
  }

  @Post('fiscal-periods/:id/close')
  @Permissions('accounting:fiscal:manage')
  closeFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: AccountingActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.updateFiscalPeriodStatus(
      id,
      AccountingPeriodStatus.CLOSED,
      dto,
      auth,
    );
  }

  @Post('fiscal-periods/:id/reopen')
  @Permissions('accounting:fiscal:manage')
  reopenFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: AccountingActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.updateFiscalPeriodStatus(
      id,
      AccountingPeriodStatus.OPEN,
      dto,
      auth,
    );
  }

  @Get('reports')
  @Permissions('accounting:reports:read')
  reports(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.buildReports(auth);
  }

  @Get('reports/trial-balance')
  @Permissions('accounting:reports:read')
  trialBalance(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getTrialBalance(auth);
  }

  @Get('reports/general-ledger')
  @Permissions('accounting:reports:read')
  generalLedger(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getGeneralLedger(auth);
  }

  @Get('accounts/:accountId/ledger')
  @Permissions('accounting:reports:read')
  accountLedger(
    @Param('accountId') accountId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.getAccountLedger(accountId, auth);
  }

  @Get('reports/income-statement')
  @Permissions('accounting:reports:read')
  incomeStatement(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getIncomeStatement(auth);
  }

  @Get('reports/balance-sheet')
  @Permissions('accounting:reports:read')
  balanceSheet(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getBalanceSheet(auth);
  }

  @Get('reports/cash-book')
  @Permissions('accounting:reports:read')
  cashBook(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getCashBook(auth);
  }

  @Get('reports/vat-summary')
  @Permissions('accounting:reports:read')
  vatSummary(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getVatSummary(auth);
  }

  @Get('reports/tds-summary')
  @Permissions('accounting:reports:read')
  tdsSummary(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getTdsSummary(auth);
  }

  @Get('reports/pf-summary')
  @Permissions('accounting:reports:read')
  pfSummary(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getPfSummary(auth);
  }

  @Get('reports/reconciliation')
  @Permissions('accounting:read')
  reconciliationSummary(
    @Query() query: ReconciliationQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getReconciliationSummary(query, auth);
  }

  @Get('reports/reconciliation/export')
  @Permissions('accounting:read')
  reconciliationExport(
    @Query() query: ReconciliationQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.exportReconciliation(query, auth);
  }

  @Get('journals')
  @Permissions('accounting:journals:read')
  listJournalEntries(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listJournalEntries(auth);
  }

  @Post('journals')
  @Permissions('accounting:journals:manual')
  createManualJournal(
    @Body() dto: CreateManualJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createManualJournal(dto, auth);
  }

  @Post('journals/manual')
  @Permissions('accounting:journals:manual')
  createManualJournalCanonical(
    @Body() dto: CreateManualJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createManualJournal(dto, auth);
  }

  @Get('journals/:id')
  @Permissions('accounting:journals:read')
  getJournalEntry(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.getJournalEntry(id, auth);
  }

  @Post('journals/:id/reverse')
  @Permissions('accounting:journals:reverse')
  reverseJournalEntry(
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.reverseJournalEntry(id, dto, auth);
  }

  @Post('journals/:id/correct')
  @Permissions('accounting:journals:reverse')
  correctJournalEntry(
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.correctJournalEntry(id, dto, auth);
  }

  @Get('exports/:report.csv')
  @Header('Content-Type', 'text/csv')
  @Permissions('accounting:exports:create')
  exportAccountingReport(
    @Param('report') report: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.exportCsv(report, auth);
  }

  @Post('expenses')
  @Permissions('accounting:close')
  createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createExpense(dto, auth);
  }

  @Post('closing/:id')
  @Permissions('accounting:close')
  closePeriod(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.closePeriod(id, auth);
  }
}
