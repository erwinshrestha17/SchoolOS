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
        createMany: jest.fn(),
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
    };
    notificationsService = {
      sendPushNotification: jest.fn(),
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
    );
  });

  it('creates event delivery records for the resolved class or section audience', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({ id: 'section-1' });
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
    prisma.notificationDelivery.createMany.mockResolvedValue({ count: 1 });
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
    expect(prisma.notificationDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: 'tenant-1',
          channel: NotificationChannel.PUSH,
          status: NotificationStatus.SENT,
          sourceType: 'event',
          sourceId: 'event-1',
          eventId: 'event-1',
          audienceType: AudienceType.SECTION,
          guardianId: 'guardian-1',
          studentId: 'student-1',
          destination: 'guardian-user-1',
        }),
      ],
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'record',
        resource: 'notification_delivery',
        tenantId: 'tenant-1',
      }),
    );
  });
});
