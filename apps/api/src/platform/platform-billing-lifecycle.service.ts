import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PlatformService } from './platform.service';

const SYSTEM_BILLING_ACTOR = 'system:platform-billing-lifecycle';

@Injectable()
export class PlatformBillingLifecycleService {
  private readonly logger = new Logger(PlatformBillingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly platformService: PlatformService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBillingJobs() {
    this.logger.log('Starting daily platform billing lifecycle jobs');
    try {
      await this.runBillingLifecycle();
    } catch (error) {
      this.logger.error('Error in daily billing jobs', error);
    }
  }

  async runBillingLifecycle(actorUserId = SYSTEM_BILLING_ACTOR) {
    const overdueInvoices = await this.checkOverdueInvoices(actorUserId);
    const subscriptionTransitions =
      await this.processSubscriptionTransitions(actorUserId);
    const renewalInvoices = await this.generateRenewalInvoices(actorUserId);

    return {
      overdueInvoices,
      subscriptionTransitions,
      renewalInvoices,
    };
  }

  private async checkOverdueInvoices(actorUserId: string) {
    const today = new Date();
    const overdueInvoices = await this.prisma.saaSInvoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { lt: today },
      },
    });

    let count = 0;
    for (const invoice of overdueInvoices) {
      await this.prisma.saaSInvoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });

      if (invoice.subscriptionId) {
        await this.prisma.tenantSubscription.update({
          where: { id: invoice.subscriptionId },
          data: { status: 'GRACE' },
        });

        await this.auditService.record({
          action: 'subscription_grace_period_started',
          resource: 'subscriptions',
          resourceId: invoice.subscriptionId,
          tenantId: 'platform',
          userId: actorUserId,
          after: { invoiceNumber: invoice.invoiceNumber, status: 'GRACE' },
        });
      }

      count += 1;
      this.logger.log(`Marked invoice ${invoice.invoiceNumber} as OVERDUE`);
    }

    return count;
  }

  private async processSubscriptionTransitions(actorUserId: string) {
    const today = new Date();
    let count = 0;

    // 1. Trial to Expired
    const expiringTrials = await this.prisma.tenantSubscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lt: today },
      },
    });

    for (const sub of expiringTrials) {
      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });

      await this.auditService.record({
        action: 'subscription_trial_expired',
        resource: 'subscriptions',
        resourceId: sub.id,
        tenantId: 'platform',
        userId: actorUserId,
        after: { status: 'EXPIRED' },
      });

      count += 1;
      this.logger.log(`Subscription ${sub.id} moved from TRIAL to EXPIRED`);
    }

    // 2. Grace to Suspended (15 days grace period)
    const gracePeriodThreshold = new Date();
    gracePeriodThreshold.setDate(gracePeriodThreshold.getDate() - 15);

    const longOverdue = await this.prisma.saaSInvoice.findMany({
      where: {
        status: 'OVERDUE',
        dueDate: { lt: gracePeriodThreshold },
      },
      include: { subscription: true },
    });

    for (const inv of longOverdue) {
      if (inv.subscription?.status === 'GRACE') {
        await this.prisma.tenantSubscription.update({
          where: { id: inv.subscriptionId! },
          data: { status: 'SUSPENDED' },
        });

        await this.prisma.tenant.update({
          where: { id: inv.tenantId },
          data: { isActive: false },
        });

        await this.auditService.record({
          action: 'tenant_suspended_billing',
          resource: 'tenants',
          resourceId: inv.tenantId,
          tenantId: 'platform',
          userId: actorUserId,
          after: {
            reason: 'long_overdue_invoice',
            invoiceNumber: inv.invoiceNumber,
          },
        });

        count += 1;
        this.logger.warn(
          `Tenant ${inv.tenantId} SUSPENDED due to long overdue invoice ${inv.invoiceNumber}`,
        );
      }
    }

    return count;
  }

  private async generateRenewalInvoices(actorUserId: string) {
    const today = new Date();
    const dueSubscriptions = await this.prisma.tenantSubscription.findMany({
      where: {
        status: 'ACTIVE',
        renewsAt: { lte: today },
        OR: [{ endsAt: null }, { endsAt: { gte: today } }],
      },
      include: { plan: true },
    });

    let count = 0;
    for (const subscription of dueSubscriptions) {
      const plan = subscription.plan;
      if (plan?.status !== 'ACTIVE') {
        continue;
      }

      const renewalDate = subscription.renewsAt ?? today;
      const nextRenewsAt = nextRenewalDate(renewalDate, plan.billingCycle);
      const price = new Prisma.Decimal(plan.priceNpr);
      let generatedInvoice = false;

      if (price.gt(0)) {
        await this.platformService.createSaaSInvoice(
          subscription.tenantId,
          {
            planId: subscription.planId,
            subscriptionId: subscription.id,
            issueDate: renewalDate.toISOString(),
            dueDate: addDays(renewalDate, 15).toISOString(),
            status: 'ISSUED',
            notes: `Automated ${plan.billingCycle.toLowerCase()} SaaS renewal invoice for ${plan.name}.`,
            lines: [
              {
                lineType: 'SUBSCRIPTION',
                description: `${plan.name} ${plan.billingCycle} subscription renewal`,
                quantity: 1,
                unitAmount: price.toFixed(2),
              },
            ],
          },
          actorUserId,
        );
        generatedInvoice = true;
        count += 1;
      }

      await this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: { renewsAt: nextRenewsAt },
      });

      await this.auditService.record({
        action: generatedInvoice
          ? 'subscription_renewal_invoice_generated'
          : 'subscription_renewal_advanced',
        resource: 'subscriptions',
        resourceId: subscription.id,
        tenantId: 'platform',
        userId: actorUserId,
        after: {
          tenantId: subscription.tenantId,
          planId: subscription.planId,
          renewalDate: renewalDate.toISOString(),
          nextRenewsAt: nextRenewsAt.toISOString(),
          priceNpr: price.toFixed(2),
        },
      });
    }

    return count;
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextRenewalDate(date: Date, billingCycle: string) {
  const next = new Date(date);
  const cycle = billingCycle.trim().toUpperCase();

  if (cycle.includes('MONTH') && !cycle.includes('QUARTER')) {
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  if (cycle.includes('QUARTER')) {
    next.setMonth(next.getMonth() + 3);
    return next;
  }

  if (cycle.includes('SEMI') || cycle.includes('HALF')) {
    next.setMonth(next.getMonth() + 6);
    return next;
  }

  next.setFullYear(next.getFullYear() + 1);
  return next;
}
