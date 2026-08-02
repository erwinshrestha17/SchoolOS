import { NotificationStatus } from '@prisma/client';
import { createProcessorClsMock } from '../plans/processor-cls.mock';
import { NotificationsProcessor } from './notifications.processor';

describe('NotificationsProcessor', () => {
  const originalEmailMode = process.env.EMAIL_DELIVERY_MODE;
  const originalEmailWebhookUrl = process.env.EMAIL_WEBHOOK_URL;
  const originalNotificationMode =
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
  const originalPushReady = process.env.PUSH_PROVIDER_READY;
  const originalFetch = global.fetch;

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
      notificationDelivery: { update: jest.fn() },
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
      { shouldProcessTenantJob: jest.fn().mockResolvedValue(true) } as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.SKIPPED }),
      }),
    );
  });

  it('moves a quiet-hours job to the policy resume time', async () => {
    const prisma = {
      notificationDelivery: { update: jest.fn() },
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
      { shouldProcessTenantJob: jest.fn().mockResolvedValue(true) } as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.RETRY_PENDING,
        }),
      }),
    );
  });

  it('sends a generic push payload to registered device tokens through the configured provider', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
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
          sourceType: 'attendance_absent',
          sourceId: 'attendance:session-1:student-1:absent',
          studentId: 'student-1',
          recipientUserId: 'guardian-user-1',
          recipientUser: {
            userRoles: [{ role: { name: 'parent' } }],
          },
        }),
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      createProcessorClsMock() as never,
      undefined,
      {
        listActiveTokens: jest
          .fn()
          .mockResolvedValue(['registered-device-token']),
      } as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1', tenantId: 'tenant-1' },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: 'push-provider-msg-1',
        errorMessage: null,
      },
    });
  });

  it('skips configured push dispatch when provider readiness is not proven', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
    delete process.env.PUSH_PROVIDER_READY;
    global.fetch = jest.fn();

    const prisma = {
      providerConfig: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'delivery-not-ready',
          sourceType: 'result_published',
          sourceId: 'report-card-1',
          studentId: 'student-1',
          recipientUserId: 'guardian-user-1',
          recipientUser: {
            userRoles: [{ role: { name: 'parent' } }],
          },
        }),
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      createProcessorClsMock() as never,
      undefined,
      {
        listActiveTokens: jest
          .fn()
          .mockResolvedValue(['registered-device-token']),
      } as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-not-ready', tenantId: 'tenant-1' },
      data: {
        status: NotificationStatus.SKIPPED,
        sentAt: undefined,
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: undefined,
        errorMessage: 'push provider is not ready',
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
      notificationDelivery: {
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      createProcessorClsMock() as never,
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

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-2', tenantId: 'tenant-1' },
      data: {
        status: NotificationStatus.FAILED,
        sentAt: undefined,
        deliveredAt: undefined,
        failedAt: expect.any(Date),
        providerMessageId: undefined,
        errorMessage:
          'email provider is configured-provider but no webhookUrl is configured',
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
      notificationDelivery: {
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      createProcessorClsMock() as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'delivery-private-provider',
          tenantId: 'tenant-1',
        },
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
      notificationDelivery: {
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      createProcessorClsMock() as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-3', tenantId: 'tenant-1' },
      data: {
        status: NotificationStatus.SKIPPED,
        sentAt: undefined,
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: undefined,
        errorMessage: 'sms provider disabled by configuration',
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
      notificationDelivery: {
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(
      prisma as never,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      createProcessorClsMock() as never,
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
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-4', tenantId: 'tenant-1' },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        deliveredAt: undefined,
        failedAt: undefined,
        providerMessageId: 'provider-msg-1',
        errorMessage: null,
      },
    });
  });

  it('skips notification jobs for suspended tenants without provider calls', async () => {
    const prisma = {
      providerConfig: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        update: jest.fn(),
      },
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
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });
});
