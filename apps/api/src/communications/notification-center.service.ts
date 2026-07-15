import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationCenterQueryDto } from './dto/communication-list-query.dto';

interface NotificationCenterRow {
  id: string;
  tenantId: string;
  channel: string;
  status: string;
  sourceType: string;
  sourceId: string;
  audienceType: string;
  recipientUserId: string | null;
  guardianId: string | null;
  studentId: string | null;
  noticeId: string | null;
  eventId: string | null;
  activityPostId: string | null;
  title: string;
  body: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
  eventType: string | null;
}

export interface NotificationCenterItem {
  id: string;
  channel: string;
  status: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  isRead: boolean;
  linkHref: string;
  category: string;
}

export interface NotificationCenterSummary {
  unreadCount: number;
  items: NotificationCenterItem[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

@Injectable()
export class NotificationCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getCenter(
    actor: AuthContext,
    query: NotificationCenterQueryDto = { page: 1, limit: 25 },
  ): Promise<NotificationCenterSummary> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const [items, unreadCount, total] = await Promise.all([
      this.getRecentItems(actor, page, limit, query),
      this.getUnreadCount(actor),
      this.getTotalCount(actor, query),
    ]);

    return {
      unreadCount,
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async getRecentItems(
    actor: AuthContext,
    page = 1,
    limit = 25,
    query: NotificationCenterQueryDto = {},
  ): Promise<NotificationCenterItem[]> {
    const rows = await this.prisma.$queryRaw<
      NotificationCenterRow[]
    >(Prisma.sql`
      SELECT
        d."id",
        d."tenantId",
        d."channel"::text AS "channel",
        d."status"::text AS "status",
        d."sourceType",
        d."sourceId",
        d."audienceType"::text AS "audienceType",
        d."recipientUserId",
        d."guardianId",
        d."studentId",
        d."noticeId",
        d."eventId",
        d."activityPostId",
        d."title",
        d."body",
        d."errorMessage",
        d."sentAt",
        d."createdAt",
        r."readAt",
        ne."type"::text AS "eventType"
      FROM "NotificationDelivery" d
      LEFT JOIN "NotificationReadReceipt" r
        ON r."tenantId" = d."tenantId"
       AND r."notificationDeliveryId" = d."id"
       AND r."userId" = ${actor.userId}
      LEFT JOIN "NotificationEvent" ne
        ON ne."id" = d."notificationEventId"
       AND ne."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${actor.tenantId}
        ${this.visibilitySql(actor)}
        ${notificationCenterFilterSql(query)}
      ORDER BY d."createdAt" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `);

    return rows.map((row) => toCenterItem(row));
  }

  async getUnreadCount(actor: AuthContext) {
    const rows = await this.prisma.$queryRaw<
      Array<{ count: bigint }>
    >(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "NotificationDelivery" d
      LEFT JOIN "NotificationReadReceipt" r
        ON r."tenantId" = d."tenantId"
       AND r."notificationDeliveryId" = d."id"
       AND r."userId" = ${actor.userId}
      WHERE d."tenantId" = ${actor.tenantId}
        AND r."notificationDeliveryId" IS NULL
        ${this.visibilitySql(actor)}
    `);

    return Number(rows[0]?.count ?? 0);
  }

  private async getTotalCount(
    actor: AuthContext,
    query: NotificationCenterQueryDto,
  ) {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "NotificationDelivery" d
        LEFT JOIN "NotificationReadReceipt" r
          ON r."tenantId" = d."tenantId"
         AND r."notificationDeliveryId" = d."id"
         AND r."userId" = ${actor.userId}
        LEFT JOIN "NotificationEvent" ne
          ON ne."id" = d."notificationEventId"
         AND ne."tenantId" = d."tenantId"
        WHERE d."tenantId" = ${actor.tenantId}
          ${this.visibilitySql(actor)}
          ${notificationCenterFilterSql(query)}
      `,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async markRead(notificationId: string, actor: AuthContext) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT d."id"
      FROM "NotificationDelivery" d
      WHERE d."id" = ${notificationId}
        AND d."tenantId" = ${actor.tenantId}
        ${this.visibilitySql(actor)}
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('Notification not found');
    }

    await this.insertReadReceipt(actor, notificationId);

    return { success: true };
  }

  async markNoticeRead(noticeId: string, actor: AuthContext) {
    const deliveries = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT d."id"
        FROM "NotificationDelivery" d
        WHERE d."noticeId" = ${noticeId}
          AND d."tenantId" = ${actor.tenantId}
          ${this.visibilitySql(actor)}
      `,
    );

    if (deliveries.length === 0) {
      const notice = await this.prisma.notice.findFirst({
        where: { id: noticeId, tenantId: actor.tenantId },
        select: { id: true },
      });

      if (!notice) {
        throw new NotFoundException('Notice not found');
      }
    }

    for (const delivery of deliveries) {
      await this.insertReadReceipt(actor, delivery.id);
    }

    return { success: true, markedCount: deliveries.length };
  }

  async markAllRead(actor: AuthContext) {
    const result = await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "NotificationReadReceipt" (
        "tenantId",
        "notificationDeliveryId",
        "userId",
        "readAt"
      )
      SELECT d."tenantId", d."id", ${actor.userId}, NOW()
      FROM "NotificationDelivery" d
      LEFT JOIN "NotificationReadReceipt" r
        ON r."tenantId" = d."tenantId"
       AND r."notificationDeliveryId" = d."id"
       AND r."userId" = ${actor.userId}
      WHERE d."tenantId" = ${actor.tenantId}
        AND r."notificationDeliveryId" IS NULL
        ${this.visibilitySql(actor)}
      ON CONFLICT ("tenantId", "notificationDeliveryId", "userId")
      DO UPDATE SET "readAt" = EXCLUDED."readAt"
    `);

    return { success: true, markedCount: Number(result) };
  }

  private async insertReadReceipt(actor: AuthContext, notificationId: string) {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "NotificationReadReceipt" (
        "tenantId",
        "notificationDeliveryId",
        "userId",
        "readAt"
      ) VALUES (${actor.tenantId}, ${notificationId}, ${actor.userId}, NOW())
      ON CONFLICT ("tenantId", "notificationDeliveryId", "userId")
      DO UPDATE SET "readAt" = EXCLUDED."readAt"
    `);
  }

  private visibilitySql(actor: AuthContext) {
    if (canReadAllTenantNotifications(actor)) {
      return Prisma.empty;
    }

    return Prisma.sql`AND d."recipientUserId" = ${actor.userId}`;
  }
}

function canReadAllTenantNotifications(actor: AuthContext) {
  return (
    actor.roles.includes('platform_super_admin') ||
    actor.roles.includes('admin') ||
    actor.roles.includes('principal') ||
    actor.permissions.includes('communications:read_deliveries')
  );
}

function toCenterItem(row: NotificationCenterRow): NotificationCenterItem {
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    isRead: Boolean(row.readAt),
    linkHref: resolveNotificationHref(row),
    category: notificationCategory(row.eventType, row.sourceType),
  };
}

function resolveNotificationHref(row: NotificationCenterRow) {
  if (row.noticeId) {
    return `/dashboard/notices/${encodeURIComponent(row.noticeId)}`;
  }

  if (row.eventId) {
    return '/dashboard/notices';
  }

  if (row.activityPostId) {
    return '/dashboard/activity';
  }

  if (row.sourceType.startsWith('attendance')) {
    return '/dashboard/attendance';
  }

  if (row.sourceType.startsWith('fee')) {
    return '/dashboard/finance';
  }

  return '/dashboard/notices';
}

function notificationCenterFilterSql(query: NotificationCenterQueryDto) {
  const readFilter =
    query.readStatus === 'READ'
      ? Prisma.sql`AND r."notificationDeliveryId" IS NOT NULL`
      : query.readStatus === 'UNREAD'
        ? Prisma.sql`AND r."notificationDeliveryId" IS NULL`
        : Prisma.empty;
  const categoryFilter = query.category
    ? Prisma.sql`AND ${notificationCategorySql()} = ${query.category}`
    : Prisma.empty;
  return Prisma.sql`${readFilter} ${categoryFilter}`;
}

function notificationCategorySql() {
  return Prisma.sql`(
    CASE
      WHEN COALESCE(ne."type"::text, '') LIKE 'ATTENDANCE_%' OR d."sourceType" LIKE 'attendance%' THEN 'ATTENDANCE'
      WHEN ne."type"::text = 'FEE_PAYMENT_CONFIRMED' OR d."sourceType" LIKE '%fee%' THEN 'FEES'
      WHEN COALESCE(ne."type"::text, '') LIKE 'NOTICE_%' OR d."sourceType" = 'notice' THEN 'NOTICE'
      WHEN d."sourceType" LIKE '%security%' OR d."sourceType" LIKE '%auth%' THEN 'SECURITY'
      WHEN d."sourceType" LIKE '%emergency%' THEN 'EMERGENCY'
      ELSE 'GENERAL'
    END
  )`;
}

function notificationCategory(eventType: string | null, sourceType: string) {
  if (
    eventType?.startsWith('ATTENDANCE_') ||
    sourceType.startsWith('attendance')
  )
    return 'ATTENDANCE';
  if (eventType === 'FEE_PAYMENT_CONFIRMED' || sourceType.includes('fee'))
    return 'FEES';
  if (eventType?.startsWith('NOTICE_') || sourceType === 'notice')
    return 'NOTICE';
  if (sourceType.includes('security') || sourceType.includes('auth'))
    return 'SECURITY';
  if (sourceType.includes('emergency')) return 'EMERGENCY';
  return 'GENERAL';
}
