import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAttachment,
  ActivityPostStatus,
  StorageProvider,
} from '@prisma/client';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { join, normalize } from 'path';
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

@Injectable()
export class ActivityMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getAttachmentMedia(
    actor: AuthContext,
    attachmentId: string,
    action: 'preview' | 'download',
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

    const objectKey =
      action === 'preview' && attachment.optimizedObjectKey
        ? attachment.optimizedObjectKey
        : fileAsset.objectKey;

    if (
      attachment.provider === StorageProvider.R2 &&
      objectKey.startsWith('http')
    ) {
      return {
        redirectUrl: objectKey,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes:
          action === 'preview' && attachment.optimizedSizeBytes
            ? attachment.optimizedSizeBytes
            : attachment.sizeBytes,
      };
    }

    const absolutePath = this.resolveLocalObjectPath(objectKey);
    await access(absolutePath);

    return {
      stream: createReadStream(absolutePath),
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes:
        action === 'preview' && attachment.optimizedSizeBytes
          ? attachment.optimizedSizeBytes
          : attachment.sizeBytes,
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
      },
    });

    if (!attachment) {
      throw new NotFoundException('Activity attachment not found');
    }

    await this.ensureAttachmentVisibleToActor(actor, attachment);

    const fileAsset = attachment.fileAsset;

    if (!fileAsset || fileAsset.softDeletedAt) {
      throw new NotFoundException('Activity media file not found');
    }

    if (fileAsset.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Activity media is outside this tenant');
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

  private resolveLocalObjectPath(objectKey: string) {
    const localRoot = join(process.cwd(), this.configService.localStorageRoot);
    const absolutePath = normalize(join(localRoot, objectKey));

    if (!absolutePath.startsWith(normalize(localRoot))) {
      throw new ForbiddenException('Invalid activity media object path');
    }

    return absolutePath;
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
      };
    },
  ) {
    if (!isParentOnly(actor) && !isStudentOnly(actor)) {
      return;
    }

    if (
      attachment.activityPost.softDeletedAt ||
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
}
