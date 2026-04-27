import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AccountingService } from './accounting.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

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

  @Post('journals')
  @Permissions('accounting:close')
  createManualJournal(
    @Body() dto: CreateManualJournalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createManualJournal(dto, auth);
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
