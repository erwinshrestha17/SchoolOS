import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { FinanceService } from '../finance/finance.service';
import { AccountingService } from './accounting.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateChartAccountDto } from './dto/create-chart-account.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
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

  @Get('chart-accounts')
  @Permissions('accounting:read')
  listChartAccounts(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listChartAccounts(auth);
  }

  @Post('chart-accounts')
  @Permissions('accounting:close')
  createChartAccount(
    @Body() dto: CreateChartAccountDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createChartAccount(dto, auth);
  }

  @Get('periods')
  @Permissions('accounting:read')
  listPeriods(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listPeriods(auth);
  }

  @Post('periods')
  @Permissions('accounting:close')
  createPeriod(
    @Body() dto: CreateAccountingPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createPeriod(dto, auth);
  }

  @Get('reports')
  @Permissions('accounting:read')
  reports(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.buildReports(auth);
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

  @Post('journals')
  @Permissions('accounting:close')
  createManualJournal(
    @Body() dto: CreateManualJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createManualJournal(dto, auth);
  }

  @Post('journals/:id/reverse')
  @Permissions('accounting:reverse')
  reverseJournalEntry(
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.reverseJournalEntry(id, dto, auth);
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
