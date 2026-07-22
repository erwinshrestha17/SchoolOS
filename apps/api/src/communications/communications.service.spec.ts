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
  NoticeLifecycleStatus,
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      staff: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      subjectTeacherAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
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
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      student: {
        findMany: jest.fn(),
      },
      user: {
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
        updateMany: jest.fn(),
        upsert: jest.fn((args) =>
          Promise.resolve({
            id: `delivery-${prisma.notificationDelivery.upsert.mock.calls.length}`,
            createdAt: new Date('2026-04-27T00:00:00.000Z'),
            sentAt: null,
            errorMessage: null,
            ...args.create,
          }),
        ),
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      communicationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (operations) => Promise.all(operations)),
    };
    notificationsService = {
      sendPushNotification: jest.fn(),
      sendSms: jest.fn(),
      sendEmail: jest.fn(),
      getProviderReadiness: jest.fn().mockResolvedValue({
        enabled: true,
        failureCode: null,
        failureReason: null,
      }),
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
      permissions: [
        'events:create',
        'notices:create',
        'communications:read_deliveries',
      ],
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

  it('queues an admission document reminder through canonical M12 intake with daily idempotency', async () => {
    const notificationEventService = {
      accept: jest.fn().mockResolvedValue({ id: 'notification-event-1' }),
      markDispatched: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const reminderService = new CommunicationsService(
      prisma,
      notificationsService,
      auditService,
      {
        verifyLimit: jest.fn(),
        checkLimit: jest.fn(),
        incrementUsage: jest.fn(),
      } as never,
      redisService,
      fileRegistryService,
      undefined,
      notificationEventService as never,
    );
    const recordDeliveryRecords = jest
      .spyOn(reminderService, 'recordDeliveryRecords')
      .mockResolvedValueOnce({ count: 1, replayed: false } as never)
      .mockResolvedValueOnce({ count: 1, replayed: true } as never);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { status: NotificationStatus.QUEUED },
    ]);
    const input = {
      actor,
      admissionCaseId: 'admission-case-1',
      applicantName: 'Aarav Shrestha',
      guardianPhone: '9800000000',
      sourceUpdatedAt: '2026-07-20T04:00:00.000Z',
      missingDocumentLabels: ['Birth certificate'],
    };

    await expect(
      reminderService.recordAdmissionDocumentReminder(input),
    ).resolves.toEqual({ state: 'QUEUED', reason: null });
    await expect(
      reminderService.recordAdmissionDocumentReminder(input),
    ).resolves.toEqual({ state: 'ALREADY_QUEUED', reason: null });

    const firstEventInput = notificationEventService.accept.mock.calls[0][0];
    expect(firstEventInput).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        type: 'ADMISSION_DOCUMENTS_REQUESTED',
        sourceEntityId: 'admission-case-1',
        actorId: 'admin-1',
        idempotencyKey: expect.stringMatching(
          /^admission-document-request:admission-case-1:\d{4}-\d{2}-\d{2}$/,
        ),
        metadata: expect.objectContaining({
          sourceUpdatedAt: '2026-07-20T04:00:00.000Z',
          missingDocumentCount: 1,
        }),
      }),
    );
    expect(
      notificationEventService.accept.mock.calls[1][0].idempotencyKey,
    ).toBe(firstEventInput.idempotencyKey);
    expect(recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'admission_document_request',
        sourceId: firstEventInput.idempotencyKey,
        notificationEventId: 'notification-event-1',
        channels: [NotificationChannel.SMS],
        directRecipients: [
          expect.objectContaining({ phone: '9800000000', userId: null }),
        ],
      }),
    );
    expect(notificationEventService.markDispatched).toHaveBeenCalledTimes(2);
  });

  it('reports an admission reminder as unavailable when M12 creates no deliverable row', async () => {
    const notificationEventService = {
      accept: jest.fn().mockResolvedValue({ id: 'notification-event-1' }),
      markDispatched: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const reminderService = new CommunicationsService(
      prisma,
      notificationsService,
      auditService,
      {} as never,
      redisService,
      fileRegistryService,
      undefined,
      notificationEventService as never,
    );
    jest
      .spyOn(reminderService, 'recordDeliveryRecords')
      .mockResolvedValue({ count: 1 } as never);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { status: NotificationStatus.SKIPPED },
    ]);

    await expect(
      reminderService.recordAdmissionDocumentReminder({
        actor,
        admissionCaseId: 'admission-case-1',
        applicantName: 'Aarav Shrestha',
        guardianPhone: '9800000000',
        sourceUpdatedAt: '2026-07-20T04:00:00.000Z',
        missingDocumentLabels: ['Birth certificate'],
      }),
    ).resolves.toEqual({
      state: 'SKIPPED',
      reason: 'DELIVERY_UNAVAILABLE',
    });
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
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          idempotencyKey: 'event:event-1:guardian-user-1:PUSH',
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
      }),
    );
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
        channels: [
          NotificationChannel.IN_APP,
          NotificationChannel.PUSH,
          NotificationChannel.SMS,
        ],
        recipientCount: 2,
        allowedRecipientCount: 1,
        skippedRecipientCount: 1,
        estimatedDeliveryRows: 3,
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
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          activityPostId: 'post-1',
          studentId: 'student-1',
          guardianId: 'guardian-1',
          status: NotificationStatus.QUEUED,
        }),
      }),
    );
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
        lifecycleStatus: NoticeLifecycleStatus.DRAFT,
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

  it('fails closed when the compatibility create route tries to bypass high-impact approval', async () => {
    await expect(
      service.createNotice(
        {
          title: 'Emergency closure',
          body: 'School is closed today.',
          priority: NoticePriority.EMERGENCY,
        },
        actor,
      ),
    ).rejects.toThrow(
      'Urgent and emergency notices must use the approval-backed draft workflow',
    );
    expect(prisma.notice.create).not.toHaveBeenCalled();
  });

  it('schedules only a future approved high-impact notice and audits the transition', async () => {
    const current = {
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Urgent circular',
      body: 'Please read.',
      priority: NoticePriority.URGENT,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.APPROVED,
      scheduledFor: null,
      publishedAt: null,
      expiresAt: null,
      archivedFromStatus: null,
    };
    prisma.notice.findFirst.mockResolvedValue(current);
    prisma.notice.update.mockResolvedValue({
      ...current,
      lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
      scheduledFor: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.scheduleNotice(
      'notice-1',
      '2099-01-01T00:00:00.000Z',
      actor,
    );

    expect(result.lifecycleStatus).toBe(NoticeLifecycleStatus.SCHEDULED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'schedule',
        resource: 'notice',
        tenantId: 'tenant-1',
        resourceId: 'notice-1',
      }),
    );
  });

  it('cancels a scheduled notice and terminalizes still-queued delivery rows', async () => {
    const current = {
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Scheduled circular',
      body: 'Please read.',
      priority: NoticePriority.NORMAL,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
      scheduledFor: new Date('2099-01-01T00:00:00.000Z'),
      publishedAt: null,
      expiresAt: null,
      archivedFromStatus: null,
    };
    const cancelled = {
      ...current,
      lifecycleStatus: NoticeLifecycleStatus.CANCELLED,
      scheduledFor: null,
    };
    prisma.notice.findFirst.mockResolvedValue(current);
    prisma.notice.update.mockResolvedValue(cancelled);
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.cancelNotice('notice-1', 'Calendar changed', actor),
    ).resolves.toEqual(cancelled);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        noticeId: 'notice-1',
        status: {
          in: [NotificationStatus.QUEUED, NotificationStatus.RETRY_PENDING],
        },
      },
      data: {
        status: NotificationStatus.CANCELLED,
        errorMessage: 'Notice was cancelled before delivery completed',
      },
    });
  });

  it('archives and restores without republishing or losing the prior lifecycle state', async () => {
    const published = {
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Published circular',
      body: 'Please read.',
      priority: NoticePriority.NORMAL,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
      scheduledFor: null,
      publishedAt: new Date('2026-07-15T00:00:00.000Z'),
      expiresAt: null,
      archivedFromStatus: null,
    };
    const archived = {
      ...published,
      lifecycleStatus: NoticeLifecycleStatus.ARCHIVED,
      archivedFromStatus: NoticeLifecycleStatus.PUBLISHED,
    };
    prisma.notice.findFirst.mockResolvedValueOnce(published);
    prisma.notice.update.mockResolvedValueOnce(archived);
    await service.archiveNotice('notice-1', 'End of term', actor);

    prisma.notice.findFirst.mockResolvedValueOnce(archived);
    prisma.notice.update.mockResolvedValueOnce(published);
    const restored = await service.restoreNotice(
      'notice-1',
      'Reference needed',
      actor,
    );

    expect(restored.lifecycleStatus).toBe(NoticeLifecycleStatus.PUBLISHED);
    expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
  });

  it('claims the published lifecycle before emitting the canonical notification event', async () => {
    const draft = {
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Normal circular',
      body: 'Please read.',
      priority: NoticePriority.NORMAL,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.DRAFT,
      scheduledFor: null,
      publishedAt: null,
      expiresAt: null,
      archivedFromStatus: null,
    };
    const published = {
      ...draft,
      lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
      publishedAt: new Date('2026-07-15T00:00:00.000Z'),
    };
    prisma.notice.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(published);
    prisma.notice.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(service, 'previewNoticeRecipients').mockResolvedValue({
      allowedRecipientCount: 1,
    } as never);
    const emit = jest
      .spyOn(service as any, 'emitNoticePublished')
      .mockImplementation(async (...args: unknown[]) => {
        const sourceNotice = args[0] as { lifecycleStatus: string };
        expect(sourceNotice.lifecycleStatus).toBe(
          NoticeLifecycleStatus.PUBLISHED,
        );
        expect(prisma.notice.updateMany).toHaveBeenCalled();
        return { count: 2 };
      });

    await expect(
      service.publishPreparedNotice('notice-1', actor),
    ).resolves.toEqual(
      expect.objectContaining({
        notice: published,
        replayed: false,
      }),
    );
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('does not change lifecycle or emit when recipient preview has no eligible recipient', async () => {
    prisma.notice.findFirst.mockResolvedValue({
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Normal circular',
      body: 'Please read.',
      priority: NoticePriority.NORMAL,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.DRAFT,
      scheduledFor: null,
      publishedAt: null,
      expiresAt: null,
      archivedFromStatus: null,
    });
    jest.spyOn(service, 'previewNoticeRecipients').mockResolvedValue({
      allowedRecipientCount: 0,
    } as never);
    const emit = jest.spyOn(service as any, 'emitNoticePublished');

    await expect(
      service.publishPreparedNotice('notice-1', actor),
    ).rejects.toThrow('No eligible recipients are available for this notice');
    expect(prisma.notice.updateMany).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('publishes high-impact notices to the in-app inbox while disabled external providers remain skipped', async () => {
    notificationsService.getProviderReadiness.mockResolvedValue({
      enabled: false,
      failureCode: 'PROVIDER_DISABLED',
      failureReason: 'Provider disabled for this environment',
    });
    prisma.notice.findFirst.mockResolvedValue({
      id: 'notice-1',
      tenantId: 'tenant-1',
      title: 'Emergency circular',
      body: 'School is closed today.',
      priority: NoticePriority.EMERGENCY,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.DRAFT,
      approvalRequestId: null,
      scheduledFor: null,
      publishedAt: null,
    });

    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([]);

    await expect(service.publishNotice('notice-1', actor)).resolves.toEqual(
      expect.objectContaining({ state: 'QUEUED' }),
    );
    expect(prisma.notice.update).toHaveBeenCalled();
    expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
    expect(notificationsService.sendSms).not.toHaveBeenCalled();
  });

  it('persists approval-pending and approved notice lifecycle projections', async () => {
    prisma.notice.findFirst.mockResolvedValueOnce({
      id: 'notice-1',
      tenantId: 'tenant-1',
      lifecycleStatus: NoticeLifecycleStatus.DRAFT,
      approvalRequestId: null,
    });
    prisma.notice.update.mockResolvedValueOnce({
      id: 'notice-1',
      lifecycleStatus: NoticeLifecycleStatus.APPROVAL_PENDING,
      approvalRequestId: 'approval-1',
    });

    await service.markNoticeApprovalPending('notice-1', 'approval-1', actor);

    prisma.notice.findFirst.mockResolvedValueOnce({
      id: 'notice-1',
      tenantId: 'tenant-1',
      lifecycleStatus: NoticeLifecycleStatus.APPROVAL_PENDING,
      approvalRequestId: 'approval-1',
    });
    prisma.notice.update.mockResolvedValueOnce({
      id: 'notice-1',
      lifecycleStatus: NoticeLifecycleStatus.APPROVED,
      approvalRequestId: 'approval-1',
    });

    await service.markNoticeApproved('notice-1', 'approval-1', actor);

    expect(prisma.notice.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'notice-1' },
      data: {
        lifecycleStatus: NoticeLifecycleStatus.APPROVAL_PENDING,
        approvalRequestId: 'approval-1',
      },
    });
    expect(prisma.notice.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'notice-1' },
      data: {
        lifecycleStatus: NoticeLifecycleStatus.APPROVED,
        approvalRequestId: 'approval-1',
      },
    });
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

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: actor.tenantId,
          sourceType: 'fee_payment_confirmed',
          sourceId: 'fee-payment:payment-1:confirmed',
          studentId: 'student-1',
          guardianId: 'guardian-1',
          status: NotificationStatus.QUEUED,
        }),
      }),
    );
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
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: actor.tenantId,
          sourceType: 'student_admitted',
          sourceId: 'student:student-1:admitted',
          guardianId: 'guardian-1',
          studentId: 'student-1',
          status: NotificationStatus.QUEUED,
        }),
      }),
    );
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
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: NotificationStatus.QUEUED,
        }),
      }),
    );
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

  it('scopes delivery listing to the requested sourceType and activityPostId when provided', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);

    await service.listDeliveries(actor, {
      sourceType: 'activity_post',
      activityPostId: 'post-1',
    });

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          sourceType: 'activity_post',
          activityPostId: 'post-1',
        },
      }),
    );
  });

  it('paginates and filters scheduled and approval notice queues on the server', async () => {
    prisma.notice.findMany.mockResolvedValue([{ id: 'notice-1' }]);
    prisma.notice.count.mockResolvedValue(26);

    await expect(
      service.listNotices(actor, {
        page: 1,
        limit: 25,
        lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
        priority: NoticePriority.URGENT,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 'notice-1',
          className: null,
          sectionName: null,
          deliveryCount: 0,
          acknowledgementCount: 0,
        },
      ],
      total: 26,
      page: 1,
      limit: 25,
      hasNextPage: true,
    });
    expect(prisma.notice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { tenantId: 'tenant-1' },
            { lifecycleStatus: NoticeLifecycleStatus.SCHEDULED },
            { priority: NoticePriority.URGENT },
          ]),
        }),
        skip: 0,
        take: 25,
      }),
    );
  });

  describe('teacher scoping (confirmed gap: previously any notices:read/events:read holder saw every notice/event in the tenant regardless of audience or lifecycle state)', () => {
    const teacherActor: AuthContext = {
      userId: 'teacher-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['notices:read', 'events:read'],
    };

    function mockTeacherAssignment() {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      prisma.subjectTeacherAssignment.findMany.mockResolvedValue([
        { classId: 'class-1', sectionId: 'section-1' },
      ]);
      prisma.section.findMany.mockResolvedValue([]);
    }

    it('scopes listNotices to ALL-audience, own-class/section, or actually-delivered published notices', async () => {
      mockTeacherAssignment();
      prisma.notice.findMany.mockResolvedValue([]);
      prisma.notice.count.mockResolvedValue(0);

      await service.listNotices(teacherActor, { page: 1, limit: 25 });

      expect(prisma.notice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: [
                  { audienceType: AudienceType.ALL },
                  {
                    deliveries: {
                      some: { recipientUserId: teacherActor.userId },
                    },
                  },
                  {
                    audienceType: AudienceType.CLASS,
                    classId: { in: ['class-1'] },
                  },
                  {
                    audienceType: AudienceType.SECTION,
                    sectionId: { in: ['section-1'] },
                  },
                ],
              },
              {
                lifecycleStatus: {
                  in: [
                    NoticeLifecycleStatus.PUBLISHED,
                    NoticeLifecycleStatus.EXPIRED,
                  ],
                },
              },
            ]),
          }),
        }),
      );
    });

    it('ignores a caller-supplied lifecycleStatus filter for a non-administrator', async () => {
      mockTeacherAssignment();
      prisma.notice.findMany.mockResolvedValue([]);
      prisma.notice.count.mockResolvedValue(0);

      await service.listNotices(teacherActor, {
        page: 1,
        limit: 25,
        lifecycleStatus: NoticeLifecycleStatus.DRAFT,
      });

      const call = (prisma.notice.findMany as jest.Mock).mock.calls[0][0];
      const andClauses = call.where.AND as Array<Record<string, unknown>>;
      expect(
        andClauses.some(
          (clause) => clause.lifecycleStatus === NoticeLifecycleStatus.DRAFT,
        ),
      ).toBe(false);
    });

    it('does not scope listNotices for a notice administrator', async () => {
      prisma.notice.findMany.mockResolvedValue([]);
      prisma.notice.count.mockResolvedValue(0);

      await service.listNotices(actor, { page: 1, limit: 25 });

      const call = (prisma.notice.findMany as jest.Mock).mock.calls[0][0];
      const andClauses = call.where.AND as unknown[];
      expect(
        andClauses.some(
          (clause) =>
            typeof clause === 'object' &&
            clause !== null &&
            ('deliveries' in clause || 'OR' in clause),
        ),
      ).toBe(false);
    });

    it('scopes listEvents to ALL-audience, own-class/section, or actually-delivered events', async () => {
      mockTeacherAssignment();
      prisma.event.findMany.mockResolvedValue([]);

      await service.listEvents(teacherActor);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            OR: [
              { audienceType: AudienceType.ALL },
              {
                deliveries: {
                  some: { recipientUserId: teacherActor.userId },
                },
              },
              {
                audienceType: AudienceType.CLASS,
                classId: { in: ['class-1'] },
              },
              {
                audienceType: AudienceType.SECTION,
                sectionId: { in: ['section-1'] },
              },
            ],
          }),
        }),
      );
    });

    it('does not scope listEvents for an events administrator', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.listEvents(actor);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        }),
      );
    });

    it('returns no notices for a teacher with no active staff assignment beyond ALL/delivered', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);
      prisma.notice.findMany.mockResolvedValue([]);
      prisma.notice.count.mockResolvedValue(0);

      await service.listNotices(teacherActor, { page: 1, limit: 25 });

      const call = (prisma.notice.findMany as jest.Mock).mock.calls[0][0];
      const andClauses = call.where.AND as Array<Record<string, unknown>>;
      const orClause = andClauses.find((clause) => Array.isArray(clause.OR)) as
        | { OR: unknown[] }
        | undefined;
      expect(orClause?.OR).toEqual([
        { audienceType: AudienceType.ALL },
        { deliveries: { some: { recipientUserId: teacherActor.userId } } },
      ]);
    });
  });

  it('omits sourceType and activityPostId filters when not provided, preserving prior behavior', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);

    await service.listDeliveries(actor);

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
      }),
    );
  });

  it('returns purpose-limited delivery operations without message bodies or raw destinations', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'delivery-1',
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.FAILED,
        sourceType: 'notice',
        sourceId: 'notice-1',
        audienceType: AudienceType.ALL,
        recipientUserId: 'user-1',
        guardianId: null,
        studentId: null,
        destination: 'guardian@example.test',
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
        sentAt: new Date('2026-07-15T00:01:00.000Z'),
        deliveredAt: null,
        failedAt: new Date('2026-07-15T00:02:00.000Z'),
        retryCount: 2,
      },
    ]);
    prisma.notificationDelivery.count.mockResolvedValue(1);

    const result = await service.listDeliveryOperations(actor, {
      page: 1,
      limit: 25,
      status: NotificationStatus.FAILED,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'delivery-1',
        recipientType: 'user',
        recipientLabel: 'gu***@example.test',
        retryCount: 2,
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty('body');
    expect(result.items[0]).not.toHaveProperty('destination');
    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          status: NotificationStatus.FAILED,
        }),
        select: expect.not.objectContaining({ body: true, title: true }),
      }),
    );
  });

  it('normalizes absent student references for direct user follow-up deliveries', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'recipient-1',
        email: 'recipient@school.test',
        phone: null,
      },
    ]);

    await service.recordDeliveryRecords({
      actor,
      sourceType: 'notice_acknowledgement_follow_up',
      sourceId: 'notice:notice-1:ack-follow-up:key-1',
      noticeId: 'notice-1',
      audienceType: AudienceType.ALL,
      recipientUserIds: ['recipient-1'],
      title: 'Please acknowledge',
      body: 'Please review the notice.',
      channels: [NotificationChannel.IN_APP],
      communicationCategory: 'ESSENTIAL',
    });

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          recipientUserId: 'recipient-1',
          guardianId: null,
          studentId: null,
        }),
      }),
    );
  });
});
