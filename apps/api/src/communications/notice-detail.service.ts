import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export type NoticeDetail = {
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
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliverySummary: {
    total: number;
    queued: number;
    sent: number;
    failed: number;
    skipped: number;
  };
};

@Injectable()
export class NoticeDetailService {
  constructor(private readonly prisma: PrismaService) {}

  async getNoticeDetail(
    noticeId: string,
    actor: AuthContext,
  ): Promise<NoticeDetail> {
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

    const deliveryGroups = await this.prisma.notificationDelivery.groupBy({
      by: ['status'],
      where: {
        tenantId: actor.tenantId,
        noticeId: notice.id,
      },
      _count: {
        status: true,
      },
    });

    const deliveryCounts = new Map(
      deliveryGroups.map((group) => [group.status, group._count.status]),
    );

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
      createdBy: notice.createdBy
        ? {
            id: notice.createdBy.id,
            email: notice.createdBy.email,
          }
        : null,
      attachmentUrl: notice.attachmentUrl,
      scheduledFor: notice.scheduledFor?.toISOString() ?? null,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
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
    };
  }
}
