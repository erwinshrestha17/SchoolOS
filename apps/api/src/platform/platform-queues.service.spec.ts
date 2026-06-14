import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformQueuesService } from './platform-queues.service';

describe('PlatformQueuesService', () => {
  let auditService: { record: jest.Mock };
  let prisma: { auditLog: { findMany: jest.Mock } };

  const makeQueue = (overrides: Record<string, unknown> = {}) => ({
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    isPaused: jest.fn().mockResolvedValue(false),
    getWorkers: jest.fn().mockResolvedValue([{ id: 'worker-1' }]),
    getFailed: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(null),
    ...overrides,
  });

  const buildService = (queueOverrides: Record<string, unknown> = {}) => {
    auditService = { record: jest.fn().mockResolvedValue({}) };
    prisma = { auditLog: { findMany: jest.fn().mockResolvedValue([]) } };

    const notificationsQueue = makeQueue(queueOverrides.notifications as any);
    const financeQueue = makeQueue(queueOverrides.finance as any);
    const payrollQueue = makeQueue(queueOverrides.payroll as any);
    const activityMediaQueue = makeQueue(
      queueOverrides['activity-media'] as any,
    );
    const homeworkQueue = makeQueue(queueOverrides.homework as any);
    const reportsQueue = makeQueue(queueOverrides.reports as any);
    const canteenAlertsQueue = makeQueue(
      queueOverrides['canteen-alerts'] as any,
    );

    const service = new PlatformQueuesService(
      auditService as any,
      prisma as any,
      notificationsQueue as any,
      financeQueue as any,
      payrollQueue as any,
      activityMediaQueue as any,
      homeworkQueue as any,
      reportsQueue as any,
      canteenAlertsQueue as any,
    );

    return {
      service,
      queues: {
        notificationsQueue,
        financeQueue,
        payrollQueue,
        activityMediaQueue,
        homeworkQueue,
        reportsQueue,
        canteenAlertsQueue,
      },
    };
  };

  it('masks secret-like failed job payload fields before returning them to platform users', async () => {
    const { service } = buildService({
      notifications: {
        getFailed: jest.fn().mockResolvedValue([
          {
            id: 'job-1',
            name: 'send-sms',
            failedReason: 'Provider rejected request',
            attemptsMade: 2,
            timestamp: 123,
            data: {
              tenantId: 'tenant-1',
              phone: '9800000000',
              apiKey: 'raw-api-key',
              nested: {
                accessToken: 'raw-token',
                message: 'Hello guardian',
              },
            },
          },
        ]),
      },
    });

    const jobs = await service.listFailedJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        id: 'job-1',
        queueName: 'notifications',
        name: 'send-sms',
      }),
    );
    expect(jobs[0].data).toEqual({
      tenantId: 'tenant-1',
      phone: '********',
      apiKey: '********',
      nested: {
        accessToken: '********',
        message: 'Hello guardian',
      },
    });
  });

  it('keeps queue health visible when one queue check fails', async () => {
    const { service } = buildService({
      notifications: {
        getJobCounts: jest
          .fn()
          .mockRejectedValue(new Error('Redis connection refused')),
      },
      finance: {
        getJobCounts: jest.fn().mockResolvedValue({
          waiting: 1,
          active: 2,
          completed: 3,
          failed: 4,
          delayed: 5,
        }),
      },
    });

    await expect(service.getQueueHealth()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'notifications',
          workerHealth: 'unknown',
          error: 'Redis connection refused',
        }),
        expect.objectContaining({
          name: 'finance',
          waiting: 1,
          active: 2,
          completed: 3,
          failed: 4,
          delayed: 5,
          workerHealth: 'healthy',
        }),
      ]),
    );
  });

  it('monitors reports and canteen alert queues alongside core queues', async () => {
    const { service } = buildService({
      reports: {
        getJobCounts: jest.fn().mockResolvedValue({
          waiting: 2,
          active: 0,
          completed: 8,
          failed: 1,
          delayed: 3,
        }),
      },
      'canteen-alerts': {
        getJobCounts: jest.fn().mockResolvedValue({
          waiting: 4,
          active: 1,
          completed: 6,
          failed: 0,
          delayed: 0,
        }),
      },
    });

    await expect(service.getQueueHealth()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'reports',
          waiting: 2,
          failed: 1,
          delayed: 3,
        }),
        expect.objectContaining({
          name: 'canteen-alerts',
          waiting: 4,
          active: 1,
          completed: 6,
        }),
      ]),
    );
  });

  it('groups failed jobs by queue, job name, and bounded failure reason with safe diagnostics', async () => {
    const { service } = buildService({
      notifications: {
        getFailed: jest.fn().mockResolvedValue([
          {
            id: 'job-1',
            name: 'send-sms',
            failedReason: 'SMS provider timeout',
            attemptsMade: 2,
            timestamp: 100,
            data: {
              tenantId: 'tenant-1',
              phone: '9800000000',
              apiKey: 'raw-api-key',
            },
          },
          {
            id: 'job-2',
            name: 'send-sms',
            failedReason: 'SMS   provider   timeout',
            attemptsMade: 4,
            timestamp: 200,
            data: {
              tenantId: 'tenant-2',
              token: 'raw-token',
            },
          },
        ]),
      },
      reports: {
        getFailed: jest.fn().mockResolvedValue([
          {
            id: 'job-3',
            name: 'generate-report',
            failedReason: 'Tenant is suspended',
            attemptsMade: 1,
            timestamp: 150,
            data: {
              tenantId: 'tenant-3',
              secret: 'raw-secret',
            },
          },
        ]),
      },
    });

    await expect(service.listFailedJobGroups()).resolves.toEqual([
      expect.objectContaining({
        queueName: 'notifications',
        name: 'send-sms',
        failedReason: 'SMS provider timeout',
        count: 2,
        firstFailedAt: 100,
        latestFailedAt: 200,
        maxAttemptsMade: 4,
        sampleJobIds: ['job-1', 'job-2'],
        affectedTenantIds: ['tenant-1', 'tenant-2'],
        diagnostic: expect.objectContaining({
          category: 'provider',
          retryable: true,
        }),
      }),
      expect.objectContaining({
        queueName: 'reports',
        name: 'generate-report',
        count: 1,
        affectedTenantIds: ['tenant-3'],
        diagnostic: expect.objectContaining({
          category: 'tenant_state',
          retryable: false,
        }),
      }),
    ]);

    const serialized = JSON.stringify(await service.listFailedJobGroups());
    expect(serialized).not.toContain('raw-api-key');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).not.toContain('raw-secret');
    expect(serialized).not.toContain('9800000000');
  });

  it('audits failed-job discard with the required reason', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const job = {
      id: 'job-1',
      name: 'generate-report',
      isFailed: jest.fn().mockResolvedValue(true),
      remove,
    };

    const { service } = buildService({
      reports: {
        getJob: jest.fn().mockResolvedValue(job),
      },
    });

    await expect(
      service.removeJob(
        'reports',
        'job-1',
        { reason: 'Report payload obsolete after tenant fix' },
        'platform-user-1',
      ),
    ).resolves.toEqual({ success: true });

    expect(remove).toHaveBeenCalledTimes(1);
    expect(job.isFailed).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'queue_job_removed',
        resource: 'queues',
        resourceId: 'reports:job-1',
        tenantId: 'platform',
        userId: 'platform-user-1',
        before: expect.objectContaining({
          queueName: 'reports',
          jobId: 'job-1',
          name: 'generate-report',
        }),
        after: expect.objectContaining({
          removed: true,
          reason: 'Report payload obsolete after tenant fix',
        }),
      }),
    );
  });

  it('does not discard jobs that already moved out of the failed state', async () => {
    const remove = jest.fn();
    const job = {
      id: 'job-1',
      name: 'generate-report',
      isFailed: jest.fn().mockResolvedValue(false),
      remove,
    };

    const { service } = buildService({
      reports: {
        getJob: jest.fn().mockResolvedValue(job),
      },
    });

    await expect(
      service.removeJob(
        'reports',
        'job-1',
        { reason: 'Report payload obsolete after tenant fix' },
        'platform-user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(remove).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('audits successful failed-job retry requests with the required reason', async () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    const job = {
      id: 'job-1',
      failedReason: 'Timeout',
      attemptsMade: 3,
      isFailed: jest.fn().mockResolvedValue(true),
      retry,
    };

    const { service } = buildService({
      notifications: {
        getJob: jest.fn().mockResolvedValue(job),
      },
    });

    await expect(
      service.retryFailedJob(
        {
          queueName: 'notifications',
          jobId: 'job-1',
          reason: 'Retry after provider outage',
        },
        'platform-user-1',
      ),
    ).resolves.toEqual({
      success: true,
      queueName: 'notifications',
      jobId: 'job-1',
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'queue_failed_job_retry_requested',
        resource: 'queues',
        resourceId: 'notifications:job-1',
        tenantId: 'platform',
        userId: 'platform-user-1',
        before: expect.objectContaining({
          queueName: 'notifications',
          jobId: 'job-1',
          failedReason: 'Timeout',
          attemptsMade: 3,
        }),
        after: expect.objectContaining({
          retryRequested: true,
          reason: 'Retry after provider outage',
        }),
      }),
    );
  });

  it('returns a bounded idempotency error when a failed job cannot be retried after state changes', async () => {
    const retry = jest.fn().mockRejectedValue(new Error('Job is not failed'));
    const job = {
      id: 'job-1',
      failedReason: 'Timeout',
      attemptsMade: 3,
      isFailed: jest.fn().mockResolvedValue(true),
      retry,
    };

    const { service } = buildService({
      notifications: {
        getJob: jest.fn().mockResolvedValue(job),
      },
    });

    await expect(
      service.retryFailedJob(
        {
          queueName: 'notifications',
          jobId: 'job-1',
          reason: 'Retry after provider outage',
        },
        'platform-user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('returns failed job detail with sanitized payload, stacktrace, timings, and retry audit history', async () => {
    const job = {
      id: 'job-1',
      name: 'send-provider-message',
      failedReason: 'Provider rejected request',
      attemptsMade: 4,
      timestamp: 100,
      processedOn: 110,
      finishedOn: 120,
      stacktrace: ['Error: rejected'],
      data: {
        tenantId: 'tenant-1',
        apiToken: 'raw-token',
        nested: { password: 'raw-password', body: 'Hello' },
      },
    };

    const { service } = buildService({
      notifications: {
        getJob: jest.fn().mockResolvedValue(job),
      },
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        userId: 'platform-user-1',
        before: { attemptsMade: 4 },
        after: { reason: 'Retry after provider outage' },
        createdAt: new Date('2026-05-17T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.getJobDetail('notifications', 'job-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'job-1',
        queueName: 'notifications',
        processedOn: 110,
        finishedOn: 120,
        stacktrace: ['Error: rejected'],
        data: {
          tenantId: 'tenant-1',
          apiToken: '********',
          nested: { password: '********', body: 'Hello' },
        },
        retryHistory: [
          {
            id: 'audit-1',
            userId: 'platform-user-1',
            reason: 'Retry after provider outage',
            attemptsMade: 4,
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'platform',
          resource: 'queues',
          resourceId: 'notifications:job-1',
          action: 'queue_failed_job_retry_requested',
        }),
        take: 10,
      }),
    );
  });

  it('rejects retry for unknown queues and non-failed jobs', async () => {
    const { service } = buildService({
      notifications: {
        getJob: jest.fn().mockResolvedValue({
          isFailed: jest.fn().mockResolvedValue(false),
        }),
      },
    });

    await expect(
      service.retryFailedJob(
        {
          queueName: 'missing-queue',
          jobId: 'job-1',
          reason: 'Manual retry request',
        },
        'platform-user-1',
      ),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.retryFailedJob(
        {
          queueName: 'notifications',
          jobId: 'job-1',
          reason: 'Manual retry request',
        },
        'platform-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
