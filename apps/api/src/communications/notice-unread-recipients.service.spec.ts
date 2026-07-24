import { NotFoundException } from '@nestjs/common';
import { NoticeUnreadRecipientsService } from './notice-unread-recipients.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
} as any;

function buildService() {
  const prisma = {
    notice: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const service = new NoticeUnreadRecipientsService(prisma as never);
  return { service, prisma };
}

describe('NoticeUnreadRecipientsService', () => {
  it('throws NotFoundException when the notice does not exist in this tenant', async () => {
    const { service, prisma } = buildService();
    prisma.notice.findFirst.mockResolvedValue(null);

    await expect(
      service.getUnreadRecipients('notice-1', actor),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.notice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notice-1', tenantId: actor.tenantId },
      }),
    );
  });

  it('returns the read/unread summary and maps guardian/student recipient rows', async () => {
    const { service, prisma } = buildService();
    prisma.notice.findFirst.mockResolvedValue({ id: 'notice-1' });
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { totalDeliveries: 5n, readCount: 2n, unreadCount: 3n },
      ])
      .mockResolvedValueOnce([
        {
          deliveryId: 'delivery-1',
          channel: 'SMS',
          status: 'SENT',
          destination: '+9779800000000',
          errorMessage: null,
          sentAt: new Date('2026-07-20T10:00:00.000Z'),
          createdAt: new Date('2026-07-20T09:55:00.000Z'),
          recipientUserId: null,
          recipientEmail: null,
          guardianId: 'guardian-1',
          guardianName: 'Ram Guardian',
          guardianPhone: '+9779800000000',
          guardianEmail: 'ram@example.com',
          studentId: 'student-1',
          studentSystemId: 'SCH-2026-0001',
          studentFirstName: 'Sita',
          studentLastName: 'Sharma',
          className: 'Grade 5',
          sectionName: 'A',
        },
        {
          deliveryId: 'delivery-2',
          channel: 'PUSH',
          status: 'FAILED',
          destination: null,
          errorMessage: 'device unregistered',
          sentAt: null,
          createdAt: new Date('2026-07-20T09:50:00.000Z'),
          recipientUserId: 'user-9',
          recipientEmail: 'teacher@example.com',
          guardianId: null,
          guardianName: null,
          guardianPhone: null,
          guardianEmail: null,
          studentId: null,
          studentSystemId: null,
          studentFirstName: null,
          studentLastName: null,
          className: null,
          sectionName: null,
        },
      ]);

    const result = await service.getUnreadRecipients('notice-1', actor, {
      page: 1,
      limit: 25,
    });

    expect(result.totalDeliveries).toBe(5);
    expect(result.readCount).toBe(2);
    expect(result.unreadCount).toBe(3);
    expect(result.total).toBe(3);
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0]).toEqual(
      expect.objectContaining({
        deliveryId: 'delivery-1',
        guardian: {
          id: 'guardian-1',
          fullName: 'Ram Guardian',
          primaryPhone: '+9779800000000',
          email: 'ram@example.com',
        },
        student: {
          id: 'student-1',
          studentSystemId: 'SCH-2026-0001',
          fullName: 'Sita Sharma',
          className: 'Grade 5',
          sectionName: 'A',
        },
      }),
    );
    expect(result.recipients[1]).toEqual(
      expect.objectContaining({
        deliveryId: 'delivery-2',
        guardian: null,
        student: null,
        recipientEmail: 'teacher@example.com',
      }),
    );
  });

  it('clamps page and limit to safe bounds and computes hasNextPage', async () => {
    const { service, prisma } = buildService();
    prisma.notice.findFirst.mockResolvedValue({ id: 'notice-1' });
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { totalDeliveries: 200n, readCount: 0n, unreadCount: 200n },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.getUnreadRecipients('notice-1', actor, {
      page: 0,
      limit: 500,
    });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.hasNextPage).toBe(true);
  });

  it('defaults to page 1 / limit 25 when no query is provided', async () => {
    const { service, prisma } = buildService();
    prisma.notice.findFirst.mockResolvedValue({ id: 'notice-1' });
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { totalDeliveries: 0n, readCount: 0n, unreadCount: 0n },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.getUnreadRecipients('notice-1', actor);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(25);
    expect(result.recipients).toEqual([]);
    expect(result.hasNextPage).toBe(false);
  });
});
