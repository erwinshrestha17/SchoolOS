import {
  AudienceType,
  AuthMethod,
  ConsentType,
  EventType,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { UsageService } from '../usage/usage.service';

describe('CommunicationsService', () => {
  let prisma: any;
  let notificationsService: any;
  let auditService: any;
  let service: CommunicationsService;
  let actor: AuthContext;

  beforeEach(() => {
    prisma = {
      class: {
        findFirst: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
      },
      event: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      notice: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
      },
      notificationDelivery: {
        create: jest.fn((args) =>
          Promise.resolve({
            id: `delivery-${prisma.notificationDelivery.create.mock.calls.length}`,
            createdAt: new Date('2026-04-27T00:00:00.000Z'),
            sentAt: null,
            errorMessage: null,
            ...args.data,
          }),
        ),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      guardian: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      guardianConsent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      communicationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    notificationsService = {
      sendPushNotification: jest.fn(),
      sendSms: jest.fn(),
      sendEmail: jest.fn(),
    };
    auditService = {
      record: jest.fn(),
    };
    actor = {
      userId: 'admin-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'admin@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: ['events:create', 'communications:read_deliveries'],
    };

    service = new CommunicationsService(
      prisma,
      notificationsService,
      auditService,
      {
        verifyLimit: jest.fn().mockResolvedValue(undefined),
        checkLimit: jest.fn().mockResolvedValue(undefined),
        incrementUsage: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
  });

  it('creates event delivery records for the resolved class or section audience', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.event.create.mockResolvedValue({
      id: 'event-1',
      title: 'Parent meeting',
      description: 'Monthly guardian conversation.',
      eventType: EventType.MEETING,
      audienceType: AudienceType.SECTION,
      classId: 'class-1',
      sectionId: 'section-1',
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        userId: null,
        user: null,
        guardianLinks: [
          {
            isPrimary: true,
            guardian: {
              id: 'guardian-1',
              userId: 'guardian-user-1',
              email: 'guardian@school.test',
              primaryPhone: '+9779800000000',
              receivesAlerts: true,
              user: { email: 'guardian-user@school.test' },
            },
          },
        ],
      },
    ]);
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.guardianConsent.findMany.mockResolvedValue([
      {
        id: 'consent-1',
        guardianId: 'guardian-1',
        consentType: ConsentType.MESSAGING,
        granted: true,
        revokedAt: null,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.createEvent(
      {
        title: 'Parent meeting',
        description: 'Monthly guardian conversation.',
        eventType: EventType.MEETING,
        audienceType: AudienceType.SECTION,
        classId: 'class-1',
        sectionId: 'section-1',
        startsAt: '2026-05-01T09:00:00.000Z',
      },
      actor,
    );

    expect(result.id).toBe('event-1');
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          sectionId: 'section-1',
        }),
      }),
    );
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        channel: NotificationChannel.PUSH,
        status: NotificationStatus.QUEUED,
        sourceType: 'event',
        sourceId: 'event-1',
        eventId: 'event-1',
        audienceType: AudienceType.SECTION,
        guardianId: 'guardian-1',
        studentId: 'student-1',
        destination: 'guardian-user-1',
      }),
    });
    expect(notificationsService.sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Parent meeting',
        body: 'Monthly guardian conversation.',
        audience: 'guardian-user-1',
        metadata: expect.objectContaining({
          notificationDeliveryId: 'delivery-1',
          sourceType: 'event',
          sourceId: 'event-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'record',
        resource: 'notification_delivery',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('replays existing delivery records for the same source event without duplicate queues', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { id: 'delivery-1', status: NotificationStatus.QUEUED },
    ]);

    const result = await service.recordDeliveryRecords({
      actor,
      sourceType: 'attendance_absent',
      sourceId: 'attendance:session-1:student-1:absent',
      audienceType: AudienceType.ALL,
      studentIds: ['student-1'],
      title: 'Attendance alert',
      body: 'Your child was marked absent today.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    expect(result).toEqual(
      expect.objectContaining({
        count: 1,
        queuedCount: 1,
        replayed: true,
      }),
    );
    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
    expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
  });

  it('converts fee payment domain events into guardian receipt notifications', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        userId: null,
        user: null,
        guardianLinks: [
          {
            isPrimary: true,
            guardian: {
              id: 'guardian-1',
              userId: 'guardian-user-1',
              email: 'guardian@school.test',
              primaryPhone: '+9779800000000',
              receivesAlerts: true,
              user: { email: 'guardian-user@school.test' },
            },
          },
        ],
      },
    ]);
    prisma.guardianConsent.findMany.mockResolvedValue([
      {
        id: 'consent-1',
        guardianId: 'guardian-1',
        consentType: ConsentType.MESSAGING,
        granted: true,
        revokedAt: null,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    await service.handleFeePaymentConfirmed({
      tenantId: actor.tenantId,
      actor,
      paymentId: 'payment-1',
      invoiceId: 'invoice-1',
      studentId: 'student-1',
      amount: 1200,
      method: 'CASH',
      receiptNumber: 'REC-2025-2026-00001',
    });

    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        sourceType: 'fee_payment_confirmed',
        sourceId: 'fee-payment:payment-1:confirmed',
        studentId: 'student-1',
        guardianId: 'guardian-1',
        status: NotificationStatus.QUEUED,
      }),
    });
    expect(notificationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guardian@school.test',
        subject: 'Fee receipt ready',
      }),
    );
  });

  it('converts admission domain events into consent-aware guardian invitation deliveries', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        userId: null,
        user: null,
        guardianLinks: [
          {
            isPrimary: true,
            guardian: {
              id: 'guardian-1',
              userId: 'guardian-user-1',
              email: 'guardian@school.test',
              primaryPhone: '+9779800000000',
              receivesAlerts: true,
              user: { email: 'guardian-user@school.test' },
            },
          },
        ],
      },
    ]);
    prisma.guardianConsent.findMany.mockResolvedValue([
      {
        id: 'consent-1',
        guardianId: 'guardian-1',
        consentType: ConsentType.MESSAGING,
        granted: true,
        revokedAt: null,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    await service.handleStudentAdmitted({
      tenantId: actor.tenantId,
      actor,
      classId: 'class-1',
      sectionId: 'section-1',
      studentId: 'student-1',
      studentName: 'Aarav Sharma',
    });

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          sectionId: 'section-1',
          id: { in: ['student-1'] },
        }),
      }),
    );
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        sourceType: 'student_admitted',
        sourceId: 'student:student-1:admitted',
        guardianId: 'guardian-1',
        studentId: 'student-1',
        status: NotificationStatus.QUEUED,
      }),
    });
    expect(notificationsService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+9779800000000',
        message: expect.stringContaining('Guardian access is ready'),
      }),
    );
  });

  it('marks provider dispatch failures without breaking delivery creation', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        userId: null,
        user: null,
        guardianLinks: [
          {
            isPrimary: true,
            guardian: {
              id: 'guardian-1',
              userId: 'guardian-user-1',
              email: 'guardian@school.test',
              primaryPhone: '+9779800000000',
              receivesAlerts: true,
              user: { email: 'guardian-user@school.test' },
            },
          },
        ],
      },
    ]);
    prisma.guardianConsent.findMany.mockResolvedValue([
      {
        id: 'consent-1',
        guardianId: 'guardian-1',
        consentType: ConsentType.MESSAGING,
        granted: true,
        revokedAt: null,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
    notificationsService.sendPushNotification.mockRejectedValueOnce(
      new Error('Queue unavailable'),
    );

    const result = await service.recordDeliveryRecords({
      actor,
      sourceType: 'attendance_absent',
      sourceId: 'attendance:session-1:student-1:absent',
      audienceType: AudienceType.ALL,
      studentIds: ['student-1'],
      title: 'Attendance alert',
      body: 'Your child was marked absent today.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    expect(result.count).toBe(1);
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: NotificationStatus.QUEUED,
      }),
    });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: {
        status: NotificationStatus.FAILED,
        errorMessage: 'Queue unavailable',
      },
    });
  });
});
