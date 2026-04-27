import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  AudienceType,
  ConsentType,
  NotificationChannel,
} from '@prisma/client';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateActivityPostDto } from './dto/create-activity-post.dto';
import { CreateActivityReactionDto } from './dto/create-activity-reaction.dto';
import { CreateDevelopmentalMilestoneDto } from './dto/create-developmental-milestone.dto';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';
import { isParentOnly, getParentStudentIds } from '../common/security/parent-scope';

@Injectable()
export class ActivityFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listPosts(
    actor: AuthContext,
    filters: {
      studentId?: string;
      classId?: string;
      sectionId?: string;
      category?: string;
      month?: string;
    } = {},
  ) {
    const monthRange = filters.month ? getMonthRange(filters.month) : null;

    // Parent scoping: parents can only see posts tagged with their children
    let studentTagFilter = filters.studentId
      ? { studentTags: { some: { studentId: filters.studentId } } }
      : {};

    if (isParentOnly(actor)) {
      const parentStudentIds = await getParentStudentIds(this.prisma, actor);
      if (parentStudentIds !== null) {
        studentTagFilter = {
          studentTags: { some: { studentId: { in: parentStudentIds } } },
        } as any;
      }
    }

    return this.prisma.activityPost.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.category
          ? { category: filters.category as ActivityCategory }
          : {}),
        ...studentTagFilter,
        ...(monthRange
          ? {
              publishedAt: {
                gte: monthRange.start,
                lt: monthRange.end,
              },
            }
          : {}),
      },
      include: {
        class: true,
        section: true,
        attachments: {
          orderBy: { sortOrder: 'asc' },
        },
        studentTags: {
          include: {
            student: true,
          },
        },
        reactions: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async getReactionAnalytics(actor: AuthContext) {
    const reactions = await this.prisma.activityReaction.groupBy({
      by: ['reaction'],
      where: { tenantId: actor.tenantId },
      _count: { reaction: true },
    });
    const postEngagement = await this.prisma.activityPost.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        _count: {
          select: { reactions: true },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 25,
    });

    return {
      byReaction: reactions.map((reaction) => ({
        reaction: reaction.reaction,
        count: reaction._count.reaction,
      })),
      topPosts: postEngagement
        .sort((a, b) => b._count.reactions - a._count.reactions)
        .slice(0, 10)
        .map((post) => ({
          postId: post.id,
          title: post.title,
          category: post.category,
          reactionCount: post._count.reactions,
        })),
    };
  }

  async createPost(dto: CreateActivityPostDto, actor: AuthContext) {
    const [classroom, section] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    if (dto.studentIds?.length) {
      const students = await this.prisma.student.findMany({
        where: {
          tenantId: actor.tenantId,
          classId: dto.classId,
          ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
          id: { in: dto.studentIds },
        },
      });

      if (students.length !== dto.studentIds.length) {
        throw new NotFoundException(
          'One or more tagged students were not found in this class/section',
        );
      }
    }

    const storedAttachments = await Promise.all(
      dto.attachments.map((attachment, index) =>
        this.storageService
          .saveBase64Object({
            tenantId: actor.tenantId,
            prefix: `activity-feed/${dto.classId}`,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            base64Content: attachment.base64Content,
          })
          .then((stored) => ({
            ...attachment,
            ...stored,
            sortOrder: index,
          })),
      ),
    );

    const audienceType =
      dto.audienceType ??
      (dto.studentIds?.length ? AudienceType.SECTION : AudienceType.CLASS);

    const post = await this.prisma.activityPost.create({
      data: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        createdById: actor.userId,
        title: dto.title,
        caption: dto.caption,
        category: dto.category ?? ActivityCategory.GENERAL,
        audienceType,
        publishedAt: new Date(),
        attachments: {
          create: storedAttachments.map((attachment) => ({
            tenantId: actor.tenantId,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            sizeBytes: attachment.sizeBytes,
            provider: attachment.provider,
            objectKey: attachment.objectKey,
            publicUrl: attachment.publicUrl,
            sortOrder: attachment.sortOrder,
          })),
        },
        studentTags: dto.studentIds?.length
          ? {
              create: dto.studentIds.map((studentId) => ({
                tenantId: actor.tenantId,
                studentId,
              })),
            }
          : undefined,
      },
      include: {
        attachments: true,
        studentTags: true,
      },
    });

    await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'activity_post',
      sourceId: post.id,
      activityPostId: post.id,
      audienceType,
      classId: post.classId,
      sectionId: post.sectionId,
      studentIds: dto.studentIds,
      title: post.title,
      body: post.caption,
      channels: [NotificationChannel.PUSH],
      requiredConsentTypes: [ConsentType.PHOTO_USAGE],
    });

    await this.auditService.record({
      action: 'create',
      resource: 'activity_post',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: post.id,
      after: {
        classId: post.classId,
        sectionId: post.sectionId,
        attachmentCount: post.attachments.length,
        taggedStudentCount: post.studentTags.length,
      },
    });

    this.eventEmitter.emit('feed.post.created', post);

    return post;
  }

  @OnEvent('student.admitted')
  async handleStudentAdmitted(event: { tenantId: string; classId: string; sectionId?: string; studentId: string; studentName: string; actor: AuthContext }) {
    const post = await this.prisma.activityPost.create({
      data: {
        tenantId: event.tenantId,
        classId: event.classId,
        sectionId: event.sectionId ?? null,
        createdById: event.actor.userId,
        title: 'New Student Welcome',
        caption: `Please welcome ${event.studentName} to the class!`,
        category: ActivityCategory.GENERAL,
        audienceType: event.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
        publishedAt: new Date(),
        studentTags: {
          create: [{ tenantId: event.tenantId, studentId: event.studentId }]
        }
      },
      include: { attachments: true, studentTags: true },
    });
    this.eventEmitter.emit('feed.post.created', post);
  }

  @OnEvent('homework.assigned')
  async handleHomeworkAssigned(event: { tenantId: string; classId: string; sectionId?: string; homeworkId: string; title: string; actor: AuthContext }) {
    const post = await this.prisma.activityPost.create({
      data: {
        tenantId: event.tenantId,
        classId: event.classId,
        sectionId: event.sectionId ?? null,
        createdById: event.actor.userId,
        title: 'New Homework Assigned',
        caption: `A new homework assignment "${event.title}" has been posted. Please check the academics portal.`,
        category: ActivityCategory.LEARNING,
        audienceType: event.sectionId ? AudienceType.SECTION : AudienceType.CLASS,
        publishedAt: new Date(),
      },
      include: { attachments: true, studentTags: true },
    });
    this.eventEmitter.emit('feed.post.created', post);
  }

  @OnEvent('exam.published')
  async handleExamPublished(event: { tenantId: string; classId: string; examTermId: string; actor: AuthContext }) {
    const post = await this.prisma.activityPost.create({
      data: {
        tenantId: event.tenantId,
        classId: event.classId,
        createdById: event.actor.userId,
        title: 'Exam Timetable Published',
        caption: `The exam timetable for the upcoming term has been published.`,
        category: ActivityCategory.LEARNING,
        audienceType: AudienceType.CLASS,
        publishedAt: new Date(),
      },
      include: { attachments: true, studentTags: true },
    });
    this.eventEmitter.emit('feed.post.created', post);
  }

  async createReaction(
    postId: string,
    dto: CreateActivityReactionDto,
    actor: AuthContext,
  ) {
    if (!dto.guardianId && !dto.studentId) {
      throw new BadRequestException(
        'A guardianId or studentId is required for a reaction',
      );
    }

    const post = await this.prisma.activityPost.findFirst({
      where: { id: postId, tenantId: actor.tenantId },
    });

    if (!post) {
      throw new NotFoundException('Activity post not found in this tenant');
    }

    const [guardian, student] = await Promise.all([
      dto.guardianId
        ? this.prisma.guardian.findFirst({
            where: { id: dto.guardianId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
      dto.studentId
        ? this.prisma.student.findFirst({
            where: { id: dto.studentId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (dto.guardianId && !guardian) {
      throw new NotFoundException('Guardian not found in this tenant');
    }

    if (dto.studentId && !student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const existing = await this.prisma.activityReaction.findFirst({
      where: {
        tenantId: actor.tenantId,
        activityPostId: post.id,
        reaction: dto.reaction,
        guardianId: dto.guardianId ?? null,
        studentId: dto.studentId ?? null,
      },
    });

    if (existing) {
      return existing;
    }

    const reaction = await this.prisma.activityReaction.create({
      data: {
        tenantId: actor.tenantId,
        activityPostId: post.id,
        guardianId: dto.guardianId ?? null,
        studentId: dto.studentId ?? null,
        reaction: dto.reaction,
      },
    });

    await this.auditService.record({
      action: 'react',
      resource: 'activity_post',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: post.id,
      after: {
        reaction: dto.reaction,
        guardianId: dto.guardianId ?? null,
        studentId: dto.studentId ?? null,
      },
    });

    return reaction;
  }

  async listMoodLogs(actor: AuthContext) {
    return this.prisma.moodLog.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        section: true,
        student: true,
      },
      orderBy: [{ logDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async createMoodLog(dto: CreateMoodLogDto, actor: AuthContext) {
    const [classroom, section, student] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
      dto.studentId
        ? this.prisma.student.findFirst({
            where: { id: dto.studentId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    if (dto.studentId && !student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const moodLog = await this.prisma.moodLog.create({
      data: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        studentId: dto.studentId ?? null,
        mood: dto.mood,
        note: dto.note ?? null,
        logDate: new Date(dto.logDate),
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'mood_log',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: moodLog.id,
      after: {
        classId: moodLog.classId,
        sectionId: moodLog.sectionId,
        studentId: moodLog.studentId,
        mood: moodLog.mood,
      },
    });

    return moodLog;
  }

  async listMilestones(
    actor: AuthContext,
    filters: { studentId?: string; month?: string } = {},
  ) {
    const monthRange = filters.month ? getMonthRange(filters.month) : null;

    return this.prisma.developmentalMilestone.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(monthRange
          ? {
              observedAt: {
                gte: monthRange.start,
                lt: monthRange.end,
              },
            }
          : {}),
      },
      include: {
        class: true,
        section: true,
        student: true,
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async createMilestone(
    dto: CreateDevelopmentalMilestoneDto,
    actor: AuthContext,
  ) {
    const [classroom, section, student] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
      this.prisma.student.findFirst({
        where: {
          id: dto.studentId,
          tenantId: actor.tenantId,
          classId: dto.classId,
          ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        },
      }),
    ]);

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    if (!student) {
      throw new NotFoundException(
        'Student not found in this class/section tenant scope',
      );
    }

    const milestone = await this.prisma.developmentalMilestone.create({
      data: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        studentId: dto.studentId,
        domain: dto.domain,
        milestone: dto.milestone,
        status: dto.status,
        observationNote: dto.observationNote ?? null,
        photoObjectKey: dto.photoObjectKey ?? null,
        photoUrl: dto.photoUrl ?? null,
        observedAt: new Date(dto.observedAt),
        createdById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'developmental_milestone',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: milestone.id,
      after: {
        studentId: milestone.studentId,
        domain: milestone.domain,
        status: milestone.status,
      },
    });

    return milestone;
  }
}

function getMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new BadRequestException('month must use YYYY-MM format');
  }

  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    throw new BadRequestException('month must use YYYY-MM format');
  }

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}
