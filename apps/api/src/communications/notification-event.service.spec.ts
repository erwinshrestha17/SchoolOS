import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationEventService } from './notification-event.service';

describe('NotificationEventService', () => {
  const originalKnownError = Prisma.PrismaClientKnownRequestError;
  beforeAll(() => {
    // The unit-test Prisma adapter omits this runtime constructor. Supply it
    // locally so the production instanceof branch is exercised, not skipped.
    Object.defineProperty(Prisma, 'PrismaClientKnownRequestError', {
      configurable: true,
      value: class extends Error {
        readonly code: string;
        constructor(message: string, options: { code: string }) {
          super(message);
          this.code = options.code;
        }
      },
    });
  });
  afterAll(() => {
    Object.defineProperty(Prisma, 'PrismaClientKnownRequestError', {
      configurable: true,
      value: originalKnownError,
    });
  });
  let prisma: any;
  let plansService: any;
  let auditService: any;
  let service: NotificationEventService;

  beforeEach(() => {
    prisma = {
      notificationEvent: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
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
      admissionApplication: { findFirst: jest.fn() },
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

  it.each([
    { type: 'STUDENT_ADMITTED' },
    { sourceEntityId: 'another-notice' },
    { tenantId: 'another-tenant' },
  ])(
    'rejects a reused event key with different identity: %j',
    async (change) => {
      const input = {
        tenantId: 'tenant-1',
        type: 'NOTICE_PUBLISHED',
        sourceEntityId: 'notice-1',
        idempotencyKey: 'notice:notice-1:published',
      };
      for (const concurrent of [false, true]) {
        prisma.notificationEvent.findUnique.mockReset();
        prisma.notificationEvent.create.mockReset();
        const existing = { id: 'event-1', ...input, ...change };
        if (concurrent) {
          prisma.notificationEvent.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existing);
          prisma.notificationEvent.create.mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError('synthetic collision', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          );
        } else {
          prisma.notificationEvent.findUnique.mockResolvedValueOnce(existing);
        }
        await expect(service.accept(input)).rejects.toThrow(
          'different source event',
        );
        expect(auditService.record).not.toHaveBeenCalled();
        expect(prisma.notificationEvent.update).not.toHaveBeenCalled();
        if (!concurrent)
          expect(prisma.notificationEvent.create).not.toHaveBeenCalled();
      }
    },
  );

  it('returns the matching event after a concurrent unique-key collision', async () => {
    const input = {
      tenantId: 'tenant-1',
      type: 'NOTICE_PUBLISHED',
      sourceEntityId: 'notice-1',
      idempotencyKey: 'same-key',
    };
    const existing = { id: 'event-1', ...input };
    prisma.notificationEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prisma.notificationEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('synthetic collision', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.accept(input)).resolves.toEqual(existing);
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it.each(['DISPATCHED', 'CANCELLED'])(
    'preserves terminal %s against late success and failure',
    async (status) => {
      const event = {
        id: 'event-1',
        tenantId: 'tenant-1',
        status,
        dispatchedAt: new Date('2026-01-01'),
      };
      prisma.notificationEvent.updateMany.mockImplementation(
        async ({ where, data }) => {
          if (
            where.tenantId === event.tenantId &&
            where.id === event.id &&
            where.status.in.includes(event.status)
          ) {
            Object.assign(event, data);
            return { count: 1 };
          }
          return { count: 0 };
        },
      );
      prisma.notificationEvent.findFirst.mockResolvedValue(event);
      await expect(
        service.markFailed('tenant-1', 'event-1', 'LATE_FAILURE'),
      ).resolves.toMatchObject({ status });
      await expect(
        service.markDispatched('tenant-1', 'event-1'),
      ).resolves.toMatchObject({
        status,
        dispatchedAt: new Date('2026-01-01'),
      });
      expect(prisma.notificationEvent.update).not.toHaveBeenCalled();
    },
  );

  it('allows successful recovery from FAILED and prevents a later failure downgrade', async () => {
    const event = {
      id: 'event-1',
      tenantId: 'tenant-1',
      status: 'FAILED',
      failureCode: 'INTAKE_FAILED',
    };
    prisma.notificationEvent.updateMany.mockImplementation(
      async ({ where, data }) => {
        if (where.status.in.includes(event.status)) {
          Object.assign(event, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    );
    prisma.notificationEvent.findFirst.mockResolvedValue(event);
    await expect(
      service.markDispatched('tenant-1', 'event-1'),
    ).resolves.toMatchObject({ status: 'DISPATCHED', failureCode: null });
    await expect(
      service.markFailed('tenant-1', 'event-1', 'LATE_FAILURE'),
    ).resolves.toMatchObject({ status: 'DISPATCHED', failureCode: null });
  });

  it('does not update an event in another tenant', async () => {
    prisma.notificationEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.notificationEvent.findFirst.mockResolvedValue(null);
    await expect(
      service.markFailed('other-tenant', 'event-1', 'FAILED'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notificationEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'event-1',
          tenantId: 'other-tenant',
        }),
      }),
    );
    expect(prisma.notificationEvent.findFirst).toHaveBeenCalledWith({
      where: { id: 'event-1', tenantId: 'other-tenant' },
    });
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

  it('accepts a current tenant-scoped admission document reminder source', async () => {
    const sourceUpdatedAt = '2026-07-20T04:00:00.000Z';
    prisma.admissionApplication.findFirst.mockResolvedValueOnce({
      updatedAt: new Date(sourceUpdatedAt),
    });

    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'ADMISSION_DOCUMENTS_REQUESTED',
        sourceEntityId: 'admission-case-1',
        actorId: 'admin-1',
        idempotencyKey:
          'admission-document-request:admission-case-1:2026-07-20',
        metadata: {
          sourceUpdatedAt,
          missingDocumentCount: 2,
          schoolDay: '2026-07-20',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        type: 'ADMISSION_DOCUMENTS_REQUESTED',
        sourceModule: 'M1_ADMISSIONS',
        sourceEntityType: 'admission_case',
      }),
    );
    expect(prisma.admissionApplication.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'admission-case-1',
        tenantId: 'tenant-1',
        status: { notIn: ['NOT_ADMITTED', 'REJECTED', 'CLOSED'] },
        guardianPhone: { not: null },
      },
      select: { updatedAt: true },
    });
  });

  it('rejects a stale or cross-tenant admission document reminder source', async () => {
    prisma.admissionApplication.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'ADMISSION_DOCUMENTS_REQUESTED',
        sourceEntityId: 'other-tenant-case',
        idempotencyKey:
          'admission-document-request:other-tenant-case:2026-07-20',
        metadata: {
          sourceUpdatedAt: '2026-07-20T04:00:00.000Z',
          missingDocumentCount: 1,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.notificationEvent.create).not.toHaveBeenCalled();
  });

  it('accepts verified-absence events at CRITICAL and allows unauthorized departure status', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValueOnce({ id: 'record-1' });

    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'ATTENDANCE_STUDENT_ABSENT',
        sourceEntityId: 'record-1',
        actorId: 'admin-1',
        idempotencyKey: 'attendance:session-1:student-1:absent',
        metadata: {
          attendanceSessionId: 'session-1',
          studentId: 'student-1',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        type: 'ATTENDANCE_STUDENT_ABSENT',
        priority: 'CRITICAL',
      }),
    );
    expect(prisma.attendanceRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ['ABSENT', 'UNAUTHORIZED_DEPARTURE'],
          },
        }),
      }),
    );
  });

  it('accepts leave events that use early authorized departure', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValueOnce({ id: 'record-2' });

    await expect(
      service.accept({
        tenantId: 'tenant-1',
        type: 'ATTENDANCE_STUDENT_LEAVE',
        sourceEntityId: 'record-2',
        actorId: 'admin-1',
        idempotencyKey: 'attendance:session-1:student-1:leave',
        metadata: {
          attendanceSessionId: 'session-1',
          studentId: 'student-1',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        type: 'ATTENDANCE_STUDENT_LEAVE',
      }),
    );
    expect(prisma.attendanceRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: expect.arrayContaining(['EARLY_AUTHORIZED_DEPARTURE']),
          },
        }),
      }),
    );
  });
});
