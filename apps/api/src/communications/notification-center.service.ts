import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

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
}

export interface NotificationCenterSummary {
  unreadCount: number;
  items: NotificationCenterItem[];
}

@Injectable()
export class NotificationCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getCenter(actor: AuthContext): Promise<NotificationCenterSummary> {
    const [items, unreadCount] = await Promise.all([
      this.getRecentItems(actor),
      this.getUnreadCount(actor),
    ]);

    return { unreadCount, items };
  }

  async getRecentItems(actor: AuthContext): Promise<NotificationCenterItem[]> {
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
        r."readAt"
      FROM "NotificationDelivery" d
      LEFT JOIN "NotificationReadReceipt" r
        ON r."tenantId" = d."tenantId"
       AND r."notificationDeliveryId" = d."id"
       AND r."userId" = ${actor.userId}
      WHERE d."tenantId" = ${actor.tenantId}
        ${this.visibilitySql(actor)}
      ORDER BY d."createdAt" DESC
      LIMIT 20
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

    return { success: true };
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

  private visibilitySql(actor: AuthContext) {
    if (canReadAllTenantNotifications(actor)) {
      return Prisma.empty;
    }

    return Prisma.sql`AND d."recipientUserId" = ${actor.userId}`;
  }
}

function canReadAllTenantNotifications(actor: AuthContext) {
  return (
    actor.roles.includes('super_admin') ||
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
  };
}

function resolveNotificationHref(row: NotificationCenterRow) {
  if (row.noticeId) {
    return '/dashboard/notices';
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
