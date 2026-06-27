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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { CreateFeeDueScheduleDto } from './dto/create-fee-due-schedule.dto';
import { CreateFeeWaiverDto } from './dto/create-fee-waiver.dto';
import { CreateInvoiceAdjustmentDto } from './dto/create-invoice-adjustment.dto';
import { GenerateBillingRunDto } from './dto/generate-billing-run.dto';
import { ProcessFeeDueScheduleDto } from './dto/process-fee-due-schedule.dto';
import { SendDefaulterRemindersDto } from './dto/send-defaulter-reminders.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { DuesQueryDto } from './dto/dues-query.dto';
import { ListDefaultersDto } from './dto/list-defaulters.dto';
import { FinanceDashboardSummaryQueryDto } from './dto/finance-dashboard-summary-query.dto';
import {
  ListBillingRunsQueryDto,
  ListDiscountRulesQueryDto,
  ListInvoicesQueryDto,
  ListWaiversQueryDto,
} from './dto/list-finance-records.query.dto';
import { FinanceService } from './finance.service';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.fees')
export class FeesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('dashboard-summary')
  getDashboardSummary(
    @Query() query: FinanceDashboardSummaryQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getDashboardSummary(query, auth);
  }

  @Get('heads')
  @Permissions('fees:manage')
  listFeeHeads(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listFeeHeads(auth);
  }

  @Post('heads')
  @Permissions('fees:manage')
  createFeeHead(
    @Body() dto: CreateFeeHeadDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createFeeHead(dto, auth);
  }

  @Get('plans')
  @Permissions('fees:manage')
  listFeePlans(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listFeePlans(auth);
  }

  @Post('plans')
  @Permissions('fees:manage')
  createFeePlan(
    @Body() dto: CreateFeePlanDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createFeePlan(dto, auth);
  }

  @Get('invoices')
  @Permissions('payments:collect')
  listInvoices(
    @Query() query: ListInvoicesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listInvoices(query, auth);
  }

  @Get('invoices/:id')
  @Permissions('payments:collect')
  getInvoiceDetail(
    @Param('id') invoiceId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getInvoiceDetail(invoiceId, auth);
  }

  @Get('students/:studentId/collection-context')
  @Permissions('payments:collect')
  getStudentCollectionContext(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getStudentCollectionContext(studentId, auth);
  }

  @Get('students/:studentId/ledger')
  @Permissions('fees:manage')
  getStudentFeeLedger(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getStudentFeeLedger(studentId, auth);
  }

  @Post('invoices/:id/void')
  @Permissions('fees:adjust')
  voidInvoice(
    @Param('id') invoiceId: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.voidInvoice(invoiceId, dto, auth);
  }

  @Post('invoices/:id/adjustments')
  @Permissions('fees:adjust')
  createInvoiceAdjustment(
    @Param('id') invoiceId: string,
    @Body() dto: CreateInvoiceAdjustmentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createInvoiceAdjustment(invoiceId, dto, auth);
  }

  @Get('billing-runs')
  @Permissions('fees:bill')
  listBillingRuns(
    @Query() query: ListBillingRunsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listBillingRuns(query, auth);
  }

  @Post('billing-runs')
  @Permissions('fees:bill')
  generateBillingRun(
    @Body() dto: GenerateBillingRunDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.generateBillingRun(dto, auth);
  }

  @Get('defaulters')
  @Permissions('fees:manage')
  listDefaulters(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListDefaultersDto,
  ) {
    return this.financeService.listDefaulters(auth, query);
  }

  @Get('due-schedules')
  @Permissions('fees:bill')
  listDueSchedules(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listDueSchedules(auth);
  }

  @Post('due-schedules')
  @Permissions('fees:bill')
  createDueSchedule(
    @Body() dto: CreateFeeDueScheduleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createDueSchedule(dto, auth);
  }

  @Post('due-schedules/:id/process')
  @Permissions('fees:bill')
  processDueSchedule(
    @Param('id') scheduleId: string,
    @Body() dto: ProcessFeeDueScheduleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.processDueSchedule(scheduleId, dto, auth);
  }

  @Get('reports/collections')
  @Permissions('fees:manage')
  getCollectionReport(@CurrentAuth() auth: AuthContext) {
    return this.financeService.getCollectionReport(auth);
  }

  @Get('reports/dues')
  @Permissions('fees:manage')
  getDuesTableReport(
    @Query() query: DuesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getDuesTableReport(query, auth);
  }

  @Post('discounts/recalculate')
  @Permissions('fees:discount')
  recalculateAutomaticDiscounts(@CurrentAuth() auth: AuthContext) {
    return this.financeService.recalculateAutomaticDiscounts(auth);
  }

  @Post('defaulters/reminders')
  @Permissions('fees:manage')
  sendDefaulterReminders(
    @Body() dto: SendDefaulterRemindersDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.sendDefaulterReminders(dto, auth);
  }

  @Get('discounts')
  @Permissions('fees:discount')
  listDiscounts(
    @Query() query: ListDiscountRulesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listDiscountRules(query, auth);
  }

  @Post('discounts')
  @Permissions('fees:discount')
  createDiscount(
    @Body() dto: CreateDiscountRuleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createDiscountRule(dto, auth);
  }

  @Get('waivers')
  @Permissions('fees:discount')
  listWaivers(
    @Query() query: ListWaiversQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listWaivers(query, auth);
  }

  @Post('waivers')
  @Permissions('fees:discount')
  createWaiver(
    @Body() dto: CreateFeeWaiverDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createWaiver(dto, auth);
  }
}
