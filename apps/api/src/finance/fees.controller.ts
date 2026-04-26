import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { CreateFeeWaiverDto } from './dto/create-fee-waiver.dto';
import { GenerateBillingRunDto } from './dto/generate-billing-run.dto';
import { SendDefaulterRemindersDto } from './dto/send-defaulter-reminders.dto';
import { FinanceService } from './finance.service';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class FeesController {
  constructor(private readonly financeService: FinanceService) {}

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
  @Permissions('fees:manage')
  listInvoices(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listInvoices(auth);
  }

  @Get('billing-runs')
  @Permissions('fees:bill')
  listBillingRuns(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listBillingRuns(auth);
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
    @Query('classId') classId?: string,
    @Query('feeHeadId') feeHeadId?: string,
  ) {
    return this.financeService.listDefaulters(auth, { classId, feeHeadId });
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
  listDiscounts(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listDiscountRules(auth);
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
  listWaivers(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listWaivers(auth);
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
