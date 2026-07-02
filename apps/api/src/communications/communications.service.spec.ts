import {
  AudienceType,
  AuthMethod,
  CommunicationTemplateCategory,
  CommunicationTemplateChannel,
  CommunicationTemplateStatus,
  ConsentType,
  EventType,
  NotificationChannel,
  NotificationStatus,
  NoticePriority,
  ProviderType,
  StudentLifecycleStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { UsageService } from '../usage/usage.service';

describe('CommunicationsService', () => {
  let prisma: any;
  let notificationsService: any;
  let auditService: any;
  let fileRegistryService: any;
  let redisService: any;
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
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
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
        findFirst: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      parentTeacherThread: {
        count: jest.fn().mockResolvedValue(0),
      },
      providerConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      communicationTemplate: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
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
    fileRegistryService = {
      getFileMetadata: jest.fn(),
      getSignedUrl: jest.fn(),
      linkToEntity: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      }),
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
      redisService,
      fileRegistryService,
    );
  });

  it('lists communication templates with tenant-scoped server pagination', async () => {
    prisma.communicationTemplate.findMany.mockResolvedValue([
      { id: 'template-1' },
    ]);
    prisma.communicationTemplate.count.mockResolvedValue(21);

    const result = await service.listCommunicationTemplates(
      { page: 2, limit: 20 },
      actor,
    );

    expect(prisma.communicationTemplate.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: expect.any(Object),
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      skip: 20,
      take: 20,
    });
    expect(prisma.communicationTemplate.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
    });
    expect(result).toEqual({
      items: [{ id: 'template-1' }],
      total: 21,
      page: 2,
      limit: 20,
      hasNextPage: false,
    });
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

  it('previews emergency notice recipients without exposing raw destinations and audits high-impact preview', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
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
      {
        id: 'student-2',
        userId: null,
        user: null,
        guardianLinks: [
          {
            isPrimary: true,
            guardian: {
              id: 'guardian-2',
              userId: 'guardian-user-2',
              email: 'second@school.test',
              primaryPhone: '+9779800000001',
              receivesAlerts: true,
              user: { email: 'second-user@school.test' },
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
      {
        id: 'consent-2',
        guardianId: 'guardian-2',
        consentType: ConsentType.MESSAGING,
        granted: false,
        revokedAt: null,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const preview = await service.previewNoticeRecipients(
      {
        title: 'Emergency closure',
        body: 'School is closed today.',
        priority: NoticePriority.EMERGENCY,
        audienceType: AudienceType.CLASS,
        classId: 'class-1',
      },
      actor,
    );

    expect(preview).toEqual(
      expect.objectContaining({
        priority: NoticePriority.EMERGENCY,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        recipientCount: 2,
        allowedRecipientCount: 1,
        skippedRecipientCount: 1,
        estimatedDeliveryRows: 2,
        sampleRecipients: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            recipientUserId: 'guardian-user-1',
          },
        ],
      }),
    );
    expect(JSON.stringify(preview)).not.toContain('guardian@school.test');
    expect(JSON.stringify(preview)).not.toContain('+9779800000000');
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
    expect(notificationsService.sendSms).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'preview_recipients',
        resource: 'notice',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('limits activity notification delivery resolution to active students only', async () => {
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
        consentType: ConsentType.PHOTO_USAGE,
        granted: true,
        revokedAt: null,
        capturedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    await service.recordDeliveryRecords({
      actor,
      sourceType: 'activity_post',
      sourceId: 'post-1',
      activityPostId: 'post-1',
      audienceType: AudienceType.SECTION,
      classId: 'class-1',
      sectionId: 'section-1',
      title: 'Class activity',
      body: 'Today in class.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.PHOTO_USAGE],
      activeStudentsOnly: true,
    });

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          sectionId: 'section-1',
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityPostId: 'post-1',
        studentId: 'student-1',
        guardianId: 'guardian-1',
        status: NotificationStatus.QUEUED,
      }),
    });
  });

  it('links notice attachments through File Registry and stores protected URLs only', async () => {
    prisma.notice.create.mockResolvedValue({
      id: 'notice-1',
      title: 'Attachment notice',
      body: 'Read the attached circular.',
      priority: NoticePriority.NORMAL,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      attachmentUrl: 'http://localhost:4000/api/v1/files/file-1/preview',
      publishedAt: new Date('2026-05-17T00:00:00.000Z'),
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);
    prisma.guardianConsent.findMany.mockResolvedValue([]);
    prisma.communicationPreference.findMany.mockResolvedValue([]);
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'file-1',
      tenantId: 'tenant-1',
      module: 'notices',
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'http://localhost:4000/api/v1/files/file-1/preview',
    );

    await expect(
      service.createNotice(
        {
          title: 'Attachment notice',
          body: 'Read the attached circular.',
          audienceType: AudienceType.ALL,
          attachmentFileId: 'file-1',
        },
        actor,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        attachmentUrl: 'http://localhost:4000/api/v1/files/file-1/preview',
      }),
    );

    expect(fileRegistryService.getFileMetadata).toHaveBeenCalledWith(
      'tenant-1',
      'file-1',
    );
    expect(fileRegistryService.linkToEntity).toHaveBeenCalledWith(
      'tenant-1',
      'file-1',
      'notices',
      'notice-1',
      'admin-1',
    );
    expect(prisma.notice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentUrl: 'http://localhost:4000/api/v1/files/file-1/preview',
      }),
    });
  });

  it('creates idempotent mobile notice drafts without storing or returning file URLs', async () => {
    prisma.notice.findFirst.mockResolvedValue(null);
    prisma.notice.create.mockResolvedValue({
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Emergency circular',
      body: 'School is closed today.',
      priority: NoticePriority.EMERGENCY,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      attachmentUrl: null,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      scheduledFor: null,
      publishedAt: null,
    });
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'file-1',
      tenantId: 'tenant-1',
      module: 'notices',
    });

    const result = await service.createNoticeDraft(
      {
        title: 'Emergency circular',
        body: 'School is closed today.',
        priority: NoticePriority.EMERGENCY,
        audienceType: AudienceType.ALL,
        attachmentFileId: 'file-1',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      },
      actor,
    );

    expect(result.attachmentUrl).toBeNull();
    expect(fileRegistryService.getSignedUrl).not.toHaveBeenCalled();
    expect(prisma.notice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        attachmentUrl: null,
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        publishedAt: null,
      }),
    });
    expect(fileRegistryService.linkToEntity).toHaveBeenCalledWith(
      'tenant-1',
      'file-1',
      'notices',
      'notice-1',
      'admin-1',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'draft',
        resource: 'notice',
        tenantId: 'tenant-1',
        resourceId: 'notice-1',
      }),
    );
  });

  it('replays the original notice for a duplicate mobile idempotency key', async () => {
    prisma.notice.findFirst.mockResolvedValue({
      id: 'notice-existing',
      tenantId: 'tenant-1',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });

    await expect(
      service.createNoticeDraft(
        {
          title: 'Emergency circular',
          body: 'School is closed today.',
          priority: NoticePriority.EMERGENCY,
          audienceType: AudienceType.ALL,
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        },
        actor,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'notice-existing' }));
    expect(prisma.notice.create).not.toHaveBeenCalled();
  });

  it('does not publish a high-impact notice when delivery providers are disabled', async () => {
    const previous = process.env.NOTIFICATIONS_DISABLED;
    process.env.NOTIFICATIONS_DISABLED = 'disabled';
    prisma.notice.findFirst.mockResolvedValue({
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Emergency circular',
      body: 'School is closed today.',
      priority: NoticePriority.EMERGENCY,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      scheduledFor: null,
      publishedAt: null,
    });

    try {
      await expect(service.publishNotice('notice-1', actor)).rejects.toThrow(
        'No configured delivery channel is currently available',
      );
      expect(prisma.notice.update).not.toHaveBeenCalled();
      expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
      expect(notificationsService.sendSms).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) {
        delete process.env.NOTIFICATIONS_DISABLED;
      } else {
        process.env.NOTIFICATIONS_DISABLED = previous;
      }
    }
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

  it('throws ConflictException if lock acquisition fails and deliveries are not created', async () => {
    redisService.getClient.mockReturnValue({
      set: jest.fn().mockResolvedValue(null),
    });

    prisma.notificationDelivery.findMany.mockResolvedValue([]);

    await expect(
      service.recordDeliveryRecords({
        actor,
        sourceType: 'attendance_absent',
        sourceId: 'attendance:session-1:student-1:absent',
        audienceType: AudienceType.ALL,
        studentIds: ['student-1'],
        title: 'Attendance alert',
        body: 'Your child was marked absent today.',
        channels: [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.MESSAGING],
      }),
    ).rejects.toThrow(
      'Another process is currently recording delivery records for this notification',
    );
  });

  it('polls and returns replayed deliveries if lock acquisition fails but concurrent process finishes', async () => {
    redisService.getClient.mockReturnValue({
      set: jest.fn().mockResolvedValue(null),
    });

    let callCount = 0;
    prisma.notificationDelivery.findMany.mockImplementation(() => {
      callCount++;
      if (callCount > 1) {
        return Promise.resolve([
          { id: 'delivery-1', status: NotificationStatus.QUEUED },
        ]);
      }
      return Promise.resolve([]);
    });

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
  });

  it('summarizes communications from tenant-scoped backend counts', async () => {
    const previousMode = process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'mock';

    try {
      prisma.notificationDelivery.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(7)
        .mockResolvedValue(0);
      prisma.notice.count.mockResolvedValueOnce(3);
      prisma.parentTeacherThread.count.mockResolvedValueOnce(1);

      const summary = await service.getCommunicationsSummary(actor);

      expect(summary).toEqual(
        expect.objectContaining({
          sentToday: 5,
          scheduledNotices: 3,
          failedDeliveries: 2,
          unreadHighImpactNotices: 7,
          escalatedChatCount: 1,
          providerStatus: 'mock',
          providerHealth: 'unavailable',
        }),
      );
      expect(prisma.notice.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          publishedAt: null,
        }),
      });
      expect(prisma.notificationDelivery.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            status: {
              in: [NotificationStatus.FAILED, NotificationStatus.RETRY_PENDING],
            },
          }),
        }),
      );
      expect(prisma.parentTeacherThread.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          status: 'ESCALATED',
        },
      });
    } finally {
      if (previousMode === undefined) {
        delete process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
      } else {
        process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = previousMode;
      }
    }
  });

  it('returns provider diagnostics without leaking secrets or recipient destinations', async () => {
    const previousMode = process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured';

    try {
      prisma.providerConfig.findFirst.mockResolvedValue({
        enabled: true,
        validationStatus: 'READY',
        lastValidatedAt: new Date('2026-06-01T00:00:00.000Z'),
        configEncrypted: {
          callbackSecret: 'secret-callback-token',
          apiKey: 'secret-api-key',
        },
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      });
      prisma.notificationDelivery.count.mockImplementation(({ where }) => {
        if (where.status === NotificationStatus.FAILED) {
          return Promise.resolve(1);
        }
        if (
          where.status?.in?.includes(NotificationStatus.FAILED) &&
          where.status?.in?.includes(NotificationStatus.RETRY_PENDING)
        ) {
          return Promise.resolve(2);
        }
        if (
          where.status?.in?.includes(NotificationStatus.SENT) &&
          where.status?.in?.includes(NotificationStatus.DELIVERED)
        ) {
          return Promise.resolve(4);
        }
        return Promise.resolve(10);
      });
      prisma.notificationDelivery.findFirst.mockResolvedValue({
        sentAt: new Date('2026-06-01T00:00:00.000Z'),
        deliveredAt: null,
        failedAt: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      const diagnostics =
        await service.getCommunicationProviderDiagnostics(actor);
      const serialized = JSON.stringify(diagnostics);

      expect(diagnostics.overallMode).toBe('configured');
      expect(diagnostics.health).toBe('degraded');
      expect(diagnostics.channels).toHaveLength(3);
      expect(diagnostics.channels[0]).toEqual(
        expect.objectContaining({
          mode: 'configured',
          deliveryCount: 10,
          sentCount: 4,
          failedCount: 1,
          retryableCount: 2,
          validationStatus: 'READY',
          callbackStatus: 'recent',
        }),
      );
      expect(serialized).not.toContain('secret-callback-token');
      expect(serialized).not.toContain('secret-api-key');
      expect(serialized).not.toContain('destination');
      expect(prisma.providerConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: ProviderType.EMAIL,
            enabled: true,
          }),
          select: expect.not.objectContaining({
            secretKeys: true,
            name: true,
          }),
        }),
      );
      expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          channel: NotificationChannel.EMAIL,
        },
      });
    } finally {
      if (previousMode === undefined) {
        delete process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE;
      } else {
        process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = previousMode;
      }
    }
  });

  it('creates communication templates as tenant-scoped versioned drafts', async () => {
    prisma.communicationTemplate.aggregate.mockResolvedValue({
      _max: { version: 2 },
    });
    prisma.communicationTemplate.create.mockResolvedValue({
      id: 'template-3',
      tenantId: 'tenant-1',
      key: 'holiday-notice',
      category: CommunicationTemplateCategory.HOLIDAY,
      channel: CommunicationTemplateChannel.IN_APP,
      language: 'en',
      title: 'Holiday notice',
      body: 'School remains closed for the approved holiday.',
      status: CommunicationTemplateStatus.DRAFT,
      version: 3,
      publishedAt: null,
      archivedAt: null,
      createdById: 'admin-1',
      updatedById: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    const template = await service.createCommunicationTemplate(
      {
        key: ' Holiday-Notice ',
        category: CommunicationTemplateCategory.HOLIDAY,
        channel: CommunicationTemplateChannel.IN_APP,
        title: ' Holiday notice ',
        body: ' School remains closed for the approved holiday. ',
      },
      actor,
    );

    expect(template.version).toBe(3);
    expect(prisma.communicationTemplate.aggregate).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        key: 'holiday-notice',
      },
      _max: {
        version: true,
      },
    });
    expect(prisma.communicationTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          key: 'holiday-notice',
          title: 'Holiday notice',
          body: 'School remains closed for the approved holiday.',
          version: 3,
          createdById: 'admin-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'communication_template',
        tenantId: 'tenant-1',
        resourceId: 'template-3',
      }),
    );
  });

  it('rejects communication template edits outside the actor tenant', async () => {
    prisma.communicationTemplate.findFirst.mockResolvedValue(null);

    await expect(
      service.updateCommunicationTemplate(
        'template-foreign',
        { title: 'Updated title' },
        actor,
      ),
    ).rejects.toThrow('Communication template not found in this tenant');

    expect(prisma.communicationTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'template-foreign',
        tenantId: 'tenant-1',
      },
      select: expect.any(Object),
    });
    expect(prisma.communicationTemplate.update).not.toHaveBeenCalled();
  });

  it('requires draft status before editing communication templates', async () => {
    prisma.communicationTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      tenantId: 'tenant-1',
      key: 'holiday-notice',
      category: CommunicationTemplateCategory.HOLIDAY,
      channel: CommunicationTemplateChannel.IN_APP,
      language: 'en',
      title: 'Holiday notice',
      body: 'School remains closed.',
      status: CommunicationTemplateStatus.PUBLISHED,
      version: 1,
      publishedAt: new Date('2026-06-01T00:00:00.000Z'),
      archivedAt: null,
      createdById: 'admin-1',
      updatedById: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    await expect(
      service.updateCommunicationTemplate(
        'template-1',
        { body: 'Updated body' },
        actor,
      ),
    ).rejects.toThrow('Only draft communication templates can be edited');

    expect(prisma.communicationTemplate.update).not.toHaveBeenCalled();
  });

  it('publishes communication templates with tenant-scoped audit state', async () => {
    const current = {
      id: 'template-1',
      tenantId: 'tenant-1',
      key: 'holiday-notice',
      category: CommunicationTemplateCategory.HOLIDAY,
      channel: CommunicationTemplateChannel.IN_APP,
      language: 'en',
      title: 'Holiday notice',
      body: 'School remains closed.',
      status: CommunicationTemplateStatus.DRAFT,
      version: 1,
      publishedAt: null,
      archivedAt: null,
      createdById: 'admin-1',
      updatedById: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    prisma.communicationTemplate.findFirst.mockResolvedValue(current);
    prisma.communicationTemplate.update.mockResolvedValue({
      ...current,
      status: CommunicationTemplateStatus.PUBLISHED,
      publishedAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedById: 'admin-1',
    });

    const template = await service.publishCommunicationTemplate(
      'template-1',
      actor,
    );

    expect(template.status).toBe(CommunicationTemplateStatus.PUBLISHED);
    expect(prisma.communicationTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'template-1',
        tenantId: 'tenant-1',
      },
      select: expect.any(Object),
    });
    expect(prisma.communicationTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'template-1' },
        data: expect.objectContaining({
          status: CommunicationTemplateStatus.PUBLISHED,
          updatedById: 'admin-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'publish',
        resource: 'communication_template',
        tenantId: 'tenant-1',
        resourceId: 'template-1',
      }),
    );
  });
});
