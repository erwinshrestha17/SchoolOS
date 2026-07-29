import { Logger } from '@nestjs/common';
import { skipSuspendedTenantJob } from './processor-tenant.guard';

describe('skipSuspendedTenantJob', () => {
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
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

  it('returns true and logs an error when tenantId is missing', async () => {
    const plansService = {
      shouldProcessTenantJob: jest.fn(),
    };

    await expect(
      skipSuspendedTenantJob(plansService as never, null, logger, 'test job'),
    ).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      'Skipping test job: tenantId is missing from job payload (fail-closed)',
    );
    expect(plansService.shouldProcessTenantJob).not.toHaveBeenCalled();
  });
});
