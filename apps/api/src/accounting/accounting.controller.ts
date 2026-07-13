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
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { FinanceService } from '../finance/finance.service';
import { AccountingService } from './accounting.service';
import { AccountingSourceMappingService } from './accounting-source-mapping.service';
import { AccountingActionDto } from './dto/accounting-action.dto';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateChartAccountDto } from './dto/create-chart-account.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReverseJournalEntryDto } from './dto/reverse-journal-entry.dto';
import { LockFiscalPeriodDto } from './dto/lock-fiscal-period.dto';
import { UnlockFiscalPeriodDto } from './dto/unlock-fiscal-period.dto';
import { CloseFiscalPeriodDto } from './dto/close-fiscal-period.dto';
import { ReopenFiscalPeriodDto } from './dto/reopen-fiscal-period.dto';
import { SubmitJournalDto } from './dto/submit-journal.dto';
import { ApproveJournalDto } from './dto/approve-journal.dto';
import { RejectJournalDto } from './dto/reject-journal.dto';
import { PostJournalDto } from './dto/post-journal.dto';
import { CancelJournalDto } from './dto/cancel-journal.dto';
import { CreateOpeningBalanceDto } from './dto/opening-balance.dto';
import {
  ImportBankStatementDto,
  ReconcileBankStatementDto,
} from './dto/import-bank-statement.dto';
import {
  ExpenseVoucherDto,
  PaymentVoucherDto,
  ReceiptVoucherDto,
  ContraVoucherDto,
} from './dto/voucher.dto';
import {
  ArchiveAccountingSourceMappingDto,
  CreateAccountingSourceMappingDto,
  ListAccountingSourceMappingsQueryDto,
} from './dto/accounting-source-mapping.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.accounting')
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly financeService: FinanceService,
    private readonly sourceMappings: AccountingSourceMappingService,
  ) {}

  @Get('dashboard-summary')
  @Permissions('accounting:reports:read')
  dashboardSummary(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getDashboardSummary(auth);
  }

  @Get('source-mappings')
  @Permissions('accounting:reports:read')
  listSourceMappings(
    @Query() query: ListAccountingSourceMappingsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.sourceMappings.listMappings(auth, query);
  }

  @Get('source-mappings/health')
  @Permissions('accounting:reports:read')
  sourceMappingHealth(@CurrentAuth() auth: AuthContext) {
    return this.sourceMappings.getSourceMappingHealth(auth);
  }

  @Post('source-mappings')
  @Permissions('accounting:settings:update')
  createSourceMapping(
    @Body() dto: CreateAccountingSourceMappingDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.sourceMappings.createMapping(dto, auth);
  }

  @Post('source-mappings/:id/archive')
  @Permissions('accounting:settings:update')
  archiveSourceMapping(
    @Param('id') id: string,
    @Body() dto: ArchiveAccountingSourceMappingDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.sourceMappings.archiveMapping(id, dto, auth);
  }

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
    @Body() dto: LockFiscalPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.lockFiscalPeriod(id, dto, auth);
  }

  @Post('fiscal-periods/:id/unlock')
  @Permissions('accounting:fiscal:manage')
  unlockFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: UnlockFiscalPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.unlockFiscalPeriod(id, dto, auth);
  }

  @Post('fiscal-periods/:id/close')
  @Permissions('accounting:fiscal:manage')
  closeFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: CloseFiscalPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.closeFiscalPeriod(id, dto, auth);
  }

  @Post('fiscal-periods/:id/reopen')
  @Permissions('accounting:fiscal:reopen')
  reopenFiscalPeriod(
    @Param('id') id: string,
    @Body() dto: ReopenFiscalPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.reopenFiscalPeriod(id, dto, auth);
  }

  @Get('reports')
  @Permissions('accounting:reports:read')
  reports(@Query() query: ReportsQueryDto, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.buildReports(auth, query);
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
  incomeStatement(
    @Query() query: ReportsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.getIncomeStatement(auth, query);
  }

  @Get('reports/balance-sheet')
  @Permissions('accounting:reports:read')
  balanceSheet(
    @Query() query: ReportsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.getBalanceSheet(auth, query);
  }

  @Get('reports/cash-book')
  @Permissions('accounting:reports:read')
  cashBook(@Query() query: ReportsQueryDto, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.getCashBook(auth, query);
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

  @Get('reports/source-ledger/reconciliation')
  @Permissions('accounting:reports:read')
  sourceLedgerReconciliation(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.getSourceLedgerReconciliation(auth);
  }

  @Get('journals')
  @Permissions('accounting:journals:read')
  listJournalEntries(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listJournalEntries(auth);
  }

  @Post('journals')
  @Permissions('accounting:journals:create')
  createManualJournal(
    @Body() dto: CreateManualJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createManualJournal(dto, auth);
  }

  @Post('journals/manual')
  @Permissions('accounting:journals:create')
  createManualJournalCanonical(
    @Body() dto: CreateManualJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createManualJournal(dto, auth);
  }

  @Post('journals/:id/submit')
  @Permissions('accounting:journals:submit')
  submitManualJournal(
    @Param('id') id: string,
    @Body() dto: SubmitJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.submitManualJournal(id, dto, auth);
  }

  @Post('journals/:id/approve')
  @Permissions('accounting:journals:approve')
  approveManualJournal(
    @Param('id') id: string,
    @Body() dto: ApproveJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.approveManualJournal(id, dto, auth);
  }

  @Post('journals/:id/reject')
  @Permissions('accounting:journals:reject')
  rejectManualJournal(
    @Param('id') id: string,
    @Body() dto: RejectJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.rejectManualJournal(id, dto, auth);
  }

  @Post('journals/:id/post')
  @Permissions('accounting:journals:post')
  postApprovedManualJournal(
    @Param('id') id: string,
    @Body() dto: PostJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.postApprovedManualJournal(id, dto, auth);
  }

  @Post('journals/:id/cancel')
  @Permissions('accounting:journals:cancel')
  cancelManualJournal(
    @Param('id') id: string,
    @Body() dto: CancelJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.cancelManualJournal(id, dto, auth);
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

  // ─── Slice 2: Opening Balance ────────────────────────────────────

  @Post('opening-balance')
  @Permissions('accounting:journals:create')
  createOpeningBalance(
    @Body() dto: CreateOpeningBalanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createOpeningBalance(dto, auth);
  }

  @Get('opening-balance/:fiscalYearId')
  @Permissions('accounting:reports:read')
  getOpeningBalance(
    @Param('fiscalYearId') fiscalYearId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.getOpeningBalance(fiscalYearId, auth);
  }

  // ─── Slice 3: Voucher Workflows ──────────────────────────────────

  @Post('vouchers/expense')
  @Permissions('accounting:journals:create')
  createExpenseVoucher(
    @Body() dto: ExpenseVoucherDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createExpenseVoucher(dto, auth);
  }

  @Post('vouchers/payment')
  @Permissions('accounting:journals:create')
  createPaymentVoucher(
    @Body() dto: PaymentVoucherDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createPaymentVoucher(dto, auth);
  }

  @Post('vouchers/receipt')
  @Permissions('accounting:journals:create')
  createReceiptVoucher(
    @Body() dto: ReceiptVoucherDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createReceiptVoucher(dto, auth);
  }

  @Post('vouchers/contra')
  @Permissions('accounting:journals:create')
  createContraVoucher(
    @Body() dto: ContraVoucherDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createContraVoucher(dto, auth);
  }

  // ─── Slice 4: Fiscal Year Close ──────────────────────────────────

  @Post('fiscal-years/:id/close-year')
  @Permissions('accounting:fiscal:manage')
  closeFiscalYear(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.closeFiscalYear(id, auth);
  }

  @Post('fiscal-years/:id/reopen-year')
  @Permissions('accounting:fiscal:reopen')
  reopenFiscalYear(
    @Param('id') id: string,
    @Body() dto: ReopenFiscalPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.reopenFiscalYear(id, dto, auth);
  }

  // ─── Slice 5: Bank Reconciliation ────────────────────────────────

  @Post('bank-reconciliation/:accountId/import')
  @Permissions('accounting:settings:update')
  importBankStatement(
    @Param('accountId') accountId: string,
    @Body() body: ImportBankStatementDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.importBankStatement(
      accountId,
      body.lines,
      auth,
    );
  }

  @Get('bank-reconciliation/:accountId/unreconciled')
  @Permissions('accounting:reports:read')
  getUnreconciledStatements(
    @Param('accountId') accountId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.getUnreconciledStatements(accountId, auth);
  }

  @Get('bank-reconciliation/:accountId/auto-match')
  @Permissions('accounting:reports:read')
  suggestReconciliationMatches(
    @Param('accountId') accountId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.suggestBankReconciliationMatches(
      accountId,
      auth,
    );
  }

  @Post('bank-reconciliation/reconcile')
  @Permissions('accounting:settings:update')
  reconcileStatement(
    @Body() body: ReconcileBankStatementDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.reconcileStatement(
      body.statementId,
      body.journalLineId,
      auth,
    );
  }

  @Get('bank-reconciliation/:accountId/summary')
  @Permissions('accounting:reports:read')
  getReconciliationSummary(
    @Param('accountId') accountId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.getReconciliationSummary(accountId, auth);
  }
}
