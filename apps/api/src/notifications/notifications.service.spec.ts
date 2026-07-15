import { Test, TestingModule } from '@nestjs/testing';
import { NotificationChannel } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queueAdd: jest.Mock;
  const originalPushMode = process.env.PUSH_PROVIDER_MODE;
  const originalNotificationMode =
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
  const originalPushEnabled = process.env.PUSH_PROVIDER_ENABLED;
  const originalPushReady = process.env.PUSH_PROVIDER_READY;
  const originalEmailEnabled = process.env.EMAIL_PROVIDER_ENABLED;
  const originalEmailReady = process.env.EMAIL_PROVIDER_READY;

  beforeEach(async () => {
    queueAdd = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getQueueToken('notifications'),
          useValue: {
            add: queueAdd,
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    restoreEnv('PUSH_PROVIDER_MODE', originalPushMode);
    restoreEnv('SCHOOLOS_NOTIFICATION_PROVIDER_MODE', originalNotificationMode);
    restoreEnv('PUSH_PROVIDER_ENABLED', originalPushEnabled);
    restoreEnv('PUSH_PROVIDER_READY', originalPushReady);
    restoreEnv('EMAIL_PROVIDER_ENABLED', originalEmailEnabled);
    restoreEnv('EMAIL_PROVIDER_READY', originalEmailReady);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not claim push delivery readiness in the default dev-log mode', async () => {
    delete process.env.PUSH_PROVIDER_MODE;
    delete process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
    delete process.env.PUSH_PROVIDER_ENABLED;
    delete process.env.PUSH_PROVIDER_READY;

    await expect(
      service.getProviderReadiness(NotificationChannel.PUSH),
    ).resolves.toEqual({
      enabled: false,
      failureCode: 'PROVIDER_NOT_READY',
      failureReason:
        'Push notifications are registered, but this environment is not connected to a delivery provider.',
    });
  });

  it('reports ready only when the configured provider is explicitly enabled and ready', async () => {
    process.env.PUSH_PROVIDER_MODE = 'configured-provider';
    process.env.PUSH_PROVIDER_ENABLED = 'true';
    process.env.PUSH_PROVIDER_READY = 'true';

    await expect(
      service.getProviderReadiness(NotificationChannel.PUSH),
    ).resolves.toEqual({
      enabled: true,
      failureCode: null,
      failureReason: null,
    });
  });

  it('fails closed when an external provider has not been explicitly enabled and verified', async () => {
    delete process.env.EMAIL_PROVIDER_ENABLED;
    delete process.env.EMAIL_PROVIDER_READY;

    await expect(
      service.getProviderReadiness(NotificationChannel.EMAIL),
    ).resolves.toEqual({
      enabled: false,
      failureCode: 'PROVIDER_NOT_READY',
      failureReason: 'Email provider readiness has not been confirmed.',
    });
  });

  it('uses a stable per-delivery attempt job id to suppress duplicate queue jobs', async () => {
    await service.sendEmail({
      to: 'guardian@school.test',
      subject: 'Notice',
      text: 'Please read.',
      metadata: {
        tenantId: 'tenant-1',
        notificationDeliveryId: 'delivery-1',
        deliveryAttempt: '0',
      },
    });

    expect(queueAdd).toHaveBeenCalledWith(
      'sendEmail',
      expect.any(Object),
      expect.objectContaining({
        jobId: 'notification-delivery-1-0',
        attempts: 3,
      }),
    );
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}
