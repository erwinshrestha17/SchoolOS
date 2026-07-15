import { BadRequestException, ConflictException } from '@nestjs/common';
import { NotificationEventService } from './notification-event.service';

describe('NotificationEventService', () => {
  let prisma: any;
  let plansService: any;
  let auditService: any;
  let service: NotificationEventService;

  beforeEach(() => {
    prisma = {
      notificationEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'notification-event-1',
          status: 'ACCEPTED',
          actorId: data.actorId,
          ...data,
        })),
        update: jest.fn(),
      },
      notice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'notice-1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      student: { findFirst: jest.fn() },
      payment: { findFirst: jest.fn() },
      attendanceRecord: { findFirst: jest.fn() },
    };
    plansService = {
      assertTenantActive: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationEventService(prisma, plansService, auditService);
  });

  it('persists a canonical M15 event once with bounded safe metadata', async () => {
    const input = {
      tenantId: 'tenant-1',
      type: 'NOTICE_PUBLISHED' as const,
      sourceEntityId: 'notice-1',
      actorId: 'admin-1',
      idempotencyKey: 'notice:notice-1:published',
      metadata: { audienceType: 'ALL', priority: 'NORMAL' },
    };

    await expect(service.accept(input)).resolves.toEqual(
      expect.objectContaining({
        type: 'NOTICE_PUBLISHED',
        sourceModule: 'M15_NOTICES',
        sourceEntityType: 'notice',
      }),
    );
    expect(prisma.notice.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'notice-1',
        tenantId: 'tenant-1',
        lifecycleStatus: 'PUBLISHED',
      },
      select: { id: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'notification_event',
        tenantId: 'tenant-1',
      }),
    );

    prisma.notificationEvent.findUnique.mockResolvedValueOnce({
      id: 'notification-event-1',
      ...input,
    });
    await service.accept(input);
    expect(prisma.notificationEvent.create).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown event strings before persistence', async () => {
    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'notice.magic_string',
        sourceEntityId: 'notice-1',
        idempotencyKey: 'unsafe-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.notificationEvent.create).not.toHaveBeenCalled();
  });

  it('rejects secret-like and attachment URL metadata', async () => {
    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'NOTICE_PUBLISHED',
        sourceEntityId: 'notice-1',
        idempotencyKey: 'unsafe-2',
        metadata: { providerPayload: 'private-data' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed when the source notice is not published', async () => {
    prisma.notice.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'NOTICE_PUBLISHED',
        sourceEntityId: 'notice-1',
        idempotencyKey: 'notice:notice-1:published',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('checks suspended tenant state even for an idempotent replay', async () => {
    plansService.assertTenantActive.mockRejectedValueOnce(
      new ConflictException('School access is suspended'),
    );
    prisma.notificationEvent.findUnique.mockResolvedValue({
      id: 'notification-event-1',
    });

    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'NOTICE_PUBLISHED',
        sourceEntityId: 'notice-1',
        idempotencyKey: 'notice:notice-1:published',
      }),
    ).rejects.toThrow('School access is suspended');
  });
});
