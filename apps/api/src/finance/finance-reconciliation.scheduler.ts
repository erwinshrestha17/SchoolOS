import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

export const ONLINE_PAYMENT_RECONCILIATION_SCHEDULER_ID =
  'online-payment-reconciliation';
export const ONLINE_PAYMENT_RECONCILIATION_EVERY_MS = 5 * 60_000;

/**
 * Registers the repeatable stale-intent reconciliation job. A BullMQ job
 * scheduler with a fixed id is idempotent across restarts and instances, so
 * only one sweep is queued at a time however many API nodes boot.
 */
@Injectable()
export class FinanceReconciliationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(FinanceReconciliationScheduler.name);

  constructor(@InjectQueue('finance') private readonly queue: Queue) {}

  async onApplicationBootstrap() {
    try {
      await this.queue.upsertJobScheduler(
        ONLINE_PAYMENT_RECONCILIATION_SCHEDULER_ID,
        { every: ONLINE_PAYMENT_RECONCILIATION_EVERY_MS },
        {
          name: 'reconcileOnlinePaymentIntents',
          data: {},
          opts: { removeOnComplete: 50, removeOnFail: 200 },
        },
      );
    } catch (error) {
      // Never block boot on the queue; settlement stays correct without it
      // (callbacks and client confirmation still verify and settle).
      this.logger.error(
        `Could not register the online payment reconciliation job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
