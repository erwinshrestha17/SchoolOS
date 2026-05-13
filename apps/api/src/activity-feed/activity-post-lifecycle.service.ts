import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityPostStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeleteActivityPostDto,
  ModerateActivityPostDto,
} from './dto/moderate-activity-post.dto';
import { UpdateActivityPostDto } from './dto/update-activity-post.dto';

@Injectable()
export class ActivityPostLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async updatePost(
    postId: string,
    dto: UpdateActivityPostDto,
    actor: AuthContext,
  ) {
    const post = await this.getPostOrThrow(postId, actor);
    this.ensureCanModify(post, actor);

    if (post.softDeletedAt) {
      throw new ForbiddenException('Deleted activity post cannot be edited');
    }

    if (
      post.status === ActivityPostStatus.APPROVED ||
      post.status === ActivityPostStatus.ARCHIVED
    ) {
      throw new ForbiddenException(
        'Approved or Archived activity post cannot be silently edited',
      );
    }

    const updated = await this.prisma.activityPost.update({
      where: { id: postId },
      data: {
        title: dto.title,
        caption: dto.caption,
        editedAt: new Date(),
        editedById: actor.userId,
        status:
          post.status === ActivityPostStatus.REJECTED
            ? ActivityPostStatus.PENDING_APPROVAL
            : undefined,
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: {
        status: post.status,
      },
      after: {
        titleChanged: dto.title !== undefined,
        captionChanged: dto.caption !== undefined,
        status: updated.status,
      },
    });

    return updated;
  }

  async softDeletePost(
    postId: string,
    dto: DeleteActivityPostDto,
    actor: AuthContext,
  ) {
    const post = await this.getPostOrThrow(postId, actor);
    this.ensureCanModify(post, actor);

    if (post.softDeletedAt) {
      return { id: post.id, deleted: false };
    }

    const updated = await this.prisma.activityPost.update({
      where: { id: postId },
      data: {
        softDeletedAt: new Date(),
        deletedById: actor.userId,
        status: ActivityPostStatus.REJECTED,
        moderationReason: dto.reason,
        moderatedAt: new Date(),
        moderatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'soft_delete',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { status: post.status },
      after: { reason: dto.reason, status: ActivityPostStatus.REJECTED },
    });

    return { ...updated, deleted: true };
  }

  async restorePost(postId: string, actor: AuthContext) {
    const post = await this.getPostOrThrow(postId, actor);
    this.ensureCanModerate(actor);

    if (!post.softDeletedAt) {
      return { id: post.id, restored: false };
    }

    const updated = await this.prisma.activityPost.update({
      where: { id: postId },
      data: {
        softDeletedAt: null,
        deletedById: null,
        status: ActivityPostStatus.PENDING_APPROVAL,
        moderationReason: null,
        moderatedAt: new Date(),
        moderatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'restore',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: {
        status: post.status,
        softDeletedAt: post.softDeletedAt,
      },
      after: { status: ActivityPostStatus.PENDING_APPROVAL, softDeletedAt: null },
    });

    return { ...updated, restored: true };
  }

  async moderatePost(
    postId: string,
    dto: ModerateActivityPostDto,
    actor: AuthContext,
  ) {
    this.ensureCanModerate(actor);
    const post = await this.getPostOrThrow(postId, actor);

    if (post.softDeletedAt) {
      throw new ForbiddenException('Deleted activity post cannot be moderated');
    }

    if (dto.status === ActivityPostStatus.REJECTED && !dto.reason?.trim()) {
      throw new ForbiddenException('Rejection reason is required');
    }

    const updated = await this.prisma.activityPost.update({
      where: { id: postId },
      data: {
        status: dto.status,
        moderationReason: dto.reason ?? null,
        moderatedAt: new Date(),
        moderatedById: actor.userId,
        publishedAt:
          dto.status === ActivityPostStatus.APPROVED
            ? post.publishedAt ?? new Date()
            : post.publishedAt,
      },
    });

    await this.auditService.record({
      action: 'moderate',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { status: post.status },
      after: { status: dto.status, reason: dto.reason ?? null },
    });

    return updated;
  }

  private async getPostOrThrow(postId: string, actor: AuthContext) {
    const post = await this.prisma.activityPost.findFirst({
      where: { id: postId, tenantId: actor.tenantId },
    });

    if (!post) {
      throw new NotFoundException('Activity post not found in this tenant');
    }

    return post;
  }

  private ensureCanModify(
    post: { createdById: string | null },
    actor: AuthContext,
  ) {
    if (this.canManageAllActivity(actor)) {
      return;
    }

    if (post.createdById !== actor.userId) {
      throw new ForbiddenException(
        'You can only modify your own activity posts',
      );
    }
  }

  private ensureCanModerate(actor: AuthContext) {
    if (!this.canManageAllActivity(actor)) {
      throw new ForbiddenException(
        'Only admin or principal can moderate activity posts',
      );
    }
  }

  private canManageAllActivity(actor: AuthContext) {
    return actor.roles.some((role) =>
      ['platform_super_admin', 'admin', 'principal'].includes(role),
    );
  }
}
