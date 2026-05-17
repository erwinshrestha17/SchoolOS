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

    const service = new PlatformQueuesService(
      auditService as any,
      prisma as any,
      notificationsQueue as any,
      financeQueue as any,
      payrollQueue as any,
      activityMediaQueue as any,
      homeworkQueue as any,
    );

    return {
      service,
      queues: {
        notificationsQueue,
        financeQueue,
        payrollQueue,
        activityMediaQueue,
        homeworkQueue,
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
      phone: '9800000000',
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
