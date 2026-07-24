import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  getNepalSchoolDay,
  type NotificationEventPriority as ContractNotificationEventPriority,
  type NotificationEventType as ContractNotificationEventType,
} from '@schoolos/core';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AudienceType,
  AuthMethod,
  type CommunicationTemplateCategory,
  CommunicationTemplateStatus,
  ConsentType,
  EventType,
  NotificationChannel,
  NotificationStatus,
  type Notice,
  NoticeLifecycleStatus,
  NoticePriority,
  ParentTeacherThreadStatus,
  Prisma,
  ProviderType,
  StaffStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationPreferencePolicy } from '../notifications/notification-preference-policy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDraftDto } from './dto/notice-lifecycle.dto';
import {
  CreateCommunicationTemplateDto,
  ListCommunicationTemplatesQueryDto,
  UpdateCommunicationTemplateDto,
} from './dto/communication-template.dto';
import { CaptureConsentDto } from './dto/capture-consent.dto';
import type {
  ListNotificationDeliveriesQueryDto,
  ListNoticesQueryDto,
} from './dto/communication-list-query.dto';
import { UsageService } from '../usage/usage.service';
import { RedisService } from '../redis/redis.service';
import {
  type AcceptNotificationEventInput,
  NotificationEventService,
} from './notification-event.service';
import { NOTICE_ADMINISTRATION_PERMISSIONS } from './notice-detail.service';
import { isTeacherOnly } from '../common/security/parent-scope';

const TEMPLATE_SELECT = {
  id: true,
  tenantId: true,
  key: true,
  category: true,
  channel: true,
  language: true,
  title: true,
  body: true,
  status: true,
  version: true,
  publishedAt: true,
  archivedAt: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CommunicationTemplateSelect;

function maskDeliveryDestination(destination: string) {
  if (destination.includes('@')) {
    const [name, domain] = destination.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (destination.length <= 4) return 'Recipient';
  return `${destination.slice(0, 3)}***${destination.slice(-2)}`;
}

const PROVIDER_CHANNELS = [
  {
    channel: NotificationChannel.EMAIL,
    label: 'Email',
    providerType: ProviderType.EMAIL,
    modeKey: 'email' as const,
  },
  {
    channel: NotificationChannel.SMS,
    label: 'SMS',
    providerType: ProviderType.SMS,
    modeKey: 'sms' as const,
  },
  {
    channel: NotificationChannel.PUSH,
    label: 'Push',
    providerType: ProviderType.FCM,
    modeKey: 'push' as const,
  },
] as const;

export interface NoticeDraftInput {
  title: string;
  titleNe?: string;
  body: string;
  bodyNe?: string;
  category?: CommunicationTemplateCategory;
  isPinned?: boolean;
  templateId?: string;
  priority: NoticePriority;
  audienceType: AudienceType;
  classId?: string;
  sectionId?: string;
  roleNames?: string[];
  staffIds?: string[];
  studentIds?: string[];
  guardianIds?: string[];
  recipientUserIds?: string[];
  attachmentFileId?: string;
  scheduledFor?: string;
  idempotencyKey: string;
}

export interface AdmissionDocumentReminderDeliveryInput {
  actor: AuthContext;
  admissionCaseId: string;
  applicantName: string;
  guardianPhone: string;
  sourceUpdatedAt: string;
  missingDocumentLabels: string[];
}

export type AdmissionDocumentReminderDeliveryOutcome = {
  state: 'QUEUED' | 'ALREADY_QUEUED' | 'SKIPPED';
  reason: 'DELIVERY_UNAVAILABLE' | null;
};

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly usageService: UsageService,
    private readonly redisService: RedisService,
    private readonly fileRegistryService?: FileRegistryService,
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    private readonly notificationEventService?: NotificationEventService,
    @Optional()
    private readonly notificationPreferencePolicy?: NotificationPreferencePolicy,
  ) {}

  async listNotices(
    actor: AuthContext,
    query: ListNoticesQueryDto = { page: 1, limit: 25 },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const search = query.search?.trim();
    // Confirmed gap: this endpoint (notices:read, held by every role including
    // base teacher) returned every notice in the tenant regardless of
    // audience/class/section targeting or lifecycle state, unlike
    // getNoticeDetail which already scopes non-administrators to notices
    // they actually received. Non-administrators are now limited to
    // published, tenant-wide/own-class/own-section notices (or anything
    // they have an actual delivery record for), matching getNoticeDetail's
    // trust model.
    const canAdministerNotices = actor.permissions.some((permission) =>
      NOTICE_ADMINISTRATION_PERMISSIONS.has(permission),
    );
    const audienceScope = canAdministerNotices
      ? []
      : await this.buildActorNoticeVisibilityScope(actor);
    const where: Prisma.NoticeWhereInput = {
      AND: [
        { tenantId: actor.tenantId },
        ...(canAdministerNotices && query.lifecycleStatus
          ? [{ lifecycleStatus: query.lifecycleStatus }]
          : []),
        ...(query.priority ? [{ priority: query.priority }] : []),
        ...(query.audienceType ? [{ audienceType: query.audienceType }] : []),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  { body: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
        ...audienceScope,
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        include: {
          createdBy: { select: { id: true, email: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          _count: { select: { deliveries: true, acknowledgements: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notice.count({ where }),
    ]);
    return {
      items: items.map(({ class: classRef, section, _count, ...notice }) => ({
        ...notice,
        className: classRef?.name ?? null,
        sectionName: section?.name ?? null,
        deliveryCount: _count?.deliveries ?? 0,
        acknowledgementCount: _count?.acknowledgements ?? 0,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  private async buildActorNoticeVisibilityScope(
    actor: AuthContext,
  ): Promise<Prisma.NoticeWhereInput[]> {
    const visibilityOr: Prisma.NoticeWhereInput[] = [
      { audienceType: AudienceType.ALL },
      { deliveries: { some: { recipientUserId: actor.userId } } },
    ];
    if (isTeacherOnly(actor)) {
      const { classIds, sectionIds } =
        await this.getTeacherAssignedClassSections(actor);
      if (classIds.length) {
        visibilityOr.push({
          audienceType: AudienceType.CLASS,
          classId: { in: classIds },
        });
      }
      if (sectionIds.length) {
        visibilityOr.push({
          audienceType: AudienceType.SECTION,
          sectionId: { in: sectionIds },
        });
      }
    }
    return [
      { OR: visibilityOr },
      {
        lifecycleStatus: {
          in: [NoticeLifecycleStatus.PUBLISHED, NoticeLifecycleStatus.EXPIRED],
        },
      },
    ];
  }

  private async buildActorEventVisibilityScope(
    actor: AuthContext,
  ): Promise<Prisma.EventWhereInput> {
    const visibilityOr: Prisma.EventWhereInput[] = [
      { audienceType: AudienceType.ALL },
      { deliveries: { some: { recipientUserId: actor.userId } } },
    ];
    if (isTeacherOnly(actor)) {
      const { classIds, sectionIds } =
        await this.getTeacherAssignedClassSections(actor);
      if (classIds.length) {
        visibilityOr.push({
          audienceType: AudienceType.CLASS,
          classId: { in: classIds },
        });
      }
      if (sectionIds.length) {
        visibilityOr.push({
          audienceType: AudienceType.SECTION,
          sectionId: { in: sectionIds },
        });
      }
    }
    return { OR: visibilityOr };
  }

  private async getTeacherAssignedClassSections(
    actor: AuthContext,
  ): Promise<{ classIds: string[]; sectionIds: string[] }> {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!staff) return { classIds: [], sectionIds: [] };

    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: { tenantId: actor.tenantId, staffId: staff.id },
        select: { classId: true, sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId, classTeacherId: staff.id },
        select: { id: true, classId: true },
      }),
    ]);

    const classIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const assignment of assignments) {
      classIds.add(assignment.classId);
      if (assignment.sectionId) sectionIds.add(assignment.sectionId);
    }
    for (const section of classTeacherSections) {
      classIds.add(section.classId);
      sectionIds.add(section.id);
    }
    return {
      classIds: Array.from(classIds),
      sectionIds: Array.from(sectionIds),
    };
  }

  async createNotice(dto: CreateNoticeDto, actor: AuthContext) {
    await this.ensureAudienceRefs(actor, dto.classId, dto.sectionId);
    const priority = dto.priority ?? NoticePriority.NORMAL;
    if (priority !== NoticePriority.NORMAL) {
      throw new ConflictException(
        'Urgent and emergency notices must use the approval-backed draft workflow',
      );
    }
    if (dto.scheduledFor && new Date(dto.scheduledFor) <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }
    const attachmentUrl = await this.resolveNoticeAttachment(dto, actor);

    const publishedAt = dto.scheduledFor ? null : new Date();
    const lifecycleStatus = dto.scheduledFor
      ? NoticeLifecycleStatus.SCHEDULED
      : NoticeLifecycleStatus.PUBLISHED;
    const notice = await this.prisma.notice.create({
      data: {
        tenantId: actor.tenantId,
        createdById: actor.userId,
        title: dto.title,
        titleNe: dto.titleNe ?? null,
        body: dto.body,
        bodyNe: dto.bodyNe ?? null,
        category: dto.category ?? undefined,
        isPinned: dto.isPinned ?? false,
        templateId: dto.templateId ?? null,
        priority,
        audienceType: dto.audienceType ?? AudienceType.ALL,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        roleNames: dto.roleNames ?? [],
        staffIds: dto.staffIds ?? [],
        studentIds: dto.studentIds ?? [],
        guardianIds: dto.guardianIds ?? [],
        recipientUserIds: dto.recipientUserIds ?? [],
        attachmentUrl,
        lifecycleStatus,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        publishedAt,
      },
    });

    if (dto.attachmentFileId && this.fileRegistryService) {
      await this.fileRegistryService.linkToEntity(
        actor.tenantId,
        dto.attachmentFileId,
        'notices',
        notice.id,
        actor.userId,
      );
    }

    if (publishedAt) {
      await this.emitNoticePublished(notice, actor);
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
        attachmentFileId: dto.attachmentFileId ?? null,
      },
    });

    return notice;
  }

  async createNoticeDraft(input: NoticeDraftInput, actor: AuthContext) {
    await this.ensureAudienceRefs(actor, input.classId, input.sectionId);
    await this.assertNoticeAttachmentFile(input.attachmentFileId, actor);

    const existing = await this.prisma.notice.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) {
      return existing;
    }

    let notice: Notice;
    try {
      notice = await this.prisma.notice.create({
        data: {
          tenantId: actor.tenantId,
          createdById: actor.userId,
          title: input.title.trim(),
          titleNe: input.titleNe?.trim() || null,
          body: input.body.trim(),
          bodyNe: input.bodyNe?.trim() || null,
          category: input.category ?? undefined,
          isPinned: input.isPinned ?? false,
          templateId: input.templateId ?? null,
          priority: input.priority,
          audienceType: input.audienceType,
          classId: input.classId ?? null,
          sectionId: input.sectionId ?? null,
          roleNames: input.roleNames ?? [],
          staffIds: input.staffIds ?? [],
          studentIds: input.studentIds ?? [],
          guardianIds: input.guardianIds ?? [],
          recipientUserIds: input.recipientUserIds ?? [],
          attachmentUrl: null,
          idempotencyKey: input.idempotencyKey,
          lifecycleStatus: NoticeLifecycleStatus.DRAFT,
          scheduledFor: input.scheduledFor
            ? new Date(input.scheduledFor)
            : null,
          publishedAt: null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.notice.findFirst({
          where: {
            tenantId: actor.tenantId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }

    if (input.attachmentFileId && this.fileRegistryService) {
      await this.fileRegistryService.linkToEntity(
        actor.tenantId,
        input.attachmentFileId,
        'notices',
        notice.id,
        actor.userId,
      );
    }

    await this.auditService.record({
      action: 'draft',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      after: {
        priority: notice.priority,
        audienceType: notice.audienceType,
        scheduledFor: notice.scheduledFor,
        attachmentFileId: input.attachmentFileId ?? null,
        source: 'principal_mobile',
      },
    });
    return notice;
  }

  async updateNoticeDraft(
    noticeId: string,
    dto: UpdateNoticeDraftDto,
    actor: AuthContext,
  ) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (notice.lifecycleStatus !== NoticeLifecycleStatus.DRAFT) {
      throw new ConflictException('Only draft notices can be edited');
    }

    const classId = dto.classId ?? notice.classId ?? undefined;
    const sectionId = dto.sectionId ?? notice.sectionId ?? undefined;
    await this.ensureAudienceRefs(actor, classId, sectionId);
    await this.assertNoticeAttachmentFile(dto.attachmentFileId, actor);

    const scheduledFor = dto.scheduledFor
      ? new Date(dto.scheduledFor)
      : notice.scheduledFor;
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : notice.expiresAt;
    this.assertNoticeDates(scheduledFor, expiresAt);

    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: {
        title: dto.title?.trim(),
        titleNe: dto.titleNe?.trim(),
        body: dto.body?.trim(),
        bodyNe: dto.bodyNe?.trim(),
        category: dto.category,
        isPinned: dto.isPinned,
        templateId: dto.templateId,
        priority: dto.priority,
        audienceType: dto.audienceType,
        classId: dto.classId,
        sectionId: dto.sectionId,
        roleNames: dto.roleNames,
        staffIds: dto.staffIds,
        studentIds: dto.studentIds,
        guardianIds: dto.guardianIds,
        recipientUserIds: dto.recipientUserIds,
        scheduledFor: dto.scheduledFor ? scheduledFor : undefined,
        expiresAt: dto.expiresAt ? expiresAt : undefined,
      },
    });

    if (dto.attachmentFileId && this.fileRegistryService) {
      await this.fileRegistryService.linkToEntity(
        actor.tenantId,
        dto.attachmentFileId,
        'notices',
        notice.id,
        actor.userId,
      );
    }

    await this.auditService.record({
      action: 'update_draft',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      before: this.noticeLifecycleAudit(notice),
      after: this.noticeLifecycleAudit(updated),
    });
    return updated;
  }

  async publishPreparedNotice(noticeId: string, actor: AuthContext) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (notice.lifecycleStatus === NoticeLifecycleStatus.PUBLISHED) {
      return {
        notice,
        delivery: await this.getNoticeDeliverySummary(actor, notice.id),
        replayed: true,
      };
    }
    if (
      notice.priority !== NoticePriority.NORMAL &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVED
    ) {
      throw new ConflictException(
        'Urgent and emergency notices require approval before publication',
      );
    }
    if (
      notice.lifecycleStatus !== NoticeLifecycleStatus.DRAFT &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVED &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.SCHEDULED
    ) {
      throw new ConflictException(
        `Notice cannot be published from ${notice.lifecycleStatus.toLowerCase()} state`,
      );
    }
    if (notice.expiresAt && notice.expiresAt <= new Date()) {
      throw new ConflictException('Expired notices cannot be published');
    }

    const preview = await this.previewNoticeRecipients(
      {
        title: notice.title,
        body: notice.body,
        priority: notice.priority,
        audienceType: notice.audienceType,
        classId: notice.classId ?? undefined,
        sectionId: notice.sectionId ?? undefined,
        roleNames: notice.roleNames,
        staffIds: notice.staffIds,
        studentIds: notice.studentIds,
        guardianIds: notice.guardianIds,
        recipientUserIds: notice.recipientUserIds,
      },
      actor,
    );
    if (preview.allowedRecipientCount < 1) {
      throw new ConflictException(
        'No eligible recipients are available for this notice',
      );
    }

    const publishedAt = new Date();
    const result = await this.prisma.notice.updateMany({
      where: {
        id: notice.id,
        tenantId: actor.tenantId,
        lifecycleStatus: notice.lifecycleStatus,
        publishedAt: null,
      },
      data: {
        lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
        publishedAt,
        scheduledFor: null,
      },
    });
    const published = await this.getTenantNotice(notice.id, actor);

    if (result.count === 0) {
      return {
        notice: published,
        delivery: await this.getNoticeDeliverySummary(actor, notice.id),
        replayed: true,
      };
    }

    // Persist the source lifecycle before accepting the canonical M12 event.
    // NotificationEventService deliberately rejects events whose source is not
    // currently published, and the updateMany claim above keeps this emission
    // exactly once across concurrent publish attempts.
    const delivery = await this.emitNoticePublished(published, actor);

    await this.auditService.record({
      action: 'publish',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      before: this.noticeLifecycleAudit(notice),
      after: {
        ...this.noticeLifecycleAudit(published),
        deliveryCount: delivery.count,
      },
    });
    return { notice: published, delivery, replayed: false };
  }

  async scheduleNotice(
    noticeId: string,
    scheduledForInput: string,
    actor: AuthContext,
  ) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (
      notice.priority !== NoticePriority.NORMAL &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVED
    ) {
      throw new ConflictException(
        'Urgent and emergency notices require approval before scheduling',
      );
    }
    if (
      notice.lifecycleStatus !== NoticeLifecycleStatus.DRAFT &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVED &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.SCHEDULED
    ) {
      throw new ConflictException(
        `Notice cannot be scheduled from ${notice.lifecycleStatus.toLowerCase()} state`,
      );
    }

    const scheduledFor = new Date(scheduledForInput);
    this.assertNoticeDates(scheduledFor, notice.expiresAt);
    if (scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: {
        lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
        scheduledFor,
        publishedAt: null,
      },
    });
    await this.auditNoticeLifecycleChange('schedule', notice, updated, actor);
    return updated;
  }

  async cancelNotice(noticeId: string, reason: string, actor: AuthContext) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (
      notice.lifecycleStatus !== NoticeLifecycleStatus.DRAFT &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVAL_PENDING &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVED &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.SCHEDULED
    ) {
      throw new ConflictException(
        `Notice cannot be cancelled from ${notice.lifecycleStatus.toLowerCase()} state`,
      );
    }

    const cancelledAt = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.notice.update({
        where: { id: notice.id },
        data: {
          lifecycleStatus: NoticeLifecycleStatus.CANCELLED,
          cancelledAt,
          cancelledById: actor.userId,
          cancellationReason: reason.trim(),
          scheduledFor: null,
        },
      }),
      this.prisma.notificationDelivery.updateMany({
        where: {
          tenantId: actor.tenantId,
          noticeId: notice.id,
          status: {
            in: [NotificationStatus.QUEUED, NotificationStatus.RETRY_PENDING],
          },
        },
        data: {
          status: NotificationStatus.CANCELLED,
          errorMessage: 'Notice was cancelled before delivery completed',
        },
      }),
    ]);
    await this.auditNoticeLifecycleChange('cancel', notice, updated, actor, {
      reason: reason.trim(),
    });
    return updated;
  }

  async archiveNotice(noticeId: string, reason: string, actor: AuthContext) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (notice.lifecycleStatus === NoticeLifecycleStatus.ARCHIVED) {
      return notice;
    }

    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: {
        archivedFromStatus: notice.lifecycleStatus,
        lifecycleStatus: NoticeLifecycleStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedById: actor.userId,
        archiveReason: reason.trim(),
      },
    });
    await this.auditNoticeLifecycleChange('archive', notice, updated, actor, {
      reason: reason.trim(),
    });
    return updated;
  }

  async restoreNotice(noticeId: string, reason: string, actor: AuthContext) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (notice.lifecycleStatus !== NoticeLifecycleStatus.ARCHIVED) {
      throw new ConflictException('Only archived notices can be restored');
    }

    let restoredStatus =
      notice.archivedFromStatus ?? NoticeLifecycleStatus.DRAFT;
    if (
      restoredStatus === NoticeLifecycleStatus.SCHEDULED &&
      (!notice.scheduledFor || notice.scheduledFor <= new Date())
    ) {
      restoredStatus = NoticeLifecycleStatus.DRAFT;
    }
    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: {
        lifecycleStatus: restoredStatus,
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
        archivedFromStatus: null,
      },
    });
    await this.auditNoticeLifecycleChange('restore', notice, updated, actor, {
      reason: reason.trim(),
    });
    return updated;
  }

  async publishNotice(
    noticeId: string,
    actor: AuthContext,
    options: { scheduledFor?: string | null } = {},
  ) {
    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: actor.tenantId,
        priority: {
          in: [NoticePriority.URGENT, NoticePriority.EMERGENCY],
        },
      },
    });
    if (!notice) {
      throw new NotFoundException(
        'High-impact notice not found in this tenant',
      );
    }
    if (
      notice.lifecycleStatus === NoticeLifecycleStatus.CANCELLED ||
      notice.lifecycleStatus === NoticeLifecycleStatus.EXPIRED ||
      notice.lifecycleStatus === NoticeLifecycleStatus.ARCHIVED
    ) {
      throw new ConflictException(
        `Notice cannot be published from ${notice.lifecycleStatus.toLowerCase()} state`,
      );
    }
    if (notice.lifecycleStatus === NoticeLifecycleStatus.APPROVAL_PENDING) {
      throw new ConflictException('Notice approval is still pending');
    }

    const requestedSchedule = options.scheduledFor
      ? new Date(options.scheduledFor)
      : notice.scheduledFor;
    if (
      requestedSchedule &&
      !Number.isNaN(requestedSchedule.getTime()) &&
      requestedSchedule > new Date()
    ) {
      const scheduled = await this.prisma.notice.update({
        where: { id: notice.id },
        data: {
          lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
          scheduledFor: requestedSchedule,
          publishedAt: null,
        },
      });
      await this.auditService.record({
        action: 'schedule',
        resource: 'notice',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: notice.id,
        after: {
          scheduledFor: requestedSchedule,
          priority: notice.priority,
        },
      });
      return {
        noticeId: scheduled.id,
        state: 'SCHEDULED',
        scheduledFor: scheduled.scheduledFor?.toISOString() ?? null,
        delivery: await this.getNoticeDeliverySummary(actor, notice.id),
      };
    }

    const providerDiagnostics =
      await this.getCommunicationProviderDiagnostics(actor);
    const requiredChannels: NotificationChannel[] =
      notice.priority === NoticePriority.EMERGENCY
        ? [NotificationChannel.PUSH, NotificationChannel.SMS]
        : [NotificationChannel.PUSH];
    const delivery = await this.emitNoticePublished(notice, actor);

    const publishedAt = notice.publishedAt ?? new Date();
    if (!notice.publishedAt) {
      await this.prisma.notice.update({
        where: { id: notice.id },
        data: {
          lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
          publishedAt,
          scheduledFor: null,
        },
      });
    }

    await this.auditService.record({
      action: 'publish_high_impact',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      after: {
        priority: notice.priority,
        audienceType: notice.audienceType,
        deliveryCount: delivery.count,
        source: 'principal_mobile',
      },
    });
    return {
      noticeId: notice.id,
      state: 'QUEUED',
      publishedAt: publishedAt.toISOString(),
      delivery,
      providerMode: providerDiagnostics.overallMode,
      externalChannelAvailable: providerDiagnostics.channels.some(
        (channel) =>
          requiredChannels.includes(channel.channel) &&
          channel.dispatchAvailable,
      ),
    };
  }

  async markNoticeApprovalPending(
    noticeId: string,
    approvalRequestId: string,
    actor: AuthContext,
  ) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (notice.lifecycleStatus === NoticeLifecycleStatus.PUBLISHED) {
      throw new ConflictException('Published notices cannot request approval');
    }

    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: {
        lifecycleStatus: NoticeLifecycleStatus.APPROVAL_PENDING,
        approvalRequestId,
      },
    });
    await this.auditService.record({
      action: 'request_approval',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      before: { lifecycleStatus: notice.lifecycleStatus },
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        approvalRequestId,
      },
    });
    return updated;
  }

  async markNoticeApproved(
    noticeId: string,
    approvalRequestId: string,
    actor: AuthContext,
  ) {
    const notice = await this.getTenantNotice(noticeId, actor);
    if (
      notice.approvalRequestId &&
      notice.approvalRequestId !== approvalRequestId
    ) {
      throw new ConflictException(
        'Notice approval does not match the active approval request',
      );
    }
    if (
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVAL_PENDING &&
      notice.lifecycleStatus !== NoticeLifecycleStatus.APPROVED
    ) {
      throw new ConflictException(
        `Notice cannot be approved from ${notice.lifecycleStatus.toLowerCase()} state`,
      );
    }

    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: {
        lifecycleStatus: NoticeLifecycleStatus.APPROVED,
        approvalRequestId,
      },
    });
    await this.auditService.record({
      action: 'approve',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      before: { lifecycleStatus: notice.lifecycleStatus },
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        approvalRequestId,
      },
    });
    return updated;
  }

  async previewNoticeRecipients(dto: CreateNoticeDto, actor: AuthContext) {
    await this.ensureAudienceRefs(actor, dto.classId, dto.sectionId);

    const priority = dto.priority ?? NoticePriority.NORMAL;
    const channels = noticeChannels(priority);
    const input: DeliveryRecordInput = {
      actor,
      sourceType: 'notice_preview',
      sourceId: `notice-preview:${actor.userId}`,
      audienceType: dto.audienceType ?? AudienceType.ALL,
      classId: dto.classId ?? null,
      sectionId: dto.sectionId ?? null,
      roleNames: dto.roleNames,
      staffIds: dto.staffIds,
      studentIds: dto.studentIds,
      guardianIds: dto.guardianIds,
      recipientUserIds: dto.recipientUserIds,
      title: dto.title,
      body: dto.body,
      channels,
      requiredConsentTypes: [ConsentType.MESSAGING],
      communicationCategory:
        priority === NoticePriority.EMERGENCY ? 'ESSENTIAL' : 'NON_ESSENTIAL',
      activeStudentsOnly: true,
    };
    const recipients = await this.resolveAudienceRecipients(input);
    const { allowedRecipients, skippedRecipients } =
      await this.partitionRecipientsByCommunicationPolicy(input, recipients);

    const result = {
      audienceType: input.audienceType,
      classId: input.classId,
      sectionId: input.sectionId,
      priority,
      channels,
      recipientCount: recipients.length,
      allowedRecipientCount: allowedRecipients.length,
      skippedRecipientCount: skippedRecipients.length,
      estimatedDeliveryRows: allowedRecipients.length * channels.length,
      sampleRecipients: allowedRecipients.slice(0, 10).map((recipient) => ({
        studentId: recipient.studentId || null,
        guardianId: recipient.guardianId,
        recipientUserId: recipient.userId,
      })),
    };

    if (priority === NoticePriority.EMERGENCY) {
      await this.auditService.record({
        action: 'preview_recipients',
        resource: 'notice',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: result,
      });
    }

    return result;
  }

  async listEvents(actor: AuthContext) {
    // Confirmed gap: same pattern as listNotices above — every events:read
    // holder (including base teacher) saw every event in the tenant
    // regardless of audience/class/section targeting. Non-administrators are
    // now limited to tenant-wide/own-class/own-section events (or anything
    // they have an actual delivery record for).
    const canAdministerEvents = actor.permissions.includes('events:create');
    const visibilityScope = canAdministerEvents
      ? {}
      : await this.buildActorEventVisibilityScope(actor);
    return this.prisma.event.findMany({
      where: {
        tenantId: actor.tenantId,
        ...visibilityScope,
      },
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
      communicationCategory: 'NON_ESSENTIAL',
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

  async listDeliveries(
    actor: AuthContext,
    filters: ListNotificationDeliveriesQueryDto = { page: 1, limit: 25 },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const where: Prisma.NotificationDeliveryWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
      ...(filters.activityPostId
        ? { activityPostId: filters.activityPostId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        include: { guardian: true, student: true },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);
    return { items, total, page, limit, hasNextPage: page * limit < total };
  }

  async listDeliveryOperations(
    actor: AuthContext,
    filters: ListNotificationDeliveriesQueryDto = { page: 1, limit: 25 },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const where: Prisma.NotificationDeliveryWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
      ...(filters.activityPostId
        ? { activityPostId: filters.activityPostId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          channel: true,
          status: true,
          sourceType: true,
          sourceId: true,
          audienceType: true,
          recipientUserId: true,
          guardianId: true,
          studentId: true,
          destination: true,
          createdAt: true,
          sentAt: true,
          deliveredAt: true,
          failedAt: true,
          retryCount: true,
        },
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return {
      items: items.map((delivery) => ({
        id: delivery.id,
        channel: delivery.channel,
        status: delivery.status,
        sourceType: delivery.sourceType,
        sourceId: delivery.sourceId,
        recipientType: delivery.recipientUserId
          ? 'user'
          : delivery.guardianId
            ? 'guardian'
            : delivery.studentId
              ? 'student'
              : 'audience',
        recipientLabel:
          delivery.channel === NotificationChannel.IN_APP ||
          delivery.destination === delivery.recipientUserId
            ? 'User recipient'
            : delivery.destination
              ? maskDeliveryDestination(delivery.destination)
              : `${delivery.audienceType.toLowerCase().replaceAll('_', ' ')} audience`,
        queuedAt: delivery.createdAt.toISOString(),
        attemptedAt: delivery.sentAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        failedAt: delivery.failedAt?.toISOString() ?? null,
        retryCount: delivery.retryCount,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
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

  async getCommunicationsSummary(actor: AuthContext) {
    const day = getNepalSchoolDay();
    const now = new Date();
    const [
      sentToday,
      scheduledNotices,
      failedDeliveries,
      unreadHighImpactNotices,
      escalatedChatCount,
      providerDiagnostics,
    ] = await Promise.all([
      this.prisma.notificationDelivery.count({
        where: {
          tenantId: actor.tenantId,
          status: {
            in: [NotificationStatus.SENT, NotificationStatus.DELIVERED],
          },
          OR: [
            {
              sentAt: {
                gte: day.startUtc,
                lt: day.endExclusiveUtc,
              },
            },
            {
              deliveredAt: {
                gte: day.startUtc,
                lt: day.endExclusiveUtc,
              },
            },
          ],
        },
      }),
      this.prisma.notice.count({
        where: {
          tenantId: actor.tenantId,
          publishedAt: null,
          scheduledFor: {
            gte: now,
          },
        },
      }),
      this.prisma.notificationDelivery.count({
        where: {
          tenantId: actor.tenantId,
          status: {
            in: [NotificationStatus.FAILED, NotificationStatus.RETRY_PENDING],
          },
        },
      }),
      this.prisma.notificationDelivery.count({
        where: {
          tenantId: actor.tenantId,
          recipientUserId: { not: null },
          notice: {
            tenantId: actor.tenantId,
            priority: {
              in: [NoticePriority.URGENT, NoticePriority.EMERGENCY],
            },
            publishedAt: { not: null },
          },
          readReceipts: {
            none: {},
          },
          status: {
            notIn: [NotificationStatus.CANCELLED, NotificationStatus.SKIPPED],
          },
        },
      }),
      this.prisma.parentTeacherThread.count({
        where: {
          tenantId: actor.tenantId,
          status: ParentTeacherThreadStatus.ESCALATED,
        },
      }),
      this.getCommunicationProviderDiagnostics(actor),
    ]);

    return {
      generatedAt: now.toISOString(),
      schoolDay: day.gregorianDate,
      sentToday,
      scheduledNotices,
      failedDeliveries,
      unreadHighImpactNotices,
      escalatedChatCount,
      providerStatus: providerDiagnostics.overallMode,
      providerHealth: providerDiagnostics.health,
    };
  }

  async getCommunicationProviderDiagnostics(actor: AuthContext) {
    const generatedAt = new Date();
    const channels = await Promise.all(
      PROVIDER_CHANNELS.map((channel) =>
        this.getProviderChannelDiagnostic(actor, channel),
      ),
    );
    const health = channels.some((channel) => channel.health === 'degraded')
      ? 'degraded'
      : channels.every((channel) => channel.health === 'unavailable')
        ? 'unavailable'
        : 'healthy';

    return {
      generatedAt: generatedAt.toISOString(),
      overallMode: resolveOverallProviderMode(
        channels.map((channel) => channel.mode),
      ),
      health,
      channels,
    };
  }

  private async getProviderChannelDiagnostic(
    actor: AuthContext,
    channelConfig: (typeof PROVIDER_CHANNELS)[number],
  ) {
    const mode = resolveSchoolProviderMode(channelConfig.modeKey);
    const where = {
      tenantId: actor.tenantId,
      channel: channelConfig.channel,
    };
    const [
      provider,
      deliveryCount,
      sentCount,
      failedCount,
      retryableCount,
      latestDelivery,
      latestCallback,
    ] = await Promise.all([
      this.prisma.providerConfig.findFirst({
        where: {
          type: channelConfig.providerType,
          enabled: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          enabled: true,
          validationStatus: true,
          lastValidatedAt: true,
          configEncrypted: true,
          updatedAt: true,
        },
      }),
      this.prisma.notificationDelivery.count({ where }),
      this.prisma.notificationDelivery.count({
        where: {
          ...where,
          status: {
            in: [NotificationStatus.SENT, NotificationStatus.DELIVERED],
          },
        },
      }),
      this.prisma.notificationDelivery.count({
        where: {
          ...where,
          status: NotificationStatus.FAILED,
        },
      }),
      this.prisma.notificationDelivery.count({
        where: {
          ...where,
          status: {
            in: [NotificationStatus.FAILED, NotificationStatus.RETRY_PENDING],
          },
        },
      }),
      this.prisma.notificationDelivery.findFirst({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          status: true,
          sentAt: true,
          deliveredAt: true,
          failedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notificationDelivery.findFirst({
        where: {
          ...where,
          OR: [
            { providerMessageId: { not: null } },
            { deliveredAt: { not: null } },
            { failedAt: { not: null } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          deliveredAt: true,
          failedAt: true,
          sentAt: true,
          createdAt: true,
        },
      }),
    ]);
    const providerConfig = asRecord(provider?.configEncrypted);
    const validationStatus = safeProviderValidationStatus(
      provider?.validationStatus,
    );
    const hasProvider = Boolean(provider);
    const callbackStatus =
      mode !== 'configured'
        ? 'not_applicable'
        : provider?.validationStatus === 'FAILED'
          ? 'failing'
          : latestCallback
            ? 'recent'
            : hasCallbackSecretConfig(providerConfig)
              ? 'configured'
              : 'not_configured';
    const health = resolveProviderHealth({
      mode,
      hasProvider,
      validationStatus,
      failedCount,
      retryableCount,
      deliveryCount,
    });

    return {
      channel: channelConfig.channel,
      label: channelConfig.label,
      mode,
      health,
      deliveryCount,
      sentCount,
      failedCount,
      retryableCount,
      validationStatus,
      lastValidatedAt: toIso(provider?.lastValidatedAt),
      lastEventAt: toIso(resolveDeliveryEventTime(latestDelivery)),
      callbackStatus,
      lastCallbackAt: toIso(resolveDeliveryEventTime(latestCallback)),
      dispatchAvailable:
        mode === 'dev-log' ||
        mode === 'mock' ||
        (mode === 'configured' && hasProvider && validationStatus !== 'FAILED'),
      liveDelivery: mode === 'configured',
      message: providerDiagnosticMessage({
        label: channelConfig.label,
        mode,
        health,
        hasProvider,
        validationStatus,
      }),
    };
  }

  async listCommunicationTemplates(
    query: ListCommunicationTemplatesQueryDto,
    actor: AuthContext,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId: actor.tenantId,
    };
    const [items, total] = await Promise.all([
      this.prisma.communicationTemplate.findMany({
        where,
        select: TEMPLATE_SELECT,
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communicationTemplate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async createCommunicationTemplate(
    dto: CreateCommunicationTemplateDto,
    actor: AuthContext,
  ) {
    const key = normalizeTemplateKey(dto.key);
    const latest = await this.prisma.communicationTemplate.aggregate({
      where: {
        tenantId: actor.tenantId,
        key,
      },
      _max: {
        version: true,
      },
    });
    const template = await this.prisma.communicationTemplate.create({
      data: {
        tenantId: actor.tenantId,
        key,
        category: dto.category,
        channel: dto.channel,
        language: dto.language ?? 'en',
        title: dto.title.trim(),
        body: dto.body.trim(),
        version: (latest._max.version ?? 0) + 1,
        createdById: actor.userId,
      },
      select: TEMPLATE_SELECT,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'communication_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: template.id,
      after: {
        key: template.key,
        category: template.category,
        channel: template.channel,
        version: template.version,
      },
    });

    return template;
  }

  async updateCommunicationTemplate(
    templateId: string,
    dto: UpdateCommunicationTemplateDto,
    actor: AuthContext,
  ) {
    const current = await this.prisma.communicationTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: actor.tenantId,
      },
      select: TEMPLATE_SELECT,
    });

    if (!current) {
      throw new NotFoundException(
        'Communication template not found in this tenant',
      );
    }

    if (current.status !== CommunicationTemplateStatus.DRAFT) {
      throw new ConflictException(
        'Only draft communication templates can be edited',
      );
    }

    const template = await this.prisma.communicationTemplate.update({
      where: {
        id: templateId,
      },
      data: {
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.channel ? { channel: dto.channel } : {}),
        ...(dto.language ? { language: dto.language } : {}),
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.body ? { body: dto.body.trim() } : {}),
        updatedById: actor.userId,
      },
      select: TEMPLATE_SELECT,
    });

    await this.auditService.record({
      action: 'update',
      resource: 'communication_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: template.id,
      before: {
        status: current.status,
      },
      after: {
        category: template.category,
        channel: template.channel,
        version: template.version,
      },
    });

    return template;
  }

  async publishCommunicationTemplate(templateId: string, actor: AuthContext) {
    return this.transitionCommunicationTemplate(
      templateId,
      CommunicationTemplateStatus.PUBLISHED,
      actor,
    );
  }

  async archiveCommunicationTemplate(templateId: string, actor: AuthContext) {
    return this.transitionCommunicationTemplate(
      templateId,
      CommunicationTemplateStatus.ARCHIVED,
      actor,
    );
  }

  private async transitionCommunicationTemplate(
    templateId: string,
    status:
      | (typeof CommunicationTemplateStatus)['PUBLISHED']
      | (typeof CommunicationTemplateStatus)['ARCHIVED'],
    actor: AuthContext,
  ) {
    const current = await this.prisma.communicationTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: actor.tenantId,
      },
      select: TEMPLATE_SELECT,
    });

    if (!current) {
      throw new NotFoundException(
        'Communication template not found in this tenant',
      );
    }

    const now = new Date();
    const template = await this.prisma.communicationTemplate.update({
      where: {
        id: templateId,
      },
      data: {
        status,
        updatedById: actor.userId,
        publishedAt:
          status === CommunicationTemplateStatus.PUBLISHED
            ? (current.publishedAt ?? now)
            : current.publishedAt,
        archivedAt:
          status === CommunicationTemplateStatus.ARCHIVED ? now : null,
      },
      select: TEMPLATE_SELECT,
    });

    await this.auditService.record({
      action:
        status === CommunicationTemplateStatus.PUBLISHED
          ? 'publish'
          : 'archive',
      resource: 'communication_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: template.id,
      before: {
        status: current.status,
      },
      after: {
        status: template.status,
        key: template.key,
        version: template.version,
      },
    });

    return template;
  }

  async processScheduledNotices(actor: AuthContext) {
    const now = new Date();
    const dueNotices = await this.prisma.notice.findMany({
      where: {
        tenantId: actor.tenantId,
        lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
        publishedAt: null,
        scheduledFor: { lte: now },
      },
    });
    const results: Array<{ noticeId: string; deliveryCount: number }> = [];

    for (const notice of dueNotices) {
      const result = await this.publishPreparedNotice(notice.id, actor);
      results.push({
        noticeId: notice.id,
        deliveryCount: result.delivery.count,
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

  async processExpiredNotices(actor: AuthContext) {
    const now = new Date();
    const due = await this.prisma.notice.findMany({
      where: {
        tenantId: actor.tenantId,
        lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
        expiresAt: { lte: now },
      },
      select: { id: true },
    });
    if (due.length === 0) return { processed: 0, noticeIds: [] as string[] };

    const noticeIds = due.map(({ id }) => id);
    const result = await this.prisma.notice.updateMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: noticeIds },
        lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
        expiresAt: { lte: now },
      },
      data: { lifecycleStatus: NoticeLifecycleStatus.EXPIRED },
    });
    await this.auditService.record({
      action: 'expire',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { processed: result.count, noticeIds },
    });
    return { processed: result.count, noticeIds };
  }

  private async getTenantNotice(noticeId: string, actor: AuthContext) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, tenantId: actor.tenantId },
    });
    if (!notice) {
      throw new NotFoundException('Notice not found in this tenant');
    }
    return notice;
  }

  private assertNoticeDates(
    scheduledFor: Date | null | undefined,
    expiresAt: Date | null | undefined,
  ) {
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Scheduled time is invalid');
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Expiry time is invalid');
    }
    if (scheduledFor && expiresAt && expiresAt <= scheduledFor) {
      throw new BadRequestException('Expiry must be after the scheduled time');
    }
  }

  private noticeLifecycleAudit(notice: Notice) {
    return {
      lifecycleStatus: notice.lifecycleStatus,
      priority: notice.priority,
      audienceType: notice.audienceType,
      classId: notice.classId,
      sectionId: notice.sectionId,
      scheduledFor: notice.scheduledFor,
      publishedAt: notice.publishedAt,
      expiresAt: notice.expiresAt,
      archivedFromStatus: notice.archivedFromStatus,
    };
  }

  private async auditNoticeLifecycleChange(
    action: string,
    before: Notice,
    after: Notice,
    actor: AuthContext,
    context: Record<string, unknown> = {},
  ) {
    await this.auditService.record({
      action,
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: before.id,
      before: this.noticeLifecycleAudit(before),
      after: { ...this.noticeLifecycleAudit(after), ...context },
    });
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

  async recordAdmissionDocumentReminder(
    input: AdmissionDocumentReminderDeliveryInput,
  ): Promise<AdmissionDocumentReminderDeliveryOutcome> {
    if (!this.notificationEventService) {
      throw new ConflictException(
        'Notification event intake is unavailable for admission reminders',
      );
    }

    const schoolDay = getNepalSchoolDay().gregorianDate;
    const sourceId = `admission-document-request:${input.admissionCaseId}:${schoolDay}`;
    const notificationEvent = await this.notificationEventService.accept({
      tenantId: input.actor.tenantId,
      type: 'ADMISSION_DOCUMENTS_REQUESTED',
      sourceEntityId: input.admissionCaseId,
      actorId: input.actor.userId,
      idempotencyKey: sourceId,
      metadata: {
        sourceUpdatedAt: input.sourceUpdatedAt,
        missingDocumentCount: input.missingDocumentLabels.length,
        schoolDay,
      },
    });

    try {
      const result = await this.recordDeliveryRecords({
        actor: input.actor,
        sourceType: 'admission_document_request',
        sourceId,
        notificationEventId: notificationEvent.id,
        audienceType: AudienceType.ALL,
        title: 'Admission documents required',
        body: admissionDocumentReminderBody(
          input.applicantName,
          input.missingDocumentLabels,
        ),
        channels: [NotificationChannel.SMS],
        communicationCategory: 'ESSENTIAL',
        directRecipients: [
          {
            studentId: '',
            guardianId: null,
            userId: null,
            email: null,
            phone: input.guardianPhone,
          },
        ],
      });
      const deliveries = await this.prisma.notificationDelivery.findMany({
        where: {
          tenantId: input.actor.tenantId,
          sourceType: 'admission_document_request',
          sourceId,
        },
        select: { status: true },
      });
      await this.notificationEventService.markDispatched(
        input.actor.tenantId,
        notificationEvent.id,
      );

      const deliverable = deliveries.some(
        (delivery) =>
          delivery.status === NotificationStatus.QUEUED ||
          delivery.status === NotificationStatus.RETRY_PENDING ||
          delivery.status === NotificationStatus.SENT ||
          delivery.status === NotificationStatus.DELIVERED,
      );
      if (!deliverable) {
        return { state: 'SKIPPED', reason: 'DELIVERY_UNAVAILABLE' };
      }
      return {
        state:
          'replayed' in result && result.replayed ? 'ALREADY_QUEUED' : 'QUEUED',
        reason: null,
      };
    } catch (error) {
      await this.notificationEventService.markFailed(
        input.actor.tenantId,
        notificationEvent.id,
        'DELIVERY_INTAKE_FAILED',
      );
      throw error;
    }
  }

  async recordDeliveryRecords(input: DeliveryRecordInput) {
    const redis = this.redisService.getClient();
    const lockKey = `lock:delivery:${input.actor.tenantId}:${input.sourceType}:${input.sourceId}`;
    const acquired = await redis.set(lockKey, 'locked', 'PX', 5000, 'NX');

    if (!acquired) {
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const deliveries = await this.prisma.notificationDelivery.findMany({
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
        if (deliveries.length > 0) {
          if (input.notificationEventId) {
            await this.prisma.notificationDelivery.updateMany({
              where: {
                tenantId: input.actor.tenantId,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                notificationEventId: null,
              },
              data: { notificationEventId: input.notificationEventId },
            });
          }
          return summarizeExistingDeliveries(deliveries);
        }
      }
      throw new ConflictException(
        'Another process is currently recording delivery records for this notification',
      );
    }

    try {
      const existingDeliveries =
        await this.prisma.notificationDelivery.findMany({
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
        if (input.notificationEventId) {
          await this.prisma.notificationDelivery.updateMany({
            where: {
              tenantId: input.actor.tenantId,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              notificationEventId: null,
            },
            data: { notificationEventId: input.notificationEventId },
          });
        }
        return summarizeExistingDeliveries(existingDeliveries);
      }

      const recipients = input.directRecipients
        ? deduplicateRecipients(input.directRecipients)
        : await this.resolveAudienceRecipients(input);
      const { allowedRecipients, skippedRecipients } =
        await this.partitionRecipientsByCommunicationPolicy(input, recipients);

      if (recipients.length === 0) {
        return { count: 0 };
      }

      const totalToSent = allowedRecipients.length * input.channels.length;
      const smsToSent = input.channels.includes(NotificationChannel.SMS)
        ? allowedRecipients.length
        : 0;

      if (totalToSent > 0) {
        await this.usageService.checkLimit(
          input.actor.tenantId,
          'notifications.sent',
          totalToSent,
        );
      }
      if (smsToSent > 0) {
        await this.usageService.checkLimit(
          input.actor.tenantId,
          'sms.sent',
          smsToSent,
        );
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

      if (totalToSent > 0) {
        await this.usageService.incrementUsage(
          input.actor.tenantId,
          'notifications.sent',
          totalToSent,
        );
      }
      if (smsToSent > 0) {
        await this.usageService.incrementUsage(
          input.actor.tenantId,
          'sms.sent',
          smsToSent,
        );
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
    } finally {
      await redis.del(lockKey);
    }
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
    let notificationEventId: string | undefined;
    try {
      if (this.notificationEventService) {
        const notificationEvent = await this.notificationEventService.accept(
          notificationEventInput(eventName, event, input),
        );
        notificationEventId = notificationEvent.id;
      }
      const result = await this.recordDeliveryRecords({
        ...input,
        notificationEventId,
      });
      if (notificationEventId && this.notificationEventService) {
        await this.notificationEventService.markDispatched(
          event.tenantId,
          notificationEventId,
        );
      }
      return result;
    } catch (error) {
      if (notificationEventId && this.notificationEventService) {
        await this.notificationEventService.markFailed(
          event.tenantId,
          notificationEventId,
          'DELIVERY_INTAKE_FAILED',
        );
      }
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
        const idempotencyKey = deliveryIdempotencyKey(
          input,
          recipient,
          channel,
        );
        const delivery = await this.prisma.notificationDelivery.upsert({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.actor.tenantId,
              idempotencyKey,
            },
          },
          create: {
            tenantId: input.actor.tenantId,
            idempotencyKey,
            channel,
            status,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            audienceType: input.audienceType,
            recipientUserId: recipient.userId,
            guardianId: recipient.guardianId,
            studentId: recipient.studentId || null,
            noticeId: input.noticeId ?? null,
            eventId: input.eventId ?? null,
            activityPostId: input.activityPostId ?? null,
            notificationEventId: input.notificationEventId ?? null,
            destination: resolveDestination(recipient, channel),
            title: input.title,
            body: input.body,
            errorMessage: errorMessage ?? null,
            sentAt: null,
          },
          update: {},
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
        deliveryAttempt: '0',
        sourceType: delivery.sourceType,
        sourceId: delivery.sourceId,
      };

      if (this.notificationPreferencePolicy) {
        const decision =
          await this.notificationPreferencePolicy.evaluateDelivery(
            delivery.tenantId,
            delivery.id,
          );
        if (decision.action === 'SKIP') {
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationStatus.SKIPPED,
              errorMessage: decision.reason,
            },
          });
          return;
        }
      }

      if (delivery.channel !== NotificationChannel.IN_APP) {
        const readiness = await this.notificationsService.getProviderReadiness(
          delivery.channel,
        );
        if (!readiness.enabled) {
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationStatus.SKIPPED,
              errorMessage: readiness.failureReason,
              failureCode: readiness.failureCode,
              failureReason: readiness.failureReason,
            },
          });
          return;
        }
      }

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

      if (delivery.channel === NotificationChannel.IN_APP) {
        if (this.notificationPreferencePolicy) {
          await this.notificationsService.releaseInAppNotification({
            metadata,
          });
          return;
        }
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
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

  private async resolveNoticeAttachment(
    dto: CreateNoticeDto,
    actor: AuthContext,
  ) {
    if (!dto.attachmentFileId) {
      return dto.attachmentUrl ?? null;
    }

    if (!this.fileRegistryService) {
      throw new NotFoundException('File Registry is not available');
    }

    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      dto.attachmentFileId,
    );

    if (asset.module && asset.module !== 'notices') {
      throw new NotFoundException('Notice attachment file not found');
    }

    return this.fileRegistryService.getSignedUrl(actor.tenantId, asset.id);
  }

  private async assertNoticeAttachmentFile(
    attachmentFileId: string | undefined,
    actor: AuthContext,
  ) {
    if (!attachmentFileId) return;
    if (!this.fileRegistryService) {
      throw new NotFoundException('File Registry is not available');
    }
    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      attachmentFileId,
    );
    if (asset.module && asset.module !== 'notices') {
      throw new NotFoundException('Notice attachment file not found');
    }
  }

  private async getNoticeDeliverySummary(actor: AuthContext, noticeId: string) {
    const deliveries = await this.prisma.notificationDelivery.groupBy({
      by: ['status'],
      where: {
        tenantId: actor.tenantId,
        noticeId,
      },
      _count: { status: true },
    });
    return {
      total: deliveries.reduce((total, item) => total + item._count.status, 0),
      byStatus: deliveries.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
    };
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
    if (input.recipientUserIds?.length) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: input.actor.tenantId,
          id: { in: input.recipientUserIds },
          status: 'ACTIVE',
        },
      });
      return deduplicateRecipients(
        users.map((user) => ({
          studentId: '',
          guardianId: null,
          userId: user.id,
          email: user.email,
          phone: user.phone,
        })),
      );
    }

    if (input.staffIds?.length) {
      const staff = await this.prisma.staff.findMany({
        where: {
          tenantId: input.actor.tenantId,
          id: { in: input.staffIds },
        },
        include: { user: true },
      });
      return deduplicateRecipients(
        staff.map((s) => ({
          studentId: '',
          guardianId: null,
          userId: s.userId,
          email: s.user?.email ?? null,
          phone: s.user?.phone ?? null,
        })),
      );
    }

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

      return deduplicateRecipients(
        users.map((user) => ({
          studentId: '',
          guardianId: null,
          userId: user.id,
          email: user.email,
          phone: user.phone,
        })),
      );
    }

    // Reached only when staffIds was not provided: a STAFF audience without
    // an explicit staff selection has no one to notify (safer than falling
    // through to the unrelated student query below).
    if (input.audienceType === AudienceType.STAFF) {
      return [];
    }

    // Guardians targeted directly (PRD "linked-parent" audience), not as a
    // sub-filter on a known student's guardian links (that case always pairs
    // guardianIds with studentIds and is handled by the student query below,
    // e.g. students.service.ts's guardian-invitation flow).
    if (input.guardianIds?.length && !input.studentIds?.length) {
      const guardians = await this.prisma.guardian.findMany({
        where: {
          tenantId: input.actor.tenantId,
          id: { in: input.guardianIds },
        },
        include: { user: true },
      });

      return deduplicateRecipients(
        guardians.map((guardian) => ({
          studentId: '',
          guardianId: guardian.id,
          userId: guardian.userId,
          email: guardian.email ?? guardian.user?.email ?? null,
          phone: guardian.primaryPhone,
        })),
      );
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
        ...(input.activeStudentsOnly
          ? {
              lifecycleStatus: StudentLifecycleStatus.ACTIVE,
              enrollments: { some: { status: 'ACTIVE' } },
            }
          : {}),
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

    return deduplicateRecipients(recipients);
  }

  private async emitNoticePublished(notice: Notice, actor: AuthContext) {
    const event: NoticePublishedEvent = {
      tenantId: actor.tenantId,
      actor,
      noticeId: notice.id,
      audienceType: notice.audienceType,
      classId: notice.classId,
      sectionId: notice.sectionId,
      roleNames: notice.roleNames,
      staffIds: notice.staffIds,
      studentIds: notice.studentIds,
      guardianIds: notice.guardianIds,
      recipientUserIds: notice.recipientUserIds,
      title: notice.title,
      body: notice.body,
      priority: notice.priority,
    };

    if (!this.eventEmitter) {
      return this.handleNoticePublished(event);
    }

    const results = await this.eventEmitter.emitAsync(
      'notice.published',
      event,
    );
    return results[0] ?? { count: 0 };
  }

  @OnEvent('notice.published')
  async handleNoticePublished(event: NoticePublishedEvent) {
    const priority: ContractNotificationEventPriority =
      event.priority === NoticePriority.EMERGENCY
        ? 'MANDATORY'
        : event.priority === NoticePriority.URGENT
          ? 'CRITICAL'
          : 'NORMAL';
    const notificationEvent = this.notificationEventService
      ? await this.notificationEventService.accept({
          tenantId: event.tenantId,
          type: 'NOTICE_PUBLISHED',
          sourceEntityId: event.noticeId,
          actorId: event.actor?.userId,
          priority,
          idempotencyKey: `notice:${event.noticeId}:published`,
          metadata: {
            audienceType: event.audienceType,
            priority: event.priority,
          },
        })
      : null;
    try {
      const result = await this.recordDeliveryRecords({
        actor: toNotificationActor(event),
        sourceType: 'notice',
        sourceId: event.noticeId,
        noticeId: event.noticeId,
        audienceType: event.audienceType,
        classId: event.classId,
        sectionId: event.sectionId,
        roleNames: event.roleNames,
        staffIds: event.staffIds,
        studentIds: event.studentIds,
        guardianIds: event.guardianIds,
        recipientUserIds: event.recipientUserIds,
        title: event.title,
        body: event.body,
        channels: noticeChannels(event.priority),
        requiredConsentTypes: [ConsentType.MESSAGING],
        communicationCategory:
          event.priority === NoticePriority.EMERGENCY
            ? 'ESSENTIAL'
            : 'NON_ESSENTIAL',
        activeStudentsOnly: true,
        notificationEventId: notificationEvent?.id,
      });
      if (notificationEvent && this.notificationEventService) {
        await this.notificationEventService.markDispatched(
          event.tenantId,
          notificationEvent.id,
        );
      }
      return result;
    } catch (error) {
      if (notificationEvent && this.notificationEventService) {
        await this.notificationEventService.markFailed(
          event.tenantId,
          notificationEvent.id,
          'DELIVERY_INTAKE_FAILED',
        );
      }
      throw error;
    }
  }

  private async partitionRecipientsByCommunicationPolicy(
    input: DeliveryRecordInput,
    recipients: DeliveryRecipient[],
  ) {
    const requiredConsentTypes = input.requiredConsentTypes ?? [];
    const communicationCategory = input.communicationCategory ?? 'ESSENTIAL';

    if (
      requiredConsentTypes.length === 0 &&
      communicationCategory === 'ESSENTIAL'
    ) {
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
    const communicationPreferences =
      guardianIds.length === 0
        ? []
        : await this.prisma.communicationPreference.findMany({
            where: {
              tenantId: input.actor.tenantId,
              guardianId: { in: guardianIds },
            },
            select: {
              guardianId: true,
              marketingOptOutAt: true,
            },
          });
    const optedOutGuardianIds = new Set(
      communicationPreferences
        .filter((preference) => preference.marketingOptOutAt)
        .map((preference) => preference.guardianId),
    );

    const allowedRecipients: DeliveryRecipient[] = [];
    const skippedRecipients: DeliveryRecipient[] = [];

    for (const recipient of recipients) {
      if (!recipient.guardianId) {
        allowedRecipients.push(recipient);
        continue;
      }

      if (
        communicationCategory !== 'ESSENTIAL' &&
        optedOutGuardianIds.has(recipient.guardianId)
      ) {
        skippedRecipients.push(recipient);
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
  notificationEventId?: string | null;
  audienceType: AudienceType;
  classId?: string | null;
  sectionId?: string | null;
  studentIds?: string[];
  guardianIds?: string[];
  staffIds?: string[];
  roleNames?: string[];
  recipientUserIds?: string[];
  directRecipients?: DeliveryRecipient[];
  title: string;
  body: string;
  channels: NotificationChannel[];
  requiredConsentTypes?: ConsentType[];
  communicationCategory?: 'ESSENTIAL' | 'NON_ESSENTIAL' | 'MARKETING';
  activeStudentsOnly?: boolean;
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

type NoticePublishedEvent = TenantDomainEvent & {
  noticeId: string;
  audienceType: AudienceType;
  classId: string | null;
  sectionId: string | null;
  roleNames: string[];
  staffIds: string[];
  studentIds: string[];
  guardianIds: string[];
  recipientUserIds: string[];
  title: string;
  body: string;
  priority: NoticePriority;
};

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

const DOMAIN_NOTIFICATION_EVENT_TYPES = {
  'student.admitted': 'STUDENT_ADMITTED',
  'attendance.student.absent': 'ATTENDANCE_STUDENT_ABSENT',
  'attendance.student.late': 'ATTENDANCE_STUDENT_LATE',
  'attendance.student.leave': 'ATTENDANCE_STUDENT_LEAVE',
  'attendance.student.consecutive_absence':
    'ATTENDANCE_STUDENT_CONSECUTIVE_ABSENCE',
  'fees.payment.confirmed': 'FEE_PAYMENT_CONFIRMED',
} as const satisfies Record<string, ContractNotificationEventType>;

function notificationEventInput(
  eventName: string,
  event: TenantDomainEvent,
  input: DeliveryRecordInput,
): AcceptNotificationEventInput {
  const type =
    DOMAIN_NOTIFICATION_EVENT_TYPES[
      eventName as keyof typeof DOMAIN_NOTIFICATION_EVENT_TYPES
    ];
  if (!type) {
    throw new BadRequestException(
      `Unknown notification event type: ${eventName}`,
    );
  }

  if (type === 'STUDENT_ADMITTED') {
    const admitted = event as StudentAdmittedEvent;
    return {
      tenantId: event.tenantId,
      type,
      sourceEntityId: admitted.studentId,
      actorId: event.actor?.userId,
      idempotencyKey: input.sourceId,
      metadata: {
        classId: admitted.classId,
        sectionId: admitted.sectionId ?? null,
      },
    };
  }

  if (type === 'FEE_PAYMENT_CONFIRMED') {
    const payment = event as FeePaymentConfirmedEvent;
    return {
      tenantId: event.tenantId,
      type,
      sourceEntityId: payment.paymentId,
      actorId: event.actor?.userId,
      idempotencyKey: input.sourceId,
      metadata: {
        invoiceId: payment.invoiceId,
        studentId: payment.studentId,
      },
    };
  }

  const attendance = event as AttendanceNotificationEvent;
  return {
    tenantId: event.tenantId,
    type,
    sourceEntityId: input.sourceId,
    actorId: event.actor?.userId,
    idempotencyKey: input.sourceId,
    metadata: {
      attendanceSessionId: attendance.attendanceSessionId,
      studentId: attendance.studentId,
      status: attendance.status,
    },
  };
}

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

function admissionDocumentReminderBody(
  applicantName: string,
  missingDocumentLabels: string[],
) {
  const safeName = applicantName.trim().slice(0, 120) || 'the applicant';
  const labels = missingDocumentLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 3);
  const remaining = Math.max(0, missingDocumentLabels.length - labels.length);
  const documentText = labels.length
    ? `${labels.join(', ')}${remaining ? ` and ${remaining} more` : ''}`
    : 'required admission documents';
  return `School records for ${safeName} still need ${documentText}. Please contact the admissions office.`.slice(
    0,
    500,
  );
}

function deliveryIdempotencyKey(
  input: DeliveryRecordInput,
  recipient: DeliveryRecipient,
  channel: NotificationChannel,
) {
  const recipientKey =
    recipient.userId ??
    recipient.guardianId ??
    recipient.studentId ??
    recipient.email?.trim().toLowerCase() ??
    recipient.phone?.trim();
  if (!recipientKey) {
    throw new ConflictException(
      'Notification recipient has no stable delivery identity',
    );
  }
  return `${input.sourceType}:${input.sourceId}:${recipientKey}:${channel}`;
}

function noticeChannels(priority: NoticePriority): NotificationChannel[] {
  return priority === NoticePriority.EMERGENCY
    ? [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.SMS,
      ]
    : [NotificationChannel.IN_APP, NotificationChannel.PUSH];
}

function deduplicateRecipients(recipients: DeliveryRecipient[]) {
  const unique = new Map<string, DeliveryRecipient>();
  for (const recipient of recipients) {
    const key =
      recipient.userId ??
      recipient.email?.trim().toLowerCase() ??
      recipient.phone?.trim() ??
      recipient.guardianId ??
      recipient.studentId;
    if (key && !unique.has(key)) unique.set(key, recipient);
  }
  return Array.from(unique.values());
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

type SchoolProviderMode = 'disabled' | 'dev-log' | 'mock' | 'configured';
type ProviderHealth = 'healthy' | 'degraded' | 'unavailable';

function resolveSchoolProviderMode(
  channel: 'email' | 'sms' | 'push',
): SchoolProviderMode {
  if (isDisabled(process.env.NOTIFICATIONS_DISABLED)) {
    return 'disabled';
  }
  if (isDisabled(process.env[`${channel.toUpperCase()}_PROVIDER_ENABLED`])) {
    return 'disabled';
  }

  const raw =
    process.env[`${channel.toUpperCase()}_PROVIDER_MODE`] ??
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE ??
    (channel === 'email' ? process.env.EMAIL_DELIVERY_MODE : undefined);
  const normalized = raw?.trim().toLowerCase();

  if (normalized === 'disabled') return 'disabled';
  if (normalized === 'mock') return 'mock';
  if (normalized === 'configured' || normalized === 'configured-provider') {
    return 'configured';
  }
  if (normalized === 'webhook') return 'configured';
  if (normalized === 'dev-log' || normalized === 'log') return 'dev-log';
  return 'dev-log';
}

function resolveOverallProviderMode(modes: SchoolProviderMode[]) {
  if (modes.includes('configured')) return 'configured';
  if (modes.includes('mock')) return 'mock';
  if (modes.includes('dev-log')) return 'dev-log';
  return 'disabled';
}

function resolveProviderHealth(input: {
  mode: SchoolProviderMode;
  hasProvider: boolean;
  validationStatus: string | null;
  failedCount: number;
  retryableCount: number;
  deliveryCount: number;
}): ProviderHealth {
  if (input.mode === 'disabled') {
    return 'unavailable';
  }
  if (
    input.mode === 'configured' &&
    (!input.hasProvider || input.validationStatus === 'FAILED')
  ) {
    return 'degraded';
  }
  if (input.failedCount > 0 || input.retryableCount > 0) {
    return 'degraded';
  }
  if (input.deliveryCount === 0) {
    return 'unavailable';
  }
  return 'healthy';
}

function providerDiagnosticMessage(input: {
  label: string;
  mode: SchoolProviderMode;
  health: ProviderHealth;
  hasProvider: boolean;
  validationStatus: string | null;
}) {
  if (input.mode === 'disabled') {
    return `${input.label} delivery is disabled. It is not treated as live provider delivery.`;
  }
  if (input.mode === 'dev-log') {
    return `${input.label} delivery is in dev-log mode and is not live provider delivery.`;
  }
  if (input.mode === 'mock') {
    return `${input.label} delivery is in mock mode and is not live provider delivery.`;
  }
  if (!input.hasProvider) {
    return `${input.label} delivery is configured mode, but no enabled backend provider is available.`;
  }
  if (input.validationStatus === 'FAILED') {
    return `${input.label} delivery provider validation failed. Review platform provider setup.`;
  }
  if (input.health === 'degraded') {
    return `${input.label} delivery has failed or retryable records that need review.`;
  }
  return `${input.label} delivery is configured through the backend provider boundary.`;
}

function normalizeTemplateKey(value: string) {
  return value.trim().toLowerCase();
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function resolveDeliveryEventTime(
  delivery:
    | {
        sentAt?: Date | null;
        deliveredAt?: Date | null;
        failedAt?: Date | null;
        createdAt?: Date | null;
      }
    | null
    | undefined,
) {
  if (!delivery) return null;
  return (
    delivery.deliveredAt ??
    delivery.failedAt ??
    delivery.sentAt ??
    delivery.createdAt ??
    null
  );
}

function safeProviderValidationStatus(value: string | null | undefined) {
  if (!value) return null;
  if (['VALID', 'READY', 'OK', 'DEGRADED', 'FAILED'].includes(value)) {
    return value;
  }
  return 'NOT_VALIDATED';
}

function hasCallbackSecretConfig(config: Record<string, unknown>) {
  return [
    'callbackSecret',
    'webhookSecret',
    'signingSecret',
    'providerWebhookSecret',
  ].some((key) => typeof config[key] === 'string' && config[key]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isDisabled(value: string | undefined) {
  if (!value) return false;
  return ['0', 'false', 'disabled', 'off', 'no'].includes(
    value.trim().toLowerCase(),
  );
}
