import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type UnreadRecipientRow = {
  deliveryId: string;
  channel: string;
  status: string;
  destination: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  recipientUserId: string | null;
  recipientEmail: string | null;
  guardianId: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  studentId: string | null;
  studentSystemId: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  className: string | null;
  sectionName: string | null;
};

export type UnreadNoticeRecipient = {
  deliveryId: string;
  channel: string;
  status: string;
  destination: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  recipientUserId: string | null;
  recipientEmail: string | null;
  guardian: {
    id: string;
    fullName: string;
    primaryPhone: string | null;
    email: string | null;
  } | null;
  student: {
    id: string;
    studentSystemId: string;
    fullName: string;
    className: string | null;
    sectionName: string | null;
  } | null;
};

export type NoticeUnreadRecipientsResult = {
  noticeId: string;
  totalDeliveries: number;
  readCount: number;
  unreadCount: number;
  recipients: UnreadNoticeRecipient[];
};

@Injectable()
export class NoticeUnreadRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnreadRecipients(
    noticeId: string,
    actor: AuthContext,
  ): Promise<NoticeUnreadRecipientsResult> {
    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: actor.tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const [summaryRows, recipientRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          totalDeliveries: bigint;
          readCount: bigint;
          unreadCount: bigint;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS "totalDeliveries",
          COUNT(r."notificationDeliveryId")::bigint AS "readCount",
          (COUNT(*) - COUNT(r."notificationDeliveryId"))::bigint AS "unreadCount"
        FROM "NotificationDelivery" d
        LEFT JOIN "NotificationReadReceipt" r
          ON r."tenantId" = d."tenantId"
         AND r."notificationDeliveryId" = d."id"
        WHERE d."tenantId" = ${actor.tenantId}
          AND d."noticeId" = ${noticeId}
      `),
      this.prisma.$queryRaw<UnreadRecipientRow[]>(Prisma.sql`
        SELECT
          d."id" AS "deliveryId",
          d."channel"::text AS "channel",
          d."status"::text AS "status",
          d."destination",
          d."errorMessage",
          d."sentAt",
          d."createdAt",
          d."recipientUserId",
          u."email" AS "recipientEmail",
          g."id" AS "guardianId",
          g."fullName" AS "guardianName",
          g."primaryPhone" AS "guardianPhone",
          g."email" AS "guardianEmail",
          s."id" AS "studentId",
          s."studentSystemId",
          s."firstNameEn" AS "studentFirstName",
          s."lastNameEn" AS "studentLastName",
          c."name" AS "className",
          sec."name" AS "sectionName"
        FROM "NotificationDelivery" d
        LEFT JOIN "NotificationReadReceipt" r
          ON r."tenantId" = d."tenantId"
         AND r."notificationDeliveryId" = d."id"
        LEFT JOIN "User" u
          ON u."id" = d."recipientUserId"
         AND u."tenantId" = d."tenantId"
        LEFT JOIN "Guardian" g
          ON g."id" = d."guardianId"
         AND g."tenantId" = d."tenantId"
        LEFT JOIN "Student" s
          ON s."id" = d."studentId"
         AND s."tenantId" = d."tenantId"
        LEFT JOIN "Class" c
          ON c."id" = s."classId"
         AND c."tenantId" = s."tenantId"
        LEFT JOIN "Section" sec
          ON sec."id" = s."sectionId"
         AND sec."tenantId" = s."tenantId"
        WHERE d."tenantId" = ${actor.tenantId}
          AND d."noticeId" = ${noticeId}
          AND r."notificationDeliveryId" IS NULL
        ORDER BY d."createdAt" DESC
        LIMIT 200
      `),
    ]);

    const summary = summaryRows[0];

    return {
      noticeId,
      totalDeliveries: Number(summary?.totalDeliveries ?? 0),
      readCount: Number(summary?.readCount ?? 0),
      unreadCount: Number(summary?.unreadCount ?? 0),
      recipients: recipientRows.map(toUnreadRecipient),
    };
  }
}

function toUnreadRecipient(row: UnreadRecipientRow): UnreadNoticeRecipient {
  const studentFullName = [row.studentFirstName, row.studentLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    deliveryId: row.deliveryId,
    channel: row.channel,
    status: row.status,
    destination: row.destination,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    recipientUserId: row.recipientUserId,
    recipientEmail: row.recipientEmail,
    guardian: row.guardianId
      ? {
          id: row.guardianId,
          fullName: row.guardianName ?? 'Guardian',
          primaryPhone: row.guardianPhone,
          email: row.guardianEmail,
        }
      : null,
    student: row.studentId
      ? {
          id: row.studentId,
          studentSystemId: row.studentSystemId ?? '',
          fullName: studentFullName || 'Student',
          className: row.className,
          sectionName: row.sectionName,
        }
      : null,
  };
}
