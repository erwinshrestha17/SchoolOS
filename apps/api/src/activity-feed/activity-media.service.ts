import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAttachment,
  ActivityPostStatus,
  ConsentType,
} from '@prisma/client';
import { Readable } from 'stream';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  getStudentOwnId,
  isParentOnly,
  isStudentOnly,
} from '../common/security/parent-scope';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface ActivityMediaFile {
  stream?: NodeJS.ReadableStream;
  redirectUrl?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ActivityMediaAccessUrl {
  url: string;
  expiresInSeconds: number;
  mediaId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

const ACTIVITY_MEDIA_ACCESS_TTL_SECONDS = 60;
const ACTIVITY_MEDIA_CONSENT_MESSAGE =
  'Some media is hidden because of student photo consent settings.';

@Injectable()
export class ActivityMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async getAttachmentMedia(
    actor: AuthContext,
    attachmentId: string,
    action: 'thumbnail' | 'preview' | 'download',
  ): Promise<ActivityMediaFile> {
    const attachment = await this.findVisibleAttachmentOrThrow(
      actor,
      attachmentId,
      action,
    );

    const fileAsset = attachment.fileAsset;

    if (!fileAsset || fileAsset.softDeletedAt) {
      throw new NotFoundException('Activity media file not found');
    }

    if (fileAsset.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Activity media is outside this tenant');
    }

    let objectKey: string;
    let fileName = attachment.fileName;
    let contentType = attachment.contentType;
    let sizeBytes = attachment.sizeBytes;

    if (action === 'thumbnail') {
      if (attachment.thumbnailFileAsset) {
        this.assertThumbnailVariantOwnership(attachment);
        objectKey = attachment.thumbnailFileAsset.objectKey;
        fileName = attachment.thumbnailFileAsset.originalFilename;
        contentType = attachment.thumbnailFileAsset.mimeType;
        sizeBytes = Number(attachment.thumbnailFileAsset.sizeBytes);
      } else if (attachment.optimizedObjectKey) {
        objectKey = attachment.optimizedObjectKey;
        sizeBytes = attachment.optimizedSizeBytes ?? attachment.sizeBytes;
      } else {
        throw new NotFoundException('Activity thumbnail is not available');
      }
    } else {
      objectKey =
        action === 'preview' && attachment.optimizedObjectKey
          ? attachment.optimizedObjectKey
          : fileAsset.objectKey;
      sizeBytes =
        action === 'preview' && attachment.optimizedSizeBytes
          ? attachment.optimizedSizeBytes
          : attachment.sizeBytes;
    }

    const content = await this.storageService.getObjectBuffer(objectKey);

    return {
      stream: Readable.from(content),
      fileName,
      contentType,
      sizeBytes,
    };
  }

  async getAttachmentAccessUrl(
    actor: AuthContext,
    attachmentId: string,
    action: 'preview' | 'download',
  ): Promise<ActivityMediaAccessUrl> {
    const attachment = await this.findVisibleAttachmentOrThrow(
      actor,
      attachmentId,
      `${action}_url`,
    );

    const urlPath =
      action === 'preview'
        ? `/activity-feed/attachments/${encodeURIComponent(attachment.id)}/preview`
        : `/activity-feed/attachments/${encodeURIComponent(attachment.id)}/download`;

    return {
      url: `${this.apiBaseUrl}${urlPath}`,
      expiresInSeconds: ACTIVITY_MEDIA_ACCESS_TTL_SECONDS,
      mediaId: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  private async findVisibleAttachmentOrThrow(
    actor: AuthContext,
    attachmentId: string,
    action: string,
  ) {
    const attachment = await this.prisma.activityAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId: actor.tenantId,
      },
      include: {
        activityPost: {
          include: {
            studentTags: {
              select: {
                studentId: true,
              },
            },
          },
        },
        fileAsset: true,
        thumbnailFileAsset: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Activity attachment not found');
    }

    await this.ensureAttachmentVisibleToActor(actor, attachment);
    await this.ensurePhotoConsentAllowsActor(actor, attachment);

    const fileAsset = attachment.fileAsset;

    if (!fileAsset || fileAsset.softDeletedAt) {
      throw new NotFoundException('Activity media file not found');
    }

    if (fileAsset.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Activity media is outside this tenant');
    }

    if (action.startsWith('thumbnail') && attachment.thumbnailFileAsset) {
      this.assertThumbnailVariantOwnership(attachment);
    }

    await this.auditService.record({
      action: `activity_attachment_${action}`,
      resource: 'activity_attachment',
      resourceId: attachment.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        activityPostId: attachment.activityPostId,
        fileAssetId: fileAsset.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
      },
    });

    return attachment;
  }

  private get apiBaseUrl() {
    const configuredBaseUrl = process.env.API_PUBLIC_BASE_URL?.trim();

    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    return `http://localhost:${this.configService.port}/api/v1`;
  }

  private async ensureAttachmentVisibleToActor(
    actor: AuthContext,
    attachment: ActivityAttachment & {
      activityPost: {
        id: string;
        classId: string;
        sectionId: string | null;
        studentTags: Array<{ studentId: string }>;
        status: ActivityPostStatus;
        softDeletedAt: Date | null;
        parentVisible: boolean;
      };
    },
  ) {
    if (
      actor.roles.some((role) =>
        ['teacher', 'subject_teacher'].includes(role),
      ) &&
      !actor.permissions.includes('activity_feed:moderate')
    ) {
      const staff = await this.prisma.staff.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { id: true },
      });
      const assignment = staff
        ? await this.prisma.subjectTeacherAssignment.findFirst({
            where: {
              tenantId: actor.tenantId,
              staffId: staff.id,
              classId: attachment.activityPost.classId,
              ...(attachment.activityPost.sectionId
                ? {
                    OR: [
                      { sectionId: attachment.activityPost.sectionId },
                      { sectionId: null },
                    ],
                  }
                : {}),
            },
            select: { id: true },
          })
        : null;
      if (!assignment) {
        throw new ForbiddenException('Activity media is outside your scope');
      }
      return;
    }

    if (!isParentOnly(actor) && !isStudentOnly(actor)) {
      return;
    }

    if (
      attachment.activityPost.softDeletedAt ||
      !attachment.activityPost.parentVisible ||
      attachment.activityPost.status !== ActivityPostStatus.APPROVED
    ) {
      throw new ForbiddenException('Activity post is no longer available');
    }

    const visibleStudentIds = isParentOnly(actor)
      ? await getParentStudentIds(this.prisma, actor)
      : [await getStudentOwnId(this.prisma, actor)].filter(
          (studentId): studentId is string => Boolean(studentId),
        );

    if (!visibleStudentIds || visibleStudentIds.length === 0) {
      throw new ForbiddenException('Activity media is outside your scope');
    }

    const taggedStudentIds = attachment.activityPost.studentTags.map(
      (tag) => tag.studentId,
    );

    if (
      taggedStudentIds.some((studentId) =>
        visibleStudentIds.includes(studentId),
      )
    ) {
      return;
    }

    const visibleStudentInAudience = await this.prisma.student.findFirst({
      where: {
        tenantId: actor.tenantId,
        id: { in: visibleStudentIds },
        classId: attachment.activityPost.classId,
        ...(attachment.activityPost.sectionId
          ? { sectionId: attachment.activityPost.sectionId }
          : {}),
      },
      select: { id: true },
    });

    if (!visibleStudentInAudience) {
      throw new ForbiddenException('Activity media is outside your scope');
    }
  }

  private assertThumbnailVariantOwnership(attachment: {
    id: string;
    tenantId: string;
    fileAssetId: string | null;
    thumbnailFileAsset: {
      tenantId: string;
      module: string | null;
      entityId: string | null;
      metadata: unknown;
      status: string;
      softDeletedAt: Date | null;
      deletedAt: Date | null;
    } | null;
  }) {
    const thumbnail = attachment.thumbnailFileAsset;
    if (
      !thumbnail ||
      thumbnail.tenantId !== attachment.tenantId ||
      thumbnail.module !== 'activity' ||
      thumbnail.entityId !== attachment.id ||
      thumbnail.status !== 'UPLOADED' ||
      thumbnail.softDeletedAt ||
      thumbnail.deletedAt ||
      !thumbnail.metadata ||
      typeof thumbnail.metadata !== 'object' ||
      Array.isArray(thumbnail.metadata)
    ) {
      throw new ForbiddenException('Activity thumbnail is outside this scope');
    }

    const metadata = thumbnail.metadata as Record<string, unknown>;
    if (
      metadata.variant !== 'thumbnail-256' ||
      metadata.sourceFileAssetId !== attachment.fileAssetId ||
      metadata.activityAttachmentId !== attachment.id
    ) {
      throw new ForbiddenException('Activity thumbnail is outside this scope');
    }
  }

  private async ensurePhotoConsentAllowsActor(
    actor: AuthContext,
    attachment: ActivityAttachment & {
      activityPost: {
        id: string;
        studentTags: Array<{ studentId: string }>;
      };
      fileAsset?: {
        id: string;
      } | null;
    },
  ) {
    if (!isParentOnly(actor)) {
      return;
    }

    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    const latestConsent = guardian
      ? await this.prisma.guardianConsent.findFirst({
          where: {
            tenantId: actor.tenantId,
            guardianId: guardian.id,
            consentType: ConsentType.PHOTO_USAGE,
          },
          orderBy: { capturedAt: 'desc' },
          select: { granted: true, revokedAt: true },
        })
      : null;

    if (!latestConsent?.granted || latestConsent.revokedAt) {
      await this.auditService.record({
        action: 'activity_attachment_denied_consent',
        resource: 'activity_attachment',
        resourceId: attachment.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          activityPostId: attachment.activityPost.id,
          fileAssetId: attachment.fileAsset?.id ?? null,
          reason: 'PHOTO_USAGE_CONSENT_REQUIRED',
        },
      });
      throw new ForbiddenException(ACTIVITY_MEDIA_CONSENT_MESSAGE);
    }

    const studentIds = attachment.activityPost.studentTags.map(
      (tag) => tag.studentId,
    );
    if (studentIds.length > 0) {
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
        let studentAllowed = student.lifecycleStatus === 'ACTIVE';
        if (studentAllowed) {
          const guardians = student.guardianLinks.map((link) => link.guardian);
          if (guardians.length === 0) {
            studentAllowed = false;
          } else {
            let studentHasConsent = false;
            for (const g of guardians) {
              const latest = g.consents[0];
              if (latest) {
                if (latest.granted && !latest.revokedAt) {
                  studentHasConsent = true;
                } else {
                  studentHasConsent = false;
                  break;
                }
              }
            }
            studentAllowed = studentHasConsent;
          }
        }

        if (!studentAllowed) {
          await this.auditService.record({
            action: 'activity_attachment_denied_consent',
            resource: 'activity_attachment',
            resourceId: attachment.id,
            tenantId: actor.tenantId,
            userId: actor.userId,
            after: {
              activityPostId: attachment.activityPost.id,
              fileAssetId: attachment.fileAsset?.id ?? null,
              reason: 'PHOTO_USAGE_CONSENT_REQUIRED',
              blockedStudentId: student.id,
            },
          });
          throw new ForbiddenException(ACTIVITY_MEDIA_CONSENT_MESSAGE);
        }
      }
    }
  }
}
