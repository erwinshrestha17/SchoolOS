import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DeleteActivityPostDto, ModerateActivityPostDto } from './dto/moderate-activity-post.dto';
import { UpdateActivityPostDto } from './dto/update-activity-post.dto';

export interface ActivityPostLifecycleRow {
  id: string;
  tenantId: string;
  createdById: string;
  moderationStatus: string;
  softDeletedAt: Date | null;
}

@Injectable()
export class ActivityPostLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async updatePost(postId: string, dto: UpdateActivityPostDto, actor: AuthContext) {
    const post = await this.getPostOrThrow(postId, actor);
    this.ensureCanModify(post, actor);

    if (post.softDeletedAt) {
      throw new ForbiddenException('Deleted activity post cannot be edited');
    }

    if (post.moderationStatus === 'APPROVED' || post.moderationStatus === 'PUBLISHED') {
      throw new ForbiddenException('Approved activity post cannot be silently edited');
    }

    const updatedRows = await this.prisma.$queryRaw<ActivityPostLifecycleRow[]>(
      Prisma.sql`
        UPDATE "ActivityPost"
        SET
          "title" = COALESCE(${dto.title ?? null}, "title"),
          "caption" = COALESCE(${dto.caption ?? null}, "caption"),
          "editedAt" = now(),
          "editedById" = ${actor.userId},
          "moderationStatus" = CASE
            WHEN "moderationStatus" = 'REJECTED' THEN 'PENDING'
            ELSE "moderationStatus"
          END
        WHERE "id" = ${post.id}
          AND "tenantId" = ${actor.tenantId}
        RETURNING "id", "tenantId", "createdById", "moderationStatus", "softDeletedAt"
      `,
    );

    await this.auditService.record({
      action: 'update',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: {
        moderationStatus: post.moderationStatus,
      },
      after: {
        titleChanged: dto.title !== undefined,
        captionChanged: dto.caption !== undefined,
        moderationStatus: updatedRows[0]?.moderationStatus,
      },
    });

    return updatedRows[0];
  }

  async softDeletePost(postId: string, dto: DeleteActivityPostDto, actor: AuthContext) {
    const post = await this.getPostOrThrow(postId, actor);
    this.ensureCanModify(post, actor);

    if (post.softDeletedAt) {
      return { id: post.id, deleted: false };
    }

    const updatedRows = await this.prisma.$queryRaw<ActivityPostLifecycleRow[]>(
      Prisma.sql`
        UPDATE "ActivityPost"
        SET
          "softDeletedAt" = now(),
          "moderationStatus" = 'REJECTED',
          "moderationReason" = ${dto.reason},
          "moderatedAt" = now(),
          "moderatedById" = ${actor.userId}
        WHERE "id" = ${post.id}
          AND "tenantId" = ${actor.tenantId}
        RETURNING "id", "tenantId", "createdById", "moderationStatus", "softDeletedAt"
      `,
    );

    await this.auditService.record({
      action: 'soft_delete',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { moderationStatus: post.moderationStatus },
      after: { reason: dto.reason, moderationStatus: 'REJECTED' },
    });

    return { ...updatedRows[0], deleted: true };
  }

  async restorePost(postId: string, actor: AuthContext) {
    const post = await this.getPostOrThrow(postId, actor);
    this.ensureCanModerate(actor);

    if (!post.softDeletedAt) {
      return { id: post.id, restored: false };
    }

    const updatedRows = await this.prisma.$queryRaw<ActivityPostLifecycleRow[]>(
      Prisma.sql`
        UPDATE "ActivityPost"
        SET
          "softDeletedAt" = NULL,
          "moderationStatus" = 'PENDING',
          "moderationReason" = NULL,
          "moderatedAt" = now(),
          "moderatedById" = ${actor.userId}
        WHERE "id" = ${post.id}
          AND "tenantId" = ${actor.tenantId}
        RETURNING "id", "tenantId", "createdById", "moderationStatus", "softDeletedAt"
      `,
    );

    await this.auditService.record({
      action: 'restore',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { moderationStatus: post.moderationStatus, softDeletedAt: post.softDeletedAt },
      after: { moderationStatus: 'PENDING', softDeletedAt: null },
    });

    return { ...updatedRows[0], restored: true };
  }

  async moderatePost(postId: string, dto: ModerateActivityPostDto, actor: AuthContext) {
    this.ensureCanModerate(actor);
    const post = await this.getPostOrThrow(postId, actor);

    if (post.softDeletedAt) {
      throw new ForbiddenException('Deleted activity post cannot be moderated');
    }

    if (dto.status === 'REJECTED' && !dto.reason?.trim()) {
      throw new ForbiddenException('Rejection reason is required');
    }

    const publishedAtExpression =
      dto.status === 'APPROVED'
        ? Prisma.sql`COALESCE("publishedAt", now())`
        : Prisma.sql`"publishedAt"`;

    const updatedRows = await this.prisma.$queryRaw<ActivityPostLifecycleRow[]>(
      Prisma.sql`
        UPDATE "ActivityPost"
        SET
          "moderationStatus" = ${dto.status},
          "moderationReason" = ${dto.reason ?? null},
          "moderatedAt" = now(),
          "moderatedById" = ${actor.userId},
          "publishedAt" = ${publishedAtExpression}
        WHERE "id" = ${post.id}
          AND "tenantId" = ${actor.tenantId}
        RETURNING "id", "tenantId", "createdById", "moderationStatus", "softDeletedAt"
      `,
    );

    await this.auditService.record({
      action: 'moderate',
      resource: 'activity_post',
      resourceId: post.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { moderationStatus: post.moderationStatus },
      after: { moderationStatus: dto.status, reason: dto.reason ?? null },
    });

    return updatedRows[0];
  }

  private async getPostOrThrow(postId: string, actor: AuthContext) {
    const rows = await this.prisma.$queryRaw<ActivityPostLifecycleRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "tenantId",
          "createdById",
          COALESCE(to_jsonb("ActivityPost") ->> 'moderationStatus', 'APPROVED') AS "moderationStatus",
          (to_jsonb("ActivityPost") ->> 'softDeletedAt')::timestamp AS "softDeletedAt"
        FROM "ActivityPost"
        WHERE "id" = ${postId}
          AND "tenantId" = ${actor.tenantId}
        LIMIT 1
      `,
    );

    if (!rows[0]) {
      throw new NotFoundException('Activity post not found in this tenant');
    }

    return rows[0];
  }

  private ensureCanModify(post: ActivityPostLifecycleRow, actor: AuthContext) {
    if (this.canManageAllActivity(actor)) {
      return;
    }

    if (post.createdById !== actor.userId) {
      throw new ForbiddenException('You can only modify your own activity posts');
    }
  }

  private ensureCanModerate(actor: AuthContext) {
    if (!this.canManageAllActivity(actor)) {
      throw new ForbiddenException('Only admin or principal can moderate activity posts');
    }
  }

  private canManageAllActivity(actor: AuthContext) {
    return actor.roles.some((role) =>
      ['super_admin', 'admin', 'principal'].includes(role),
    );
  }
}
