import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AudienceType,
  AuthMethod,
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
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async listNotices(actor: AuthContext) {
    return this.prisma.notice.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
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
      take: 100,
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

  async getDeliveryAnalytics(actor: AuthContext) {
    const [byStatus, byChannel, emergencyCount] = await Promise.all([
      this.prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: { tenantId: actor.tenantId },
        _count: { status: true },
      }),
      this.prisma.notificationDelivery.groupBy({
        by: ['channel'],
        where: { tenantId: actor.tenantId },
        _count: { channel: true },
      }),
      this.prisma.notice.count({
        where: {
          tenantId: actor.tenantId,
          priority: NoticePriority.EMERGENCY,
        },
      }),
    ]);

    return {
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count.status,
      })),
      byChannel: byChannel.map((row) => ({
        channel: row.channel,
        count: row._count.channel,
      })),
      emergencyNoticeCount: emergencyCount,
    };
  }

  async processScheduledNotices(actor: AuthContext) {
    const now = new Date();
    const dueNotices = await this.prisma.notice.findMany({
      where: {
        tenantId: actor.tenantId,
        publishedAt: null,
        scheduledFor: { lte: now },
      },
    });
    const results: Array<{ noticeId: string; deliveryCount: number }> = [];

    for (const notice of dueNotices) {
      await this.prisma.notice.update({
        where: { id: notice.id },
        data: { publishedAt: now },
      });

      const delivery = await this.recordDeliveryRecords({
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

      results.push({
        noticeId: notice.id,
        deliveryCount: delivery.count,
      });
    }

    await this.auditService.record({
      action: 'process',
      resource: 'scheduled_notices',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        processed: results.length,
      },
    });

    return {
      processed: results.length,
      results,
    };
  }

  async listConsents(actor: AuthContext) {
    return this.prisma.guardianConsent.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        guardian: true,
      },
      orderBy: [{ capturedAt: 'desc' }],
      take: 100,
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
    const existingDeliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        tenantId: input.actor.tenantId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingDeliveries.length > 0) {
      return summarizeExistingDeliveries(existingDeliveries);
    }

    const recipients = await this.resolveAudienceRecipients(input);
    const { allowedRecipients, skippedRecipients } =
      await this.partitionRecipientsByConsent(input, recipients);

    if (recipients.length === 0) {
      return { count: 0 };
    }

    const queuedDeliveries = await this.createDeliveryRows(
      input,
      allowedRecipients,
      NotificationStatus.QUEUED,
    );
    const skippedDeliveries = await this.createDeliveryRows(
      input,
      skippedRecipients,
      NotificationStatus.SKIPPED,
      `Missing required consent: ${input.requiredConsentTypes?.join(', ')}`,
    );

    for (const delivery of queuedDeliveries) {
      await this.dispatchDelivery(delivery);
    }

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
      queuedCount: queuedDeliveries.length,
      failedCount: 0,
      deliveryIds: [...queuedDeliveries, ...skippedDeliveries].map(
        (delivery) => delivery.id,
      ),
    };
  }

  @OnEvent('student.admitted')
  async handleStudentAdmitted(event: StudentAdmittedEvent) {
    await this.safeRecordDomainDelivery('student.admitted', event, {
      actor: toNotificationActor(event),
      sourceType: 'student_admitted',
      sourceId: `student:${event.studentId}:admitted`,
      audienceType: event.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
      classId: event.classId,
      sectionId: event.sectionId ?? null,
      studentIds: [event.studentId],
      title: 'Student admitted',
      body: `${event.studentName} has been enrolled. Guardian access is ready in SchoolOS.`,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  @OnEvent('attendance.student.absent')
  async handleAttendanceAbsent(event: AttendanceNotificationEvent) {
    await this.safeRecordDomainDelivery('attendance.student.absent', event, {
      actor: toNotificationActor(event),
      sourceType: 'attendance_absent',
      sourceId: `attendance:${event.attendanceSessionId}:${event.studentId}:absent`,
      audienceType: event.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
      classId: event.classId,
      sectionId: event.sectionId ?? null,
      studentIds: [event.studentId],
      title: 'Attendance alert',
      body: 'Your child was marked absent today.',
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  @OnEvent('attendance.student.late')
  async handleAttendanceLate(event: AttendanceNotificationEvent) {
    await this.safeRecordDomainDelivery('attendance.student.late', event, {
      actor: toNotificationActor(event),
      sourceType: 'attendance_late',
      sourceId: `attendance:${event.attendanceSessionId}:${event.studentId}:late`,
      audienceType: event.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
      classId: event.classId,
      sectionId: event.sectionId ?? null,
      studentIds: [event.studentId],
      title: 'Late arrival recorded',
      body: 'Your child was marked late today.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  @OnEvent('attendance.student.leave')
  async handleAttendanceLeave(event: AttendanceNotificationEvent) {
    await this.safeRecordDomainDelivery('attendance.student.leave', event, {
      actor: toNotificationActor(event),
      sourceType: 'attendance_leave',
      sourceId: `attendance:${event.attendanceSessionId}:${event.studentId}:${event.status.toLowerCase()}`,
      audienceType: event.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
      classId: event.classId,
      sectionId: event.sectionId ?? null,
      studentIds: [event.studentId],
      title: 'Leave attendance recorded',
      body: 'A leave attendance status was recorded for your child today.',
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  @OnEvent('attendance.student.consecutive_absence')
  async handleConsecutiveAbsence(event: ConsecutiveAbsenceEvent) {
    await this.safeRecordDomainDelivery(
      'attendance.student.consecutive_absence',
      event,
      {
        actor: toNotificationActor(event),
        sourceType: 'attendance_consecutive_absence',
        sourceId: `attendance:${event.attendanceSessionId}:${event.studentId}:consecutive:${event.consecutiveAbsences}`,
        audienceType: event.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        classId: event.classId,
        sectionId: event.sectionId ?? null,
        studentIds: [event.studentId],
        title: 'Consecutive absence warning',
        body: `Your child has ${event.consecutiveAbsences} consecutive absences. Please contact the school.`,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      },
    );
  }

  @OnEvent('fees.payment.confirmed')
  async handleFeePaymentConfirmed(event: FeePaymentConfirmedEvent) {
    await this.safeRecordDomainDelivery('fees.payment.confirmed', event, {
      actor: toNotificationActor(event),
      sourceType: 'fee_payment_confirmed',
      sourceId: `fee-payment:${event.paymentId}:confirmed`,
      audienceType: AudienceType.ALL,
      studentIds: [event.studentId],
      title: 'Fee receipt ready',
      body: `Payment of Rs ${event.amount.toFixed(2)} was received. Receipt ${event.receiptNumber ?? 'is ready'}.`,
      channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });
  }

  private async safeRecordDomainDelivery(
    eventName: string,
    event: TenantDomainEvent,
    input: DeliveryRecordInput,
  ) {
    try {
      await this.recordDeliveryRecords(input);
    } catch (error) {
      this.logger.error(
        `Notification event ${eventName} failed for tenant ${event.tenantId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async createDeliveryRows(
    input: DeliveryRecordInput,
    recipients: DeliveryRecipient[],
    status: NotificationStatus,
    errorMessage?: string,
  ) {
    const deliveries: DeliveryRow[] = [];

    for (const recipient of recipients) {
      for (const channel of input.channels) {
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            tenantId: input.actor.tenantId,
            channel,
            status,
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
            errorMessage: errorMessage ?? null,
            sentAt: null,
          },
        });

        deliveries.push(delivery);
      }
    }

    return deliveries;
  }

  private async dispatchDelivery(delivery: DeliveryRow) {
    try {
      if (!delivery.destination) {
        throw new Error(`No destination resolved for ${delivery.channel}`);
      }

      const metadata = {
        tenantId: delivery.tenantId,
        notificationDeliveryId: delivery.id,
        sourceType: delivery.sourceType,
        sourceId: delivery.sourceId,
      };

      if (delivery.channel === NotificationChannel.EMAIL) {
        await this.notificationsService.sendEmail({
          to: delivery.destination,
          subject: delivery.title,
          text: delivery.body,
          metadata,
        });
        return;
      }

      if (delivery.channel === NotificationChannel.SMS) {
        await this.notificationsService.sendSms({
          to: delivery.destination,
          message: delivery.body,
          metadata,
        });
        return;
      }

      await this.notificationsService.sendPushNotification({
        title: delivery.title,
        body: delivery.body,
        audience: delivery.destination,
        metadata,
      });
    } catch (error) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Notification failed',
        },
      });
    }
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

      if (classId && section.classId !== classId) {
        throw new NotFoundException('Section not found in selected class');
      }
    }
  }

  private async ensureStudentRefs(actor: AuthContext, studentIds: string[]) {
    if (studentIds.length === 0) return;

    const count = await this.prisma.student.count({
      where: {
        tenantId: actor.tenantId,
        id: { in: studentIds },
      },
    });

    if (count !== studentIds.length) {
      throw new NotFoundException(
        'One or more students not found in this tenant',
      );
    }
  }

  private async resolveAudienceRecipients(
    input: DeliveryRecordInput,
  ): Promise<DeliveryRecipient[]> {
    if (input.audienceType === AudienceType.ROLE) {
      if (!input.roleNames?.length) {
        return [];
      }
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: input.actor.tenantId,
          userRoles: {
            some: {
              role: {
                name: { in: input.roleNames },
              },
            },
          },
        },
      });

      return users.map((user) => ({
        studentId: '',
        guardianId: null,
        userId: user.id,
        email: user.email,
        phone: user.phone,
      }));
    }

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
        // If audience type is STUDENT but no IDs provided, we return NO ONE (safer)
        ...(input.audienceType === AudienceType.STUDENT &&
        !input.studentIds?.length
          ? { id: 'none' }
          : {}),
      },
      include: {
        user: true,
        guardianLinks: {
          where: input.guardianIds?.length
            ? { guardianId: { in: input.guardianIds } }
            : undefined,
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

interface DeliveryRecordInput {
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
  guardianIds?: string[];
  roleNames?: string[];
  title: string;
  body: string;
  channels: NotificationChannel[];
  requiredConsentTypes?: ConsentType[];
}

interface DeliveryRecipient {
  studentId: string;
  guardianId: string | null;
  userId: string | null;
  email: string | null;
  phone: string | null;
}

interface DeliveryRow {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sourceType: string;
  sourceId: string;
  audienceType: AudienceType;
  recipientUserId: string | null;
  guardianId: string | null;
  studentId: string | null;
  noticeId: string | null;
  eventId: string | null;
  activityPostId: string | null;
  destination: string | null;
  title: string;
  body: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

interface TenantDomainEvent {
  tenantId: string;
  actor?: AuthContext;
}

type StudentAdmittedEvent = TenantDomainEvent & {
  classId: string;
  sectionId?: string | null;
  studentId: string;
  studentName: string;
};

type AttendanceNotificationEvent = TenantDomainEvent & {
  attendanceSessionId: string;
  attendanceDate: Date;
  classId: string;
  sectionId?: string | null;
  studentId: string;
  status: string;
};

type ConsecutiveAbsenceEvent = AttendanceNotificationEvent & {
  consecutiveAbsences: number;
};

type FeePaymentConfirmedEvent = TenantDomainEvent & {
  paymentId: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  method: string;
  receiptNumber?: string | null;
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

function toNotificationActor(event: TenantDomainEvent): AuthContext {
  return (
    event.actor ?? {
      userId: 'system',
      tenantId: event.tenantId,
      tenantSlug: event.tenantId,
      email: null,
      authMethod: AuthMethod.PASSWORD,
      roles: ['system'],
      permissions: [],
    }
  );
}

function summarizeExistingDeliveries(
  deliveries: Array<{ id: string; status: NotificationStatus }>,
) {
  return {
    count: deliveries.length,
    sentCount: deliveries.filter(
      (delivery) => delivery.status === NotificationStatus.SENT,
    ).length,
    skippedCount: deliveries.filter(
      (delivery) => delivery.status === NotificationStatus.SKIPPED,
    ).length,
    queuedCount: deliveries.filter(
      (delivery) => delivery.status === NotificationStatus.QUEUED,
    ).length,
    failedCount: deliveries.filter(
      (delivery) => delivery.status === NotificationStatus.FAILED,
    ).length,
    deliveryIds: deliveries.map((delivery) => delivery.id),
    replayed: true,
  };
}
