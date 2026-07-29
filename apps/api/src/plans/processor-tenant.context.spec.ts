import { Logger } from '@nestjs/common';
import { runTenantScopedJob } from './processor-tenant.context';

describe('runTenantScopedJob', () => {
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips suspended tenants without running the handler', async () => {
    const cls = {
      run: jest.fn(),
      set: jest.fn(),
    };
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(false),
    };
    const handler = jest.fn();

    await expect(
      runTenantScopedJob(
        cls as never,
        plansService as never,
        'tenant-suspended',
        logger,
        'test job',
        handler,
      ),
    ).resolves.toBeUndefined();

    expect(handler).not.toHaveBeenCalled();
    expect(cls.run).not.toHaveBeenCalled();
  });

  it('injects tenant scope and runs the handler for active tenants', async () => {
    const handler = jest.fn().mockResolvedValue('done');
    const cls = {
      run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      set: jest.fn(),
    };
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    };

    await expect(
      runTenantScopedJob(
        cls as never,
        plansService as never,
        'tenant-1',
        logger,
        'test job',
        handler,
      ),
    ).resolves.toBe('done');

    expect(cls.set).toHaveBeenCalledWith('tenantId', 'tenant-1');
    expect(handler).toHaveBeenCalled();
  });
});
