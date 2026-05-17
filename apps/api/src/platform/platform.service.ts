import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PaginatedResponse,
  PlatformAuditLog,
  PlatformBillingProfile,
  PlatformDashboardSummary,
  PlatformEntitlementCheck,
  PlatformHealthSummary,
  PlatformOnboardingChecklist,
  PlatformProviderConfigSummary,
  PlatformProviderReadinessDetail,
  PlatformQueueSummary,
  PlatformSaaSInvoiceSummary,
  PlatformTenantDetail,
  PlatformTenantSummary,
  PlatformTenantSubscriptionSummary,
  PlatformTenantUsage,
  PlatformUsageCounterSummary,
} from '@schoolos/core';
import { ListPlatformTenantsDto } from './dto/list-platform-tenants.dto';
import { UsageService } from '../usage/usage.service';
import {
  AssignTenantSubscriptionDto,
  CancelSaaSInvoiceDto,
  CreatePlatformPlanDto,
  CreateSaaSInvoiceDto,
  RecordSaaSPaymentDto,
  RetryFailedJobDto,
  TenantFeatureOverrideDto,
  UpdateBillingProfileDto,
  UpdatePlatformPlanDto,
  UpsertProviderConfigDto,
  UsageIncrementDto,
  OnboardingOverrideDto,
} from './dto/platform-core.dto';
import { ConfigService } from '../config/config.service';
import { RedisService } from '../redis/redis.service';
import { encryptSensitiveField } from '../common/security/field-encryption';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { PlatformFailedJobSummary } from '@schoolos/core';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['TRIAL', 'ACTIVE', 'GRACE']);

const FEATURE_KEYS = [
  'module.students',
  'module.attendance',
  'module.fees',
  'module.exams',
  'module.homework',
  'module.timetable',
  'module.hr',
  'module.payroll',
  'module.accounting',
  'module.library',
  'module.transport',
  'module.canteen',
  'module.communications',
  'module.intelligence',

  'feature.receipt_pdf',
  'feature.report_card_pdf',
  'feature.parent_teacher_chat',
  'feature.transport_live_tracking',
  'feature.ai_teacher_assistant',
  'feature.ai_dropout_prediction',
  'feature.ai_natural_language_query',
  'module.reports',
];

const USAGE_KEYS = [
  'students.count',
  'staff.count',
  'storage.bytes',
  'sms.sent',
  'notifications.sent',
  'messages.sent',
  'receipts.generated',
  'report_cards.generated',
  'exports.generated',
  'api.requests',
  'ai.credits',
];

const ONBOARDING_ITEMS = [
  {
    key: 'school_profile',
    label: 'School profile complete',
    href: '/dashboard/settings',
    required: true,
  },
  {
    key: 'branding_files',
    label: 'Logo, seal, and signature uploaded',
    href: '/dashboard/settings',
    required: true,
  },
  {
    key: 'academic_year',
    label: 'Academic year set',
    href: '/dashboard/settings',
    required: true,
  },
  {
    key: 'classes_sections',
    label: 'Classes and sections configured',
    href: '/dashboard/settings',
    required: true,
  },
  {
    key: 'subjects',
    label: 'Subjects configured',
    href: '/dashboard/academics/subjects',
    required: true,
  },
  {
    key: 'fee_heads',
    label: 'Fee heads configured',
    href: '/dashboard/settings',
    required: true,
  },
  {
    key: 'users_staff',
    label: 'Users and staff invited',
    href: '/dashboard/hr/staff',
    required: true,
  },
  {
    key: 'students',
    label: 'Students imported or created',
    href: '/dashboard/students',
    required: true,
  },
  {
    key: 'accounting_fiscal_year',
    label: 'Accounting fiscal year configured',
    href: '/dashboard/accounting/management',
    required: true,
  },
  {
    key: 'chart_of_accounts',
    label: 'Chart of accounts ready',
    href: '/dashboard/accounting/accounts',
    required: true,
  },
  {
    key: 'communication_settings',
    label: 'Communication settings configured',
    href: '/dashboard/settings',
    required: false,
  },
  {
    key: 'file_storage',
    label: 'File storage configured',
    href: '/platform/settings',
    required: true,
  },
] as const;

type DynamicRecord = Record<string, unknown>;
interface DynamicDelegate {
  findMany(args?: unknown): Promise<DynamicRecord[]>;
  findUnique(args?: unknown): Promise<DynamicRecord | null>;
  findFirst(args?: unknown): Promise<DynamicRecord | null>;
  create(args?: unknown): Promise<DynamicRecord>;
  update(args?: unknown): Promise<DynamicRecord>;
  updateMany(args?: unknown): Promise<DynamicRecord>;
  upsert(args?: unknown): Promise<DynamicRecord>;
  count(args?: unknown): Promise<number>;
}

@Injectable()
export class PlatformService {
  private readonly queues: Map<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly usageService: UsageService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly plansService: PlansService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('finance') private readonly financeQueue: Queue,
    @InjectQueue('payroll') private readonly payrollQueue: Queue,
    @InjectQueue('activity-media') private readonly activityQueue: Queue,
    @InjectQueue('homework') private readonly homeworkQueue: Queue,
  ) {
    this.queues = new Map([
      ['notifications', notificationsQueue],
      ['finance', financeQueue],
      ['payroll', payrollQueue],
      ['activity-media', activityQueue],
      ['homework', homeworkQueue],
    ]);
  }

  async getDashboardSummary(): Promise<PlatformDashboardSummary> {
    const [
      totalTenants,
      activeTenants,
      usage,
      health,
      failedJobs,
      onboarding,
      audit,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.usageService.getGlobalUsageStats(),
      this.getPlatformHealth(),
      this.listFailedJobs(),
      this.getOnboardingCounts(),
      this.listAuditLogs({ limit: 10 }),
    ]);
    const suspendedTenants = totalTenants - activeTenants;

    return {
      totalTenants,
      activeTenants,
      suspendedTenants,
      pendingOnboarding: onboarding.pending,
      usage,
      healthStatus: health.status,
      failedJobsCount: failedJobs.length,
      recentAudit: audit.items,
    };
  }

  async listTenants(): Promise<PlatformTenantSummary[]> {
    const page = await this.listTenantsPage({ page: 1, limit: 100 });
    return page.items;
  }

  async listTenantsPage(
    query: ListPlatformTenantsDto = {},
  ): Promise<PaginatedResponse<PlatformTenantSummary>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;
    const where = this.buildTenantWhere(query);

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const items = await Promise.all(
      tenants.map((tenant) => this.toTenantSummary(tenant)),
    );

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async getTenantDetail(tenantId: string): Promise<PlatformTenantDetail> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const [
      usage,
      subscription,
      billingProfile,
      recentAudit,
      onboarding,
      overrides,
    ] = await Promise.all([
      this.usageService.getTenantUsageSummary(tenantId),
      this.getTenantSubscription(tenantId),
      this.getBillingProfile(tenantId),
      this.getTenantRecentAudit(tenantId),
      this.getOnboardingChecklist(tenantId),
      this.getTenantFeatureOverrides(tenantId),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      panNumber: tenant.panNumber,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.createdAt.toISOString(),
      studentCount: usage.studentCount,
      staffCount: usage.staffCount,
      usage,
      subscription,
      billingProfile,
      recentAudit,
      onboarding,
      overrides,
    };
  }

  async updateTenantStatus(
    tenantId: string,
    isActive: boolean,
    userId: string,
    reason?: string,
  ): Promise<void> {
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new BadRequestException('Tenant status changes require a reason');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (tenant.isActive === isActive) {
      await this.auditService.record({
        action: 'tenant_status_noop',
        resource: 'tenants',
        resourceId: tenantId,
        tenantId: 'platform',
        userId,
        before: { isActive: tenant.isActive },
        after: { isActive, reason: reason.trim() },
      });
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive },
    });

    await this.auditService.record({
      action: isActive ? 'tenant_activated' : 'tenant_suspended',
      resource: 'tenants',
      resourceId: tenantId,
      tenantId: 'platform',
      userId,
      before: { isActive: tenant.isActive },
      after: { isActive, reason: reason.trim() },
    });
  }

  async getTenantUsage(tenantId: string): Promise<PlatformTenantUsage> {
    await this.ensureTenant(tenantId);
    return this.usageService.getTenantUsageSummary(tenantId);
  }

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    tenantId?: string;
    action?: string;
    userId?: string;
    resource?: string;
    resourceId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<PlatformAuditLog>> {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.resource) where.resource = query.resource;
    if (query.resourceId) where.resourceId = query.resourceId;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: logs.map((log) => this.toAuditLog(log)),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async listPlans() {
    const delegate = this.delegate('platformPlan');
    if (!delegate) return [];

    const plans = await delegate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { features: true, usageLimits: true },
    });

    return plans.map((plan) => this.toPlanSummary(plan));
  }

  async createPlan(dto: CreatePlatformPlanDto, actorUserId: string) {
    const delegate = this.requireDelegate('platformPlan');
    const plan = await delegate.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        priceNpr: new Prisma.Decimal(dto.priceNpr ?? '0'),
        billingCycle: dto.billingCycle ?? 'ANNUAL',
        features: {
          create: (dto.features ?? []).map((feature) => ({
            featureKey: feature.featureKey,
            enabled: feature.enabled ?? true,
          })),
        },
        usageLimits: {
          create: (dto.limits ?? []).map((limit) => ({
            usageKey: limit.usageKey,
            limit: limit.limit,
            period: limit.period ?? 'MONTHLY',
          })),
        },
      },
      include: { features: true, usageLimits: true },
    });
    await this.platformAudit(
      actorUserId,
      'platform_plan_created',
      'plans',
      String(plan.id),
      null,
      {
        key: dto.key,
        name: dto.name,
      },
    );
    return this.toPlanSummary(plan);
  }

  async updatePlan(
    planId: string,
    dto: UpdatePlatformPlanDto,
    actorUserId: string,
  ) {
    const delegate = this.requireDelegate('platformPlan');
    const before = await delegate.findUnique({ where: { id: planId } });
    if (!before) throw new NotFoundException('Plan not found');
    const updated = await delegate.update({
      where: { id: planId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        priceNpr: dto.priceNpr ? new Prisma.Decimal(dto.priceNpr) : undefined,
        billingCycle: dto.billingCycle,
      },
      include: { features: true, usageLimits: true },
    });
    await this.platformAudit(
      actorUserId,
      'platform_plan_updated',
      'plans',
      planId,
      before,
      dto,
    );
    return this.toPlanSummary(updated);
  }

  async assignSubscription(
    tenantId: string,
    dto: AssignTenantSubscriptionDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    const delegate = this.requireDelegate('tenantSubscription');
    const before = await delegate.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const previousActiveSubscriptions = ACTIVE_SUBSCRIPTION_STATUSES.has(
      dto.status,
    )
      ? await delegate.findMany({
          where: {
            tenantId,
            status: { in: Array.from(ACTIVE_SUBSCRIPTION_STATUSES) },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    for (const previous of previousActiveSubscriptions) {
      await delegate.update({
        where: { id: String(previous.id) },
        data: {
          status: 'EXPIRED',
          endsAt: startsAt,
          notes: appendSubscriptionNote(
            previous.notes,
            `Superseded by platform subscription assignment to plan ${dto.planId}.`,
          ),
        },
      });
    }

    const subscription = await delegate.create({
      data: {
        tenantId,
        planId: dto.planId,
        status: dto.status,
        startsAt,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        renewsAt: dto.renewsAt ? new Date(dto.renewsAt) : null,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
        notes: dto.notes,
      },
      include: { plan: true },
    });
    await this.platformAudit(
      actorUserId,
      'tenant_subscription_assigned',
      'subscriptions',
      String(subscription.id),
      {
        latestSubscriptionBefore: before,
        activeSubscriptionsBefore: previousActiveSubscriptions,
      },
      {
        tenantId,
        planId: dto.planId,
        status: dto.status,
        closedPreviousSubscriptionIds: previousActiveSubscriptions.map((item) =>
          String(item.id),
        ),
      },
      tenantId,
    );
    return this.toSubscriptionSummary(subscription);
  }

  async updateSubscriptionStatus(
    tenantId: string,
    subscriptionId: string,
    dto: { status: string; notes?: string },
    actorUserId: string,
  ) {
    const delegate = this.requireDelegate('tenantSubscription');
    const before = await delegate.findFirst({
      where: { id: subscriptionId, tenantId },
    });
    if (!before) throw new NotFoundException('Subscription not found');

    const subscription = await delegate.update({
      where: { id: subscriptionId },
      data: {
        status: dto.status,
        notes: dto.notes,
      },
    });

    await this.platformAudit(
      actorUserId,
      'tenant_subscription_status_updated',
      'subscriptions',
      String(subscription.id),
      before,
      { status: dto.status, notes: dto.notes },
      tenantId,
    );

    return this.toSubscriptionSummary(subscription);
  }

  async getTenantFeatureOverrides(tenantId: string) {
    const delegate = this.delegate('tenantFeatureOverride');
    if (!delegate) return [];
    const overrides = await delegate.findMany({ where: { tenantId } });
    return asRecords(overrides).map((o) => ({
      featureKey: String(o.featureKey),
      enabled: Boolean(o.enabled),
      reason: String(o.reason),
    }));
  }

  async setFeatureOverride(
    tenantId: string,
    dto: TenantFeatureOverrideDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    if (!FEATURE_KEYS.includes(dto.featureKey)) {
      throw new BadRequestException('Unknown feature key');
    }
    const delegate = this.requireDelegate('tenantFeatureOverride');
    const before = await delegate.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey: dto.featureKey } },
    });
    const override = await delegate.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey: dto.featureKey } },
      update: {
        enabled: dto.enabled,
        reason: dto.reason,
        createdBy: actorUserId,
      },
      create: {
        tenantId,
        featureKey: dto.featureKey,
        enabled: dto.enabled,
        reason: dto.reason,
        createdBy: actorUserId,
      },
    });
    await this.platformAudit(
      actorUserId,
      'tenant_feature_override_updated',
      'entitlements',
      String(override.id),
      before,
      { featureKey: dto.featureKey, enabled: dto.enabled, reason: dto.reason },
      tenantId,
    );
    return override;
  }

  async checkEntitlement(
    tenantId: string,
    featureKey: string,
  ): Promise<PlatformEntitlementCheck> {
    const tenant = await this.ensureTenant(tenantId);
    if (!tenant.isActive) {
      return {
        allowed: false,
        tenantId,
        featureKey,
        reason: 'tenant_inactive',
        source: 'none',
      };
    }

    const entitlement = await this.plansService.checkFeatureEnabled(
      tenantId,
      featureKey,
    );

    const subscription = await this.getRawActiveSubscription(tenantId);

    // Determine source
    let source: PlatformEntitlementCheck['source'] = 'none';
    const override = await this.prisma.tenantFeatureOverride.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey } },
    });

    if (override) {
      source = 'override';
    } else if (subscription) {
      source = 'plan';
    }

    let reason: PlatformEntitlementCheck['reason'] = 'feature_locked';
    if (entitlement.allowed) {
      reason = 'allowed';
    } else if (entitlement.reason === 'tenant_inactive') {
      reason = 'tenant_inactive';
    } else if (entitlement.reason === 'subscription_missing') {
      reason = 'no_subscription';
    }

    return {
      allowed: entitlement.allowed,
      tenantId,
      featureKey,
      reason,
      source,
      subscriptionStatus: subscription?.status as string | null,
    };
  }

  async listUsageCounters(
    tenantId: string,
  ): Promise<PlatformUsageCounterSummary[]> {
    await this.ensureTenant(tenantId);
    const delegate = this.delegate('usageCounter');
    if (!delegate) return [];
    const counters = await delegate.findMany({
      where: { tenantId },
      orderBy: [{ usageKey: 'asc' }, { periodStart: 'desc' }],
    });
    return Promise.all(counters.map((counter) => this.toUsageCounter(counter)));
  }

  async incrementUsage(
    tenantId: string,
    dto: UsageIncrementDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    if (!USAGE_KEYS.includes(dto.usageKey)) {
      throw new BadRequestException('Unknown usage key');
    }
    const delegate = this.requireDelegate('usageCounter');
    const period = dto.period ?? 'MONTHLY';
    const periodStart = this.getPeriodStart(period);
    const amount = dto.amount ?? 1;
    const counter = await delegate.upsert({
      where: {
        tenantId_usageKey_period_periodStart: {
          tenantId,
          usageKey: dto.usageKey,
          period,
          periodStart,
        },
      },
      update: { value: { increment: amount } },
      create: {
        tenantId,
        usageKey: dto.usageKey,
        period,
        periodStart,
        value: amount,
      },
    });
    const summary = await this.toUsageCounter(counter);
    if (
      summary.limit !== null &&
      summary.limit !== undefined &&
      summary.value > summary.limit
    ) {
      throw new ForbiddenException('Usage limit exceeded');
    }
    await this.platformAudit(
      actorUserId,
      'usage_counter_incremented',
      'usage',
      String(counter.id),
      null,
      { usageKey: dto.usageKey, amount, value: counter.value },
      tenantId,
    );
    return summary;
  }

  async getBillingProfile(
    tenantId: string,
  ): Promise<PlatformBillingProfile | null> {
    const delegate = this.delegate('tenantBillingProfile');
    if (!delegate) return null;
    const profile = await delegate.findUnique({ where: { tenantId } });
    return profile ? this.toBillingProfile(profile) : null;
  }

  async updateBillingProfile(
    tenantId: string,
    dto: UpdateBillingProfileDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    const delegate = this.requireDelegate('tenantBillingProfile');
    const before = await delegate.findUnique({ where: { tenantId } });
    const profile = await delegate.upsert({
      where: { tenantId },
      update: dto,
      create: { tenantId, ...dto },
    });
    await this.platformAudit(
      actorUserId,
      'tenant_billing_profile_updated',
      'billing',
      String(profile.id),
      before,
      dto,
      tenantId,
    );
    return this.toBillingProfile(profile);
  }

  async listSaaSInvoices(
    tenantId: string,
  ): Promise<PlatformSaaSInvoiceSummary[]> {
    await this.ensureTenant(tenantId);
    const delegate = this.delegate('saaSInvoice');
    if (!delegate) return [];
    const invoices = await delegate.findMany({
      where: { tenantId },
      orderBy: { issueDate: 'desc' },
      include: { lines: true, payments: true },
    });
    return invoices.map((invoice) => this.toInvoiceSummary(invoice));
  }

  async createSaaSInvoice(
    tenantId: string,
    dto: CreateSaaSInvoiceDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    const delegate = this.requireDelegate('saaSInvoice');
    const lines = dto.lines.map((line) => {
      const total = new Prisma.Decimal(line.unitAmount).mul(line.quantity);
      return {
        lineType: line.lineType,
        description: line.description,
        quantity: line.quantity,
        unitAmount: new Prisma.Decimal(line.unitAmount),
        totalAmount: total,
      };
    });
    const amount = lines.reduce(
      (sum, line) => sum.add(line.totalAmount),
      new Prisma.Decimal(0),
    );
    const existing = await delegate.findFirst({
      where: {
        tenantId,
        subscriptionId: dto.subscriptionId,
        issueDate: new Date(dto.issueDate),
        status: { not: 'CANCELLED' },
      },
    });
    if (existing) {
      return this.toInvoiceSummary(existing);
    }

    const invoice = await delegate.create({
      data: {
        tenantId,
        invoiceNumber: await this.nextInvoiceNumber(tenantId),
        planId: dto.planId,
        subscriptionId: dto.subscriptionId,
        amount,
        currency: 'NPR',
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        status: 'ISSUED',
        notes: dto.notes,
        createdBy: actorUserId,
        lines: { create: lines },
      },
      include: { lines: true, payments: true },
    });
    await this.platformAudit(
      actorUserId,
      'saas_invoice_created',
      'saas_billing',
      String(invoice.id),
      null,
      { invoiceNumber: invoice.invoiceNumber, amount: amount.toString() },
      tenantId,
    );
    return this.toInvoiceSummary(invoice);
  }

  async recordSaaSPayment(
    tenantId: string,
    invoiceId: string,
    dto: RecordSaaSPaymentDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    const invoiceDelegate = this.requireDelegate('saaSInvoice');
    const paymentDelegate = this.requireDelegate('saaSPayment');
    const invoice = await invoiceDelegate.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: true, lines: true },
    });
    if (!invoice) throw new NotFoundException('SaaS invoice not found');
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot pay a cancelled invoice');
    }
    const amount = new Prisma.Decimal(dto.amount);
    const paid = this.sumPayments(asRecords(invoice.payments));
    if (paid.add(amount).gt(decimalValue(invoice.amount))) {
      throw new BadRequestException('Payment exceeds invoice balance');
    }
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already fully paid');
    }
    await paymentDelegate.create({
      data: {
        tenantId,
        invoiceId,
        amount,
        paymentDate: new Date(dto.paymentDate),
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        createdBy: actorUserId,
      },
    });
    const nextPaid = paid.add(amount);
    const status = nextPaid.eq(decimalValue(invoice.amount))
      ? 'PAID'
      : 'PARTIAL';
    const updated = await invoiceDelegate.update({
      where: { id: invoiceId },
      data: { status },
      include: { lines: true, payments: true },
    });
    await this.platformAudit(
      actorUserId,
      'saas_payment_recorded',
      'saas_billing',
      invoiceId,
      { status: invoice.status, paidAmount: paid.toString() },
      { amount: amount.toString(), status },
      tenantId,
    );
    return this.toInvoiceSummary(updated);
  }

  async cancelSaaSInvoice(
    tenantId: string,
    invoiceId: string,
    dto: CancelSaaSInvoiceDto,
    actorUserId: string,
  ) {
    const delegate = this.requireDelegate('saaSInvoice');
    const invoice = await delegate.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('SaaS invoice not found');
    if (asRecords(invoice.payments).length > 0) {
      throw new BadRequestException('Cannot cancel an invoice with payments');
    }
    const updated = await delegate.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: actorUserId,
        cancellationReason: dto.reason,
      },
      include: { lines: true, payments: true },
    });
    await this.platformAudit(
      actorUserId,
      'saas_invoice_cancelled',
      'saas_billing',
      invoiceId,
      { status: invoice.status },
      { status: 'CANCELLED', reason: dto.reason },
      tenantId,
    );
    return this.toInvoiceSummary(updated);
  }

  async listProviders(): Promise<PlatformProviderConfigSummary[]> {
    const delegate = this.delegate('providerConfig');
    if (!delegate) return [];
    const providers = await delegate.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return providers.map((provider) => this.toProviderSummary(provider));
  }

  async getProviderReadinessDetail(
    providerId: string,
  ): Promise<PlatformProviderReadinessDetail> {
    const provider = await this.prisma.providerConfig.findUnique({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const recentAudit = await this.prisma.auditLog.findMany({
      where: {
        tenantId: 'platform',
        resource: 'provider_config',
        resourceId: providerId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, after: true, createdAt: true },
    });

    return this.buildProviderReadinessDetail(
      provider,
      provider.lastValidatedAt ? toDate(provider.lastValidatedAt) : new Date(),
      recentAudit,
    );
  }

  async upsertProvider(dto: UpsertProviderConfigDto, actorUserId: string) {
    const delegate = this.requireDelegate('providerConfig');
    this.validateProvider(dto);
    const before = await delegate.findUnique({
      where: {
        type_name_environment: {
          type: dto.type,
          name: dto.name,
          environment: dto.environment,
        },
      },
    });
    const secretKeys = dto.secretKeys ?? this.detectSecretKeys(dto.config);
    const configEncrypted = preserveMaskedProviderSecrets(
      this.encryptProviderConfig(dto.config, secretKeys),
      dto.config,
      before?.configEncrypted,
      secretKeys,
    );
    const provider = await delegate.upsert({
      where: {
        type_name_environment: {
          type: dto.type,
          name: dto.name,
          environment: dto.environment,
        },
      },
      update: {
        enabled: dto.enabled,
        configEncrypted,
        secretKeys,
        updatedBy: actorUserId,
      },
      create: {
        type: dto.type,
        name: dto.name,
        enabled: dto.enabled,
        environment: dto.environment,
        configEncrypted,
        secretKeys,
        updatedBy: actorUserId,
      },
    });
    await this.platformAudit(
      actorUserId,
      'provider_config_updated',
      'provider_config',
      String(provider.id),
      before ? this.toProviderSummary(before) : null,
      this.toProviderSummary(provider),
    );
    return this.toProviderSummary(provider);
  }

  async updateProviderStatus(
    providerId: string,
    enabled: boolean,
    actorUserId: string,
    reason?: string,
  ) {
    const delegate = this.requireDelegate('providerConfig');
    const before = await delegate.findUnique({ where: { id: providerId } });
    if (!before) throw new NotFoundException('Provider not found');
    if (!enabled && (!reason?.trim() || reason.trim().length < 5)) {
      throw new BadRequestException('Provider disable requires a reason');
    }

    const provider = await delegate.update({
      where: { id: providerId },
      data: {
        enabled,
        updatedBy: actorUserId,
      },
    });

    await this.platformAudit(
      actorUserId,
      enabled ? 'provider_config_enabled' : 'provider_config_disabled',
      'provider_config',
      providerId,
      this.toProviderSummary(before),
      {
        ...this.toProviderSummary(provider),
        reason: reason?.trim() || null,
      },
    );

    return this.toProviderSummary(provider);
  }

  async testProviderConnection(providerId: string, actorUserId: string) {
    const provider = await this.prisma.providerConfig.findUnique({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const checkedAt = new Date();
    const readiness = this.buildProviderReadinessDetail(
      provider,
      checkedAt,
      [],
    );
    const validationStatus = readiness.status.toUpperCase();

    await this.prisma.providerConfig.update({
      where: { id: providerId },
      data: {
        validationStatus,
        lastValidatedAt: checkedAt,
      },
    });

    await this.platformAudit(
      actorUserId,
      'provider_connection_tested',
      'provider_config',
      providerId,
      null,
      {
        status: readiness.status,
        mode: readiness.mode,
        message: readiness.message,
        missingKeys: readiness.missingKeys,
        paidExternalCallSkipped: readiness.paidExternalCallSkipped,
        secretKeysMasked: readiness.secretKeysMasked,
      },
    );

    return {
      ...readiness,
      provider: {
        ...readiness.provider,
        validationStatus,
        lastValidatedAt: checkedAt.toISOString(),
      },
    };
  }

  async enterSupportOverride(
    tenantId: string,
    platformUserId: string,
    reason: string,
    durationMinutes = 60,
  ) {
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new BadRequestException('Support override requires a reason');
    }

    await this.ensureTenant(tenantId);

    // Expire existing active overrides for this user
    await this.prisma.supportOverride.updateMany({
      where: { platformUserId, isActive: true },
      data: { isActive: false },
    });

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    const override = await this.prisma.supportOverride.create({
      data: {
        platformUserId,
        tenantId,
        reason,
        expiresAt,
        isActive: true,
      },
    });

    await this.auditService.record({
      action: 'support_override_entered',
      resource: 'support',
      resourceId: tenantId,
      tenantId: 'platform',
      userId: platformUserId,
      after: {
        overrideId: override.id,
        reason,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      success: true,
      overrideId: override.id,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async exitSupportOverride(platformUserId: string) {
    const override = await this.prisma.supportOverride.findFirst({
      where: { platformUserId, isActive: true },
    });

    if (override) {
      await this.prisma.supportOverride.update({
        where: { id: override.id },
        data: { isActive: false },
      });

      await this.auditService.record({
        action: 'support_override_exited',
        resource: 'support',
        resourceId: override.tenantId,
        tenantId: 'platform',
        userId: platformUserId,
        after: { overrideId: override.id },
      });
    }

    return { success: true };
  }

  async getQueueHealth(): Promise<PlatformQueueSummary[]> {
    const summaries: PlatformQueueSummary[] = [];

    for (const [name, queue] of this.queues.entries()) {
      const [counts, paused, workers] = await Promise.all([
        queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
        queue.isPaused(),
        queue.getWorkers(),
      ]);

      summaries.push({
        name,
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
        paused,
        workerHealth: workers.length > 0 ? 'healthy' : 'degraded',
      });
    }

    return summaries;
  }

  async listFailedJobs(): Promise<PlatformFailedJobSummary[]> {
    const allFailed: PlatformFailedJobSummary[] = [];

    for (const [name, queue] of this.queues.entries()) {
      const failedJobs = await queue.getFailed(0, 50);
      for (const job of failedJobs) {
        allFailed.push({
          id: String(job.id),
          queueName: name,
          name: job.name,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          data: job.data,
        });
      }
    }

    return allFailed.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }

  async retryFailedJob(dto: RetryFailedJobDto, actorUserId: string) {
    const queue = this.queues.get(dto.queueName);
    if (!queue) {
      throw new NotFoundException(`Queue ${dto.queueName} not found`);
    }

    const job = await queue.getJob(dto.jobId);
    if (!job) {
      throw new NotFoundException(
        `Job ${dto.jobId} not found in queue ${dto.queueName}`,
      );
    }

    const isFailed = await job.isFailed();
    if (!isFailed) {
      throw new BadRequestException(`Job ${dto.jobId} is not in failed state`);
    }

    await job.retry();

    await this.platformAudit(
      actorUserId,
      'queue_failed_job_retry_requested',
      'queues',
      `${dto.queueName}:${dto.jobId}`,
      { status: 'failed', failedReason: job.failedReason },
      {
        queueName: dto.queueName,
        jobId: dto.jobId,
        reason: dto.reason ?? 'manual_retry',
      },
    );

    return { success: true };
  }

  async getPlatformHealth(): Promise<PlatformHealthSummary> {
    const [database, redis, storageProvider] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.prisma.providerConfig.findFirst({
        where: { type: 'OBJECT_STORAGE', enabled: true },
      }),
    ]);

    const checks = {
      database,
      redis,
      queue: redis,
      objectStorage: storageProvider
        ? { status: 'ok' as const }
        : { status: 'error' as const, message: 'No enabled storage provider' },
    };

    const ready = Object.values(checks).every((check) => check.status === 'ok');
    return {
      status: ready ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  async listReportExports(tenantId?: string) {
    return this.listReportExportsPage({ tenantId, page: 1, limit: 100 });
  }

  async listReportExportsPage(query: {
    tenantId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ReportExportWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;

    const delegate = this.delegate('reportExport');
    if (!delegate)
      return { items: [], total: 0, page, limit, hasNextPage: false };

    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      delegate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async recordReportExport(input: {
    tenantId?: string | null;
    scope: string;
    reportKey: string;
    format: string;
    filters: Prisma.InputJsonValue;
    requestedBy?: string | null;
    status?: string;
  }) {
    const delegate = this.delegate('reportExport');
    if (!delegate) return null;
    return delegate.create({
      data: {
        tenantId: input.tenantId,
        scope: input.scope,
        reportKey: input.reportKey,
        format: input.format,
        filters: input.filters,
        requestedBy: input.requestedBy,
        status: input.status ?? 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  async getOnboardingChecklist(
    tenantId: string,
  ): Promise<PlatformOnboardingChecklist> {
    await this.ensureTenant(tenantId);
    const [
      settings,
      classCount,
      sectionCount,
      subjectCount,
      feeHeadCount,
      staffCount,
      studentCount,
      fiscalYearCount,
      chartAccountCount,
      overrides,
    ] = await Promise.all([
      this.prisma.tenantSetting.findMany({ where: { tenantId } }),
      this.count('class', { tenantId }),
      this.count('section', { tenantId }),
      this.count('subject', { tenantId }),
      this.count('feeHead', { tenantId }),
      this.count('staff', { tenantId }),
      this.count('student', { tenantId }),
      this.count('fiscalYear', { tenantId }),
      this.count('chartAccount', { tenantId }),
      this.delegate('tenantOnboardingChecklistOverride')?.findMany({
        where: { tenantId },
      }) ?? Promise.resolve([]),
    ]);
    const settingKeys = new Set(settings.map((setting) => setting.key));
    const computed: Record<string, boolean> = {
      school_profile: ['school_name', 'school_address', 'school_phone'].some(
        (key) => settingKeys.has(key),
      ),
      branding_files: [
        'school_logo',
        'school_seal',
        'principal_signature',
      ].some((key) => settingKeys.has(key)),
      academic_year: (await this.count('academicYear', { tenantId })) > 0,
      classes_sections: classCount > 0 && sectionCount > 0,
      subjects: subjectCount > 0,
      fee_heads: feeHeadCount > 0,
      users_staff: staffCount > 0,
      students: studentCount > 0,
      accounting_fiscal_year: fiscalYearCount > 0,
      chart_of_accounts: chartAccountCount > 0,
      communication_settings: settingKeys.has('parent_notification_enabled'),
      file_storage: true,
    };
    const overrideMap = new Map(
      asRecords(overrides).map((override) => [override.itemKey, override]),
    );
    const items = ONBOARDING_ITEMS.map((item) => {
      const override = overrideMap.get(item.key);
      const completed = override
        ? Boolean(override.completed)
        : computed[item.key];
      return {
        ...item,
        completed,
        source: override ? ('manual' as const) : ('computed' as const),
      };
    });
    const completed = items.filter((item) => item.completed).length;
    return {
      tenantId,
      completed,
      total: items.length,
      progressPercent: Math.round((completed / items.length) * 100),
      items,
    };
  }

  async setOnboardingOverride(
    tenantId: string,
    dto: OnboardingOverrideDto,
    actorUserId: string,
  ) {
    await this.ensureTenant(tenantId);
    if (!ONBOARDING_ITEMS.some((item) => item.key === dto.itemKey)) {
      throw new BadRequestException('Unknown onboarding item');
    }
    const delegate = this.requireDelegate('tenantOnboardingChecklistOverride');
    const override = await delegate.upsert({
      where: { tenantId_itemKey: { tenantId, itemKey: dto.itemKey } },
      update: {
        completed: dto.completed,
        reason: dto.reason,
        updatedBy: actorUserId,
      },
      create: {
        tenantId,
        itemKey: dto.itemKey,
        completed: dto.completed,
        reason: dto.reason,
        updatedBy: actorUserId,
      },
    });
    await this.platformAudit(
      actorUserId,
      'onboarding_override_updated',
      'onboarding',
      String(override.id),
      null,
      { itemKey: dto.itemKey, completed: dto.completed, reason: dto.reason },
      tenantId,
    );
    return this.getOnboardingChecklist(tenantId);
  }

  getFeatureKeys() {
    return FEATURE_KEYS;
  }

  getUsageKeys() {
    return USAGE_KEYS;
  }

  private buildTenantWhere(query: ListPlatformTenantsDto) {
    const where: Prisma.TenantWhereInput = {};

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { panNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.plan?.trim()) {
      where.plan = query.plan.trim();
    }

    if (query.status === 'active') {
      where.isActive = true;
    }

    if (query.status === 'suspended') {
      where.isActive = false;
    }

    return where;
  }

  private async toTenantSummary(tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
    createdAt: Date;
  }): Promise<PlatformTenantSummary> {
    const [studentCount, staffCount] = await Promise.all([
      this.prisma.student.count({ where: { tenantId: tenant.id } }),
      this.prisma.staff.count({ where: { tenantId: tenant.id } }),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.createdAt.toISOString(),
      studentCount,
      staffCount,
    };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }
    return tenant;
  }

  private delegate(name: string): DynamicDelegate | null {
    return (
      (this.prisma as unknown as Record<string, DynamicDelegate | undefined>)[
        name
      ] ?? null
    );
  }

  private requireDelegate(name: string): DynamicDelegate {
    const delegate = this.delegate(name);
    if (!delegate) {
      throw new BadRequestException(`Platform model ${name} is not available`);
    }
    return delegate;
  }

  private async platformAudit(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    before: unknown,
    after: unknown,
    tenantId = 'platform',
  ) {
    await this.auditService.record({
      action,
      resource,
      resourceId,
      tenantId,
      userId,
      before,
      after,
    });
  }

  private async getTenantRecentAudit(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { OR: [{ tenantId }, { resourceId: tenantId }] },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, email: true, phone: true } } },
    });
    return logs.map((log) => this.toAuditLog(log));
  }

  private toAuditLog(log: DynamicRecord): PlatformAuditLog {
    return {
      id: String(log.id),
      action: String(log.action),
      resource: String(log.resource),
      resourceId: nullableString(log.resourceId),
      tenantId: String(log.tenantId),
      userId: nullableString(log.userId),
      before: log.before,
      after: log.after,
      ipAddress: nullableString(log.ipAddress),
      userAgent: nullableString(log.userAgent),
      createdAt: toDate(log.createdAt).toISOString(),
      user: asNullableUser(log.user),
    };
  }

  private toPlanSummary(plan: DynamicRecord) {
    return {
      id: String(plan.id),
      key: String(plan.key),
      name: String(plan.name),
      description: nullableString(plan.description),
      status: String(plan.status),
      priceNpr: plan.priceNpr?.toString?.() ?? String(plan.priceNpr ?? '0'),
      billingCycle: String(plan.billingCycle),
      features: asRecords(plan.features).map((feature) => ({
        featureKey: String(feature.featureKey),
        enabled: Boolean(feature.enabled),
      })),
      limits: asRecords(plan.usageLimits).map((limit) => ({
        usageKey: String(limit.usageKey),
        limit: Number(limit.limit),
        period: String(limit.period),
      })),
    };
  }

  private async getTenantSubscription(
    tenantId: string,
  ): Promise<PlatformTenantSubscriptionSummary | null> {
    const subscription = await this.getRawActiveSubscription(tenantId);
    return subscription ? this.toSubscriptionSummary(subscription) : null;
  }

  private async getRawActiveSubscription(tenantId: string) {
    const delegate = this.delegate('tenantSubscription');
    if (!delegate) return null;
    return delegate.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { include: { features: true, usageLimits: true } } },
    });
  }

  private toSubscriptionSummary(
    subscription: DynamicRecord,
  ): PlatformTenantSubscriptionSummary {
    return {
      id: String(subscription.id),
      tenantId: String(subscription.tenantId),
      planId: String(subscription.planId),
      planKey: String(asRecord(subscription.plan).key ?? subscription.planId),
      planName: String(asRecord(subscription.plan).name ?? 'Unknown plan'),
      status: String(
        subscription.status,
      ) as PlatformTenantSubscriptionSummary['status'],
      startsAt: toDate(subscription.startsAt).toISOString(),
      endsAt: subscription.endsAt
        ? toDate(subscription.endsAt).toISOString()
        : null,
      renewsAt: subscription.renewsAt
        ? toDate(subscription.renewsAt).toISOString()
        : null,
      trialEndsAt: subscription.trialEndsAt
        ? toDate(subscription.trialEndsAt).toISOString()
        : null,
    };
  }

  private async toUsageCounter(
    counter: DynamicRecord,
  ): Promise<PlatformUsageCounterSummary> {
    const limit = await this.findUsageLimit(
      String(counter.tenantId),
      String(counter.usageKey),
      String(counter.period),
    );
    return {
      tenantId: String(counter.tenantId),
      usageKey: String(counter.usageKey),
      value: Number(counter.value),
      limit,
      period: String(counter.period),
      periodStart: toDate(counter.periodStart).toISOString(),
      exceeded: limit !== null && Number(counter.value) > limit,
    };
  }

  private async findUsageLimit(
    tenantId: string,
    usageKey: string,
    period: string,
  ): Promise<number | null> {
    const subscription = await this.getRawActiveSubscription(tenantId);
    const limit = asRecords(asRecord(subscription?.plan).usageLimits).find(
      (item: DynamicRecord) =>
        item.usageKey === usageKey && item.period === period,
    );
    return limit ? Number(limit.limit) : null;
  }

  private getPeriodStart(period: string) {
    const now = new Date();
    if (period === 'DAILY') {
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
    }
    if (period === 'ANNUAL') {
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    }
    if (period === 'LIFETIME') {
      return new Date(Date.UTC(1970, 0, 1));
    }
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private toBillingProfile(profile: DynamicRecord): PlatformBillingProfile {
    return {
      tenantId: String(profile.tenantId),
      billingContactName: nullableString(profile.billingContactName),
      billingEmail: nullableString(profile.billingEmail),
      billingPhone: nullableString(profile.billingPhone),
      billingAddress: nullableString(profile.billingAddress),
      panVatNumber: nullableString(profile.panVatNumber),
      preferredBillingCycle: String(profile.preferredBillingCycle),
      notes: nullableString(profile.notes),
    };
  }

  private toInvoiceSummary(invoice: DynamicRecord): PlatformSaaSInvoiceSummary {
    const paidAmount = this.sumPayments(asRecords(invoice.payments));
    const amount = decimalValue(invoice.amount);
    const balanceAmount = amount.sub(paidAmount);
    return {
      id: String(invoice.id),
      tenantId: String(invoice.tenantId),
      invoiceNumber: String(invoice.invoiceNumber),
      amount: amount.toString(),
      paidAmount: paidAmount.toString(),
      balanceAmount: balanceAmount.toString(),
      currency: String(invoice.currency),
      issueDate: toDate(invoice.issueDate).toISOString(),
      dueDate: toDate(invoice.dueDate).toISOString(),
      status:
        invoice.status !== 'PAID' &&
        invoice.status !== 'CANCELLED' &&
        toDate(invoice.dueDate) < new Date()
          ? 'OVERDUE'
          : (String(invoice.status) as PlatformSaaSInvoiceSummary['status']),
      lines: asRecords(invoice.lines).map((line) => ({
        id: String(line.id),
        lineType: String(line.lineType),
        description: String(line.description),
        quantity: Number(line.quantity),
        unitAmount: line.unitAmount?.toString?.() ?? String(line.unitAmount),
        totalAmount: line.totalAmount?.toString?.() ?? String(line.totalAmount),
      })),
    };
  }

  private sumPayments(payments: DynamicRecord[]) {
    return payments.reduce(
      (sum, payment) => sum.add(decimalValue(payment.amount)),
      new Prisma.Decimal(0),
    );
  }

  private async nextInvoiceNumber(tenantId: string) {
    const count = await this.delegate('saaSInvoice')?.count({
      where: { tenantId },
    });
    return `SO-${new Date().getUTCFullYear()}-${String((count ?? 0) + 1).padStart(5, '0')}`;
  }

  private validateProvider(dto: UpsertProviderConfigDto) {
    for (const key of this.getProviderRequiredKeys(dto.type)) {
      if (!dto.config[key]) {
        throw new BadRequestException(`${key} is required for ${dto.type}`);
      }
    }
  }

  private getProviderRequiredKeys(type: string) {
    const required: Record<string, string[]> = {
      SMS: ['apiToken', 'senderId'],
      EMAIL: ['apiToken', 'fromEmail'],
      FCM: ['projectId'],
      OBJECT_STORAGE: ['bucket', 'region'],
      PAYMENT_GATEWAY: ['merchantId'],
      AI_PROVIDER: ['apiKey'],
    };
    return required[type] ?? [];
  }

  private detectSecretKeys(config: Record<string, unknown>) {
    return Object.keys(config).filter((key) =>
      /(secret|token|key|password|credential)/i.test(key),
    );
  }

  private encryptProviderConfig(
    config: Record<string, unknown>,
    secretKeys: string[],
  ) {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      output[key] =
        secretKeys.includes(key) && typeof value === 'string'
          ? encryptSensitiveField(value, this.configService.jwtSecret)
          : value;
    }
    return output;
  }

  private toProviderSummary(
    provider: DynamicRecord,
  ): PlatformProviderConfigSummary {
    const config = { ...(provider.configEncrypted ?? {}) };
    for (const key of asStringArray(provider.secretKeys)) {
      if (key in config) {
        config[key] = '********';
      }
    }
    return {
      id: String(provider.id),
      type: String(provider.type),
      name: String(provider.name),
      enabled: Boolean(provider.enabled),
      environment: String(provider.environment),
      config,
      secretKeys: asStringArray(provider.secretKeys),
      validationStatus: nullableString(provider.validationStatus),
      lastValidatedAt: provider.lastValidatedAt
        ? toDate(provider.lastValidatedAt).toISOString()
        : null,
      updatedAt: toDate(provider.updatedAt).toISOString(),
    };
  }

  private buildProviderReadinessDetail(
    provider: DynamicRecord,
    checkedAt: Date,
    recentAuditRows: DynamicRecord[],
  ): PlatformProviderReadinessDetail {
    const providerType = String(provider.type);
    const requiredKeys = this.getProviderRequiredKeys(providerType);
    const config = asRecord(provider.configEncrypted);
    const missingKeys = requiredKeys.filter((key) => {
      const value = config[key];
      return (
        value === null ||
        typeof value === 'undefined' ||
        (typeof value === 'string' && value.trim().length === 0)
      );
    });
    const enabled = Boolean(provider.enabled);
    const status = !enabled
      ? 'warning'
      : missingKeys.length > 0
        ? 'error'
        : 'ok';
    const message = !enabled
      ? 'Provider is disabled; delivery remains blocked until an operator enables it.'
      : missingKeys.length > 0
        ? `Provider configuration is missing required keys: ${missingKeys.join(', ')}.`
        : providerType === 'OBJECT_STORAGE'
          ? 'Object storage configuration passed local S3-compatible dry-run validation. No external bucket call was made.'
          : 'Provider configuration passed local dry-run validation. No paid external call was made.';

    return {
      provider: this.toProviderSummary(provider),
      status,
      mode: enabled ? 'dry_run' : 'disabled',
      message,
      missingKeys,
      paidExternalCallSkipped: true,
      secretKeysMasked: asStringArray(provider.secretKeys),
      checkedAt: checkedAt.toISOString(),
      recentAudit: recentAuditRows.map((row) => {
        const after = asRecord(row.after);
        return {
          id: String(row.id),
          action: String(row.action),
          createdAt: toDate(row.createdAt).toISOString(),
          status: nullableString(after.status),
          message: nullableString(after.message),
        };
      }),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const };
    } catch (error) {
      return {
        status: 'error' as const,
        message:
          error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private async checkRedis() {
    try {
      const response = await this.redisService.ping();
      return {
        status: response === 'PONG' ? ('ok' as const) : ('error' as const),
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  private async count(model: string, where: Record<string, unknown>) {
    const delegate = this.delegate(model);
    if (!delegate?.count) return 0;
    return delegate.count({ where });
  }

  private async getOnboardingCounts() {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      take: 100,
    });
    const checklists = await Promise.all(
      tenants.map((tenant) => this.getOnboardingChecklist(tenant.id)),
    );
    return {
      pending: checklists.filter((checklist) => checklist.progressPercent < 100)
        .length,
    };
  }
}

function asRecord(value: unknown): DynamicRecord {
  return value && typeof value === 'object' ? (value as DynamicRecord) : {};
}

function asRecords(value: unknown): DynamicRecord[] {
  return Array.isArray(value) ? (value as DynamicRecord[]) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function nullableString(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  return String(value);
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function appendSubscriptionNote(current: unknown, note: string) {
  const existing = typeof current === 'string' ? current.trim() : '';
  return existing ? `${existing}\n${note}` : note;
}

function preserveMaskedProviderSecrets(
  encryptedConfig: Record<string, unknown>,
  rawConfig: Record<string, unknown>,
  previousConfig: unknown,
  secretKeys: string[],
) {
  const previous = asRecord(previousConfig);
  const merged: Record<string, unknown> = { ...encryptedConfig };

  for (const key of secretKeys) {
    const value = rawConfig[key];
    if (
      typeof value === 'string' &&
      ['********', '••••••••'].includes(value.trim()) &&
      typeof previous[key] !== 'undefined'
    ) {
      merged[key] = previous[key];
    }
  }

  return merged;
}

function decimalValue(value: unknown): Prisma.Decimal {
  return new Prisma.Decimal(String(value ?? 0));
}

function asNullableUser(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const user = value as DynamicRecord;
  return {
    id: String(user.id),
    email: nullableString(user.email),
    phone: nullableString(user.phone),
  };
}
