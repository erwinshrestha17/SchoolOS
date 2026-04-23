import { Injectable, NotFoundException } from '@nestjs/common';
import { AudienceType, EventType, NoticePriority } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';

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
}
