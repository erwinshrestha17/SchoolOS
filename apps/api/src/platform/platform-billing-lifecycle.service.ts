import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PlatformBillingLifecycleService {
  private readonly logger = new Logger(PlatformBillingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBillingJobs() {
    this.logger.log('Starting daily platform billing lifecycle jobs');
    try {
      await this.checkOverdueInvoices();
      await this.processSubscriptionTransitions();
    } catch (error) {
      this.logger.error('Error in daily billing jobs', error);
    }
  }

  private async checkOverdueInvoices() {
    const today = new Date();
    const overdueInvoices = await this.prisma.saaSInvoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { lt: today },
      },
    });

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
          after: { invoiceNumber: invoice.invoiceNumber, status: 'GRACE' },
        });
      }

      this.logger.log(`Marked invoice ${invoice.invoiceNumber} as OVERDUE`);
    }
  }

  private async processSubscriptionTransitions() {
    const today = new Date();

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
        after: { status: 'EXPIRED' },
      });

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
      if (inv.subscription && inv.subscription.status === 'GRACE') {
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
          after: {
            reason: 'long_overdue_invoice',
            invoiceNumber: inv.invoiceNumber,
          },
        });

        this.logger.warn(
          `Tenant ${inv.tenantId} SUSPENDED due to long overdue invoice ${inv.invoiceNumber}`,
        );
      }
    }
  }
}
