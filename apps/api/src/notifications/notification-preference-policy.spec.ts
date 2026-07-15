import {
  NotificationChannel,
  NotificationEventPriority,
  NotificationPreferenceCategory,
  UserStatus,
} from '@prisma/client';
import { NotificationPreferencePolicy } from './notification-preference-policy';

describe('NotificationPreferencePolicy', () => {
  let prisma: any;
  let policy: NotificationPreferencePolicy;

  beforeEach(() => {
    prisma = {
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue(baseDelivery()),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      tenantSetting: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'quiet_hours_enabled', value: true },
          { key: 'notification_quiet_hours_start', value: '20:00' },
          { key: 'notification_quiet_hours_end', value: '06:00' },
        ]),
      },
      studentGuardian: {
        findFirst: jest.fn().mockResolvedValue({ id: 'link-1' }),
      },
    };
    policy = new NotificationPreferencePolicy(prisma);
  });

  it('delays a normal notification during Nepal quiet hours', async () => {
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T15:00:00.000Z'),
      ),
    ).resolves.toEqual({
      action: 'DELAY',
      reason: 'Recipient is currently in quiet hours',
      resumeAt: new Date('2026-07-16T00:15:00.000Z'),
      mandatory: false,
    });
  });

  it('allows a critical notification during quiet hours', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce(
      baseDelivery({ priority: NotificationEventPriority.CRITICAL }),
    );
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T15:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'IMMEDIATE' });
  });

  it('skips a user-disabled channel', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValueOnce({
      enabled: false,
      quietHoursEnabled: null,
    });
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T10:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'SKIP' });
  });

  it('honors a user quiet-hours override over the tenant default', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValueOnce({
      enabled: true,
      quietHoursEnabled: false,
    });
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T15:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'IMMEDIATE' });
  });

  it('does not let user settings suppress mandatory security delivery', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce(
      baseDelivery({
        type: undefined,
        sourceType: 'security_alert',
        priority: NotificationEventPriority.MANDATORY,
      }),
    );
    prisma.notificationPreference.findUnique.mockResolvedValueOnce({
      enabled: false,
      quietHoursEnabled: true,
    });
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T15:00:00.000Z'),
      ),
    ).resolves.toEqual({
      action: 'IMMEDIATE',
      reason: 'Mandatory security or emergency delivery',
      mandatory: true,
    });
  });

  it('uses the exact Nepal timezone boundary', async () => {
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T14:14:59.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'IMMEDIATE' });
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T14:15:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'DELAY' });
  });

  it('releases a delayed job after quiet hours end', async () => {
    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-16T00:16:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'IMMEDIATE' });
  });

  it('skips a recipient who becomes inactive before execution', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce({
      ...baseDelivery(),
      recipientUser: { status: UserStatus.SUSPENDED },
    });
    await expect(
      policy.evaluateDelivery('tenant-1', 'delivery-1'),
    ).resolves.toEqual({
      action: 'SKIP',
      reason: 'Recipient is no longer active',
      mandatory: false,
    });
  });
});

function baseDelivery(
  overrides: {
    priority?: string;
    type?: string;
    sourceType?: string;
  } = {},
) {
  return {
    id: 'delivery-1',
    channel: NotificationChannel.PUSH,
    sourceType: overrides.sourceType ?? 'notice',
    recipientUserId: 'guardian-user-1',
    guardianId: 'guardian-1',
    studentId: 'student-1',
    noticeId: 'notice-1',
    recipientUser: { status: UserStatus.ACTIVE },
    notice: { lifecycleStatus: 'PUBLISHED' },
    notificationEvent:
      overrides.type === undefined && overrides.sourceType
        ? null
        : {
            type: overrides.type ?? 'NOTICE_PUBLISHED',
            priority: overrides.priority ?? NotificationEventPriority.NORMAL,
            status: 'DISPATCHED',
          },
  };
}
