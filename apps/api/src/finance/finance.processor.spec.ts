import { FinanceProcessor } from './finance.processor';

describe('FinanceProcessor', () => {
  it('runs the cross-tenant online payment reconciliation sweep without a tenant scope of its own', async () => {
    const financeService = {
      reconcileStaleOnlinePaymentIntents: jest.fn().mockResolvedValue({
        examined: 0,
        settled: 0,
        failed: 0,
        expired: 0,
        pending: 0,
        exceptions: 0,
        errors: 0,
      }),
      calculateLateFeesForTenant: jest.fn(),
    };
    const processor = new FinanceProcessor(
      financeService as never,
      {} as never,
      {} as never,
    );

    await processor.process({
      name: 'reconcileOnlinePaymentIntents',
      data: {},
    } as never);

    expect(
      financeService.reconcileStaleOnlinePaymentIntents,
    ).toHaveBeenCalledTimes(1);
    expect(financeService.calculateLateFeesForTenant).not.toHaveBeenCalled();
  });
});
