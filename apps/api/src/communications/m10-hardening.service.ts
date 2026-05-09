import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from './communications.service';
import { DeliveryRetryService } from './delivery-retry.service';
import {
  CommunicationPreferenceDto,
  CreateConsentTemplateDto,
  ResendNoticeDto,
  RetryDeliveryDto,
  UpdateConsentTemplateDto,
} from './dto/m10-hardening.dto';

interface NoticeRow {
  id: string;
  title: string;
  body: string;
  priority: string;
  audienceType: string;
  classId: string | null;
  sectionId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
}

@Injectable()
export class M10HardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly deliveryRetryService: DeliveryRetryService,
    private readonly auditService: AuditService,
  ) {}

  async listNoticesWithReadStatus(actor: AuthContext) {
    const rows = await this.prisma.$queryRaw<NoticeRow[]>(Prisma.sql`
      SELECT
        n."id",
        n."title",
        n."body",
        n."priority"::text AS "priority",
        n."audienceType"::text AS "audienceType",
        n."classId",
        n."sectionId",
        n."publishedAt",
        n."createdAt",
        r."readAt"
      FROM "Notice" n
      LEFT JOIN "NoticeReadReceipt" r
        ON r."tenantId" = n."tenantId"
       AND r."noticeId" = n."id"
       AND r."userId" = ${actor.userId}
      WHERE n."tenantId" = ${actor.tenantId}
      ORDER BY n."createdAt" DESC
      LIMIT 100
    `);

    return rows.map((row) => ({
      ...row,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      isRead: Boolean(row.readAt),
    }));
  }

  async getNoticeDetailWithReadStatus(noticeId: string, actor: AuthContext) {
    const rows = await this.prisma.$queryRaw<NoticeRow[]>(Prisma.sql`
      SELECT
        n."id",
        n."title",
        n."body",
        n."priority"::text AS "priority",
        n."audienceType"::text AS "audienceType",
        n."classId",
        n."sectionId",
        n."publishedAt",
        n."createdAt",
        r."readAt"
      FROM "Notice" n
      LEFT JOIN "NoticeReadReceipt" r
        ON r."tenantId" = n."tenantId"
       AND r."noticeId" = n."id"
       AND r."userId" = ${actor.userId}
      WHERE n."tenantId" = ${actor.tenantId}
        AND n."id" = ${noticeId}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Notice not found in this tenant');
    }

    return {
      ...row,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      isRead: Boolean(row.readAt),
    };
  }

  async markNoticeRead(noticeId: string, actor: AuthContext) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, tenantId: actor.tenantId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found in this tenant');
    }

    const recipient = await this.prisma.notificationDelivery.findFirst({
      where: {
        tenantId: actor.tenantId,
        noticeId,
        recipientUserId: actor.userId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "NoticeReadReceipt" (
        "tenantId",
        "noticeId",
        "userId",
        "recipientUserId",
        "guardianId",
        "studentId",
        "readAt"
      ) VALUES (
        ${actor.tenantId},
        ${noticeId},
        ${actor.userId},
        ${actor.userId},
        ${recipient?.guardianId ?? null},
        ${recipient?.studentId ?? null},
        NOW()
      )
      ON CONFLICT ("tenantId", "noticeId", "userId")
      DO UPDATE SET "readAt" = EXCLUDED."readAt"
    `);

    await this.auditService.record({
      action: 'read',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: noticeId,
    });

    return { success: true, noticeId };
  }

  async retryDeliveryWithMetadata(
    deliveryId: string,
    dto: RetryDeliveryDto,
    actor: AuthContext,
  ) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "NotificationDelivery"
      SET
        "status" = 'RETRYING',
        "retryCount" = "retryCount" + 1,
        "lastRetryAt" = NOW(),
        "retryReason" = ${dto.reason ?? null},
        "requestedById" = ${actor.userId}
      WHERE "id" = ${deliveryId}
        AND "tenantId" = ${actor.tenantId}
        AND "status" IN ('FAILED', 'QUEUED')
    `);

    return this.deliveryRetryService.retryDelivery(deliveryId, actor);
  }

  async resendNoticeFailed(
    noticeId: string,
    dto: ResendNoticeDto,
    actor: AuthContext,
  ) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, tenantId: actor.tenantId },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found in this tenant');
    }

    const failed = await this.prisma.notificationDelivery.findMany({
      where: {
        tenantId: actor.tenantId,
        noticeId,
        status: NotificationStatus.FAILED,
        ...(dto.recipientUserIds?.length
          ? { recipientUserId: { in: dto.recipientUserIds } }
          : {}),
        ...(dto.guardianIds?.length
          ? { guardianId: { in: dto.guardianIds } }
          : {}),
      },
      take: 100,
    });

    const results: any[] = [];
    for (const delivery of failed) {
      results.push(
        await this.retryDeliveryWithMetadata(
          delivery.id,
          { reason: dto.reason },
          actor,
        ),
      );
    }

    await this.auditService.record({
      action: 'resend_failed',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: noticeId,
      after: {
        requested: failed.length,
        retried: results.length,
        reason: dto.reason ?? null,
      },
    });

    return { requested: failed.length, retried: results.length, results };
  }

  async createConsentTemplate(
    dto: CreateConsentTemplateDto,
    actor: AuthContext,
  ) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "ConsentTemplate" (
        "tenantId",
        "key",
        "consentType",
        "version",
        "title",
        "body",
        "effectiveFrom",
        "createdById"
      ) VALUES (
        ${actor.tenantId},
        ${dto.key},
        ${dto.consentType},
        ${dto.version},
        ${dto.title},
        ${dto.body},
        ${dto.effectiveFrom ? new Date(dto.effectiveFrom) : null},
        ${actor.userId}
      )
      RETURNING "id"
    `);

    await this.auditService.record({
      action: 'create',
      resource: 'consent_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: rows[0]?.id,
      after: {
        key: dto.key,
        version: dto.version,
        consentType: dto.consentType,
      },
    });

    return rows[0];
  }

  async listConsentTemplates(actor: AuthContext, activeOnly = false) {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT *
      FROM "ConsentTemplate"
      WHERE "tenantId" = ${actor.tenantId}
        ${activeOnly ? Prisma.sql`AND "status" = 'PUBLISHED'` : Prisma.empty}
      ORDER BY "key" ASC, "version" DESC
    `);
  }

  async updateConsentTemplate(
    templateId: string,
    dto: UpdateConsentTemplateDto,
    actor: AuthContext,
  ) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "ConsentTemplate"
      SET
        "title" = COALESCE(${dto.title ?? null}, "title"),
        "body" = COALESCE(${dto.body ?? null}, "body"),
        "effectiveFrom" = COALESCE(${dto.effectiveFrom ? new Date(dto.effectiveFrom) : null}, "effectiveFrom"),
        "updatedById" = ${actor.userId}
      WHERE "id" = ${templateId}
        AND "tenantId" = ${actor.tenantId}
      RETURNING "id"
    `);

    if (!rows[0]) {
      throw new NotFoundException('Consent template not found in this tenant');
    }

    await this.auditService.record({
      action: 'update',
      resource: 'consent_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: templateId,
    });

    return rows[0];
  }

  async publishConsentTemplate(templateId: string, actor: AuthContext) {
    return this.transitionConsentTemplate(templateId, 'PUBLISHED', actor);
  }

  async archiveConsentTemplate(templateId: string, actor: AuthContext) {
    return this.transitionConsentTemplate(templateId, 'ARCHIVED', actor);
  }

  async getCommunicationPreference(actor: AuthContext) {
    const guardian = await this.getGuardianForActor(actor);
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT * FROM "CommunicationPreference"
      WHERE "tenantId" = ${actor.tenantId}
        AND "guardianId" = ${guardian.id}
      LIMIT 1
    `);
    return {
      guardianId: guardian.id,
      preference: Array.isArray(rows) ? (rows[0] ?? null) : null,
    };
  }

  async marketingOptOut(dto: CommunicationPreferenceDto, actor: AuthContext) {
    return this.setMarketingPreference(true, dto, actor);
  }

  async marketingOptIn(dto: CommunicationPreferenceDto, actor: AuthContext) {
    return this.setMarketingPreference(false, dto, actor);
  }

  private async transitionConsentTemplate(
    templateId: string,
    status: 'PUBLISHED' | 'ARCHIVED',
    actor: AuthContext,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; status: string }>
    >(Prisma.sql`
      UPDATE "ConsentTemplate"
      SET
        "status" = ${status},
        "updatedById" = ${actor.userId},
        "archivedAt" = CASE WHEN ${status} = 'ARCHIVED' THEN NOW() ELSE "archivedAt" END
      WHERE "id" = ${templateId}
        AND "tenantId" = ${actor.tenantId}
      RETURNING "id", "status"
    `);

    if (!rows[0]) {
      throw new NotFoundException('Consent template not found in this tenant');
    }

    await this.auditService.record({
      action: status.toLowerCase(),
      resource: 'consent_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: templateId,
    });

    return rows[0];
  }

  private async setMarketingPreference(
    optOut: boolean,
    dto: CommunicationPreferenceDto,
    actor: AuthContext,
  ) {
    const guardian = await this.getGuardianForActor(actor);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "CommunicationPreference" (
        "tenantId",
        "guardianId",
        "marketingOptOutAt",
        "marketingOptOutById",
        "marketingOptOutReason",
        "marketingOptOutSource"
      ) VALUES (
        ${actor.tenantId},
        ${guardian.id},
        ${optOut ? new Date() : null},
        ${optOut ? actor.userId : null},
        ${optOut ? (dto.reason ?? null) : null},
        ${optOut ? (dto.source ?? 'self_service') : null}
      )
      ON CONFLICT ("tenantId", "guardianId")
      DO UPDATE SET
        "marketingOptOutAt" = EXCLUDED."marketingOptOutAt",
        "marketingOptOutById" = EXCLUDED."marketingOptOutById",
        "marketingOptOutReason" = EXCLUDED."marketingOptOutReason",
        "marketingOptOutSource" = EXCLUDED."marketingOptOutSource",
        "updatedAt" = NOW()
      RETURNING "id"
    `);

    await this.auditService.record({
      action: optOut ? 'marketing_opt_out' : 'marketing_opt_in',
      resource: 'communication_preference',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: rows[0]?.id,
      after: { guardianId: guardian.id, reason: dto.reason ?? null },
    });

    return rows[0];
  }

  private async getGuardianForActor(actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!guardian) {
      throw new NotFoundException(
        'Guardian profile not found for current user',
      );
    }

    return guardian;
  }
}
