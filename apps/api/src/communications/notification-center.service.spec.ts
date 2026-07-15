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
        },
      ],
    });
  });
});
