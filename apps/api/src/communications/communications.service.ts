import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  EventType,
  NotificationChannel,
  NotificationStatus,
  NoticePriority,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { CaptureConsentDto } from './dto/capture-consent.dto';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async listNotices(actor: AuthContext) {
    return this.prisma.notice.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createNotice(dto: CreateNoticeDto, actor: AuthContext) {
    await this.ensureAudienceRefs(actor, dto.classId, dto.sectionId);

    const publishedAt = dto.scheduledFor ? null : new Date();
    const notice = await this.prisma.notice.create({
      data: {
        tenantId: actor.tenantId,
        createdById: actor.userId,
        title: dto.title,
        body: dto.body,
        priority: dto.priority ?? NoticePriority.NORMAL,
        audienceType: dto.audienceType ?? AudienceType.ALL,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        publishedAt,
      },
    });

    if (publishedAt) {
      await this.notificationsService.sendPushNotification({
        title: notice.title,
        body: notice.body,
        audience: notice.audienceType.toLowerCase(),
        metadata: {
          tenantId: actor.tenantId,
          noticeId: notice.id,
        },
      });

      await this.recordDeliveryRecords({
        actor,
        sourceType: 'notice',
        sourceId: notice.id,
        noticeId: notice.id,
        audienceType: notice.audienceType,
        classId: notice.classId,
        sectionId: notice.sectionId,
        title: notice.title,
        body: notice.body,
        channels:
          notice.priority === NoticePriority.EMERGENCY
            ? [NotificationChannel.PUSH, NotificationChannel.SMS]
            : [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }

    await this.auditService.record({
      action: 'create',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      after: {
        title: notice.title,
        priority: notice.priority,
        audienceType: notice.audienceType,
      },
    });

    return notice;
  }

  async listEvents(actor: AuthContext) {
    return this.prisma.event.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ startsAt: 'asc' }],
    });
  }

  async createEvent(dto: CreateEventDto, actor: AuthContext) {
    await this.ensureAudienceRefs(actor, dto.classId, dto.sectionId);

    const event = await this.prisma.event.create({
      data: {
        tenantId: actor.tenantId,
        createdById: actor.userId,
        title: dto.title,
        description: dto.description ?? null,
        eventType: dto.eventType ?? EventType.GENERAL,
        audienceType: dto.audienceType ?? AudienceType.ALL,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        location: dto.location ?? null,
      },
    });

    await this.recordDeliveryRecords({
      actor,
      sourceType: 'event',
      sourceId: event.id,
      eventId: event.id,
      audienceType: event.audienceType,
      classId: event.classId,
      sectionId: event.sectionId,
      title: event.title,
      body: event.description ?? event.title,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    await this.auditService.record({
      action: 'create',
      resource: 'event',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: event.id,
      after: {
        title: event.title,
        eventType: event.eventType,
        audienceType: event.audienceType,
      },
    });

    return event;
  }

  async listDeliveries(actor: AuthContext) {
    return this.prisma.notificationDelivery.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        guardian: true,
        student: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async listConsents(actor: AuthContext) {
    return this.prisma.guardianConsent.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        guardian: true,
      },
      orderBy: [{ capturedAt: 'desc' }],
    });
  }

  async captureConsent(dto: CaptureConsentDto, actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, tenantId: actor.tenantId },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian not found in this tenant');
    }

    const consent = await this.prisma.guardianConsent.create({
      data: {
        tenantId: actor.tenantId,
        guardianId: guardian.id,
        consentType: dto.consentType,
        granted: dto.granted ?? true,
        version: dto.version,
        revokedAt: dto.granted === false ? new Date() : null,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    if (dto.consentType === ConsentType.PRIVACY && consent.granted) {
      await this.prisma.guardian.update({
        where: { id: guardian.id },
        data: { privacyConsentAt: consent.capturedAt },
      });
    }

    await this.auditService.record({
      action: 'capture',
      resource: 'guardian_consent',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: consent.id,
      after: {
        guardianId: guardian.id,
        consentType: consent.consentType,
        granted: consent.granted,
      },
    });

    return consent;
  }

  async getGuardianConsentStatus(guardianId: string, actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: guardianId, tenantId: actor.tenantId },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian not found in this tenant');
    }

    const consents = await this.prisma.guardianConsent.findMany({
      where: {
        tenantId: actor.tenantId,
        guardianId,
      },
      orderBy: [{ capturedAt: 'desc' }],
    });
    const latestByType = new Map<ConsentType, (typeof consents)[number]>();

    for (const consent of consents) {
      if (!latestByType.has(consent.consentType)) {
        latestByType.set(consent.consentType, consent);
      }
    }

    return Object.values(ConsentType).map((consentType) => {
      const latest = latestByType.get(consentType);

      return {
        guardianId,
        consentType,
        granted: Boolean(latest?.granted && !latest.revokedAt),
        latestConsentId: latest?.id ?? null,
        version: latest?.version ?? null,
        capturedAt: latest?.capturedAt ?? null,
        revokedAt: latest?.revokedAt ?? null,
      };
    });
  }

  async recordDeliveryRecords(input: DeliveryRecordInput) {
    const recipients = await this.resolveAudienceRecipients(input);
    const { allowedRecipients, skippedRecipients } =
      await this.partitionRecipientsByConsent(input, recipients);

    if (recipients.length === 0) {
      return { count: 0 };
    }

    await this.prisma.notificationDelivery.createMany({
      data: [
        ...allowedRecipients.flatMap((recipient) =>
          input.channels.map((channel) => ({
            tenantId: input.actor.tenantId,
            channel,
            status: NotificationStatus.SENT,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            audienceType: input.audienceType,
            recipientUserId: recipient.userId,
            guardianId: recipient.guardianId,
            studentId: recipient.studentId,
            noticeId: input.noticeId ?? null,
            eventId: input.eventId ?? null,
            activityPostId: input.activityPostId ?? null,
            destination: resolveDestination(recipient, channel),
            title: input.title,
            body: input.body,
            sentAt: new Date(),
          })),
        ),
        ...skippedRecipients.flatMap((recipient) =>
          input.channels.map((channel) => ({
            tenantId: input.actor.tenantId,
            channel,
            status: NotificationStatus.SKIPPED,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            audienceType: input.audienceType,
            recipientUserId: recipient.userId,
            guardianId: recipient.guardianId,
            studentId: recipient.studentId,
            noticeId: input.noticeId ?? null,
            eventId: input.eventId ?? null,
            activityPostId: input.activityPostId ?? null,
            destination: resolveDestination(recipient, channel),
            title: input.title,
            body: input.body,
            errorMessage: `Missing required consent: ${input.requiredConsentTypes?.join(
              ', ',
            )}`,
            sentAt: null,
          })),
        ),
      ],
    });

    await this.auditService.record({
      action: 'record',
      resource: 'notification_delivery',
      tenantId: input.actor.tenantId,
      userId: input.actor.userId,
      resourceId: input.sourceId,
      after: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        audienceType: input.audienceType,
        recipientCount: allowedRecipients.length,
        skippedRecipientCount: skippedRecipients.length,
        channelCount: input.channels.length,
      },
    });

    return {
      count:
        (allowedRecipients.length + skippedRecipients.length) *
        input.channels.length,
      sentCount: allowedRecipients.length * input.channels.length,
      skippedCount: skippedRecipients.length * input.channels.length,
    };
  }

  private async ensureAudienceRefs(
    actor: AuthContext,
    classId?: string,
    sectionId?: string,
  ) {
    if (classId) {
      const classroom = await this.prisma.class.findFirst({
        where: { id: classId, tenantId: actor.tenantId },
      });

      if (!classroom) {
        throw new NotFoundException('Class not found in this tenant');
      }
    }

    if (sectionId) {
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId, tenantId: actor.tenantId },
      });

      if (!section) {
        throw new NotFoundException('Section not found in this tenant');
      }
    }
  }

  private async resolveAudienceRecipients(
    input: DeliveryRecordInput,
  ): Promise<DeliveryRecipient[]> {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: input.actor.tenantId,
        ...(input.audienceType === AudienceType.CLASS && input.classId
          ? { classId: input.classId }
          : {}),
        ...(input.audienceType === AudienceType.SECTION && input.sectionId
          ? { sectionId: input.sectionId }
          : {}),
        ...(input.studentIds?.length ? { id: { in: input.studentIds } } : {}),
      },
      include: {
        user: true,
        guardianLinks: {
          include: {
            guardian: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    const recipients: DeliveryRecipient[] = [];

    for (const student of students) {
      const guardians = student.guardianLinks.filter(
        (link) => link.isPrimary || link.guardian.receivesAlerts,
      );

      if (guardians.length === 0) {
        recipients.push({
          studentId: student.id,
          guardianId: null,
          userId: student.userId,
          email: student.user?.email ?? null,
          phone: student.user?.phone ?? null,
        });

        continue;
      }

      for (const link of guardians) {
        recipients.push({
          studentId: student.id,
          guardianId: link.guardian.id,
          userId: link.guardian.userId,
          email: link.guardian.email ?? link.guardian.user?.email ?? null,
          phone: link.guardian.primaryPhone,
        });
      }
    }

    return recipients;
  }

  private async partitionRecipientsByConsent(
    input: DeliveryRecordInput,
    recipients: DeliveryRecipient[],
  ) {
    const requiredConsentTypes = input.requiredConsentTypes ?? [];

    if (requiredConsentTypes.length === 0) {
      return {
        allowedRecipients: recipients,
        skippedRecipients: [],
      };
    }

    const guardianIds = Array.from(
      new Set(
        recipients
          .map((recipient) => recipient.guardianId)
          .filter((guardianId): guardianId is string => Boolean(guardianId)),
      ),
    );
    const consents = await this.prisma.guardianConsent.findMany({
      where: {
        tenantId: input.actor.tenantId,
        guardianId: { in: guardianIds },
        consentType: { in: requiredConsentTypes },
      },
      orderBy: [{ capturedAt: 'desc' }],
    });
    const latestByGuardianAndType = new Map<
      string,
      (typeof consents)[number]
    >();

    for (const consent of consents) {
      const key = `${consent.guardianId}:${consent.consentType}`;
      if (!latestByGuardianAndType.has(key)) {
        latestByGuardianAndType.set(key, consent);
      }
    }

    const allowedRecipients: DeliveryRecipient[] = [];
    const skippedRecipients: DeliveryRecipient[] = [];

    for (const recipient of recipients) {
      if (!recipient.guardianId) {
        allowedRecipients.push(recipient);
        continue;
      }

      const hasAllConsents = requiredConsentTypes.every((consentType) => {
        const latest = latestByGuardianAndType.get(
          `${recipient.guardianId}:${consentType}`,
        );

        return Boolean(latest?.granted && !latest.revokedAt);
      });

      if (hasAllConsents) {
        allowedRecipients.push(recipient);
      } else {
        skippedRecipients.push(recipient);
      }
    }

    return {
      allowedRecipients,
      skippedRecipients,
    };
  }
}

type DeliveryRecordInput = {
  actor: AuthContext;
  sourceType: string;
  sourceId: string;
  noticeId?: string | null;
  eventId?: string | null;
  activityPostId?: string | null;
  audienceType: AudienceType;
  classId?: string | null;
  sectionId?: string | null;
  studentIds?: string[];
  title: string;
  body: string;
  channels: NotificationChannel[];
  requiredConsentTypes?: ConsentType[];
};

type DeliveryRecipient = {
  studentId: string;
  guardianId: string | null;
  userId: string | null;
  email: string | null;
  phone: string | null;
};

function resolveDestination(
  recipient: DeliveryRecipient,
  channel: NotificationChannel,
) {
  if (channel === NotificationChannel.EMAIL) {
    return recipient.email;
  }

  if (channel === NotificationChannel.SMS) {
    return recipient.phone;
  }

  return recipient.userId ?? recipient.phone ?? recipient.email;
}
