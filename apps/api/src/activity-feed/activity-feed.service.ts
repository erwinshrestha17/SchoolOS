import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  AudienceType,
  ConsentType,
  NotificationChannel,
  Prisma,
  ActivityAttachment,
  ActivityPostStatus,
  StorageProvider,
} from '@prisma/client';
import { Queue } from 'bullmq';
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
import { FileRegistryService } from '../file-registry/file-registry.service';
import {
  isParentOnly,
  isStudentOnly,
  getParentStudentIds,
  getStudentOwnId,
} from '../common/security/parent-scope';

const MAX_ACTIVITY_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACTIVITY_MEDIA_CONSENT_BLOCK_REASON = 'PHOTO_USAGE_CONSENT_REQUIRED';

interface ActorMediaAccess {
  blocked: boolean;
  reason?: string;
}

interface StoredActivityAttachment {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: StorageProvider;
  objectKey: string;
  fileAssetId: string;
  publicUrl: string | null;
  sortOrder: number;
}

@Injectable()
export class ActivityFeedService {
  private readonly logger = new Logger(ActivityFeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly fileRegistryService: FileRegistryService,
    @InjectQueue('activity-media')
    private readonly mediaQueue: Queue,
  ) {}

  listMilestoneTemplates(filters: { stage?: string; domain?: string } = {}) {
    const normalizedStage = filters.stage?.trim().toLowerCase();
    const normalizedDomain = filters.domain?.trim().toLowerCase();

    return MILESTONE_TEMPLATE_CATALOG.filter((template) => {
      const matchesStage =
        !normalizedStage ||
        template.stage.toLowerCase() === normalizedStage ||
        template.stageAliases.some((alias) => alias === normalizedStage);
      const matchesDomain =
        !normalizedDomain || template.domain.toLowerCase() === normalizedDomain;

      return matchesStage && matchesDomain;
    }).map(({ stageAliases, ...template }) => template);
  }

  async listPosts(
    actor: AuthContext,
    filters: {
      studentId?: string;
      classId?: string;
      sectionId?: string;
      category?: string;
      month?: string;
      status?: string;
    } = {},
  ) {
    const monthRange = filters.month ? getMonthRange(filters.month) : null;
    const visibilityFilter = await this.buildActorPostVisibilityFilter(
      actor,
      filters.studentId,
    );

    if (filters.classId) {
      await this.ensureClassSectionAndWriteAccess(actor, {
        classId: filters.classId,
        sectionId: filters.sectionId,
        requireWritable: false,
      });
    }

    if (
      filters.status &&
      filters.status !== ActivityPostStatus.APPROVED &&
      !canManageAllActivity(actor)
    ) {
      throw new ForbiddenException(
        'You do not have permission to filter posts by status',
      );
    }

    const posts = await this.prisma.activityPost.findMany({
      where: {
        tenantId: actor.tenantId,
        softDeletedAt: null,
        status: filters.status
          ? (filters.status as ActivityPostStatus)
          : canManageAllActivity(actor)
            ? {
                in: [
                  ActivityPostStatus.APPROVED,
                  ActivityPostStatus.PENDING_APPROVAL,
                ],
              }
            : ActivityPostStatus.APPROVED,
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.category
          ? { category: filters.category as ActivityCategory }
          : {}),
        ...visibilityFilter,
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

    const mediaAccess = await this.resolveActorMediaAccess(actor);

    const allTaggedStudentIds = Array.from(
      new Set(
        posts.flatMap((post) => post.studentTags.map((tag) => tag.studentId)),
      ),
    );

    const consentMap = new Map<string, boolean>();
    if (allTaggedStudentIds.length > 0 && isParentOnly(actor)) {
      const students = await this.prisma.student.findMany({
        where: { id: { in: allTaggedStudentIds }, tenantId: actor.tenantId },
        include: {
          guardianLinks: {
            include: {
              guardian: {
                include: {
                  consents: {
                    where: { consentType: ConsentType.PHOTO_USAGE },
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      for (const student of students) {
        let allowed = student.lifecycleStatus === 'ACTIVE';
        if (allowed) {
          const guardians = student.guardianLinks.map((link) => link.guardian);
          if (guardians.length === 0) {
            allowed = false;
          } else {
            let studentHasConsent = false;
            for (const guardian of guardians) {
              const latestConsent = guardian.consents[0];
              if (latestConsent) {
                if (latestConsent.granted && !latestConsent.revokedAt) {
                  studentHasConsent = true;
                } else {
                  studentHasConsent = false;
                  break;
                }
              }
            }
            allowed = studentHasConsent;
          }
        }
        consentMap.set(student.id, allowed);
      }
    }

    return posts.map((post) => {
      let isBlockedByTags = false;
      if (isParentOnly(actor)) {
        for (const tag of post.studentTags) {
          if (consentMap.get(tag.studentId) === false) {
            isBlockedByTags = true;
            break;
          }
        }
      }
      const postMediaAccess = {
        blocked: mediaAccess.blocked || isBlockedByTags,
        reason: isBlockedByTags
          ? 'PHOTO_USAGE_CONSENT_REQUIRED'
          : mediaAccess.reason,
      };
      return this.serializePostForActor(post, postMediaAccess);
    });
  }

  async getPostDetail(postId: string, actor: AuthContext) {
    const visibilityFilter = await this.buildActorPostVisibilityFilter(actor);

    const post = await this.prisma.activityPost.findFirst({
      where: {
        id: postId,
        tenantId: actor.tenantId,
        softDeletedAt: null,
        ...(canManageAllActivity(actor)
          ? {}
          : { status: ActivityPostStatus.APPROVED }),
        ...visibilityFilter,
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
        reactions: {
          include: {
            guardian: true,
            student: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Activity post not found');
    }

    const mediaAccess = await this.resolveActorMediaAccess(actor);

    let isBlockedByTags = false;
    if (isParentOnly(actor) && post.studentTags.length > 0) {
      const studentIds = post.studentTags.map((tag) => tag.studentId);
      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId: actor.tenantId },
        include: {
          guardianLinks: {
            include: {
              guardian: {
                include: {
                  consents: {
                    where: { consentType: ConsentType.PHOTO_USAGE },
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      for (const student of students) {
        if (student.lifecycleStatus !== 'ACTIVE') {
          isBlockedByTags = true;
          break;
        }
        const guardians = student.guardianLinks.map((link) => link.guardian);
        if (guardians.length === 0) {
          isBlockedByTags = true;
          break;
        }
        let studentHasConsent = false;
        for (const guardian of guardians) {
          const latestConsent = guardian.consents[0];
          if (latestConsent) {
            if (latestConsent.granted && !latestConsent.revokedAt) {
              studentHasConsent = true;
            } else {
              studentHasConsent = false;
              break;
            }
          }
        }
        if (!studentHasConsent) {
          isBlockedByTags = true;
          break;
        }
      }
    }

    const postMediaAccess = {
      blocked: mediaAccess.blocked || isBlockedByTags,
      reason: isBlockedByTags
        ? 'PHOTO_USAGE_CONSENT_REQUIRED'
        : mediaAccess.reason,
    };

    return this.serializePostForActor(post, postMediaAccess);
  }

  async listGallery(
    actor: AuthContext,
    filters: {
      studentId?: string;
      classId?: string;
      sectionId?: string;
      category?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const visibilityFilter = await this.buildActorPostVisibilityFilter(
      actor,
      filters.studentId,
    );

    const attachments = await this.prisma.activityAttachment.findMany({
      where: {
        tenantId: actor.tenantId,
        activityPost: {
          softDeletedAt: null,
          status: canManageAllActivity(actor)
            ? {
                in: [
                  ActivityPostStatus.APPROVED,
                  ActivityPostStatus.PENDING_APPROVAL,
                ],
              }
            : ActivityPostStatus.APPROVED,
          ...(filters.classId ? { classId: filters.classId } : {}),
          ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
          ...(filters.category
            ? { category: filters.category as ActivityCategory }
            : {}),
          ...visibilityFilter,
        },
      },
      include: {
        activityPost: {
          include: {
            studentTags: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });

    const mediaAccess = await this.resolveActorMediaAccess(actor);

    const allTaggedStudentIds = Array.from(
      new Set(
        attachments.flatMap((att) =>
          att.activityPost.studentTags.map((tag) => tag.studentId),
        ),
      ),
    );

    const consentMap = new Map<string, boolean>();
    if (allTaggedStudentIds.length > 0 && isParentOnly(actor)) {
      const students = await this.prisma.student.findMany({
        where: { id: { in: allTaggedStudentIds }, tenantId: actor.tenantId },
        include: {
          guardianLinks: {
            include: {
              guardian: {
                include: {
                  consents: {
                    where: { consentType: ConsentType.PHOTO_USAGE },
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      for (const student of students) {
        let allowed = student.lifecycleStatus === 'ACTIVE';
        if (allowed) {
          const guardians = student.guardianLinks.map((link) => link.guardian);
          if (guardians.length === 0) {
            allowed = false;
          } else {
            let studentHasConsent = false;
            for (const guardian of guardians) {
              const latestConsent = guardian.consents[0];
              if (latestConsent) {
                if (latestConsent.granted && !latestConsent.revokedAt) {
                  studentHasConsent = true;
                } else {
                  studentHasConsent = false;
                  break;
                }
              }
            }
            allowed = studentHasConsent;
          }
        }
        consentMap.set(student.id, allowed);
      }
    }

    return attachments.map((attachment) => {
      let isBlockedByTags = false;
      if (isParentOnly(actor)) {
        for (const tag of attachment.activityPost.studentTags) {
          if (consentMap.get(tag.studentId) === false) {
            isBlockedByTags = true;
            break;
          }
        }
      }
      const attachmentMediaAccess = {
        blocked: mediaAccess.blocked || isBlockedByTags,
        reason: isBlockedByTags
          ? 'PHOTO_USAGE_CONSENT_REQUIRED'
          : mediaAccess.reason,
      };

      return {
        ...this.serializeAttachmentForActor(attachment, attachmentMediaAccess),
        postId: attachment.activityPostId,
        createdAt: attachment.createdAt,
        postTitle: attachment.activityPost.title,
      };
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
    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: dto.classId,
      sectionId: dto.sectionId,
      requireWritable: true,
    });

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

    for (const attachment of dto.attachments) {
      this.validateActivityAttachment(attachment);
    }

    const storedAttachments: StoredActivityAttachment[] = [];

    try {
      for (let index = 0; index < dto.attachments.length; index++) {
        const attachment = dto.attachments[index];
        const stored = await this.storageService.saveBase64Object({
          tenantId: actor.tenantId,
          prefix: `activity-feed/${dto.classId}`,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          base64Content: attachment.base64Content,
        });

        const asset = await this.fileRegistryService.registerFile({
          tenantId: actor.tenantId,
          uploadedByUserId: actor.userId,
          originalFilename: attachment.fileName,
          objectKey: stored.objectKey,
          mimeType: attachment.contentType,
          sizeBytes: stored.sizeBytes,
          provider: stored.provider,
          bucket: stored.bucket,
          checksumSha256: stored.checksumSha256,
          module: 'activity',
          metadata: { sortOrder: index },
        });
        await this.fileRegistryService.markUploaded(
          actor.tenantId,
          asset.id,
          actor.userId,
        );

        storedAttachments.push({
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: stored.sizeBytes,
          provider: stored.provider,
          objectKey: stored.objectKey,
          fileAssetId: asset.id,
          publicUrl: null,
          sortOrder: index,
        });
      }
    } catch (error) {
      await this.cleanupStoredActivityAttachments(storedAttachments);
      throw error;
    }

    let post;
    try {
      const audienceType =
        dto.audienceType ??
        (dto.studentIds?.length
          ? AudienceType.ALL
          : dto.sectionId
            ? AudienceType.SECTION
            : AudienceType.CLASS);

      post = await this.prisma.activityPost.create({
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
              fileAssetId: attachment.fileAssetId,
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

      for (const attachment of post.attachments) {
        await this.mediaQueue.add(
          'compress',
          {
            tenantId: actor.tenantId,
            attachmentId: attachment.id,
            fileAssetId: attachment.fileAssetId,
            requestedById: actor.userId,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
          },
        );
      }

      await Promise.all(
        post.attachments.map((attachment) =>
          (attachment as ActivityAttachment & { fileAssetId?: string })
            .fileAssetId
            ? this.prisma.fileAsset.update({
                where: {
                  id: (
                    attachment as ActivityAttachment & { fileAssetId?: string }
                  ).fileAssetId,
                },
                data: { entityId: post.id },
              })
            : Promise.resolve(),
        ),
      );

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
    } catch (error) {
      if (post?.id) {
        try {
          await this.prisma.activityPost.deleteMany({
            where: { id: post.id, tenantId: actor.tenantId },
          });
        } catch (cleanupErr) {
          this.logger.error(
            `Failed to clean up activity post after create failure: ${post.id}`,
            cleanupErr instanceof Error ? cleanupErr.stack : undefined,
          );
        }
      }
      await this.cleanupStoredActivityAttachments(storedAttachments);
      throw error;
    }

    return post;
  }

  @OnEvent('student.admitted')
  async handleStudentAdmitted(event: {
    tenantId: string;
    classId: string;
    sectionId?: string;
    studentId: string;
    studentName: string;
    actor: AuthContext;
  }) {
    const post = await this.prisma.activityPost.create({
      data: {
        tenantId: event.tenantId,
        classId: event.classId,
        sectionId: event.sectionId ?? null,
        createdById: event.actor.userId,
        title: 'New Student Welcome',
        caption: `Please welcome ${event.studentName} to the class!`,
        category: ActivityCategory.GENERAL,
        audienceType: event.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        publishedAt: new Date(),
        studentTags: {
          create: [{ tenantId: event.tenantId, studentId: event.studentId }],
        },
      },
      include: { attachments: true, studentTags: true },
    });
    this.eventEmitter.emit('feed.post.created', post);
  }

  @OnEvent('homework.assigned')
  async handleHomeworkAssigned(event: {
    tenantId: string;
    classId: string;
    sectionId?: string;
    homeworkId: string;
    title: string;
    actor: AuthContext;
  }) {
    const post = await this.prisma.activityPost.create({
      data: {
        tenantId: event.tenantId,
        classId: event.classId,
        sectionId: event.sectionId ?? null,
        createdById: event.actor.userId,
        title: 'New Homework Assigned',
        caption: `A new homework assignment "${event.title}" has been posted. Please check the academics portal.`,
        category: ActivityCategory.LEARNING,
        audienceType: event.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        publishedAt: new Date(),
      },
      include: { attachments: true, studentTags: true },
    });
    this.eventEmitter.emit('feed.post.created', post);
  }

  @OnEvent('exam.published')
  async handleExamPublished(event: {
    tenantId: string;
    classId: string;
    examTermId: string;
    actor: AuthContext;
  }) {
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

    await this.ensurePostVisibleToActor(actor, post.id);

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

    if (isParentOnly(actor)) {
      if (!dto.guardianId) {
        throw new ForbiddenException('Guardian context is required');
      }

      if (guardian?.userId !== actor.userId) {
        throw new ForbiddenException(
          'Parent can only react as their own guardian profile',
        );
      }
    }

    if (isStudentOnly(actor)) {
      const studentOwnId = await getStudentOwnId(this.prisma, actor);

      if (dto.studentId !== studentOwnId) {
        throw new ForbiddenException(
          'Student can only react as their own profile',
        );
      }
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

  async getAttachmentPreview(actor: AuthContext, attachmentId: string) {
    const attachment = await this.prisma.activityAttachment.findFirst({
      where: { id: attachmentId, tenantId: actor.tenantId },
      include: { activityPost: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const fileAssetId = (
      attachment as ActivityAttachment & { fileAssetId?: string }
    ).fileAssetId;
    if (!fileAssetId) {
      throw new BadRequestException('Attachment has no linked file asset');
    }

    await this.ensurePostVisibleToActor(actor, attachment.activityPostId);
    const mediaAccess = await this.resolveActorMediaAccess(actor);
    if (mediaAccess.blocked) {
      await this.auditService.record({
        action: 'activity_attachment_denied_consent',
        resource: 'activity_attachment',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: attachment.id,
        after: {
          activityPostId: attachment.activityPostId,
          reason: mediaAccess.reason,
        },
      });
      throw new ForbiddenException(
        'Some media is hidden because of student photo consent settings.',
      );
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      fileAssetId,
      actor.userId,
      'preview',
    );

    return this.fileRegistryService.getSignedUrl(actor.tenantId, fileAssetId);
  }

  async listMoodLogs(actor: AuthContext) {
    const studentScope = await this.buildActorStudentIdScope(actor);

    return this.prisma.moodLog.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentScope ? { studentId: studentScope } : {}),
      },
      include: {
        class: true,
        section: true,
        student: true,
      },
      orderBy: [{ logDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  private async cleanupStoredActivityAttachments(
    attachments: StoredActivityAttachment[],
  ) {
    for (const attachment of attachments) {
      try {
        await this.storageService.deleteObject(attachment.objectKey);
        await this.prisma.fileAsset.delete({
          where: { id: attachment.fileAssetId },
        });
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to clean up uploaded file: ${attachment.objectKey}`,
          cleanupErr instanceof Error ? cleanupErr.stack : undefined,
        );
      }
    }
  }

  async createMoodLog(dto: CreateMoodLogDto, actor: AuthContext) {
    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: dto.classId,
      sectionId: dto.sectionId,
      requireWritable: true,
    });

    const student = dto.studentId
      ? await this.prisma.student.findFirst({
          where: {
            id: dto.studentId,
            tenantId: actor.tenantId,
            classId: dto.classId,
            ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
          },
        })
      : null;

    if (dto.studentId && !student) {
      throw new NotFoundException(
        'Student not found in this class/section tenant scope',
      );
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
    const studentScope = await this.buildActorStudentIdScope(
      actor,
      filters.studentId,
    );

    return this.prisma.developmentalMilestone.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentScope
          ? { studentId: studentScope }
          : filters.studentId
            ? { studentId: filters.studentId }
            : {}),
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
      take: 100,
    });
  }

  async createMilestone(
    dto: CreateDevelopmentalMilestoneDto,
    actor: AuthContext,
  ) {
    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: dto.classId,
      sectionId: dto.sectionId,
      requireWritable: true,
    });

    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
      },
    });

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
        photoObjectKey: dto.photoObjectKey ?? dto.photoUrl ?? null,
        photoUrl: null,
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

  private async ensureClassSectionAndWriteAccess(
    actor: AuthContext,
    input: {
      classId: string;
      sectionId?: string | null;
      requireWritable: boolean;
    },
  ) {
    const [classroom, section] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: input.classId, tenantId: actor.tenantId },
      }),
      input.sectionId
        ? this.prisma.section.findFirst({
            where: { id: input.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (input.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    if (section && section.classId !== input.classId) {
      throw new NotFoundException('Section not found in selected class');
    }

    if (!input.requireWritable || canManageAllActivity(actor)) {
      return;
    }

    const staffAssignment = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        teacherAssignments: {
          some: {
            classId: input.classId,
            ...(input.sectionId ? { sectionId: input.sectionId } : {}),
          },
        },
      },
      select: { id: true },
    });

    if (!staffAssignment) {
      throw new ForbiddenException(
        'Teacher is not assigned to this class/section',
      );
    }
  }

  private validateActivityAttachment(attachment: {
    fileName: string;
    contentType: string;
    base64Content: string;
  }) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    if (!allowedTypes.includes(attachment.contentType.toLowerCase())) {
      throw new BadRequestException(
        `Invalid file type ${attachment.contentType}. Only standard images are allowed.`,
      );
    }

    const sizeBytes = Buffer.byteLength(attachment.base64Content, 'base64');

    if (sizeBytes > MAX_ACTIVITY_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        'Activity attachment exceeds the 10MB size limit',
      );
    }

    const extension = attachment.fileName.toLowerCase().split('.').pop();
    const allowedExtensions = new Set([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'heic',
      'heif',
    ]);

    if (!extension || !allowedExtensions.has(extension)) {
      throw new BadRequestException(
        'Activity attachment must use a standard image file extension',
      );
    }

    if (/[/\\]|\.\./.test(attachment.fileName)) {
      throw new BadRequestException('Activity attachment filename is not safe');
    }

    const signature = Buffer.from(attachment.base64Content, 'base64');
    if (!hasAllowedImageSignature(signature, attachment.contentType)) {
      throw new BadRequestException(
        'Activity attachment content does not match the selected image type',
      );
    }
  }

  private async buildActorPostVisibilityFilter(
    actor: AuthContext,
    requestedStudentId?: string,
  ): Promise<Prisma.ActivityPostWhereInput> {
    const studentIds = await this.resolveVisibleStudentIds(
      actor,
      requestedStudentId,
    );

    if (studentIds === null) {
      return requestedStudentId
        ? { studentTags: { some: { studentId: requestedStudentId } } }
        : {};
    }

    if (studentIds.length === 0) {
      return { id: '__no_visible_activity_posts__' };
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: studentIds },
      },
      select: {
        id: true,
        classId: true,
        sectionId: true,
      },
    });

    return {
      OR: [
        { studentTags: { some: { studentId: { in: studentIds } } } },
        ...students.flatMap((student) => {
          const classWidePost = {
            studentTags: { none: {} },
            classId: student.classId,
            sectionId: null,
          };

          if (!student.sectionId) {
            return [classWidePost];
          }

          return [
            classWidePost,
            {
              studentTags: { none: {} },
              classId: student.classId,
              sectionId: student.sectionId,
            },
          ];
        }),
      ],
    };
  }

  private async buildActorStudentIdScope(
    actor: AuthContext,
    requestedStudentId?: string,
  ): Promise<Prisma.StringFilter | string | undefined> {
    const studentIds = await this.resolveVisibleStudentIds(
      actor,
      requestedStudentId,
    );

    if (studentIds === null) {
      return requestedStudentId;
    }

    if (studentIds.length === 0) {
      return { in: ['__no_visible_students__'] };
    }

    return { in: studentIds };
  }

  private async resolveVisibleStudentIds(
    actor: AuthContext,
    requestedStudentId?: string,
  ) {
    let studentIds: string[] | null = null;

    if (isParentOnly(actor)) {
      studentIds = (await getParentStudentIds(this.prisma, actor)) ?? [];
    } else if (isStudentOnly(actor)) {
      const studentOwnId = await getStudentOwnId(this.prisma, actor);
      studentIds = studentOwnId ? [studentOwnId] : [];
    }

    if (studentIds === null) {
      return null;
    }

    if (requestedStudentId) {
      if (!studentIds.includes(requestedStudentId)) {
        throw new ForbiddenException('Student is outside your activity scope');
      }

      return [requestedStudentId];
    }

    return studentIds;
  }

  private async ensurePostVisibleToActor(actor: AuthContext, postId: string) {
    const visibilityFilter = await this.buildActorPostVisibilityFilter(actor);

    if (Object.keys(visibilityFilter).length === 0) {
      return;
    }

    const visiblePost = await this.prisma.activityPost.findFirst({
      where: {
        id: postId,
        tenantId: actor.tenantId,
        ...visibilityFilter,
      },
      select: { id: true },
    });

    if (!visiblePost) {
      throw new ForbiddenException('Activity post is outside your scope');
    }
  }

  private async resolveActorMediaAccess(
    actor: AuthContext,
  ): Promise<ActorMediaAccess> {
    if (!isParentOnly(actor)) {
      return { blocked: false };
    }

    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    if (!guardian) {
      return {
        blocked: true,
        reason: ACTIVITY_MEDIA_CONSENT_BLOCK_REASON,
      };
    }

    const latestConsent = await this.prisma.guardianConsent.findFirst({
      where: {
        tenantId: actor.tenantId,
        guardianId: guardian.id,
        consentType: ConsentType.PHOTO_USAGE,
      },
      orderBy: { capturedAt: 'desc' },
      select: { granted: true, revokedAt: true },
    });

    if (!latestConsent?.granted || latestConsent.revokedAt) {
      return {
        blocked: true,
        reason: ACTIVITY_MEDIA_CONSENT_BLOCK_REASON,
      };
    }

    return { blocked: false };
  }

  private serializePostForActor<
    TPost extends {
      attachments: ActivityAttachment[];
    },
  >(post: TPost, mediaAccess: ActorMediaAccess) {
    return {
      ...post,
      attachments: post.attachments.map((attachment) =>
        this.serializeAttachmentForActor(attachment, mediaAccess),
      ),
    };
  }

  private serializeAttachmentForActor(
    attachment: ActivityAttachment,
    mediaAccess: ActorMediaAccess,
  ) {
    const isBlocked = Boolean(mediaAccess.blocked && attachment.fileAssetId);

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      sortOrder: attachment.sortOrder,
      processingStatus: attachment.processingStatus,
      previewUrl: isBlocked
        ? null
        : attachment.fileAssetId
          ? this.buildActivityAttachmentUrl(attachment.id, 'preview')
          : null,
      accessBlockedReason: isBlocked ? mediaAccess.reason : null,
    };
  }

  private buildActivityAttachmentUrl(
    attachmentId: string,
    action: 'preview' | 'download',
  ) {
    const configuredBaseUrl = process.env.API_PUBLIC_BASE_URL?.trim();
    const apiBaseUrl = configuredBaseUrl
      ? configuredBaseUrl.replace(/\/$/, '')
      : 'http://localhost:4000/api/v1';

    return `${apiBaseUrl}/activity-feed/attachments/${encodeURIComponent(
      attachmentId,
    )}/${action}`;
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

function canManageAllActivity(actor: AuthContext) {
  return actor.roles.some((role) =>
    ['platform_super_admin', 'admin', 'principal'].includes(role),
  );
}

const MILESTONE_TEMPLATE_CATALOG = [
  {
    key: 'ecd-social-shares-materials',
    stage: 'ECD',
    stageAliases: ['montessori', 'nursery', 'kg', 'pre-primary'],
    domain: 'Social',
    milestone: 'Shares classroom materials with peers',
    suggestedStatus: 'EMERGING',
    observationPrompt:
      'Observed during group play, material sharing, or pair activity.',
  },
  {
    key: 'ecd-language-follows-two-step',
    stage: 'ECD',
    stageAliases: ['montessori', 'nursery', 'kg', 'pre-primary'],
    domain: 'Language',
    milestone: 'Follows two-step classroom instructions',
    suggestedStatus: 'ACHIEVED',
    observationPrompt:
      'Record the instruction and whether the child completed both steps independently.',
  },
  {
    key: 'ecd-motor-pencil-grip',
    stage: 'ECD',
    stageAliases: ['montessori', 'nursery', 'kg', 'pre-primary'],
    domain: 'Motor',
    milestone: 'Uses age-appropriate pencil grip',
    suggestedStatus: 'EMERGING',
    observationPrompt:
      'Capture grip, control, and comfort during writing or drawing work.',
  },
  {
    key: 'primary-self-help-organizes-bag',
    stage: 'Primary',
    stageAliases: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
    domain: 'Self-help',
    milestone: 'Organizes school bag and materials with minimal support',
    suggestedStatus: 'ACHIEVED',
    observationPrompt:
      'Note whether the student prepares books, copies, and stationery independently.',
  },
] as const;

function hasAllowedImageSignature(buffer: Buffer, contentType: string) {
  if (buffer.length < 4) {
    return false;
  }

  const normalizedType = contentType.toLowerCase();

  if (normalizedType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (normalizedType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  if (normalizedType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  if (normalizedType === 'image/heic' || normalizedType === 'image/heif') {
    return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
  }

  return false;
}
