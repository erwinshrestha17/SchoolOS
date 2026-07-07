import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LearningResourceStatus,
  LearningResourceType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningActivityPermissionsService } from '../activities/learning-activity-permissions.service';
import { LEARNING_AUDIT_RESOURCES } from '../learning.constants';
import { CreateLearningResourceDto } from './dto/create-learning-resource.dto';
import { ListLearningResourcesDto } from './dto/list-learning-resources.dto';
import { UpdateLearningResourceDto } from './dto/update-learning-resource.dto';

@Injectable()
export class LearningResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: LearningActivityPermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async listResources(actor: AuthContext, query: ListLearningResourcesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LearningResourceWhereInput = {
      tenantId: actor.tenantId,
      status: query.status ?? LearningResourceStatus.ACTIVE,
      ...(query.activityId ? { activityId: query.activityId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.topicId ? { topicId: query.topicId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    if (!isSchoolAdmin(actor)) {
      const staffId = await this.permissions.resolveActorStaffId(actor);
      if (!staffId) {
        throw new ForbiddenException('Learning resource access denied');
      }
      where.OR = [
        { createdBy: actor.userId },
        { activity: { teacherId: staffId } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.learningResource.findMany({
        where,
        include: resourceInclude(),
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.learningResource.count({ where }),
    ]);

    return { items: items.map(toResourceResponse), total, page, limit };
  }

  async listActivityResources(actor: AuthContext, activityId: string) {
    await this.assertCanReadActivity(actor, activityId);
    const items = await this.prisma.learningResource.findMany({
      where: {
        tenantId: actor.tenantId,
        activityId,
        status: LearningResourceStatus.ACTIVE,
      },
      include: resourceInclude(),
      orderBy: [{ updatedAt: 'desc' }],
    });
    return { items: items.map(toResourceResponse) };
  }

  async createResource(actor: AuthContext, dto: CreateLearningResourceDto) {
    await this.validateResourcePayload(actor, dto, 'create');

    const resource = await this.prisma.learningResource.create({
      data: {
        tenantId: actor.tenantId,
        activityId: dto.activityId ?? null,
        subjectId: dto.subjectId ?? null,
        topicId: dto.topicId ?? null,
        fileAssetId: dto.fileAssetId ?? null,
        type: dto.type,
        title: dto.title,
        url: dto.type === LearningResourceType.LINK ? (dto.url ?? null) : null,
        metadata: toJsonOrNull(dto.metadata),
        status: LearningResourceStatus.ACTIVE,
        createdBy: actor.userId,
      },
      include: resourceInclude(),
    });

    await this.auditService.record({
      action: 'create',
      resource: LEARNING_AUDIT_RESOURCES.RESOURCE,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: resource.id,
      after: {
        activityId: resource.activityId,
        subjectId: resource.subjectId,
        topicId: resource.topicId,
        type: resource.type,
        fileAssetId: resource.fileAssetId,
      },
    });

    return toResourceResponse(resource);
  }

  async attachActivityResource(
    actor: AuthContext,
    activityId: string,
    dto: CreateLearningResourceDto,
  ) {
    return this.createResource(actor, { ...dto, activityId });
  }

  async getResource(actor: AuthContext, resourceId: string) {
    const resource = await this.findResource(actor, resourceId);
    await this.assertCanReadResource(actor, resource);
    return toResourceResponse(resource);
  }

  async updateResource(
    actor: AuthContext,
    resourceId: string,
    dto: UpdateLearningResourceDto,
  ) {
    const existing = await this.findResource(actor, resourceId);
    await this.assertCanManageResource(actor, existing);
    await this.validateResourcePayload(
      actor,
      {
        activityId: dto.activityId ?? existing.activityId ?? undefined,
        subjectId: dto.subjectId ?? existing.subjectId ?? undefined,
        topicId: dto.topicId ?? existing.topicId ?? undefined,
        fileAssetId: dto.fileAssetId ?? existing.fileAssetId ?? undefined,
        type: dto.type ?? existing.type,
        title: dto.title ?? existing.title,
        url: dto.url ?? existing.url ?? undefined,
        metadata: dto.metadata ?? existing.metadata ?? undefined,
      },
      'update',
    );

    const updated = await this.prisma.learningResource.update({
      where: { id: resourceId },
      data: {
        ...(dto.activityId !== undefined
          ? { activityId: dto.activityId || null }
          : {}),
        ...(dto.subjectId !== undefined
          ? { subjectId: dto.subjectId || null }
          : {}),
        ...(dto.topicId !== undefined ? { topicId: dto.topicId || null } : {}),
        ...(dto.fileAssetId !== undefined
          ? { fileAssetId: dto.fileAssetId || null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined
          ? {
              url:
                (dto.type ?? existing.type) === LearningResourceType.LINK
                  ? dto.url || null
                  : null,
            }
          : {}),
        ...(dto.metadata !== undefined
          ? { metadata: toJsonOrNull(dto.metadata) }
          : {}),
      },
      include: resourceInclude(),
    });

    await this.auditService.record({
      action: 'update',
      resource: LEARNING_AUDIT_RESOURCES.RESOURCE,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId,
      before: {
        activityId: existing.activityId,
        subjectId: existing.subjectId,
        topicId: existing.topicId,
        type: existing.type,
        status: existing.status,
      },
      after: dto,
    });

    return toResourceResponse(updated);
  }

  async archiveResource(actor: AuthContext, resourceId: string) {
    const existing = await this.findResource(actor, resourceId);
    await this.assertCanManageResource(actor, existing);

    const archived = await this.prisma.learningResource.update({
      where: { id: resourceId },
      data: {
        status: LearningResourceStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedBy: actor.userId,
      },
      include: resourceInclude(),
    });

    await this.auditService.record({
      action: 'archive',
      resource: LEARNING_AUDIT_RESOURCES.RESOURCE,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId,
      before: { status: existing.status },
      after: { status: archived.status },
    });

    return toResourceResponse(archived);
  }

  private async findResource(actor: AuthContext, resourceId: string) {
    const resource = await this.prisma.learningResource.findFirst({
      where: { id: resourceId, tenantId: actor.tenantId },
      include: resourceInclude(),
    });

    if (!resource) {
      throw new NotFoundException('Learning resource not found');
    }

    return resource;
  }

  private async validateResourcePayload(
    actor: AuthContext,
    dto: CreateLearningResourceDto,
    mode: 'create' | 'update',
  ) {
    if (dto.type === LearningResourceType.FILE && !dto.fileAssetId) {
      throw new BadRequestException('File resource requires fileAssetId');
    }
    if (dto.type === LearningResourceType.LINK && !dto.url) {
      throw new BadRequestException('Link resource requires url');
    }
    if (dto.type !== LearningResourceType.LINK && dto.url) {
      throw new BadRequestException('Only link resources may include url');
    }

    if (dto.activityId) {
      await this.assertCanManageActivity(actor, dto.activityId);
    } else if (!isSchoolAdmin(actor) && mode === 'create') {
      throw new ForbiddenException(
        'Teacher resources must be attached to a learning activity',
      );
    }

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found in this school');
      }
    }

    if (dto.topicId) {
      const topic = await this.prisma.syllabusTopic.findFirst({
        where: { id: dto.topicId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!topic) {
        throw new NotFoundException('Topic not found in this school');
      }
    }

    if (dto.fileAssetId) {
      const asset = await this.prisma.fileAsset.findFirst({
        where: {
          id: dto.fileAssetId,
          tenantId: actor.tenantId,
          softDeletedAt: null,
        },
        select: { id: true },
      });
      if (!asset) {
        throw new NotFoundException('File asset not found in this school');
      }
    }
  }

  private async assertCanReadActivity(actor: AuthContext, activityId: string) {
    const activity = await this.prisma.learningActivity.findFirst({
      where: { id: activityId, tenantId: actor.tenantId },
      select: {
        id: true,
        classId: true,
        sectionId: true,
        subjectId: true,
        topicId: true,
        teacherId: true,
      },
    });
    if (!activity) {
      throw new NotFoundException('Learning activity not found');
    }
    if (!isSchoolAdmin(actor)) {
      await this.permissions.assertActorCanControlScope(
        actor,
        activity.teacherId,
        {
          classId: activity.classId,
          sectionId: activity.sectionId,
          subjectId: activity.subjectId,
          topicId: activity.topicId,
        },
      );
    }
    return activity;
  }

  private async assertCanManageActivity(
    actor: AuthContext,
    activityId: string,
  ) {
    const activity = await this.assertCanReadActivity(actor, activityId);
    await this.permissions.assertActorCanControlScope(
      actor,
      activity.teacherId,
      {
        classId: activity.classId,
        sectionId: activity.sectionId,
        subjectId: activity.subjectId,
        topicId: activity.topicId,
      },
    );
  }

  private async assertCanReadResource(
    actor: AuthContext,
    resource: LearningResourceDetail,
  ) {
    if (isSchoolAdmin(actor)) {
      return;
    }
    if (resource.activityId) {
      await this.assertCanReadActivity(actor, resource.activityId);
      return;
    }
    if (resource.createdBy !== actor.userId) {
      throw new ForbiddenException('Learning resource access denied');
    }
  }

  private async assertCanManageResource(
    actor: AuthContext,
    resource: LearningResourceDetail,
  ) {
    if (resource.activityId) {
      await this.assertCanManageActivity(actor, resource.activityId);
      return;
    }
    if (!isSchoolAdmin(actor) && resource.createdBy !== actor.userId) {
      throw new ForbiddenException('Learning resource access denied');
    }
  }
}

export function resourceInclude() {
  return {
    activity: {
      select: {
        id: true,
        title: true,
        classId: true,
        sectionId: true,
        subjectId: true,
        teacherId: true,
      },
    },
    subject: { select: { id: true, name: true, code: true } },
    topic: { select: { id: true, title: true } },
    fileAsset: {
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        module: true,
        entityId: true,
      },
    },
  };
}

type LearningResourceDetail = Prisma.LearningResourceGetPayload<{
  include: ReturnType<typeof resourceInclude>;
}>;

function toResourceResponse(resource: LearningResourceDetail) {
  return {
    id: resource.id,
    activityId: resource.activityId,
    subjectId: resource.subjectId,
    topicId: resource.topicId,
    fileAssetId: resource.fileAssetId,
    type: resource.type,
    title: resource.title,
    url: resource.type === LearningResourceType.LINK ? resource.url : null,
    metadata: resource.metadata,
    status: resource.status,
    createdBy: resource.createdBy,
    archivedAt: resource.archivedAt,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    activity: resource.activity,
    subject: resource.subject,
    topic: resource.topic,
    fileAsset: resource.fileAsset
      ? {
          ...resource.fileAsset,
          fileName: resource.fileAsset.originalFilename ?? null,
        }
      : resource.fileAsset,
  };
}

function toJsonOrNull(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function isSchoolAdmin(actor: AuthContext) {
  return actor.roles.some((role) =>
    ['admin', 'principal', 'platform_super_admin'].includes(role),
  );
}
