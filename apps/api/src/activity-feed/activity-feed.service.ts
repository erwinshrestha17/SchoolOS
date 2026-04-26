import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityCategory,
  AudienceType,
  NotificationChannel,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateActivityPostDto } from './dto/create-activity-post.dto';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';

@Injectable()
export class ActivityFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async listPosts(actor: AuthContext) {
    return this.prisma.activityPost.findMany({
      where: { tenantId: actor.tenantId },
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
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
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

    return post;
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
}
