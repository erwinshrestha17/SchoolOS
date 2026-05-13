import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Query,
  Post,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformQueuesService } from './platform-queues.service';
import { PlatformReportExportsService } from './platform-report-exports.service';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type {
  PaginatedResponse,
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformTenantUsage,
  PlatformAuditLog,
  PlatformDashboardSummary,
  PlatformOnboardingChecklist,
} from '@schoolos/core';
import { ListPlatformTenantsDto } from './dto/list-platform-tenants.dto';
import { UpdatePlatformTenantStatusDto } from './dto/update-platform-tenant-status.dto';
import {
  AssignTenantSubscriptionDto,
  CancelSaaSInvoiceDto,
  CreatePlatformPlanDto,
  CreateSaaSInvoiceDto,
  OnboardingOverrideDto,
  RecordSaaSPaymentDto,
  RetryFailedJobDto,
  TenantFeatureOverrideDto,
  UpdateBillingProfileDto,
  UpdatePlatformPlanDto,
  UpsertProviderConfigDto,
  UsageIncrementDto,
} from './dto/platform-core.dto';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformGuard)
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly platformQueuesService: PlatformQueuesService,
    private readonly platformReportExportsService: PlatformReportExportsService,
  ) {}

  @Get('dashboard')
  @Permissions('platform:dashboard:read')
  async getDashboard(): Promise<PlatformDashboardSummary> {
    return this.platformService.getDashboardSummary();
  }

  @Get('tenants')
  @Permissions('platform:tenants:read')
  async listTenants(): Promise<PlatformTenantSummary[]> {
    return this.platformService.listTenants();
  }

  @Get('tenants/page')
  @Permissions('platform:tenants:read')
  async listTenantsPage(
    @Query() query: ListPlatformTenantsDto,
  ): Promise<PaginatedResponse<PlatformTenantSummary>> {
    return this.platformService.listTenantsPage(query);
  }

  @Get('tenants/:tenantId')
  @Permissions('platform:tenants:read')
  async getTenantDetail(
    @Param('tenantId') tenantId: string,
  ): Promise<PlatformTenantDetail> {
    return this.platformService.getTenantDetail(tenantId);
  }

  @Patch('tenants/:tenantId/status')
  @Permissions('platform:tenants:status')
  async updateTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdatePlatformTenantStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }

    await this.platformService.updateTenantStatus(
      tenantId,
      body.isActive,
      req.auth.userId,
      body.reason,
    );
    return { success: true };
  }

  @Get('tenants/:tenantId/usage')
  @Permissions('platform:usage:read')
  async getTenantUsage(
    @Param('tenantId') tenantId: string,
  ): Promise<PlatformTenantUsage> {
    return this.platformService.getTenantUsage(tenantId);
  }

  @Get('plans')
  @Permissions('platform:plans:read')
  async listPlans() {
    return this.platformService.listPlans();
  }

  @Post('plans')
  @Permissions('platform:plans:manage')
  async createPlan(
    @Body() body: CreatePlatformPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.createPlan(body, this.requireUser(req));
  }

  @Patch('plans/:planId')
  @Permissions('platform:plans:manage')
  async updatePlan(
    @Param('planId') planId: string,
    @Body() body: UpdatePlatformPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.updatePlan(planId, body, this.requireUser(req));
  }

  @Post('tenants/:tenantId/subscriptions')
  @Permissions('platform:billing:manage')
  async assignSubscription(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignTenantSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.assignSubscription(
      tenantId,
      dto,
      this.requireUser(req),
    );
  }

  @Patch('tenants/:tenantId/subscriptions/:subId')
  @Permissions('platform:billing:manage')
  async updateSubscriptionStatus(
    @Param('tenantId') tenantId: string,
    @Param('subId') subId: string,
    @Body() dto: { status: string; notes?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.updateSubscriptionStatus(
      tenantId,
      subId,
      dto,
      this.requireUser(req),
    );
  }

  @Post('tenants/:tenantId/feature-overrides')
  @Permissions('platform:subscriptions:manage')
  async setFeatureOverride(
    @Param('tenantId') tenantId: string,
    @Body() body: TenantFeatureOverrideDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.setFeatureOverride(
      tenantId,
      body,
      this.requireUser(req),
    );
  }

  @Get('tenants/:tenantId/entitlements/:featureKey')
  @Permissions('platform:subscriptions:read')
  async checkEntitlement(
    @Param('tenantId') tenantId: string,
    @Param('featureKey') featureKey: string,
  ) {
    return this.platformService.checkEntitlement(tenantId, featureKey);
  }

  @Get('tenants/:tenantId/usage-counters')
  @Permissions('platform:usage:read')
  async listUsageCounters(@Param('tenantId') tenantId: string) {
    return this.platformService.listUsageCounters(tenantId);
  }

  @Post('tenants/:tenantId/usage-counters/increment')
  @Permissions('platform:subscriptions:manage')
  async incrementUsage(
    @Param('tenantId') tenantId: string,
    @Body() body: UsageIncrementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.incrementUsage(
      tenantId,
      body,
      this.requireUser(req),
    );
  }

  @Get('feature-keys')
  @Permissions('platform:plans:read')
  getFeatureKeys() {
    return this.platformService.getFeatureKeys();
  }

  @Get('usage-keys')
  @Permissions('platform:usage:read')
  getUsageKeys() {
    return this.platformService.getUsageKeys();
  }

  @Get('tenants/:tenantId/billing-profile')
  @Permissions('platform:billing:read')
  async getBillingProfile(@Param('tenantId') tenantId: string) {
    return this.platformService.getBillingProfile(tenantId);
  }

  @Patch('tenants/:tenantId/billing-profile')
  @Permissions('platform:billing:manage')
  async updateBillingProfile(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateBillingProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.updateBillingProfile(
      tenantId,
      body,
      this.requireUser(req),
    );
  }

  @Get('tenants/:tenantId/saas-invoices')
  @Permissions('platform:billing:read')
  async listSaaSInvoices(@Param('tenantId') tenantId: string) {
    return this.platformService.listSaaSInvoices(tenantId);
  }

  @Post('tenants/:tenantId/saas-invoices')
  @Permissions('platform:billing:manage')
  async createSaaSInvoice(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateSaaSInvoiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.createSaaSInvoice(
      tenantId,
      body,
      this.requireUser(req),
    );
  }

  @Post('tenants/:tenantId/saas-invoices/:invoiceId/payments')
  @Permissions('platform:billing:manage')
  async recordSaaSPayment(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: RecordSaaSPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.recordSaaSPayment(
      tenantId,
      invoiceId,
      body,
      this.requireUser(req),
    );
  }

  @Post('tenants/:tenantId/saas-invoices/:invoiceId/cancel')
  @Permissions('platform:billing:manage')
  async cancelSaaSInvoice(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: CancelSaaSInvoiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.cancelSaaSInvoice(
      tenantId,
      invoiceId,
      body,
      this.requireUser(req),
    );
  }

  @Get('providers')
  @Permissions('platform:providers:read')
  async listProviders() {
    return this.platformService.listProviders();
  }

  @Post('providers')
  @Permissions('platform:providers:manage')
  async upsertProvider(
    @Body() body: UpsertProviderConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.upsertProvider(body, this.requireUser(req));
  }

  @Get('queues')
  @Permissions('platform:queues:read')
  async getQueueHealth() {
    return this.platformQueuesService.getQueueHealth();
  }

  @Get('queues/failed-jobs')
  @Permissions('platform:queues:read')
  async listFailedJobs() {
    return this.platformQueuesService.listFailedJobs();
  }

  @Post('queues/retry')
  @Permissions('platform:queues:retry')
  async retryFailedJob(
    @Body() body: RetryFailedJobDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformQueuesService.retryFailedJob(
      body,
      this.requireUser(req),
    );
  }

  @Get('health')
  @Permissions('platform:health:read')
  async getPlatformHealth() {
    return this.platformService.getPlatformHealth();
  }

  @Get('report-exports')
  @Permissions('platform:reports:read')
  async listReportExports(
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.platformService.listReportExportsPage({
      tenantId,
      page,
      limit,
    });
  }

  @Get('tenants/:tenantId/onboarding')
  @Permissions('platform:onboarding:read')
  async getOnboarding(
    @Param('tenantId') tenantId: string,
  ): Promise<PlatformOnboardingChecklist> {
    return this.platformService.getOnboardingChecklist(tenantId);
  }

  @Post('tenants/:tenantId/onboarding/override')
  @Permissions('platform:onboarding:manage')
  async setOnboardingOverride(
    @Param('tenantId') tenantId: string,
    @Body() body: OnboardingOverrideDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformService.setOnboardingOverride(
      tenantId,
      body,
      this.requireUser(req),
    );
  }

  @Get('audit-logs')
  @Permissions('platform:audit:read')
  async listAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ): Promise<PaginatedResponse<PlatformAuditLog>> {
    return this.platformService.listAuditLogs({
      page,
      limit,
      tenantId,
      action,
      userId,
    });
  }

  private requireUser(req: AuthenticatedRequest) {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }

    return req.auth.userId;
  }
}
