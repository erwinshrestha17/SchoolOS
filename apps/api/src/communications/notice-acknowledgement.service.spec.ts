import { NotFoundException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { NoticeAcknowledgementService } from './notice-acknowledgement.service';

describe('NoticeAcknowledgementService', () => {
  const actor: AuthContext = {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-1',
    tenantSlug: 'school-one',
    email: 'parent@school.test',
    roles: ['parent'],
    permissions: ['notices:read'],
    authMethod: AuthMethod.PASSWORD,
  };
  let prisma: any;
  let auditService: any;
  let eventService: any;
  let communicationsService: any;
  let service: NoticeAcknowledgementService;

  beforeEach(() => {
    prisma = {
      notificationDelivery: {
        findFirst: jest.fn().mockResolvedValue({
          guardianId: 'guardian-1',
          studentId: 'student-1',
          notice: { id: 'notice-1' },
        }),
        findMany: jest.fn(),
      },
      studentGuardian: {
        findFirst: jest.fn().mockResolvedValue({ id: 'link-1' }),
      },
      noticeAcknowledgement: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({
          id: 'ack-1',
          tenantId: 'tenant-1',
          noticeId: 'notice-1',
          recipientUserId: actor.userId,
          actorId: actor.userId,
          firstAcknowledgedAt: new Date('2026-07-15T10:00:00.000Z'),
        }),
      },
      notice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'notice-1' }),
      },
      $queryRaw: jest.fn(),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    eventService = {
      accept: jest.fn().mockResolvedValue({ id: 'event-1' }),
      markDispatched: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    communicationsService = {
      recordDeliveryRecords: jest
        .fn()
        .mockResolvedValue({ count: 2, queuedCount: 1, skippedCount: 1 }),
    };
    service = new NoticeAcknowledgementService(
      prisma,
      auditService,
      eventService,
      communicationsService,
    );
  });

  it('records the first acknowledgement separately from read state', async () => {
    await expect(service.acknowledge('notice-1', actor)).resolves.toMatchObject(
      {
        id: 'ack-1',
        firstAcknowledgedAt: new Date('2026-07-15T10:00:00.000Z'),
      },
    );
    expect(prisma.noticeAcknowledgement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actorId: actor.userId,
          recipientUserId: actor.userId,
          guardianId: 'guardian-1',
          studentId: 'student-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'acknowledge' }),
    );
  });

  it('returns the existing acknowledgement on replay without duplication', async () => {
    prisma.noticeAcknowledgement.findUnique.mockResolvedValueOnce({
      id: 'ack-existing',
      firstAcknowledgedAt: new Date('2026-07-15T09:00:00.000Z'),
    });
    await expect(service.acknowledge('notice-1', actor)).resolves.toMatchObject(
      {
        id: 'ack-existing',
      },
    );
    expect(prisma.noticeAcknowledgement.upsert).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('allows a staff recipient only when delivery audience resolution included them', async () => {
    prisma.notificationDelivery.findFirst.mockResolvedValueOnce({
      guardianId: null,
      studentId: null,
      notice: { id: 'notice-1' },
    });
    await expect(service.acknowledge('notice-1', actor)).resolves.toMatchObject(
      {
        id: 'ack-1',
      },
    );
    expect(prisma.studentGuardian.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed when a parent is no longer linked to the targeted child', async () => {
    prisma.studentGuardian.findFirst.mockResolvedValueOnce(null);
    await expect(service.acknowledge('notice-1', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.noticeAcknowledgement.upsert).not.toHaveBeenCalled();
  });

  it('returns canonical pagination metadata for pending or acknowledged reports', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          recipientUserId: actor.userId,
          guardianId: 'guardian-1',
          studentId: 'student-1',
          firstDeliveredAt: new Date('2026-07-15T08:00:00.000Z'),
          acknowledgementId: null,
          firstAcknowledgedAt: null,
        },
      ])
      .mockResolvedValueOnce([{ total: 26n }]);
    await expect(
      service.listRecipients(
        'notice-1',
        { page: 1, limit: 25, status: 'PENDING' },
        actor,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        total: 26,
        page: 1,
        limit: 25,
        hasNextPage: true,
        items: [expect.objectContaining({ acknowledgementId: null })],
      }),
    );
  });

  it('emits a persisted M12 event for pending follow-up recipients', async () => {
    const recipientUserId = '22222222-2222-4222-8222-222222222222';
    prisma.notificationDelivery.findMany.mockResolvedValueOnce([
      { recipientUserId },
    ]);
    await expect(
      service.requestFollowUp(
        'notice-1',
        {
          recipientUserIds: [recipientUserId],
          reason: 'Pilot follow-up requested',
          idempotencyKey: 'follow-up-001',
        },
        actor,
      ),
    ).resolves.toMatchObject({
      eventId: 'event-1',
      recipientCount: 1,
      requested: 1,
      queued: 1,
      skipped: 1,
    });
    expect(eventService.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NOTICE_ACKNOWLEDGEMENT_FOLLOW_UP',
        sourceEntityId: 'notice-1',
      }),
    );
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationEventId: 'event-1',
        recipientUserIds: [recipientUserId],
      }),
    );
  });

  it('marks the persisted event failed when delivery intake fails', async () => {
    const recipientUserId = '22222222-2222-4222-8222-222222222222';
    prisma.notificationDelivery.findMany.mockResolvedValueOnce([
      { recipientUserId },
    ]);
    communicationsService.recordDeliveryRecords.mockRejectedValueOnce(
      new Error('delivery intake failed'),
    );

    await expect(
      service.requestFollowUp(
        'notice-1',
        {
          recipientUserIds: [recipientUserId],
          reason: 'Pilot follow-up requested',
          idempotencyKey: 'follow-up-002',
        },
        actor,
      ),
    ).rejects.toThrow('delivery intake failed');
    expect(eventService.markFailed).toHaveBeenCalledWith(
      actor.tenantId,
      'event-1',
      'DELIVERY_INTAKE_FAILED',
    );
  });
});
