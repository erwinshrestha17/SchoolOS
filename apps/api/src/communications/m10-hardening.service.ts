import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NotificationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { decryptSensitiveField } from '../common/security/field-encryption';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from './communications.service';
import { DeliveryRetryService } from './delivery-retry.service';
import {
  CommunicationAuditQueryDto,
  CommunicationPreferenceDto,
  CreateConsentTemplateDto,
  ProviderDeliveryStatusDto,
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

const COMMUNICATION_AUDIT_RESOURCES = [
  'notice',
  'notification_delivery',
  'guardian_consent',
  'consent_template',
  'communication_preference',
  'parent_teacher_thread',
  'parent_teacher_message',
  'chat_escalation',
  'chat_abuse_report',
];

const RETENTION_POLICY_DAYS = {
  notificationDeliveries: 730,
  noticeReadReceipts: 730,
  closedChatMessages: 1095,
  closedChatThreads: 1095,
  resolvedEscalations: 1095,
  reviewedAbuseReports: 1825,
};

@Injectable()
export class M10HardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly deliveryRetryService: DeliveryRetryService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
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

  async getRetentionPolicyStatus(actor: AuthContext) {
    const generatedAt = new Date();
    const cutoffs = {
      notificationDeliveries: daysAgo(
        generatedAt,
        RETENTION_POLICY_DAYS.notificationDeliveries,
      ),
      noticeReadReceipts: daysAgo(
        generatedAt,
        RETENTION_POLICY_DAYS.noticeReadReceipts,
      ),
      closedChatMessages: daysAgo(
        generatedAt,
        RETENTION_POLICY_DAYS.closedChatMessages,
      ),
      closedChatThreads: daysAgo(
        generatedAt,
        RETENTION_POLICY_DAYS.closedChatThreads,
      ),
      resolvedEscalations: daysAgo(
        generatedAt,
        RETENTION_POLICY_DAYS.resolvedEscalations,
      ),
      reviewedAbuseReports: daysAgo(
        generatedAt,
        RETENTION_POLICY_DAYS.reviewedAbuseReports,
      ),
    };

    const [
      notificationDeliveries,
      noticeReadReceipts,
      closedChatMessages,
      closedChatThreads,
      resolvedEscalations,
      reviewedAbuseReports,
    ] = await Promise.all([
      this.prisma.notificationDelivery.count({
        where: {
          tenantId: actor.tenantId,
          createdAt: { lt: cutoffs.notificationDeliveries },
        },
      }),
      this.prisma.noticeReadReceipt.count({
        where: {
          tenantId: actor.tenantId,
          createdAt: { lt: cutoffs.noticeReadReceipts },
        },
      }),
      this.prisma.parentTeacherMessage.count({
        where: {
          tenantId: actor.tenantId,
          createdAt: { lt: cutoffs.closedChatMessages },
          thread: { status: 'CLOSED' },
        },
      }),
      this.prisma.parentTeacherThread.count({
        where: {
          tenantId: actor.tenantId,
          status: 'CLOSED',
          updatedAt: { lt: cutoffs.closedChatThreads },
        },
      }),
      this.prisma.chatEscalation.count({
        where: {
          tenantId: actor.tenantId,
          status: 'RESOLVED',
          resolvedAt: { lt: cutoffs.resolvedEscalations },
        },
      }),
      this.prisma.chatAbuseReport.count({
        where: {
          tenantId: actor.tenantId,
          status: { not: 'OPEN' },
          reviewedAt: { lt: cutoffs.reviewedAbuseReports },
        },
      }),
    ]);

    return {
      tenantId: actor.tenantId,
      generatedAt: generatedAt.toISOString(),
      mode: 'review_only',
      policies: [
        {
          key: 'notification_deliveries',
          days: RETENTION_POLICY_DAYS.notificationDeliveries,
          cutoff: cutoffs.notificationDeliveries.toISOString(),
          reviewCount: notificationDeliveries,
        },
        {
          key: 'notice_read_receipts',
          days: RETENTION_POLICY_DAYS.noticeReadReceipts,
          cutoff: cutoffs.noticeReadReceipts.toISOString(),
          reviewCount: noticeReadReceipts,
        },
        {
          key: 'closed_chat_messages',
          days: RETENTION_POLICY_DAYS.closedChatMessages,
          cutoff: cutoffs.closedChatMessages.toISOString(),
          reviewCount: closedChatMessages,
        },
        {
          key: 'closed_chat_threads',
          days: RETENTION_POLICY_DAYS.closedChatThreads,
          cutoff: cutoffs.closedChatThreads.toISOString(),
          reviewCount: closedChatThreads,
        },
        {
          key: 'resolved_chat_escalations',
          days: RETENTION_POLICY_DAYS.resolvedEscalations,
          cutoff: cutoffs.resolvedEscalations.toISOString(),
          reviewCount: resolvedEscalations,
        },
        {
          key: 'reviewed_chat_abuse_reports',
          days: RETENTION_POLICY_DAYS.reviewedAbuseReports,
          cutoff: cutoffs.reviewedAbuseReports.toISOString(),
          reviewCount: reviewedAbuseReports,
        },
      ],
    };
  }

  async listCommunicationAuditTrail(
    query: CommunicationAuditQueryDto,
    actor: AuthContext,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const resource = query.resource?.trim();

    if (resource && !COMMUNICATION_AUDIT_RESOURCES.includes(resource)) {
      throw new BadRequestException('Unsupported communication audit resource');
    }

    const where: Prisma.AuditLogWhereInput = {
      tenantId: actor.tenantId,
      resource: resource ?? { in: COMMUNICATION_AUDIT_RESOURCES },
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        resource: item.resource,
        resourceId: item.resourceId,
        userId: item.userId,
        requestId: item.requestId,
        before: item.before,
        after: item.after,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async retryDeliveryWithMetadata(
    deliveryId: string,
    dto: RetryDeliveryDto,
    actor: AuthContext,
  ) {
    return this.deliveryRetryService.retryDelivery(deliveryId, actor, {
      reason: dto.reason ?? null,
    });
  }

  async recordProviderDeliveryStatus(
    dto: ProviderDeliveryStatusDto,
    actor: AuthContext,
  ) {
    await this.verifyProviderCallbackSignature(dto, actor);

    if (!dto.deliveryId && !dto.providerMessageId) {
      throw new BadRequestException(
        'deliveryId or providerMessageId is required',
      );
    }

    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: {
        tenantId: actor.tenantId,
        OR: [
          ...(dto.deliveryId ? [{ id: dto.deliveryId }] : []),
          ...(dto.providerMessageId
            ? [{ providerMessageId: dto.providerMessageId }]
            : []),
        ],
      },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery record not found in this tenant');
    }

    if (
      dto.providerMessageId &&
      delivery.providerMessageId &&
      delivery.providerMessageId !== dto.providerMessageId
    ) {
      throw new BadRequestException(
        'Provider message id does not match delivery record',
      );
    }

    const incomingStatus = dto.status as NotificationStatus;
    const decision = resolveDeliveryStatusTransition(
      delivery.status,
      incomingStatus,
    );

    if (!decision.apply) {
      await this.auditService.record({
        action: 'provider_status_ignored',
        resource: 'notification_delivery',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: delivery.id,
        before: { status: delivery.status },
        after: {
          attemptedStatus: incomingStatus,
          providerMessageId: dto.providerMessageId ?? null,
          reason: decision.reason,
        },
      });

      return {
        deliveryId: delivery.id,
        status: delivery.status,
        ignored: true,
        reason: decision.reason,
      };
    }

    const updated = await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: incomingStatus,
        providerMessageId:
          dto.providerMessageId ?? delivery.providerMessageId ?? undefined,
        failureCode:
          incomingStatus === NotificationStatus.FAILED
            ? (dto.failureCode ?? null)
            : null,
        failureReason:
          incomingStatus === NotificationStatus.FAILED
            ? sanitizeProviderFailureReason(dto.failureReason ?? null)
            : null,
        errorMessage:
          incomingStatus === NotificationStatus.FAILED
            ? sanitizeProviderFailureReason(
                dto.failureReason ?? dto.failureCode ?? 'Provider failed',
              )
            : null,
        sentAt:
          (incomingStatus === NotificationStatus.SENT ||
            incomingStatus === NotificationStatus.DELIVERED) &&
          !delivery.sentAt
            ? new Date()
            : undefined,
        deliveredAt:
          incomingStatus === NotificationStatus.DELIVERED
            ? new Date()
            : undefined,
        failedAt:
          incomingStatus === NotificationStatus.FAILED ? new Date() : null,
      },
    });

    await this.auditService.record({
      action: 'provider_status_update',
      resource: 'notification_delivery',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: delivery.id,
      before: {
        status: delivery.status,
        providerMessageId: delivery.providerMessageId,
      },
      after: {
        status: updated.status,
        providerMessageId: updated.providerMessageId,
        failureCode: updated.failureCode,
        failureReason: updated.failureReason,
      },
    });

    return {
      deliveryId: updated.id,
      status: updated.status,
      providerMessageId: updated.providerMessageId,
      updatedAt: new Date().toISOString(),
    };
  }

  private async verifyProviderCallbackSignature(
    dto: ProviderDeliveryStatusDto,
    actor: AuthContext,
  ) {
    const hasProviderCallbackMetadata =
      Boolean(dto.providerType) ||
      Boolean(dto.providerName) ||
      Boolean(dto.signature);

    if (!hasProviderCallbackMetadata) {
      return;
    }

    if (!dto.providerType) {
      throw new BadRequestException(
        'providerType is required for signed provider callbacks',
      );
    }
    if (!dto.signature) {
      throw new BadRequestException(
        'signature is required for provider callbacks',
      );
    }

    const provider = await this.prisma.providerConfig.findFirst({
      where: {
        type: dto.providerType,
        enabled: true,
        ...(dto.providerName ? { name: dto.providerName } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    if (!provider) {
      throw new BadRequestException(
        `Provider ${dto.providerType} is disabled or not configured.`,
      );
    }

    const config = this.decryptProviderConfig(
      provider.configEncrypted as Record<string, unknown>,
      provider.secretKeys,
    );
    const signingSecret = getProviderCallbackSecret(config);

    if (!signingSecret) {
      throw new BadRequestException(
        'Provider callback signing secret is not configured.',
      );
    }

    if (!verifyProviderCallbackSignature(dto, signingSecret)) {
      await this.auditService.record({
        action: 'provider_status_rejected',
        resource: 'notification_delivery',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          providerType: dto.providerType,
          providerName: dto.providerName ?? provider.name,
          deliveryId: dto.deliveryId ?? null,
          providerMessageId: dto.providerMessageId ?? null,
          reason: 'invalid_signature',
        },
      });
      throw new ForbiddenException('Invalid provider callback signature.');
    }
  }

  private decryptProviderConfig(
    config: Record<string, unknown>,
    secretKeys: string[],
  ) {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config ?? {})) {
      output[key] =
        secretKeys.includes(key) && typeof value === 'string'
          ? decryptSensitiveField(value, this.configService.jwtSecret)
          : value;
    }
    return output;
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

    const results: unknown[] = [];
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

function daysAgo(now: Date, days: number) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

function resolveDeliveryStatusTransition(
  current: NotificationStatus,
  incoming: NotificationStatus,
) {
  if (current === incoming) {
    return { apply: false, reason: 'duplicate_status' };
  }

  if (current === NotificationStatus.DELIVERED) {
    return { apply: false, reason: 'delivered_is_terminal' };
  }

  if (
    current === NotificationStatus.CANCELLED ||
    current === NotificationStatus.SKIPPED
  ) {
    return { apply: false, reason: 'delivery_not_provider_retryable' };
  }

  if (
    current === NotificationStatus.FAILED &&
    incoming === NotificationStatus.SENT
  ) {
    return { apply: false, reason: 'sent_status_cannot_clear_failure' };
  }

  return { apply: true, reason: null };
}

function sanitizeProviderFailureReason(reason: string | null | undefined) {
  if (!reason) return null;
  return reason
    .replace(
      /(secret|token|key|password|authorization|bearer)=[^\s,;]+/gi,
      '$1=***',
    )
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer ***')
    .slice(0, 500);
}

function getProviderCallbackSecret(config: Record<string, unknown>) {
  for (const key of [
    'callbackSecret',
    'webhookSecret',
    'signingSecret',
    'providerWebhookSecret',
  ]) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

function verifyProviderCallbackSignature(
  dto: ProviderDeliveryStatusDto,
  signingSecret: string,
) {
  const expected = createHmac('sha256', signingSecret)
    .update(stableStringify(providerCallbackSigningPayload(dto)))
    .digest('hex');
  const normalized = dto.signature?.trim().replace(/^sha256=/i, '') ?? '';
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(normalized, 'hex');

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function providerCallbackSigningPayload(dto: ProviderDeliveryStatusDto) {
  return {
    deliveryId: dto.deliveryId ?? null,
    failureCode: dto.failureCode ?? null,
    failureReason: dto.failureReason ?? null,
    providerMessageId: dto.providerMessageId ?? null,
    providerName: dto.providerName ?? null,
    providerType: dto.providerType ?? null,
    status: dto.status,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
