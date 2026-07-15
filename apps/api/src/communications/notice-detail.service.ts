import { Injectable, NotFoundException } from '@nestjs/common';
import type { NoticeLifecycleStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';

export interface NoticeDetail {
  id: string;
  title: string;
  body: string;
  priority: string;
  audienceType: string;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  createdBy: {
    id: string;
    email: string | null;
  } | null;
  attachmentUrl: string | null;
  attachmentFileId: string | null;
  lifecycleStatus: NoticeLifecycleStatus;
  approvalRequestId: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  archivedFromStatus: NoticeLifecycleStatus | null;
  createdAt: string;
  updatedAt: string;
  deliverySummary: {
    total: number;
    queued: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  approvalHistory: Array<{
    decision: string;
    reason: string | null;
    actorEmail: string | null;
    createdAt: string;
  }>;
  auditHistory: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
}

@Injectable()
export class NoticeDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async getNoticeDetail(
    noticeId: string,
    actor: AuthContext,
  ): Promise<NoticeDetail> {
    const canAdministerNotice = actor.permissions.some((permission) =>
      NOTICE_ADMINISTRATION_PERMISSIONS.has(permission),
    );
    const canViewReports = actor.permissions.includes('notices:read_reports');
    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: actor.tenantId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    if (!canAdministerNotice) {
      const recipientDelivery =
        await this.prisma.notificationDelivery.findFirst({
          where: {
            tenantId: actor.tenantId,
            noticeId: notice.id,
            recipientUserId: actor.userId,
          },
          select: { id: true },
        });

      if (!recipientDelivery) {
        throw new NotFoundException('Notice not found');
      }
    }

    const [deliveryGroups, auditRows, approvalRequest] = await Promise.all([
      this.prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: {
          tenantId: actor.tenantId,
          noticeId: notice.id,
        },
        _count: {
          status: true,
        },
      }),
      canViewReports
        ? this.prisma.auditLog.findMany({
            where: {
              tenantId: actor.tenantId,
              resource: 'notice',
              resourceId: notice.id,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              action: true,
              createdAt: true,
              user: { select: { email: true } },
            },
          })
        : Promise.resolve([]),
      canViewReports && notice.approvalRequestId
        ? this.prisma.approvalRequest.findFirst({
            where: {
              id: notice.approvalRequestId,
              tenantId: actor.tenantId,
              targetId: notice.id,
            },
            select: {
              decisions: {
                orderBy: { createdAt: 'asc' },
                select: {
                  decision: true,
                  reason: true,
                  createdAt: true,
                  decidedBy: { select: { email: true } },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    const deliveryCounts = new Map(
      deliveryGroups.map((group) => [group.status, group._count.status]),
    );

    const attachment = await this.resolveAttachment(notice, actor);

    return {
      id: notice.id,
      title: notice.title,
      body: notice.body,
      priority: notice.priority,
      audienceType: notice.audienceType,
      classId: notice.classId,
      className: notice.class?.name ?? null,
      sectionId: notice.sectionId,
      sectionName: notice.section?.name ?? null,
      createdBy:
        canAdministerNotice && notice.createdBy
          ? {
              id: notice.createdBy.id,
              email: notice.createdBy.email,
            }
          : null,
      attachmentUrl: attachment.url,
      attachmentFileId: attachment.fileId,
      lifecycleStatus: notice.lifecycleStatus,
      approvalRequestId: notice.approvalRequestId,
      scheduledFor: notice.scheduledFor?.toISOString() ?? null,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
      expiresAt: notice.expiresAt?.toISOString() ?? null,
      cancelledAt: notice.cancelledAt?.toISOString() ?? null,
      cancellationReason: notice.cancellationReason,
      archivedAt: notice.archivedAt?.toISOString() ?? null,
      archiveReason: notice.archiveReason,
      archivedFromStatus: notice.archivedFromStatus,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
      deliverySummary: {
        total: deliveryGroups.reduce(
          (sum, group) => sum + group._count.status,
          0,
        ),
        queued: deliveryCounts.get('QUEUED') ?? 0,
        sent: deliveryCounts.get('SENT') ?? 0,
        failed: deliveryCounts.get('FAILED') ?? 0,
        skipped: deliveryCounts.get('SKIPPED') ?? 0,
      },
      approvalHistory:
        approvalRequest?.decisions.map((decision) => ({
          decision: decision.decision,
          reason: decision.reason,
          actorEmail: decision.decidedBy.email,
          createdAt: decision.createdAt.toISOString(),
        })) ?? [],
      auditHistory: auditRows.map((row) => ({
        id: row.id,
        action: row.action,
        actorEmail: row.user?.email ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async resolveAttachment(
    notice: { id: string; attachmentUrl: string | null },
    actor: AuthContext,
  ) {
    const [linkedFile] = await this.fileRegistryService.listFilesByEntity(
      actor.tenantId,
      'notices',
      notice.id,
    );

    if (!linkedFile) {
      return {
        fileId: null,
        url: this.isSafeLegacyAttachmentUrl(notice.attachmentUrl)
          ? notice.attachmentUrl
          : null,
      };
    }

    return {
      fileId: linkedFile.id,
      url: await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        linkedFile.id,
      ),
    };
  }

  private isSafeLegacyAttachmentUrl(url: string | null) {
    if (!url) {
      return false;
    }

    if (url.startsWith('/api/') || url.startsWith('/files/')) {
      return true;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

const NOTICE_ADMINISTRATION_PERMISSIONS = new Set([
  'notices:create',
  'notices:edit',
  'notices:publish',
  'notices:schedule',
  'notices:cancel',
  'notices:archive',
  'notices:approve',
  'notices:read_reports',
]);
