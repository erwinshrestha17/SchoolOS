import { NotificationStatus } from '@prisma/client';
import { NotificationsProcessor } from './notifications.processor';

describe('NotificationsProcessor', () => {
  const originalEmailMode = process.env.EMAIL_DELIVERY_MODE;
  const originalEmailWebhookUrl = process.env.EMAIL_WEBHOOK_URL;

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
  });

  it('marks queued delivery rows as sent after provider processing succeeds', async () => {
    const prisma = {
      notificationDelivery: {
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(prisma as never);

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

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        errorMessage: null,
      },
    });
  });

  it('marks delivery rows as failed when provider processing fails', async () => {
    delete process.env.EMAIL_WEBHOOK_URL;
    process.env.EMAIL_DELIVERY_MODE = 'webhook';

    const prisma = {
      notificationDelivery: {
        update: jest.fn(),
      },
    };
    const processor = new NotificationsProcessor(prisma as never);

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
      'EMAIL_WEBHOOK_URL must be configured when EMAIL_DELIVERY_MODE=webhook',
    );

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-2' },
      data: {
        status: NotificationStatus.FAILED,
        errorMessage:
          'EMAIL_WEBHOOK_URL must be configured when EMAIL_DELIVERY_MODE=webhook',
      },
    });
  });
});
