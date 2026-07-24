import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  ActivityPostLanguage,
  AudienceType,
  ConsentType,
  type DevelopmentalMilestone,
  NotificationChannel,
  Prisma,
  ActivityAttachment,
  ActivityPostStatus,
  EnrollmentStatus,
  StaffStatus,
  StudentLifecycleStatus,
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
  isTeacherOnly,
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
      limit?: number;
      offset?: number;
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
        createdBy: {
          select: {
            staff: { select: { firstName: true, lastName: true } },
          },
        },
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
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
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
        const allowed =
          student.lifecycleStatus === 'ACTIVE' &&
          isPhotoConsentAllowed(
            derivePhotoConsentStatus(student.guardianLinks),
          );
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

  async previewAudience(
    actor: AuthContext,
    filters: {
      classId?: string;
      sectionId?: string;
      studentIds?: string | string[];
    },
  ) {
    if (!filters.classId?.trim()) {
      throw new BadRequestException('classId is required for audience preview');
    }

    const requestedStudentIds = normalizeStudentIds(filters.studentIds);

    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: filters.classId,
      sectionId: filters.sectionId,
      requireWritable: false,
    });

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: filters.classId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(requestedStudentIds.length
          ? { id: { in: requestedStudentIds } }
          : {}),
      },
      select: {
        id: true,
        firstNameEn: true,
        lastNameEn: true,
        classId: true,
        sectionId: true,
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
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
      take: requestedStudentIds.length ? requestedStudentIds.length : 250,
    });

    if (
      requestedStudentIds.length > 0 &&
      students.length !== requestedStudentIds.length
    ) {
      throw new NotFoundException(
        'One or more preview students were not found as active members of this class/section',
      );
    }

    const guardianIds = new Set<string>();
    let pushRecipientCount = 0;
    const consentCounts: Record<PhotoConsentStatus, number> = {
      ALLOWED: 0,
      NOT_ALLOWED: 0,
      RESTRICTED: 0,
      NOT_RECORDED: 0,
    };

    const previewStudents = students.map((student) => {
      const recipientLinks = student.guardianLinks.filter(
        (link) => link.isPrimary || link.guardian.receivesAlerts,
      );
      const mediaConsentStatus = derivePhotoConsentStatus(
        student.guardianLinks,
      );

      for (const link of recipientLinks) {
        guardianIds.add(link.guardianId);
        if (link.guardian.userId) {
          pushRecipientCount += 1;
        }
      }

      consentCounts[mediaConsentStatus] += 1;

      return {
        id: student.id,
        fullName: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        classId: student.classId,
        sectionId: student.sectionId,
        guardianRecipientCount: recipientLinks.length,
        mediaConsentStatus,
        mediaConsentGranted: isPhotoConsentAllowed(mediaConsentStatus),
      };
    });

    return {
      audienceType: requestedStudentIds.length
        ? AudienceType.STUDENT
        : filters.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
      classId: filters.classId,
      sectionId: filters.sectionId ?? null,
      requestedStudentIds,
      studentCount: students.length,
      guardianRecipientCount: guardianIds.size,
      pushRecipientCount,
      mediaConsent: {
        // Deprecated aggregate fields kept for existing consumers; prefer the
        // per-status counts below for the 4-state (Allowed/Not allowed/
        // Restricted/Not recorded) breakdown.
        grantedStudentCount: consentCounts.ALLOWED,
        blockedStudentCount:
          consentCounts.NOT_ALLOWED +
          consentCounts.RESTRICTED +
          consentCounts.NOT_RECORDED,
        allowedCount: consentCounts.ALLOWED,
        notAllowedCount: consentCounts.NOT_ALLOWED,
        restrictedCount: consentCounts.RESTRICTED,
        notRecordedCount: consentCounts.NOT_RECORDED,
      },
      students: previewStudents,
    };
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
        createdBy: {
          select: {
            staff: { select: { firstName: true, lastName: true } },
          },
        },
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
        if (
          !isPhotoConsentAllowed(
            derivePhotoConsentStatus(student.guardianLinks),
          )
        ) {
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
        const allowed =
          student.lifecycleStatus === 'ACTIVE' &&
          isPhotoConsentAllowed(
            derivePhotoConsentStatus(student.guardianLinks),
          );
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

  async listTeacherMobileScopes(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) {
      throw new ForbiddenException('Active teacher profile is required');
    }

    const assignments = await this.prisma.subjectTeacherAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        academicYear: { isCurrent: true },
      },
      select: {
        academicYearId: true,
        classId: true,
        sectionId: true,
        academicYear: { select: { name: true } },
        class: { select: { name: true, level: true } },
        section: { select: { name: true } },
      },
      orderBy: [{ class: { level: 'asc' } }, { section: { name: 'asc' } }],
      take: 200,
    });

    const scopes = new Map<
      string,
      {
        id: string;
        academicYearId: string;
        academicYearName: string;
        classId: string;
        className: string;
        sectionId: string | null;
        sectionName: string | null;
      }
    >();

    for (const assignment of assignments) {
      const id = `${assignment.academicYearId}:${assignment.classId}:${assignment.sectionId ?? 'none'}`;
      if (!scopes.has(id)) {
        scopes.set(id, {
          id,
          academicYearId: assignment.academicYearId,
          academicYearName: assignment.academicYear.name,
          classId: assignment.classId,
          className: assignment.class.name,
          sectionId: assignment.sectionId,
          sectionName: assignment.section?.name ?? null,
        });
      }
    }

    return { items: [...scopes.values()] };
  }

  async listTeacherMobileStudents(
    actor: AuthContext,
    query: {
      classId: string;
      sectionId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: query.classId,
      sectionId: query.sectionId,
      requireWritable: true,
    });

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 50);
    const search = query.search?.trim();
    const where: Prisma.StudentWhereInput = {
      tenantId: actor.tenantId,
      classId: query.classId,
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      ...(search
        ? {
            OR: [
              { firstNameEn: { contains: search, mode: 'insensitive' } },
              { lastNameEn: { contains: search, mode: 'insensitive' } },
              { studentSystemId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        select: {
          id: true,
          studentSystemId: true,
          firstNameEn: true,
          lastNameEn: true,
          rollNumber: true,
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
        orderBy: [
          { rollNumber: 'asc' },
          { firstNameEn: 'asc' },
          { lastNameEn: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items: students.map((student) => {
        const mediaConsentStatus = derivePhotoConsentStatus(
          student.guardianLinks,
        );
        return {
          id: student.id,
          studentSystemId: student.studentSystemId,
          fullName: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
          rollNumber: student.rollNumber,
          mediaConsentStatus,
          mediaConsentGranted: isPhotoConsentAllowed(mediaConsentStatus),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listTeacherMobilePosts(
    actor: AuthContext,
    query: { page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const where: Prisma.ActivityPostWhereInput = {
      tenantId: actor.tenantId,
      createdById: actor.userId,
      softDeletedAt: null,
    };
    const [items, total] = await Promise.all([
      this.prisma.activityPost.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          attachments: { orderBy: { sortOrder: 'asc' } },
          studentTags: {
            include: {
              student: {
                select: {
                  id: true,
                  studentSystemId: true,
                  firstNameEn: true,
                  lastNameEn: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityPost.count({ where }),
    ]);

    return {
      items: items.map((post) =>
        this.serializePostForActor(post, { blocked: false }),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createPost(dto: CreateActivityPostDto, actor: AuthContext) {
    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: dto.classId,
      sectionId: dto.sectionId,
      requireWritable: true,
    });

    for (const attachment of dto.attachments) {
      this.validateActivityAttachment(attachment);
    }

    if (dto.studentIds?.length) {
      const students = await this.prisma.student.findMany({
        where: {
          tenantId: actor.tenantId,
          classId: dto.classId,
          ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
          id: { in: dto.studentIds },
        },
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
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

      if (students.length !== dto.studentIds.length) {
        throw new NotFoundException(
          'One or more tagged students were not active in this class/section',
        );
      }

      const blocked = students
        .map((student) => ({
          name: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
          status: derivePhotoConsentStatus(student.guardianLinks),
        }))
        .filter((entry) => !isPhotoConsentAllowed(entry.status));

      if (blocked.length > 0) {
        const notRecorded = blocked.filter(
          (entry) => entry.status === 'NOT_RECORDED',
        );
        const notAllowed = blocked.filter(
          (entry) => entry.status === 'NOT_ALLOWED',
        );
        const restricted = blocked.filter(
          (entry) => entry.status === 'RESTRICTED',
        );
        const parts: string[] = [];
        if (notRecorded.length) {
          parts.push(
            `no photo consent on file: ${notRecorded.map((e) => e.name).join(', ')}`,
          );
        }
        if (notAllowed.length) {
          parts.push(
            `photo consent declined: ${notAllowed.map((e) => e.name).join(', ')}`,
          );
        }
        if (restricted.length) {
          parts.push(
            `restricted photo consent: ${restricted.map((e) => e.name).join(', ')}`,
          );
        }
        throw new ForbiddenException(
          `Cannot tag students without active, unrestricted photo consent — ${parts.join('; ')}`,
        );
      }
    }

    if (dto.clientSubmissionId) {
      const existing = await this.prisma.activityPost.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdById: actor.userId,
          clientSubmissionId: dto.clientSubmissionId,
        },
        include: {
          attachments: { orderBy: { sortOrder: 'asc' } },
          studentTags: true,
        },
      });
      if (existing) {
        return this.serializePostForActor(existing, { blocked: false });
      }
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
      const defaultAudienceType = dto.sectionId
        ? AudienceType.SECTION
        : AudienceType.CLASS;
      const audienceType = dto.studentIds?.length
        ? AudienceType.STUDENT
        : (dto.audienceType ?? defaultAudienceType);
      const category = dto.category ?? ActivityCategory.GENERAL;
      const requiresApproval = activityPostRequiresApproval(
        audienceType,
        category,
      );

      post = await this.prisma.activityPost.create({
        data: {
          tenantId: actor.tenantId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          createdById: actor.userId,
          clientSubmissionId: dto.clientSubmissionId,
          title: dto.title,
          caption: dto.caption,
          askAtHome: dto.askAtHome ?? null,
          activityDate: dto.activityDate
            ? new Date(dto.activityDate)
            : new Date(),
          parentVisible: dto.parentVisible ?? true,
          language: dto.language ?? ActivityPostLanguage.ENGLISH,
          category,
          audienceType,
          status: requiresApproval
            ? ActivityPostStatus.PENDING_APPROVAL
            : ActivityPostStatus.APPROVED,
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
            jobId: `activity-media-${attachment.id}`,
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

      if (!requiresApproval) {
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
          channels: resolveActivityNotificationChannels(category),
          requiredConsentTypes: [ConsentType.PHOTO_USAGE],
          activeStudentsOnly: true,
        });
      }

      await this.auditService.record({
        action: 'create',
        resource: 'activity_post',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: post.id,
        after: {
          classId: post.classId,
          sectionId: post.sectionId,
          requiresApproval,
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
      if (
        !post?.id &&
        dto.clientSubmissionId &&
        isDatabaseErrorCode(error, 'P2002')
      ) {
        const existing = await this.prisma.activityPost.findFirst({
          where: {
            tenantId: actor.tenantId,
            createdById: actor.userId,
            clientSubmissionId: dto.clientSubmissionId,
          },
          include: {
            attachments: { orderBy: { sortOrder: 'asc' } },
            studentTags: true,
          },
        });
        if (existing) {
          return this.serializePostForActor(existing, { blocked: false });
        }
        throw new ConflictException(
          'This activity submission is already being processed',
        );
      }
      throw error;
    }

    return this.serializePostForActor(post, { blocked: false });
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

    if (
      (isParentOnly(actor) || isStudentOnly(actor)) &&
      (post.status !== ActivityPostStatus.APPROVED || post.softDeletedAt)
    ) {
      throw new ForbiddenException('Activity post is no longer available');
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

    this.ensureAttachmentPostAllowsSignedPreview(actor, {
      status: attachment.activityPost.status,
      softDeletedAt: attachment.activityPost.softDeletedAt,
    });
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
    await this.ensureTaggedStudentsAllowMediaForParent(
      actor,
      attachment.activityPostId,
      attachment.id,
      fileAssetId,
    );

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      fileAssetId,
      actor.userId,
      'preview',
    );

    return this.fileRegistryService.getSignedUrl(actor.tenantId, fileAssetId);
  }

  private ensureAttachmentPostAllowsSignedPreview(
    actor: AuthContext,
    post: {
      status: ActivityPostStatus;
      softDeletedAt: Date | null;
    },
  ) {
    if (post.softDeletedAt) {
      throw new ForbiddenException('Activity post is no longer available');
    }

    if (
      post.status === ActivityPostStatus.ARCHIVED ||
      post.status === ActivityPostStatus.REJECTED
    ) {
      throw new ForbiddenException('Activity post is no longer available');
    }

    if (
      (isParentOnly(actor) || isStudentOnly(actor)) &&
      post.status !== ActivityPostStatus.APPROVED
    ) {
      throw new ForbiddenException('Activity post is no longer available');
    }
  }

  private async ensureTaggedStudentsAllowMediaForParent(
    actor: AuthContext,
    postId: string,
    attachmentId: string,
    fileAssetId: string,
  ) {
    if (!isParentOnly(actor)) {
      return;
    }

    const post = await this.prisma.activityPost.findFirst({
      where: {
        id: postId,
        tenantId: actor.tenantId,
      },
      include: {
        studentTags: {
          select: { studentId: true },
        },
      },
    });

    const studentIds = post?.studentTags.map((tag) => tag.studentId) ?? [];
    if (studentIds.length === 0) {
      return;
    }

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

    const blockedStudent = students.find((student) => {
      if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVE) {
        return true;
      }
      return !isPhotoConsentAllowed(
        derivePhotoConsentStatus(student.guardianLinks),
      );
    });

    if (!blockedStudent) {
      return;
    }

    await this.auditService.record({
      action: 'activity_attachment_denied_consent',
      resource: 'activity_attachment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: attachmentId,
      after: {
        activityPostId: postId,
        fileAssetId,
        reason: ACTIVITY_MEDIA_CONSENT_BLOCK_REASON,
        blockedStudentId: blockedStudent.id,
      },
    });
    throw new ForbiddenException(
      'Some media is hidden because of student photo consent settings.',
    );
  }

  async listMoodLogs(actor: AuthContext) {
    const studentScope = await this.buildActorStudentIdScope(actor);

    // Confirmed gap: resolveVisibleStudentIds only scopes parent/student
    // actors, so a base teacher previously got every mood log in the tenant.
    let teacherFilter: Prisma.MoodLogWhereInput | undefined;
    if (isTeacherOnly(actor)) {
      const classSections = await this.getTeacherAssignedClassSections(actor);
      if (classSections.length === 0) {
        return [];
      }
      teacherFilter = {
        OR: classSections.flatMap(({ classId, sectionId }) =>
          sectionId
            ? [
                { classId, sectionId },
                { classId, sectionId: null },
              ]
            : [{ classId, sectionId: null }],
        ),
      };
    }

    return this.prisma.moodLog.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentScope ? { studentId: studentScope } : {}),
        ...(teacherFilter ?? {}),
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

    // Confirmed gap: same shape as listMoodLogs above -- a base teacher had
    // no restriction here and, with no studentId filter, saw developmental
    // milestones for the entire tenant.
    let teacherFilter: Prisma.DevelopmentalMilestoneWhereInput | undefined;
    if (isTeacherOnly(actor)) {
      const classSections = await this.getTeacherAssignedClassSections(actor);
      if (classSections.length === 0) {
        return [];
      }
      teacherFilter = {
        OR: classSections.flatMap(({ classId, sectionId }) =>
          sectionId
            ? [
                { classId, sectionId },
                { classId, sectionId: null },
              ]
            : [{ classId, sectionId: null }],
        ),
      };
      if (filters.studentId) {
        const student = await this.prisma.student.findFirst({
          where: {
            id: filters.studentId,
            tenantId: actor.tenantId,
            OR: classSections.flatMap(({ classId, sectionId }) =>
              sectionId
                ? [
                    { classId, sectionId },
                    { classId, sectionId: null },
                  ]
                : [{ classId, sectionId: null }],
            ),
          },
          select: { id: true },
        });
        if (!student) {
          throw new ForbiddenException(
            'Student is outside your teaching scope',
          );
        }
      }
    }

    return this.prisma.developmentalMilestone.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(studentScope
          ? { studentId: studentScope }
          : filters.studentId
            ? { studentId: filters.studentId }
            : {}),
        ...(teacherFilter ?? {}),
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
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        enrollments: {
          some: {
            tenantId: actor.tenantId,
            classId: dto.classId,
            ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
            status: EnrollmentStatus.ACTIVE,
            academicYear: { isCurrent: true },
          },
        },
      },
      select: {
        id: true,
        enrollments: {
          where: {
            tenantId: actor.tenantId,
            classId: dto.classId,
            ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
            status: EnrollmentStatus.ACTIVE,
            academicYear: { isCurrent: true },
          },
          select: { sectionId: true },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(
        'Student not found in this assigned class/section',
      );
    }

    const resolvedSectionId =
      dto.sectionId ?? student.enrollments[0]?.sectionId ?? null;

    await this.ensureClassSectionAndWriteAccess(actor, {
      classId: dto.classId,
      sectionId: resolvedSectionId,
      requireWritable: true,
    });

    if (dto.clientSubmissionId) {
      const existing = await this.prisma.developmentalMilestone.findFirst({
        where: {
          tenantId: actor.tenantId,
          createdById: actor.userId,
          clientSubmissionId: dto.clientSubmissionId,
        },
      });
      if (existing) {
        this.assertMatchingMilestoneReplay(existing, dto, resolvedSectionId);
        return mapMilestoneSubmission(existing, true);
      }
    }

    let milestone: DevelopmentalMilestone;
    try {
      milestone = await this.prisma.developmentalMilestone.create({
        data: {
          tenantId: actor.tenantId,
          classId: dto.classId,
          sectionId: resolvedSectionId,
          studentId: dto.studentId,
          domain: dto.domain,
          milestone: dto.milestone,
          status: dto.status,
          observationNote: dto.observationNote ?? null,
          photoObjectKey: dto.photoObjectKey ?? dto.photoUrl ?? null,
          photoUrl: null,
          observedAt: new Date(dto.observedAt),
          createdById: actor.userId,
          clientSubmissionId: dto.clientSubmissionId,
        },
      });
    } catch (error) {
      if (dto.clientSubmissionId && isDatabaseErrorCode(error, 'P2002')) {
        const existing = await this.prisma.developmentalMilestone.findFirst({
          where: {
            tenantId: actor.tenantId,
            createdById: actor.userId,
            clientSubmissionId: dto.clientSubmissionId,
          },
        });
        if (existing) {
          this.assertMatchingMilestoneReplay(existing, dto, resolvedSectionId);
          return mapMilestoneSubmission(existing, true);
        }
        throw new ConflictException(
          'This milestone submission is already being processed',
        );
      }
      throw error;
    }

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

    return mapMilestoneSubmission(milestone, false);
  }

  private assertMatchingMilestoneReplay(
    existing: {
      classId: string;
      sectionId: string | null;
      studentId: string;
      domain: string;
      milestone: string;
      status: string;
      observationNote: string | null;
      photoObjectKey: string | null;
      observedAt: Date;
    },
    dto: CreateDevelopmentalMilestoneDto,
    resolvedSectionId: string | null,
  ) {
    const matches =
      existing.classId === dto.classId &&
      existing.sectionId === resolvedSectionId &&
      existing.studentId === dto.studentId &&
      existing.domain === dto.domain &&
      existing.milestone === dto.milestone &&
      existing.status === dto.status &&
      existing.observationNote === (dto.observationNote ?? null) &&
      existing.photoObjectKey ===
        (dto.photoObjectKey ?? dto.photoUrl ?? null) &&
      existing.observedAt.getTime() === new Date(dto.observedAt).getTime();

    if (!matches) {
      throw new ConflictException(
        'This milestone submission ID was already used for different content. Create a new offline draft and try again.',
      );
    }
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

    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!staff) {
      throw new ForbiddenException(
        'Teacher is not assigned to this class/section',
      );
    }

    // A teacher may post either as the assigned subject teacher for this
    // class/section (Staff.teacherAssignments -> SubjectTeacherAssignment)
    // or as the section's homeroom class teacher (Section.classTeacherId) —
    // matching the same dual check AttendanceService.getTeacherSectionIds
    // already uses. Checking only the former silently locked every homeroom
    // class teacher out of posting for their own class.
    const [subjectAssignment, classTeacherSection] = await Promise.all([
      this.prisma.staff.findFirst({
        where: {
          id: staff.id,
          teacherAssignments: {
            some: {
              classId: input.classId,
              ...(input.sectionId
                ? {
                    OR: [{ sectionId: input.sectionId }, { sectionId: null }],
                  }
                : { sectionId: null }),
              academicYear: { isCurrent: true },
            },
          },
        },
        select: { id: true },
      }),
      this.prisma.section.findFirst({
        where: {
          tenantId: actor.tenantId,
          classId: input.classId,
          classTeacherId: staff.id,
          ...(input.sectionId ? { id: input.sectionId } : {}),
        },
        select: { id: true },
      }),
    ]);

    if (!subjectAssignment && !classTeacherSection) {
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

  /**
   * Confirmed gap: listPosts/listMoodLogs/listMilestones were scoped for
   * parent/student (via resolveVisibleStudentIds) but had NO restriction for
   * a base teacher/subject_teacher actor -- an omitted classId/studentId
   * filter returned every post, mood log, and developmental milestone for
   * every student in the tenant, including sensitive behavioral/wellbeing
   * data outside the teacher's own classes. Returns the class/section combos
   * a teacher is actually assigned to (empty array if none).
   */
  private async getTeacherAssignedClassSections(
    actor: AuthContext,
  ): Promise<Array<{ classId: string; sectionId: string | null }>> {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!staff) return [];

    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          academicYear: { isCurrent: true },
        },
        select: { classId: true, sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId, classTeacherId: staff.id },
        select: { id: true, classId: true },
      }),
    ]);

    const combos = new Map<
      string,
      { classId: string; sectionId: string | null }
    >();
    for (const a of assignments) {
      combos.set(`${a.classId}:${a.sectionId ?? 'none'}`, {
        classId: a.classId,
        sectionId: a.sectionId,
      });
    }
    for (const s of classTeacherSections) {
      combos.set(`${s.classId}:${s.id}`, {
        classId: s.classId,
        sectionId: s.id,
      });
    }
    return Array.from(combos.values());
  }

  private buildClassSectionOrFilter(
    classSections: Array<{ classId: string; sectionId: string | null }>,
  ): Prisma.ActivityPostWhereInput['OR'] {
    return classSections.flatMap(({ classId, sectionId }) =>
      sectionId
        ? [
            { classId, sectionId },
            { classId, sectionId: null },
          ]
        : [{ classId, sectionId: null }],
    );
  }

  private async buildActorPostVisibilityFilter(
    actor: AuthContext,
    requestedStudentId?: string,
  ): Promise<Prisma.ActivityPostWhereInput> {
    if (isTeacherOnly(actor)) {
      const classSections = await this.getTeacherAssignedClassSections(actor);
      if (classSections.length === 0) {
        return { id: '__no_visible_activity_posts__' };
      }
      const classSectionFilter = {
        OR: this.buildClassSectionOrFilter(classSections),
      };
      if (requestedStudentId) {
        return {
          AND: [
            classSectionFilter,
            { studentTags: { some: { studentId: requestedStudentId } } },
          ],
        };
      }
      return classSectionFilter;
    }

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
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: {
        id: true,
        classId: true,
        sectionId: true,
      },
    });
    const activeStudentIds = students.map((student) => student.id);

    if (activeStudentIds.length === 0) {
      return { id: '__no_visible_activity_posts__' };
    }

    return {
      parentVisible: true,
      OR: [
        { studentTags: { some: { studentId: { in: activeStudentIds } } } },
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
      createdBy?: {
        staff?: { firstName: string; lastName: string } | null;
      } | null;
    },
  >(post: TPost, mediaAccess: ActorMediaAccess) {
    const { createdBy, ...rest } = post;
    const teacherName = createdBy?.staff
      ? `${createdBy.staff.firstName} ${createdBy.staff.lastName}`.trim()
      : null;
    return {
      ...rest,
      teacherName,
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
      thumbnailUrl: isBlocked
        ? null
        : attachment.thumbnailFileAssetId || attachment.optimizedObjectKey
          ? this.buildActivityAttachmentUrl(attachment.id, 'thumbnail')
          : null,
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
    action: 'thumbnail' | 'preview' | 'download',
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

function normalizeStudentIds(studentIds?: string | string[]) {
  const rawValues = Array.isArray(studentIds)
    ? studentIds
    : studentIds
      ? studentIds.split(',')
      : [];

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

const CATEGORIES_REQUIRING_APPROVAL = new Set<ActivityCategory>([
  ActivityCategory.COMPETITION,
  ActivityCategory.ACHIEVEMENT,
]);

function activityPostRequiresApproval(
  audienceType: AudienceType,
  category: ActivityCategory,
) {
  return (
    audienceType === AudienceType.STUDENT ||
    audienceType === AudienceType.ALL ||
    CATEGORIES_REQUIRING_APPROVAL.has(category)
  );
}

const CATEGORIES_ELIGIBLE_FOR_PUSH = new Set<ActivityCategory>([
  ActivityCategory.EDUCATIONAL_TOUR,
  ActivityCategory.COMPETITION,
  ActivityCategory.ACHIEVEMENT,
]);

/**
 * Routine classroom posts and individual milestones only need an in-app
 * notification; tours, competitions, and achievements also get a push
 * notification since parents are more likely to want to know right away.
 * Emergency/urgent communication is out of scope here — that goes through
 * the M12 notice workflow, not the activity feed.
 */
export function resolveActivityNotificationChannels(
  category: ActivityCategory,
): NotificationChannel[] {
  return CATEGORIES_ELIGIBLE_FOR_PUSH.has(category)
    ? [NotificationChannel.IN_APP, NotificationChannel.PUSH]
    : [NotificationChannel.IN_APP];
}

type PhotoConsentStatus =
  | 'ALLOWED'
  | 'NOT_ALLOWED'
  | 'RESTRICTED'
  | 'NOT_RECORDED';

/**
 * Collapses each guardian's latest PHOTO_USAGE consent into one of four
 * school-facing states. "Restricted" is carried in the existing
 * GuardianConsent.metadata JSON (no schema change) so an admin can mark a
 * granted consent as e.g. "class photos only, no individual naming" without
 * a new consent type. If guardians disagree, the most protective state wins:
 * any decline blocks the student outright; otherwise any restriction applies.
 */
function derivePhotoConsentStatus(
  guardianLinks: Array<{
    guardian: {
      consents: Array<{
        granted: boolean;
        revokedAt: Date | null;
        metadata?: Prisma.JsonValue;
      }>;
    };
  }>,
): PhotoConsentStatus {
  let hasAnyRecord = false;
  let hasDecline = false;
  let hasRestricted = false;
  let hasAllowed = false;

  for (const link of guardianLinks) {
    const latestConsent = link.guardian.consents[0];
    if (!latestConsent) {
      continue;
    }
    hasAnyRecord = true;

    if (!latestConsent.granted || latestConsent.revokedAt) {
      hasDecline = true;
      continue;
    }

    const metadata =
      latestConsent.metadata && typeof latestConsent.metadata === 'object'
        ? (latestConsent.metadata as Record<string, unknown>)
        : null;
    if (metadata?.restricted === true) {
      hasRestricted = true;
    } else {
      hasAllowed = true;
    }
  }

  if (!hasAnyRecord) return 'NOT_RECORDED';
  if (hasDecline) return 'NOT_ALLOWED';
  if (hasRestricted) return 'RESTRICTED';
  return hasAllowed ? 'ALLOWED' : 'NOT_RECORDED';
}

function isPhotoConsentAllowed(status: PhotoConsentStatus) {
  return status === 'ALLOWED';
}

function mapMilestoneSubmission<
  T extends {
    clientSubmissionId: string | null;
    createdAt: Date;
  },
>(milestone: T, replayed: boolean) {
  return {
    ...milestone,
    replayed,
    serverReceivedAt: milestone.createdAt.toISOString(),
  };
}

function isDatabaseErrorCode(error: unknown, code: string) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === code,
  );
}

function canManageAllActivity(actor: AuthContext) {
  return actor.roles.some((role) =>
    ['platform_super_admin', 'admin', 'principal'].includes(role),
  );
}

const MILESTONE_TEMPLATE_CATALOG = [
  {
    key: 'primary-social-works-in-groups',
    stage: 'Primary',
    stageAliases: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
    domain: 'Social',
    milestone: 'Works cooperatively in pairs or small groups',
    suggestedStatus: 'PROGRESSING',
    observationPrompt:
      'Observed during pair work, group tasks, or shared classroom responsibilities.',
  },
  {
    key: 'primary-language-reads-grade-level-text',
    stage: 'Primary',
    stageAliases: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
    domain: 'Language',
    milestone: 'Reads grade-level text aloud with confidence',
    suggestedStatus: 'EMERGING',
    observationPrompt:
      'Record the passage read and whether the student needed support with fluency.',
  },
  {
    key: 'primary-language-expresses-ideas',
    stage: 'Primary',
    stageAliases: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
    domain: 'Language',
    milestone: 'Expresses ideas clearly in class discussion',
    suggestedStatus: 'PROGRESSING',
    observationPrompt:
      'Capture an example of the student explaining an idea, answer, or question in their own words.',
  },
  {
    key: 'primary-motor-writes-legibly',
    stage: 'Primary',
    stageAliases: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
    domain: 'Motor',
    milestone: 'Writes legibly at a grade-appropriate pace',
    suggestedStatus: 'EMERGING',
    observationPrompt:
      'Note handwriting control and pace during copywork or dictation.',
  },
  {
    key: 'primary-cognitive-applies-number-skills',
    stage: 'Primary',
    stageAliases: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5'],
    domain: 'Cognitive',
    milestone: 'Applies number skills to classroom problems',
    suggestedStatus: 'EMERGING',
    observationPrompt:
      'Record the task and whether the student solved it independently or with support.',
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
  {
    key: 'lower-secondary-study-plans-revision',
    stage: 'Lower Secondary',
    stageAliases: ['grade-6', 'grade-7', 'grade-8'],
    domain: 'Self-help',
    milestone: 'Plans and revises for unit tests independently',
    suggestedStatus: 'EMERGING',
    observationPrompt:
      'Record how the student prepared — notes, practice questions, or a revision plan.',
  },
  {
    key: 'lower-secondary-social-takes-responsibility',
    stage: 'Lower Secondary',
    stageAliases: ['grade-6', 'grade-7', 'grade-8'],
    domain: 'Social',
    milestone: 'Takes responsibility in group projects',
    suggestedStatus: 'PROGRESSING',
    observationPrompt:
      'Note the role the student took and how they handled their share of the work.',
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
