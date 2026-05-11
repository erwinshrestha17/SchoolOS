import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  NotificationChannel,
  NotificationStatus,
  NoticePriority,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { CommunicationsService } from '../src/communications/communications.service';
import { DeliveryRetryService } from '../src/communications/delivery-retry.service';
import { M10HardeningService } from '../src/communications/m10-hardening.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface CommunicationState {
  notices: Record<string, unknown>[];
  notificationDeliveries: Record<string, unknown>[];
  guardianConsents: Record<string, unknown>[];
  students: Record<string, unknown>[];
  guardians: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  executeRawCalls: unknown[];
}

type CommunicationPrismaMock = ReturnType<typeof buildPrismaMock>;

describe('Communications Delivery Reliability Integration (E2E)', () => {
  const tenantId = 'tenant-communications-depth';
  const otherTenantId = 'tenant-communications-other';
  const actor: AuthContext = {
    tenantId,
    tenantSlug: 'communications-depth',
    userId: 'admin-user',
    email: 'admin@schoolos.test',
    authMethod: 'PASSWORD' as never,
    roles: ['admin'],
    permissions: ['communications:read_deliveries'],
  };

  let prisma: CommunicationPrismaMock;
  let auditService: { record: jest.Mock };
  let notificationsService: {
    sendEmail: jest.Mock;
    sendSms: jest.Mock;
    sendPushNotification: jest.Mock;
  };
  let communicationsService: CommunicationsService;
  let deliveryRetryService: DeliveryRetryService;
  let m10HardeningService: M10HardeningService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = {
      record: jest.fn(async (entry: Record<string, unknown>) => {
        prisma.__state.auditLogs.push({
          id: `audit-${prisma.__state.auditLogs.length + 1}`,
          ...entry,
          createdAt: new Date(),
        });
      }),
    };
    notificationsService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
      sendPushNotification: jest.fn().mockResolvedValue(undefined),
    };

    deliveryRetryService = new DeliveryRetryService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
      auditService as unknown as AuditService,
    );
    communicationsService = new CommunicationsService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
      auditService as unknown as AuditService,
    );
    m10HardeningService = new M10HardeningService(
      prisma as unknown as PrismaService,
      communicationsService,
      deliveryRetryService,
      auditService as unknown as AuditService,
    );
  });

  it('creates notice delivery rows, dispatches allowed recipients, skips missing consent recipients, and audits the delivery record', async () => {
    seedStudentWithGuardian({
      studentId: 'student-1',
      guardianId: 'guardian-1',
      guardianUserId: 'guardian-user-1',
      phone: '9800000001',
      hasMessagingConsent: true,
    });
    seedStudentWithGuardian({
      studentId: 'student-2',
      guardianId: 'guardian-2',
      guardianUserId: 'guardian-user-2',
      phone: '9800000002',
      hasMessagingConsent: false,
    });

    const notice = await communicationsService.createNotice(
      {
        title: 'Exam notice',
        body: 'Exam starts Sunday.',
        priority: NoticePriority.NORMAL,
        audienceType: AudienceType.ALL,
      },
      actor,
    );

    expect(notice.id).toBe('notice-1');
    expect(prisma.__state.notificationDeliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId,
          noticeId: notice.id,
          guardianId: 'guardian-1',
          recipientUserId: 'guardian-user-1',
          status: NotificationStatus.QUEUED,
          channel: NotificationChannel.PUSH,
        }),
        expect.objectContaining({
          tenantId,
          noticeId: notice.id,
          guardianId: 'guardian-2',
          recipientUserId: 'guardian-user-2',
          status: NotificationStatus.SKIPPED,
          channel: NotificationChannel.PUSH,
          errorMessage: 'Missing required consent: MESSAGING',
        }),
      ]),
    );
    expect(notificationsService.sendPushNotification).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'guardian-user-1',
        title: 'Exam notice',
        metadata: expect.objectContaining({
          tenantId,
          sourceType: 'notice',
          sourceId: notice.id,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'record',
        resource: 'notification_delivery',
        tenantId,
        resourceId: notice.id,
        after: expect.objectContaining({
          recipientCount: 1,
          skippedRecipientCount: 1,
          channelCount: 1,
        }),
      }),
    );
  });

  it('replays existing delivery summary idempotently without duplicate delivery rows or duplicate dispatch', async () => {
    seedStudentWithGuardian({
      studentId: 'student-1',
      guardianId: 'guardian-1',
      guardianUserId: 'guardian-user-1',
      phone: '9800000001',
      hasMessagingConsent: true,
    });

    const first = await communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'notice',
      sourceId: 'notice-idempotent',
      noticeId: 'notice-idempotent',
      audienceType: AudienceType.ALL,
      title: 'Idempotent notice',
      body: 'Only one delivery should exist.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
    const second = await communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'notice',
      sourceId: 'notice-idempotent',
      noticeId: 'notice-idempotent',
      audienceType: AudienceType.ALL,
      title: 'Idempotent notice',
      body: 'Only one delivery should exist.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    expect(first.count).toBe(1);
    expect(second).toEqual(
      expect.objectContaining({
        count: 1,
        queuedCount: 1,
        replayed: true,
      }),
    );
    expect(prisma.__state.notificationDeliveries).toHaveLength(1);
    expect(notificationsService.sendPushNotification).toHaveBeenCalledTimes(1);
  });

  it('retries a failed delivery with metadata, sends through provider boundary, updates status, and audits retry', async () => {
    seedDelivery({
      id: 'delivery-failed-1',
      status: NotificationStatus.FAILED,
      channel: NotificationChannel.SMS,
      destination: '9800000001',
      errorMessage: 'Provider timeout',
    });

    const result = await m10HardeningService.retryDeliveryWithMetadata(
      'delivery-failed-1',
      { reason: 'Manual retry after provider timeout' },
      actor,
    );

    expect(prisma.__state.executeRawCalls).toHaveLength(1);
    expect(notificationsService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '9800000001',
        message: 'Body',
        metadata: expect.objectContaining({
          tenantId,
          notificationDeliveryId: 'delivery-failed-1',
          retry: 'true',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        deliveryId: 'delivery-failed-1',
        status: NotificationStatus.SENT,
        errorMessage: null,
      }),
    );
    expect(prisma.__state.notificationDeliveries[0]).toEqual(
      expect.objectContaining({
        status: NotificationStatus.SENT,
        errorMessage: null,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry',
        resource: 'notification_delivery',
        tenantId,
        resourceId: 'delivery-failed-1',
      }),
    );
  });

  it('rejects retry for another tenant and sent terminal deliveries', async () => {
    seedDelivery({
      id: 'delivery-other-tenant',
      tenantId: otherTenantId,
      status: NotificationStatus.FAILED,
    });
    seedDelivery({
      id: 'delivery-sent',
      status: NotificationStatus.SENT,
    });

    await expect(
      deliveryRetryService.retryDelivery('delivery-other-tenant', actor),
    ).rejects.toThrow(NotFoundException);
    await expect(
      deliveryRetryService.retryDelivery('delivery-sent', actor),
    ).rejects.toThrow(BadRequestException);
    expect(notificationsService.sendPushNotification).not.toHaveBeenCalled();
    expect(notificationsService.sendSms).not.toHaveBeenCalled();
    expect(notificationsService.sendEmail).not.toHaveBeenCalled();
  });

  it('resends only failed same-tenant notice deliveries and audits the resend request', async () => {
    prisma.__state.notices.push({
      id: 'notice-1',
      tenantId,
      title: 'Notice',
      body: 'Body',
    });
    seedDelivery({
      id: 'delivery-failed-1',
      noticeId: 'notice-1',
      status: NotificationStatus.FAILED,
      channel: NotificationChannel.PUSH,
      destination: 'guardian-user-1',
    });
    seedDelivery({
      id: 'delivery-sent-1',
      noticeId: 'notice-1',
      status: NotificationStatus.SENT,
      channel: NotificationChannel.PUSH,
      destination: 'guardian-user-2',
    });
    seedDelivery({
      id: 'delivery-other-tenant',
      tenantId: otherTenantId,
      noticeId: 'notice-1',
      status: NotificationStatus.FAILED,
      channel: NotificationChannel.PUSH,
      destination: 'other-user',
    });

    const result = await m10HardeningService.resendNoticeFailed(
      'notice-1',
      { reason: 'Retry failed notice delivery' },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({ requested: 1, retried: 1 }),
    );
    expect(notificationsService.sendPushNotification).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'guardian-user-1' }),
    );
    expect(prisma.__state.notificationDeliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'delivery-failed-1', status: 'SENT' }),
        expect.objectContaining({ id: 'delivery-sent-1', status: 'SENT' }),
        expect.objectContaining({
          id: 'delivery-other-tenant',
          tenantId: otherTenantId,
          status: 'FAILED',
        }),
      ]),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'resend_failed',
        resource: 'notice',
        tenantId,
        resourceId: 'notice-1',
        after: expect.objectContaining({ requested: 1, retried: 1 }),
      }),
    );
  });

  it('marks notice reads idempotently for same-tenant recipients and rejects cross-tenant notice reads', async () => {
    prisma.__state.notices.push({
      id: 'notice-1',
      tenantId,
      title: 'Notice',
      body: 'Body',
    });
    prisma.__state.notices.push({
      id: 'notice-other',
      tenantId: otherTenantId,
      title: 'Other Notice',
      body: 'Body',
    });
    seedDelivery({
      id: 'delivery-1',
      noticeId: 'notice-1',
      recipientUserId: actor.userId,
      guardianId: 'guardian-1',
      studentId: 'student-1',
    });

    await expect(
      m10HardeningService.markNoticeRead('notice-other', actor),
    ).rejects.toThrow(NotFoundException);

    await m10HardeningService.markNoticeRead('notice-1', actor);
    await m10HardeningService.markNoticeRead('notice-1', actor);

    expect(prisma.__state.executeRawCalls).toHaveLength(2);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        resource: 'notice',
        tenantId,
        userId: actor.userId,
        resourceId: 'notice-1',
      }),
    );
  });

  function seedStudentWithGuardian(input: {
    studentId: string;
    guardianId: string;
    guardianUserId: string;
    phone: string;
    hasMessagingConsent: boolean;
  }) {
    prisma.__state.guardians.push({
      id: input.guardianId,
      tenantId,
      userId: input.guardianUserId,
      email: `${input.guardianId}@schoolos.test`,
      primaryPhone: input.phone,
      receivesAlerts: true,
    });
    prisma.__state.students.push({
      id: input.studentId,
      tenantId,
      studentSystemId: input.studentId,
      userId: null,
      classId: null,
      sectionId: null,
      guardianLinks: [
        {
          isPrimary: true,
          guardianId: input.guardianId,
          guardian: {
            id: input.guardianId,
            tenantId,
            userId: input.guardianUserId,
            email: `${input.guardianId}@schoolos.test`,
            primaryPhone: input.phone,
            receivesAlerts: true,
            user: {
              id: input.guardianUserId,
              email: `${input.guardianId}@schoolos.test`,
            },
          },
        },
      ],
    });
    if (input.hasMessagingConsent) {
      prisma.__state.guardianConsents.push({
        id: `consent-${input.guardianId}`,
        tenantId,
        guardianId: input.guardianId,
        consentType: ConsentType.MESSAGING,
        granted: true,
        revokedAt: null,
        capturedAt: new Date(),
      });
    }
  }

  function seedDelivery(overrides: Record<string, unknown>) {
    prisma.__state.notificationDeliveries.push({
      id:
        overrides.id ??
        `delivery-${prisma.__state.notificationDeliveries.length + 1}`,
      tenantId: overrides.tenantId ?? tenantId,
      channel: overrides.channel ?? NotificationChannel.PUSH,
      status: overrides.status ?? NotificationStatus.FAILED,
      sourceType: overrides.sourceType ?? 'notice',
      sourceId: overrides.sourceId ?? 'notice-1',
      audienceType: overrides.audienceType ?? AudienceType.ALL,
      recipientUserId: overrides.recipientUserId ?? 'guardian-user-1',
      guardianId: overrides.guardianId ?? 'guardian-1',
      studentId: overrides.studentId ?? 'student-1',
      noticeId: overrides.noticeId ?? null,
      eventId: null,
      activityPostId: null,
      destination: overrides.destination ?? 'guardian-user-1',
      title: overrides.title ?? 'Title',
      body: overrides.body ?? 'Body',
      errorMessage: overrides.errorMessage ?? null,
      sentAt: null,
      createdAt: new Date(),
    });
  }
});

function buildPrismaMock() {
  const state: CommunicationState = {
    notices: [],
    notificationDeliveries: [],
    guardianConsents: [],
    students: [],
    guardians: [],
    auditLogs: [],
    executeRawCalls: [],
  };

  const prisma = {
    __state: state,
    notice: {
      create: jest.fn(async (q: { data: Record<string, unknown> }) => {
        const notice = {
          id: `notice-${state.notices.length + 1}`,
          createdAt: new Date(),
          ...q.data,
        };
        state.notices.push(notice);
        return notice;
      }),
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.notices.find(
            (notice) =>
              notice.id === q.where?.id &&
              notice.tenantId === q.where?.tenantId,
          ) ?? null,
      ),
    },
    class: {
      findFirst: jest.fn(async () => null),
    },
    section: {
      findFirst: jest.fn(async () => null),
    },
    student: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        const idIn = (where.id as { in?: string[] } | undefined)?.in;
        return state.students.filter(
          (student) =>
            student.tenantId === where.tenantId &&
            (!where.classId || student.classId === where.classId) &&
            (!where.sectionId || student.sectionId === where.sectionId) &&
            (!idIn || idIn.includes(student.id as string)),
        );
      }),
    },
    guardian: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.guardians.find(
            (guardian) =>
              guardian.tenantId === q.where?.tenantId &&
              (!q.where?.userId || guardian.userId === q.where.userId),
          ) ?? null,
      ),
    },
    guardianConsent: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const guardianIn = (
          q.where?.guardianId as { in?: string[] } | undefined
        )?.in;
        const consentIn = (
          q.where?.consentType as { in?: ConsentType[] } | undefined
        )?.in;
        return state.guardianConsents.filter(
          (consent) =>
            consent.tenantId === q.where?.tenantId &&
            (!guardianIn ||
              guardianIn.includes(consent.guardianId as string)) &&
            (!consentIn ||
              consentIn.includes(consent.consentType as ConsentType)),
        );
      }),
    },
    notificationDelivery: {
      create: jest.fn(async (q: { data: Record<string, unknown> }) => {
        const delivery = {
          id: `delivery-${state.notificationDeliveries.length + 1}`,
          createdAt: new Date(),
          ...q.data,
        };
        state.notificationDeliveries.push(delivery);
        return delivery;
      }),
      findMany: jest.fn(
        async (q: { where?: Record<string, unknown>; take?: number }) => {
          const where = q.where ?? {};
          const guardianIn = (where.guardianId as { in?: string[] } | undefined)
            ?.in;
          const recipientIn = (
            where.recipientUserId as { in?: string[] } | undefined
          )?.in;
          const rows = state.notificationDeliveries.filter(
            (delivery) =>
              delivery.tenantId === where.tenantId &&
              (!where.sourceType || delivery.sourceType === where.sourceType) &&
              (!where.sourceId || delivery.sourceId === where.sourceId) &&
              (!where.noticeId || delivery.noticeId === where.noticeId) &&
              (!where.status || delivery.status === where.status) &&
              (!guardianIn ||
                guardianIn.includes(delivery.guardianId as string)) &&
              (!recipientIn ||
                recipientIn.includes(delivery.recipientUserId as string)),
          );
          return typeof q.take === 'number' ? rows.slice(0, q.take) : rows;
        },
      ),
      findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        return (
          state.notificationDeliveries.find(
            (delivery) =>
              (!where.id || delivery.id === where.id) &&
              delivery.tenantId === where.tenantId &&
              (!where.noticeId || delivery.noticeId === where.noticeId) &&
              (!where.recipientUserId ||
                delivery.recipientUserId === where.recipientUserId),
          ) ?? null
        );
      }),
      update: jest.fn(
        async (q: { where: { id: string }; data: Record<string, unknown> }) => {
          const delivery = state.notificationDeliveries.find(
            (item) => item.id === q.where.id,
          );
          if (!delivery) {
            return null;
          }
          Object.assign(delivery, q.data);
          return delivery;
        },
      ),
    },
    $executeRaw: jest.fn(async (...args: unknown[]) => {
      state.executeRawCalls.push(args);
      return 1;
    }),
  };

  return prisma;
}
