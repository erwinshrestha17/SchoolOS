import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  NotificationChannel,
  NoticeLifecycleStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from './communications.service';
import type {
  ListNoticeAcknowledgementsQueryDto,
  NoticeAcknowledgementFollowUpDto,
} from './dto/notice-acknowledgement.dto';
import { NotificationEventService } from './notification-event.service';

interface AcknowledgementRecipientRow {
  recipientUserId: string;
  guardianId: string | null;
  studentId: string | null;
  firstDeliveredAt: Date;
  acknowledgementId: string | null;
  firstAcknowledgedAt: Date | null;
}

@Injectable()
export class NoticeAcknowledgementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationEventService: NotificationEventService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  async acknowledge(noticeId: string, actor: AuthContext) {
    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: {
        tenantId: actor.tenantId,
        noticeId,
        recipientUserId: actor.userId,
        notice: { lifecycleStatus: NoticeLifecycleStatus.PUBLISHED },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        guardianId: true,
        studentId: true,
        notice: { select: { id: true } },
      },
    });
    if (!delivery?.notice) {
      throw new NotFoundException('Published notice is not visible to you');
    }

    if (delivery.guardianId && delivery.studentId) {
      const linkedChild = await this.prisma.studentGuardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          guardianId: delivery.guardianId,
          studentId: delivery.studentId,
          guardian: { userId: actor.userId },
        },
        select: { id: true },
      });
      if (!linkedChild) {
        throw new NotFoundException('Published notice is not visible to you');
      }
    }

    const existing = await this.prisma.noticeAcknowledgement.findUnique({
      where: {
        tenantId_noticeId_recipientUserId: {
          tenantId: actor.tenantId,
          noticeId,
          recipientUserId: actor.userId,
        },
      },
    });
    if (existing) return existing;

    const acknowledgement = await this.prisma.noticeAcknowledgement.upsert({
      where: {
        tenantId_noticeId_recipientUserId: {
          tenantId: actor.tenantId,
          noticeId,
          recipientUserId: actor.userId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        noticeId,
        recipientUserId: actor.userId,
        actorId: actor.userId,
        guardianId: delivery.guardianId,
        studentId: delivery.studentId,
      },
      update: {},
    });
    await this.auditService.record({
      action: 'acknowledge',
      resource: 'notice_acknowledgement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: acknowledgement.id,
      after: {
        noticeId,
        firstAcknowledgedAt: acknowledgement.firstAcknowledgedAt,
      },
    });
    return acknowledgement;
  }

  async listRecipients(
    noticeId: string,
    query: ListNoticeAcknowledgementsQueryDto,
    actor: AuthContext,
  ) {
    await this.assertNotice(actor.tenantId, noticeId);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const offset = (page - 1) * limit;
    const statusClause =
      query.status === 'ACKNOWLEDGED'
        ? Prisma.sql`a."id" IS NOT NULL`
        : Prisma.sql`a."id" IS NULL`;
    const recipients = Prisma.sql`
      SELECT DISTINCT ON (d."recipientUserId")
        d."recipientUserId",
        d."guardianId",
        d."studentId",
        d."createdAt" AS "firstDeliveredAt"
      FROM "NotificationDelivery" d
      WHERE d."tenantId" = ${actor.tenantId}
        AND d."noticeId" = ${noticeId}
        AND d."recipientUserId" IS NOT NULL
      ORDER BY d."recipientUserId", d."createdAt" ASC
    `;
    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<AcknowledgementRecipientRow[]>(Prisma.sql`
        WITH recipients AS (${recipients})
        SELECT
          r.*,
          a."id" AS "acknowledgementId",
          a."firstAcknowledgedAt"
        FROM recipients r
        LEFT JOIN "NoticeAcknowledgement" a
          ON a."tenantId" = ${actor.tenantId}
         AND a."noticeId" = ${noticeId}
         AND a."recipientUserId" = r."recipientUserId"
        WHERE ${statusClause}
        ORDER BY COALESCE(a."firstAcknowledgedAt", r."firstDeliveredAt") DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        WITH recipients AS (${recipients})
        SELECT COUNT(*)::bigint AS "total"
        FROM recipients r
        LEFT JOIN "NoticeAcknowledgement" a
          ON a."tenantId" = ${actor.tenantId}
         AND a."noticeId" = ${noticeId}
         AND a."recipientUserId" = r."recipientUserId"
        WHERE ${statusClause}
      `),
    ]);
    const total = Number(totals[0]?.total ?? 0);
    return {
      items: rows.map((row) => ({
        recipientUserId: row.recipientUserId,
        guardianId: row.guardianId,
        studentId: row.studentId,
        firstDeliveredAt: row.firstDeliveredAt.toISOString(),
        acknowledgementId: row.acknowledgementId,
        firstAcknowledgedAt: row.firstAcknowledgedAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async requestFollowUp(
    noticeId: string,
    dto: NoticeAcknowledgementFollowUpDto,
    actor: AuthContext,
  ) {
    await this.assertNotice(actor.tenantId, noticeId);
    const pendingUsers = await this.prisma.notificationDelivery.findMany({
      where: {
        tenantId: actor.tenantId,
        noticeId,
        recipientUserId: { in: dto.recipientUserIds },
        notice: { lifecycleStatus: NoticeLifecycleStatus.PUBLISHED },
      },
      distinct: ['recipientUserId'],
      select: { recipientUserId: true },
    });
    const acknowledged = await this.prisma.noticeAcknowledgement.findMany({
      where: {
        tenantId: actor.tenantId,
        noticeId,
        recipientUserId: { in: dto.recipientUserIds },
      },
      select: { recipientUserId: true },
    });
    const acknowledgedIds = new Set(
      acknowledged.map((item) => item.recipientUserId),
    );
    const recipientUserIds = pendingUsers
      .map((item) => item.recipientUserId)
      .filter(
        (userId): userId is string =>
          Boolean(userId) && !acknowledgedIds.has(userId as string),
      );
    if (recipientUserIds.length === 0) {
      throw new ConflictException(
        'No pending acknowledgement recipients found',
      );
    }

    const sourceId = `notice:${noticeId}:ack-follow-up:${dto.idempotencyKey}`;
    const event = await this.notificationEventService.accept({
      tenantId: actor.tenantId,
      type: 'NOTICE_ACKNOWLEDGEMENT_FOLLOW_UP',
      sourceEntityId: noticeId,
      actorId: actor.userId,
      idempotencyKey: sourceId,
      metadata: { recipientCount: recipientUserIds.length },
    });
    const result = await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'notice_acknowledgement_follow_up',
      sourceId,
      noticeId,
      notificationEventId: event.id,
      audienceType: AudienceType.ALL,
      recipientUserIds,
      title: 'Notice acknowledgement requested',
      body: 'Please review and acknowledge the school notice.',
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      communicationCategory: 'ESSENTIAL',
    });
    await this.notificationEventService.markDispatched(
      actor.tenantId,
      event.id,
    );
    await this.auditService.record({
      action: 'request_follow_up',
      resource: 'notice_acknowledgement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: noticeId,
      after: {
        reason: dto.reason,
        recipientCount: recipientUserIds.length,
        notificationEventId: event.id,
      },
    });
    return {
      eventId: event.id,
      recipientCount: recipientUserIds.length,
      ...result,
    };
  }

  private async assertNotice(tenantId: string, noticeId: string) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, tenantId },
      select: { id: true },
    });
    if (!notice) throw new NotFoundException('Notice not found');
  }
}
