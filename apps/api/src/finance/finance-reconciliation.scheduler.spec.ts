import {
  FinanceReconciliationScheduler,
  ONLINE_PAYMENT_RECONCILIATION_EVERY_MS,
  ONLINE_PAYMENT_RECONCILIATION_SCHEDULER_ID,
} from './finance-reconciliation.scheduler';

describe('FinanceReconciliationScheduler', () => {
  it('registers one idempotent repeatable reconciliation job under a fixed id', async () => {
    const queue = { upsertJobScheduler: jest.fn().mockResolvedValue({}) };
    await new FinanceReconciliationScheduler(
      queue as never,
    ).onApplicationBootstrap();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      ONLINE_PAYMENT_RECONCILIATION_SCHEDULER_ID,
      { every: ONLINE_PAYMENT_RECONCILIATION_EVERY_MS },
      expect.objectContaining({ name: 'reconcileOnlinePaymentIntents' }),
    );
  });

  it('never blocks application boot when the queue is unavailable', async () => {
    const queue = {
      upsertJobScheduler: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    await expect(
      new FinanceReconciliationScheduler(
        queue as never,
      ).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });
});
