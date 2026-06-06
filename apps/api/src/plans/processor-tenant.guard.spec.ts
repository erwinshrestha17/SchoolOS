import { Logger } from '@nestjs/common';
import { skipSuspendedTenantJob } from './processor-tenant.guard';

describe('skipSuspendedTenantJob', () => {
  const logger = {
    warn: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when tenant job processing is allowed', async () => {
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    };

    await expect(
      skipSuspendedTenantJob(
        plansService as never,
        'tenant-1',
        logger,
        'test job',
      ),
    ).resolves.toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns true and logs when tenant is inactive', async () => {
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(false),
    };

    await expect(
      skipSuspendedTenantJob(
        plansService as never,
        'tenant-suspended',
        logger,
        'test job',
      ),
    ).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Skipping test job for inactive or missing tenant tenant-suspended',
    );
  });
});
