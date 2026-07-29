import { Logger } from '@nestjs/common';
import { AdvancedOperationsProcessor } from './advanced-operations.processor';

describe('AdvancedOperationsProcessor (DEF-06)', () => {
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(logger.warn);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(logger.error);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips export jobs for suspended tenants', async () => {
    const exportsService = {
      completeJob: jest.fn(),
    };
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(false),
    };
    const processor = new AdvancedOperationsProcessor(
      exportsService as never,
      plansService as never,
    );

    await processor.process({
      name: 'runDataExport',
      data: { tenantId: 'tenant-suspended', jobId: 'job-1' },
    } as never);

    expect(exportsService.completeJob).not.toHaveBeenCalled();
    expect(plansService.shouldProcessTenantJob).toHaveBeenCalledWith(
      'tenant-suspended',
    );
  });

  it('completes export jobs for active tenants', async () => {
    const exportsService = {
      completeJob: jest.fn().mockResolvedValue(undefined),
    };
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    };
    const processor = new AdvancedOperationsProcessor(
      exportsService as never,
      plansService as never,
    );

    await processor.process({
      name: 'runDataExport',
      data: { tenantId: 'tenant-1', jobId: 'job-1' },
    } as never);

    expect(exportsService.completeJob).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      jobId: 'job-1',
    });
  });
});
