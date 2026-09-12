import { NotificationStatus } from '@prisma/client';
import { createProcessorClsMock } from '../plans/processor-cls.mock';
import { NotificationsProcessor } from './notifications.processor';

describe('NotificationsProcessor', () => {
  const originalEmailMode = process.env.EMAIL_DELIVERY_MODE;
  const originalEmailWebhookUrl = process.env.EMAIL_WEBHOOK_URL;
  const originalNotificationMode =
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
  const originalPushMode = process.env.PUSH_PROVIDER_MODE;
  const originalPushReady = process.env.PUSH_PROVIDER_READY;
  const originalFetch = global.fetch;

  const permittedPlans = () => ({
    shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    checkFeatureEnabled: jest.fn().mockResolvedValue({ allowed: true }),
  });

  const immediatePolicy = () => ({
    evaluateDelivery: jest.fn().mockResolvedValue({ action: 'IMMEDIATE' }),
  });

  const currentDelivery = (id: string) => ({
    findFirst: jest.fn().mockResolvedValue({
      id,
      retryCount: 0,
      status: NotificationStatus.QUEUED,
    }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  });

  const attemptWhere = (id: string, retryCount = 0) => ({
    id,
    tenantId: 'tenant-1',
    retryCount,
    status: {
      in: [
        NotificationStatus.QUEUED,
        NotificationStatus.RETRY_PENDING,
        NotificationStatus.FAILED,
      ],
    },
  });

  afterEach(() => {
    if (originalEmailMode === undefined) {
      delete process.env.EMAIL_DELIVERY_MODE;
    } else {
      process.env.EMAIL_DELIVERY_MODE = originalEmailMode;
    }

    if (originalEmailWebhookUrl === undefined) {
      delete process.env.EMAIL_WEBHOOK_URL;
    } else {
      process.env.EMAIL_WEBHOOK_URL = originalEmailWebhookUrl;
    }

    if (originalNotificationMode === undefined) {
      delete process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
    } else {
      process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE =
        originalNotificationMode;
    }
    if (originalPushReady === undefined) {
      delete process.env.PUSH_PROVIDER_READY;
    } else {
      process.env.PUSH_PROVIDER_READY = originalPushReady;
    }
    if (originalPushMode === undefined) {
      delete process.env.PUSH_PROVIDER_MODE;
    } else {
      process.env.PUSH_PROVIDER_MODE = originalPushMode;
    }

    global.fetch = originalFetch;
  });

  it('keeps dev-log delivery metadata-only for email, SMS, and push', async () => {
    const processor = new NotificationsProcessor(
      {} as never,
      {} as never,
      createProcessorClsMock() as never,
    );
    const log = jest.fn();
    (processor as any).logger.log = log;
    const deliveryId = 'delivery-safe-log';

    await (processor as any).deliverWithProvider(
      {
        mode: 'dev-log',
        channel: 'email',
        providerName: null,
        webhookUrl: null,
        headers: {},
      },
      {
        to: 'guardian.private@school.test',
        subject: 'Private fee subject',
        text: 'Private receipt and student details',
        html: '<p>Private receipt and student details</p>',
        metadata: { notificationDeliveryId: deliveryId },
      },
    );
    await (processor as any).deliverWithProvider(
      {
        mode: 'dev-log',
        channel: 'sms',
        providerName: null,
        webhookUrl: null,
        headers: {},
      },
      {
        to: '+9779800000000',
        message: 'Private attendance details',
        metadata: { notificationDeliveryId: deliveryId },
      },
    );
    await (processor as any).deliverWithProvider(
      {
        mode: 'dev-log',
        channel: 'push',
        providerName: null,
        webhookUrl: null,
        headers: {},
      },
      {
        tokens: ['private-device-token'],
        data: {
          notificationId: deliveryId,
          childId: 'student-private',
          route: '/parent/children/student-private/attendance',
        },
      },
    );

    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain(deliveryId);
    expect(output).toContain('"recipientCount":1');
    expect(output).toContain('"tokenCount":1');
    expect(output).not.toMatch(
      /guardian\.private|9800000000|Private fee|Private receipt|Private attendance|private-device-token|student-private|\/parent\/children/,
    );
  });

  it('re-evaluates preferences at execution and skips an inactive recipient', async () => {
    const prisma = {
      notificationDelivery: currentDelivery('delivery-1'),
    };
    const policy = {
      evaluateDelivery: jest.fn().mockResolvedValue({
        action: 'SKIP',
        reason: 'Recipient is no longer active',
        mandatory: false,
      }),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      policy as never,
    );

    await processor.process({
      name: 'sendEmail',
      data: {
        to: 'recipient@school.test',
        subject: 'Notice',
        text: 'Open SchoolOS.',
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-1',
        },
      },
    } as never);

    expect(policy.evaluateDelivery).toHaveBeenCalledWith(
      'tenant-1',
      'delivery-1',
    );
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: attemptWhere('delivery-1'),
        data: expect.objectContaining({ status: NotificationStatus.SKIPPED }),
      }),
    );
  });

  it('moves a quiet-hours job to the policy resume time', async () => {
    const prisma = {
      notificationDelivery: currentDelivery('delivery-1'),
    };
    const resumeAt = new Date('2026-07-16T00:15:00.000Z');
    const policy = {
      evaluateDelivery: jest.fn().mockResolvedValue({
        action: 'DELAY',
        reason: 'Recipient is currently in quiet hours',
        resumeAt,
        mandatory: false,
      }),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      policy as never,
    );
    const job = {
      name: 'sendEmail',
      token: 'worker-token',
      moveToDelayed: jest.fn().mockResolvedValue(undefined),
      data: {
        to: 'recipient@school.test',
        subject: 'Notice',
        text: 'Open SchoolOS.',
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-1',
        },
      },
    };

    await expect(processor.process(job as never)).rejects.toThrow();
    expect(job.moveToDelayed).toHaveBeenCalledWith(
      resumeAt.getTime(),
      'worker-token',
    );
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: attemptWhere('delivery-1'),
        data: expect.objectContaining({
          status: NotificationStatus.RETRY_PENDING,
        }),
      }),
    );
  });

  it('sends a generic push payload to registered device tokens through the configured provider', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
    process.env.PUSH_PROVIDER_MODE = 'configured-provider';
    process.env.PUSH_PROVIDER_READY = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('push-provider-msg-1'),
      },
    }) as never;

    const prisma = {
      providerConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'provider-1',
          type: 'FCM',
          name: 'fcm-webhook',
          enabled: true,
          configEncrypted: {
            webhookUrl: 'https://provider.example.com/push',
          },
          secretKeys: [],
        }),
      },
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'delivery-1',
          retryCount: 0,
          status: NotificationStatus.QUEUED,
          sourceType: 'attendance_absent',
          sourceId: 'attendance:session-1:student-1:absent',
          studentId: 'student-1',
          recipientUserId: 'guardian-user-1',
          recipientUser: {
            userRoles: [{ role: { name: 'parent' } }],
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      {
        listActiveTokens: jest
          .fn()
          .mockResolvedValue(['registered-device-token']),
      } as never,
      immediatePolicy() as never,
    );

    await processor.process({
      name: 'sendPushNotification',
      data: {
        title: 'Attendance alert',
        body: 'Your child was marked absent today.',
        audience: 'guardian-user-1',
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-1',
          sourceType: 'attendance_absent',
          sourceId: 'attendance:session-1:student-1:absent',
        },
      },
    } as never);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://provider.example.com/push',
      expect.objectContaining({
        body: expect.not.stringContaining(
          'Your child was marked absent today.',
        ),
      }),
    );
    const pushRequest = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(pushRequest.payload).toEqual({
      tokens: ['registered-device-token'],
      notification: {
        title: 'SchoolOS notification',
        body: 'Open SchoolOS to view this update.',
      },
      data: {
        notificationId: 'delivery-1',
        tenantId: 'tenant-1',
        route: '/parent/children/student-1/attendance',
        childId: 'student-1',
      },
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-1'),
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: 'push-provider-msg-1',
        errorMessage: null,
        failureReason: null,
        failureCode: null,
      },
    });
  });

  it('skips configured push dispatch when provider readiness is not proven', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
    process.env.PUSH_PROVIDER_MODE = 'configured-provider';
    delete process.env.PUSH_PROVIDER_READY;
    global.fetch = jest.fn();

    const prisma = {
      providerConfig: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'delivery-not-ready',
          retryCount: 0,
          status: NotificationStatus.QUEUED,
          sourceType: 'result_published',
          sourceId: 'report-card-1',
          studentId: 'student-1',
          recipientUserId: 'guardian-user-1',
          recipientUser: {
            userRoles: [{ role: { name: 'parent' } }],
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      {
        listActiveTokens: jest
          .fn()
          .mockResolvedValue(['registered-device-token']),
      } as never,
      immediatePolicy() as never,
    );

    await processor.process({
      name: 'sendPushNotification',
      data: {
        title: 'Results published',
        body: 'A result is ready.',
        audience: 'guardian-user-1',
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-not-ready',
        },
      },
    } as never);

    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-not-ready'),
      data: {
        status: NotificationStatus.SKIPPED,
        sentAt: undefined,
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: undefined,
        errorMessage: 'push provider is not ready',
        failureReason: 'push provider is not ready',
        failureCode: null,
      },
    });
  });

  it('marks delivery rows as failed when provider processing fails', async () => {
    delete process.env.EMAIL_WEBHOOK_URL;
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';

    const prisma = {
      providerConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'provider-1',
          type: 'EMAIL',
          name: 'generic-email',
          enabled: true,
          configEncrypted: {},
          secretKeys: [],
        }),
      },
      notificationDelivery: currentDelivery('delivery-2'),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      immediatePolicy() as never,
    );

    await expect(
      processor.process({
        name: 'sendEmail',
        data: {
          to: 'guardian@school.test',
          subject: 'Fee receipt ready',
          text: 'Receipt REC-2026-00001 is ready.',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-2',
            sourceType: 'fee_payment_confirmed',
            sourceId: 'fee-payment:payment-1:confirmed',
          },
        },
      } as never),
    ).rejects.toThrow(
      'email provider is configured-provider but no webhookUrl is configured',
    );

    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-2'),
      data: {
        status: NotificationStatus.FAILED,
        sentAt: undefined,
        deliveredAt: undefined,
        failedAt: expect.any(Date),
        providerMessageId: undefined,
        errorMessage:
          'email provider is configured-provider but no webhookUrl is configured',
        failureReason:
          'email provider is configured-provider but no webhookUrl is configured',
        failureCode: 'DELIVERY_JOB_FAILED',
      },
    });
  });

  it('rejects an existing provider record that targets a private network', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
    global.fetch = jest.fn();
    const prisma = {
      providerConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'provider-private',
          type: 'EMAIL',
          name: 'unsafe-email',
          enabled: true,
          configEncrypted: {
            webhookUrl: 'https://127.0.0.1/internal-provider',
          },
          secretKeys: [],
        }),
      },
      notificationDelivery: currentDelivery('delivery-private-provider'),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      immediatePolicy() as never,
    );

    await expect(
      processor.process({
        name: 'sendEmail',
        data: {
          to: 'guardian@school.test',
          subject: 'Notice',
          text: 'Open SchoolOS.',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-private-provider',
          },
        },
      } as never),
    ).rejects.toThrow('email provider webhook URL must be a public HTTPS URL');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: attemptWhere('delivery-private-provider'),
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
        }),
      }),
    );
  });

  it('marks delivery rows as skipped in disabled provider mode', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'disabled';

    const prisma = {
      providerConfig: {
        findFirst: jest.fn(),
      },
      notificationDelivery: currentDelivery('delivery-3'),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      immediatePolicy() as never,
    );

    await processor.process({
      name: 'sendSms',
      data: {
        to: '+9779800000000',
        message: 'School closed today.',
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-3',
          sourceType: 'notice',
          sourceId: 'notice-1',
        },
      },
    } as never);

    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-3'),
      data: {
        status: NotificationStatus.SKIPPED,
        sentAt: undefined,
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: undefined,
        errorMessage: 'sms provider disabled by configuration',
        failureReason: 'sms provider disabled by configuration',
        failureCode: null,
      },
    });
  });

  it('uses the configured provider adapter boundary with a mocked generic webhook', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('provider-msg-1'),
      },
    }) as never;

    const prisma = {
      providerConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'provider-1',
          type: 'EMAIL',
          name: 'generic-email',
          enabled: true,
          configEncrypted: {
            webhookUrl: 'https://provider.example.com/email',
            apiToken: 'test-token',
          },
          secretKeys: ['apiToken'],
        }),
      },
      notificationDelivery: currentDelivery('delivery-4'),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      immediatePolicy() as never,
    );

    await processor.process({
      name: 'sendEmail',
      data: {
        to: 'guardian@school.test',
        subject: 'Notice',
        text: 'Read this notice',
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-4',
          sourceType: 'notice',
          sourceId: 'notice-1',
        },
      },
    } as never);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://provider.example.com/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-4'),
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: 'provider-msg-1',
        errorMessage: null,
        failureReason: null,
        failureCode: null,
      },
    });
  });

  it.each([
    NotificationStatus.QUEUED,
    NotificationStatus.RETRY_PENDING,
    NotificationStatus.FAILED,
  ])('processes the current attempt from %s', async (status) => {
    const prisma = {
      notificationDelivery: currentDelivery('delivery-current'),
    };
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-current',
      retryCount: 2,
      status,
    });
    const policy = immediatePolicy();
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      policy as never,
    );

    await processor.process({
      name: 'releaseInAppNotification',
      data: {
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-current',
          deliveryAttempt: '2',
        },
      },
    } as never);

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith({
      where: { id: 'delivery-current', tenantId: 'tenant-1' },
      select: { id: true, retryCount: true, status: true },
    });
    expect(policy.evaluateDelivery).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-current', 2),
      data: expect.objectContaining({ status: NotificationStatus.SENT }),
    });
  });

  it.each([
    'sendEmail',
    'sendSms',
    'sendPushNotification',
    'releaseInAppNotification',
  ])(
    'skips an obsolete %s attempt before policy or provider dispatch',
    async (name) => {
      const prisma = {
        providerConfig: { findFirst: jest.fn() },
        notificationDelivery: currentDelivery('delivery-obsolete'),
      };
      prisma.notificationDelivery.findFirst.mockResolvedValue({
        id: 'delivery-obsolete',
        retryCount: 2,
        status: NotificationStatus.QUEUED,
      });
      const policy = { evaluateDelivery: jest.fn() };
      const pushTokens = { listActiveTokens: jest.fn() };
      global.fetch = jest.fn();
      const processor = new NotificationsProcessor(
        prisma as never,
        permittedPlans() as never,
        createProcessorClsMock() as never,
        undefined,
        pushTokens as never,
        policy as never,
      );

      await processor.process({
        name,
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          text: 'Open SchoolOS.',
          message: 'Open SchoolOS.',
          title: 'SchoolOS notification',
          body: 'Open SchoolOS.',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-obsolete',
            deliveryAttempt: '1',
          },
        },
      } as never);

      expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith({
        where: { id: 'delivery-obsolete', tenantId: 'tenant-1' },
        select: { id: true, retryCount: true, status: true },
      });
      expect(policy.evaluateDelivery).not.toHaveBeenCalled();
      expect(pushTokens.listActiveTokens).not.toHaveBeenCalled();
      expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    { label: 'sent', status: NotificationStatus.SENT },
    { label: 'delivered', status: NotificationStatus.DELIVERED },
    { label: 'cancelled', status: NotificationStatus.CANCELLED },
    { label: 'skipped', status: NotificationStatus.SKIPPED },
    { label: 'missing', status: null },
  ])(
    'skips a $label delivery before policy or provider dispatch',
    async ({ status }) => {
      const prisma = {
        providerConfig: { findFirst: jest.fn() },
        notificationDelivery: currentDelivery('delivery-terminal'),
      };
      prisma.notificationDelivery.findFirst.mockResolvedValue(
        status === null
          ? null
          : { id: 'delivery-terminal', retryCount: 0, status },
      );
      const policy = { evaluateDelivery: jest.fn() };
      global.fetch = jest.fn();
      const processor = new NotificationsProcessor(
        prisma as never,
        permittedPlans() as never,
        createProcessorClsMock() as never,
        undefined,
        undefined,
        policy as never,
      );

      await processor.process({
        name: 'sendEmail',
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          text: 'Open SchoolOS.',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-terminal',
            deliveryAttempt: '0',
          },
        },
      } as never);

      expect(policy.evaluateDelivery).not.toHaveBeenCalled();
      expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['', ' 0', '00', '1.0', '1e0', '-1', '9007199254740992'])(
    'skips a noncanonical delivery attempt %j without dispatch or status writes',
    async (deliveryAttempt) => {
      const prisma = {
        providerConfig: { findFirst: jest.fn() },
        notificationDelivery: currentDelivery('delivery-invalid-attempt'),
      };
      const policy = { evaluateDelivery: jest.fn() };
      global.fetch = jest.fn();
      const processor = new NotificationsProcessor(
        prisma as never,
        permittedPlans() as never,
        createProcessorClsMock() as never,
        undefined,
        undefined,
        policy as never,
      );

      await processor.process({
        name: 'sendEmail',
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          text: 'Open SchoolOS.',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-invalid-attempt',
            deliveryAttempt,
          },
        },
      } as never);

      expect(policy.evaluateDelivery).not.toHaveBeenCalled();
      expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    },
  );

  it('does not reinterpret a legacy job as the current retry attempt', async () => {
    const prisma = { notificationDelivery: currentDelivery('delivery-legacy') };
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-legacy',
      retryCount: 1,
      status: NotificationStatus.QUEUED,
    });
    const policy = { evaluateDelivery: jest.fn() };
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      policy as never,
    );

    await processor.process({
      name: 'releaseInAppNotification',
      data: {
        metadata: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-legacy',
        },
      },
    } as never);

    expect(policy.evaluateDelivery).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'newer retry', retryCount: 2, status: NotificationStatus.QUEUED },
    {
      label: 'provider confirmation',
      retryCount: 1,
      status: NotificationStatus.DELIVERED,
    },
  ])(
    'does not overwrite a $label after a delayed provider failure',
    async (newerState) => {
      let stored = {
        id: 'delivery-race',
        tenantId: 'tenant-1',
        retryCount: 1,
        status: NotificationStatus.QUEUED as NotificationStatus,
      };
      const prisma = {
        notificationDelivery: {
          findFirst: jest.fn().mockImplementation(async () => ({ ...stored })),
          updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
            if (
              where.id !== stored.id ||
              where.tenantId !== stored.tenantId ||
              where.retryCount !== stored.retryCount ||
              !where.status.in.includes(stored.status)
            ) {
              return { count: 0 };
            }
            stored = { ...stored, ...data };
            return { count: 1 };
          }),
        },
      };
      const processor = new NotificationsProcessor(
        prisma as never,
        permittedPlans() as never,
        createProcessorClsMock() as never,
        undefined,
        undefined,
        immediatePolicy() as never,
      );
      let enteredProvider!: () => void;
      const providerStarted = new Promise<void>((resolve) => {
        enteredProvider = resolve;
      });
      let rejectProvider!: (reason: Error) => void;
      const providerResult = new Promise<never>((_resolve, reject) => {
        rejectProvider = reject;
      });
      jest
        .spyOn(processor as any, 'handleSendEmail')
        .mockImplementation(async () => {
          enteredProvider();
          return providerResult;
        });
      const processing = processor.process({
        name: 'sendEmail',
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          text: 'Open SchoolOS.',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-race',
            deliveryAttempt: '1',
          },
        },
      } as never);
      const failed = expect(processing).rejects.toThrow('Provider timeout');
      await providerStarted;
      stored = {
        ...stored,
        retryCount: newerState.retryCount,
        status: newerState.status,
      };
      rejectProvider(new Error('Provider timeout'));
      await failed;

      expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
        where: attemptWhere('delivery-race', 1),
        data: expect.objectContaining({ status: NotificationStatus.FAILED }),
      });
      expect(stored).toEqual({
        id: 'delivery-race',
        tenantId: 'tenant-1',
        retryCount: newerState.retryCount,
        status: newerState.status,
      });
    },
  );

  it.each([
    { label: 'disabled', entitlement: { allowed: false } },
    { label: 'missing', entitlement: undefined },
    { label: 'null', entitlement: null },
    { label: 'incomplete', entitlement: {} },
    { label: 'nonboolean', entitlement: { allowed: 'true' } },
  ])(
    'skips delivery when notification entitlement is $label',
    async ({ entitlement }) => {
      const prisma = {
        providerConfig: { findFirst: jest.fn() },
        notificationDelivery: currentDelivery('delivery-entitlement'),
      };
      const plans = permittedPlans();
      plans.checkFeatureEnabled.mockResolvedValue(entitlement);
      const policy = immediatePolicy();
      global.fetch = jest.fn();
      const processor = new NotificationsProcessor(
        prisma as never,
        plans as never,
        createProcessorClsMock() as never,
        undefined,
        undefined,
        policy as never,
      );

      await processor.process({
        name: 'sendEmail',
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-entitlement',
            deliveryAttempt: '0',
          },
        },
      } as never);

      expect(plans.checkFeatureEnabled).toHaveBeenCalledWith(
        'tenant-1',
        'module.notifications',
      );
      expect(policy.evaluateDelivery).not.toHaveBeenCalled();
      expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
        where: attemptWhere('delivery-entitlement'),
        data: expect.objectContaining({
          status: NotificationStatus.SKIPPED,
          errorMessage:
            'Notification delivery is no longer enabled for this school.',
        }),
      });
    },
  );

  it('does not dispatch or rewrite delivery state when entitlement lookup fails', async () => {
    const prisma = {
      providerConfig: { findFirst: jest.fn() },
      notificationDelivery: currentDelivery('delivery-entitlement-error'),
    };
    const plans = permittedPlans();
    plans.checkFeatureEnabled.mockRejectedValue(
      new Error('Entitlement unavailable'),
    );
    const policy = immediatePolicy();
    global.fetch = jest.fn();
    const processor = new NotificationsProcessor(
      prisma as never,
      plans as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      policy as never,
    );

    await expect(
      processor.process({
        name: 'sendEmail',
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-entitlement-error',
          },
        },
      } as never),
    ).rejects.toThrow('Entitlement unavailable');

    expect(policy.evaluateDelivery).not.toHaveBeenCalled();
    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when delivery recipient policy is unavailable', async () => {
    const prisma = {
      providerConfig: { findFirst: jest.fn() },
      notificationDelivery: currentDelivery('delivery-policy-unavailable'),
    };
    global.fetch = jest.fn();
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
    );

    await expect(
      processor.process({
        name: 'sendEmail',
        data: {
          to: 'recipient@school.test',
          subject: 'Notice',
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-policy-unavailable',
          },
        },
      } as never),
    ).rejects.toThrow('Notification delivery policy is unavailable');

    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('rejects unknown job names without recording a sent delivery', async () => {
    const prisma = {
      providerConfig: { findFirst: jest.fn() },
      notificationDelivery: currentDelivery('delivery-unknown-job'),
    };
    global.fetch = jest.fn();
    const processor = new NotificationsProcessor(
      prisma as never,
      permittedPlans() as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      immediatePolicy() as never,
    );

    await expect(
      processor.process({
        name: 'unsupportedNotificationAction',
        data: {
          metadata: {
            tenantId: 'tenant-1',
            notificationDeliveryId: 'delivery-unknown-job',
          },
        },
      } as never),
    ).rejects.toThrow('Unsupported notification job type');

    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: attemptWhere('delivery-unknown-job'),
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        errorMessage: 'Unsupported notification job type',
      }),
    });
  });

  it('preserves auth email jobs without a delivery ID', async () => {
    const prisma = { notificationDelivery: currentDelivery('unused-delivery') };
    const policy = { evaluateDelivery: jest.fn() };
    const plans = permittedPlans();
    const processor = new NotificationsProcessor(
      prisma as never,
      plans as never,
      createProcessorClsMock() as never,
      undefined,
      undefined,
      policy as never,
    );
    const sendEmail = jest
      .spyOn(processor as any, 'handleSendEmail')
      .mockResolvedValue({
        status: NotificationStatus.SENT,
      });
    const data = {
      to: 'recipient@school.test',
      subject: 'Account recovery',
      text: 'Follow your account recovery instructions.',
      metadata: { tenantId: 'tenant-1' },
    };

    await processor.process({ name: 'sendEmail', data } as never);

    expect(sendEmail).toHaveBeenCalledWith(data);
    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(plans.checkFeatureEnabled).not.toHaveBeenCalled();
    expect(policy.evaluateDelivery).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('skips notification jobs for suspended tenants without provider calls', async () => {
    const prisma = {
      providerConfig: {
        findFirst: jest.fn(),
      },
      notificationDelivery: currentDelivery('delivery-suspended'),
    };
    const plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(false),
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      plansService as never,
      createProcessorClsMock() as never,
    );

    await processor.process({
      name: 'sendPushNotification',
      data: {
        title: 'Attendance alert',
        body: 'Your child was marked absent today.',
        audience: 'guardian-user-1',
        metadata: {
          tenantId: 'tenant-suspended',
          notificationDeliveryId: 'delivery-suspended',
        },
      },
    } as never);

    expect(plansService.shouldProcessTenantJob).toHaveBeenCalledWith(
      'tenant-suspended',
    );
    expect(prisma.providerConfig.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });
});
