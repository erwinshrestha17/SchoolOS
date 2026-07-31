import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { NotificationCenterService } from './notification-center.service';

describe('NotificationCenterService', () => {
  const actor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'user@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['notifications:view_own'],
    tenantSlug: 'green-valley',
  };

  it('returns server pagination metadata, category, and a bounded notice deep link', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'delivery-1',
            tenantId: actor.tenantId,
            channel: 'IN_APP',
            status: 'DELIVERED',
            sourceType: 'notice',
            sourceId: 'notice-1',
            audienceType: 'ALL',
            recipientUserId: actor.userId,
            guardianId: null,
            studentId: null,
            noticeId: 'notice-1',
            eventId: 'event-1',
            activityPostId: null,
            title: 'School notice',
            body: 'Review this notice.',
            errorMessage: null,
            sentAt: new Date('2026-07-15T03:00:00.000Z'),
            createdAt: new Date('2026-07-15T02:59:00.000Z'),
            readAt: null,
            eventType: 'NOTICE_PUBLISHED',
            eventPriority: 'NORMAL',
          },
        ])
        .mockResolvedValueOnce([{ count: 1n }])
        .mockResolvedValueOnce([{ count: 51n }]),
    };
    const service = new NotificationCenterService(prisma as never);

    await expect(
      service.getCenter(actor, {
        page: 2,
        limit: 25,
        readStatus: 'UNREAD',
        category: 'NOTICE',
      } as never),
    ).resolves.toMatchObject({
      unreadCount: 1,
      total: 51,
      page: 2,
      limit: 25,
      hasNextPage: true,
      items: [
        {
          id: 'delivery-1',
          category: 'NOTICE',
          isRead: false,
          linkHref: '/dashboard/notices/notice-1',
          priority: 'NORMAL',
          severity: 'INFORMATIONAL',
          deliveryState: 'DELIVERED',
        },
      ],
    });
  });

  it('distinguishes emergency notices from verified-absence urgency', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'delivery-emergency',
            tenantId: actor.tenantId,
            channel: 'PUSH',
            status: 'SENT',
            sourceType: 'notice_emergency',
            sourceId: 'notice-e1',
            audienceType: 'ALL',
            recipientUserId: actor.userId,
            guardianId: null,
            studentId: null,
            noticeId: 'notice-e1',
            eventId: null,
            activityPostId: null,
            title: 'Campus security alert',
            body: 'Follow school instructions immediately.',
            errorMessage: null,
            sentAt: new Date('2026-07-15T03:00:00.000Z'),
            createdAt: new Date('2026-07-15T02:59:00.000Z'),
            readAt: null,
            eventType: 'NOTICE_PUBLISHED',
            eventPriority: 'MANDATORY',
          },
          {
            id: 'delivery-absent',
            tenantId: actor.tenantId,
            channel: 'PUSH',
            status: 'SENT',
            sourceType: 'attendance_absent',
            sourceId: 'attendance:session-1:student-1:absent',
            audienceType: 'SECTION',
            recipientUserId: actor.userId,
            guardianId: 'guardian-1',
            studentId: 'student-1',
            noticeId: null,
            eventId: null,
            activityPostId: null,
            title: 'Verified absence',
            body: 'Your child has a verified absence recorded for today.',
            errorMessage: null,
            sentAt: new Date('2026-07-15T03:05:00.000Z'),
            createdAt: new Date('2026-07-15T03:04:00.000Z'),
            readAt: null,
            eventType: 'ATTENDANCE_STUDENT_ABSENT',
            eventPriority: 'CRITICAL',
          },
        ])
        .mockResolvedValueOnce([{ count: 2n }])
        .mockResolvedValueOnce([{ count: 2n }]),
    };
    const service = new NotificationCenterService(prisma as never);

    const result = await service.getCenter(actor);

    expect(result.items[0]).toMatchObject({
      category: 'EMERGENCY',
      priority: 'MANDATORY',
      severity: 'EMERGENCY',
      deliveryState: 'SENT_TO_PROVIDER',
    });
    expect(result.items[1]).toMatchObject({
      category: 'ATTENDANCE',
      priority: 'CRITICAL',
      severity: 'URGENT',
      deliveryState: 'SENT_TO_PROVIDER',
    });
  });
});
