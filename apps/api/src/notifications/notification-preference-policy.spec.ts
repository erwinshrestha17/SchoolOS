import {
  NotificationChannel,
  NotificationEventPriority,
  NotificationEventStatus,
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
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'APPLIED',
          guardianPhone: '9800000000',
          updatedAt: new Date('2026-07-20T04:00:00.000Z'),
        }),
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

  it('resets only the current user tenant category and channel override', async () => {
    await expect(
      policy.resetOwnPreference(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
        } as never,
        {
          category: NotificationPreferenceCategory.NOTICE,
          channel: NotificationChannel.PUSH,
        },
      ),
    ).resolves.toEqual({ success: true });

    expect(prisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: NotificationPreferenceCategory.NOTICE,
        channel: NotificationChannel.PUSH,
      },
    });
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

  it('treats emergency notice deliveries as mandatory EMERGENCY category', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce(
      baseDelivery({
        type: 'NOTICE_PUBLISHED',
        sourceType: 'notice_emergency',
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
    expect(prisma.notificationPreference.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId_userId_category_channel: expect.objectContaining({
            category: 'EMERGENCY',
          }),
        }),
      }),
    );
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

  it.each([
    ['missing', null],
    [
      'cross-tenant',
      { ...baseDelivery().notificationEvent, tenantId: 'tenant-2' },
    ],
    [
      'cancelled',
      {
        ...baseDelivery().notificationEvent,
        status: NotificationEventStatus.CANCELLED,
        priority: NotificationEventPriority.MANDATORY,
      },
    ],
  ])(
    'skips a linked %s event before recipient and preference checks',
    async (_, event) => {
      prisma.notificationDelivery.findFirst.mockResolvedValueOnce({
        ...baseDelivery(),
        recipientUser: { status: UserStatus.SUSPENDED },
        notificationEvent: event,
      });

      await expect(
        policy.evaluateDelivery('tenant-1', 'delivery-1'),
      ).resolves.toEqual({
        action: 'SKIP',
        reason: 'Notification event is no longer deliverable',
        mandatory: false,
      });
      expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delivery-1', tenantId: 'tenant-1' },
          select: expect.objectContaining({
            notificationEventId: true,
            notificationEvent: {
              select: expect.objectContaining({ tenantId: true, status: true }),
            },
          }),
        }),
      );
      expect(prisma.studentGuardian.findFirst).not.toHaveBeenCalled();
      expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
      expect(prisma.tenantSetting.findMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    NotificationEventStatus.ACCEPTED,
    NotificationEventStatus.DISPATCHED,
    NotificationEventStatus.FAILED,
  ])('preserves current policy for a same-tenant %s event', async (status) => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce({
      ...baseDelivery(),
      notificationEvent: { ...baseDelivery().notificationEvent, status },
    });

    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T10:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'IMMEDIATE' });
    expect(prisma.studentGuardian.findFirst).toHaveBeenCalled();
    expect(prisma.notificationPreference.findUnique).toHaveBeenCalled();
  });

  it('preserves normal policy for an unlinked legacy delivery', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce({
      ...baseDelivery(),
      notificationEventId: null,
      notificationEvent: null,
    });

    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-15T10:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ action: 'IMMEDIATE' });
  });

  it('skips a cancelled admission event before evaluating its case', async () => {
    const delivery = admissionReminderDelivery();
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce({
      ...delivery,
      notificationEvent: {
        ...delivery.notificationEvent,
        status: NotificationEventStatus.CANCELLED,
      },
    });

    await expect(
      policy.evaluateDelivery('tenant-1', 'delivery-1'),
    ).resolves.toEqual({
      action: 'SKIP',
      reason: 'Notification event is no longer deliverable',
      mandatory: false,
    });
    expect(prisma.admissionApplication.findFirst).not.toHaveBeenCalled();
  });

  it('allows a current admission reminder without requiring a user account', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce(
      admissionReminderDelivery(),
    );

    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-20T05:00:00.000Z'),
      ),
    ).resolves.toEqual({
      action: 'IMMEDIATE',
      reason: 'Current admission case and guardian contact are valid',
      mandatory: false,
    });
  });

  it('skips an admission reminder when the case or guardian contact changed', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce(
      admissionReminderDelivery(),
    );
    prisma.admissionApplication.findFirst.mockResolvedValueOnce({
      status: 'APPLIED',
      guardianPhone: '9811111111',
      updatedAt: new Date('2026-07-20T04:00:00.000Z'),
    });

    await expect(
      policy.evaluateDelivery('tenant-1', 'delivery-1'),
    ).resolves.toEqual({
      action: 'SKIP',
      reason: 'Admission case or guardian contact changed before delivery',
      mandatory: false,
    });
  });

  it('delays a current admission reminder during tenant quiet hours', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce(
      admissionReminderDelivery(),
    );

    await expect(
      policy.evaluateDelivery(
        'tenant-1',
        'delivery-1',
        new Date('2026-07-20T15:00:00.000Z'),
      ),
    ).resolves.toEqual({
      action: 'DELAY',
      reason: 'Recipient is currently in quiet hours',
      resumeAt: new Date('2026-07-21T00:15:00.000Z'),
      mandatory: false,
    });
  });
});

function admissionReminderDelivery() {
  return {
    id: 'delivery-1',
    channel: NotificationChannel.SMS,
    sourceType: 'admission_document_request',
    destination: '9800000000',
    recipientUserId: null,
    guardianId: null,
    studentId: null,
    noticeId: null,
    notificationEventId: 'admission-event-1',
    recipientUser: null,
    notice: null,
    notificationEvent: {
      tenantId: 'tenant-1',
      type: 'ADMISSION_DOCUMENTS_REQUESTED',
      priority: NotificationEventPriority.NORMAL,
      status: 'DISPATCHED',
      sourceEntityId: 'admission-case-1',
      metadata: { sourceUpdatedAt: '2026-07-20T04:00:00.000Z' },
    },
  };
}

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
    destination: null,
    recipientUserId: 'guardian-user-1',
    guardianId: 'guardian-1',
    studentId: 'student-1',
    noticeId: 'notice-1',
    notificationEventId:
      overrides.type === undefined && overrides.sourceType ? null : 'event-1',
    recipientUser: { status: UserStatus.ACTIVE },
    notice: { lifecycleStatus: 'PUBLISHED' },
    notificationEvent:
      overrides.type === undefined && overrides.sourceType
        ? null
        : {
            tenantId: 'tenant-1',
            type: overrides.type ?? 'NOTICE_PUBLISHED',
            priority: overrides.priority ?? NotificationEventPriority.NORMAL,
            status: 'DISPATCHED',
            sourceEntityId: 'notice-1',
            metadata: {},
          },
  };
}
