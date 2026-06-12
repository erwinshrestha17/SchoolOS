import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LearningAccessType,
  LearningActivityStatus,
  LearningLanguageMode,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { LEARNING_AUDIT_RESOURCES } from '../learning.constants';
import { CreateLearningActivityDto } from './dto/create-learning-activity.dto';
import { LearningQuestionDto } from './dto/learning-question.dto';
import { ListLearningActivitiesDto } from './dto/list-learning-activities.dto';
import { UpdateLearningActivityDto } from './dto/update-learning-activity.dto';
import { LearningActivityPermissionsService } from './learning-activity-permissions.service';

@Injectable()
export class LearningActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: LearningActivityPermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async listActivities(actor: AuthContext, query: ListLearningActivitiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LearningActivityWhereInput = {
      tenantId: actor.tenantId,
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      status: query.status ?? { not: LearningActivityStatus.ARCHIVED },
    };

    const [items, total] = await Promise.all([
      this.prisma.learningActivity.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { questions: true, sessions: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.learningActivity.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async createActivity(dto: CreateLearningActivityDto, actor: AuthContext) {
    const teacherId = await this.permissions.resolveTeacherIdForWrite(
      actor,
      dto.teacherId,
    );
    const scope = this.scopeFromDto(dto);
    await this.permissions.assertActorCanControlScope(actor, teacherId, scope);

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.learningActivity.create({
        data: {
          tenantId: actor.tenantId,
          title: dto.title,
          description: dto.description ?? null,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          subjectId: dto.subjectId,
          chapterId: dto.chapterId ?? null,
          topicId: dto.topicId ?? null,
          teacherId,
          activityType: dto.activityType,
          difficulty: dto.difficulty,
          mode: dto.mode,
          accessType: dto.accessType ?? LearningAccessType.SCHOOL_ONLY,
          languageMode: dto.languageMode ?? LearningLanguageMode.ENGLISH,
          estimatedMinutes: dto.estimatedMinutes ?? null,
          status: dto.status ?? LearningActivityStatus.DRAFT,
          createdBy: actor.userId,
        },
      });

      if (dto.questions?.length) {
        await tx.learningQuestion.createMany({
          data: this.toQuestionRows(actor.tenantId, created.id, dto.questions),
        });
      }

      return created;
    });

    await this.auditService.record({
      action: 'create',
      resource: LEARNING_AUDIT_RESOURCES.ACTIVITY,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: activity.id,
      after: {
        classId: activity.classId,
        sectionId: activity.sectionId,
        subjectId: activity.subjectId,
        teacherId: activity.teacherId,
        status: activity.status,
      },
    });

    return this.getActivity(actor, activity.id);
  }

  async getActivity(actor: AuthContext, activityId: string) {
    const activity = await this.prisma.learningActivity.findFirst({
      where: { id: activityId, tenantId: actor.tenantId },
      include: activityDetailInclude(),
    });

    if (!activity) {
      throw new NotFoundException('Learning activity not found');
    }

    return activity;
  }

  async updateActivity(
    activityId: string,
    dto: UpdateLearningActivityDto,
    actor: AuthContext,
  ) {
    const existing = await this.getActivity(actor, activityId);
    if (existing.status === LearningActivityStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived learning activity cannot be edited',
      );
    }

    const teacherId = dto.teacherId ?? existing.teacherId;
    const scope = {
      classId: dto.classId ?? existing.classId,
      sectionId: dto.sectionId ?? existing.sectionId,
      subjectId: dto.subjectId ?? existing.subjectId,
      topicId: dto.topicId ?? existing.topicId,
    };
    await this.permissions.assertActorCanControlScope(actor, teacherId, scope);

    await this.prisma.$transaction(async (tx) => {
      await tx.learningActivity.update({
        where: { id: activityId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description ?? null }
            : {}),
          ...(dto.classId !== undefined ? { classId: dto.classId } : {}),
          ...(dto.sectionId !== undefined
            ? { sectionId: dto.sectionId ?? null }
            : {}),
          ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
          ...(dto.chapterId !== undefined
            ? { chapterId: dto.chapterId ?? null }
            : {}),
          ...(dto.topicId !== undefined
            ? { topicId: dto.topicId ?? null }
            : {}),
          ...(dto.teacherId !== undefined ? { teacherId } : {}),
          ...(dto.activityType !== undefined
            ? { activityType: dto.activityType }
            : {}),
          ...(dto.difficulty !== undefined
            ? { difficulty: dto.difficulty }
            : {}),
          ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
          ...(dto.accessType !== undefined
            ? { accessType: dto.accessType }
            : {}),
          ...(dto.languageMode !== undefined
            ? { languageMode: dto.languageMode }
            : {}),
          ...(dto.estimatedMinutes !== undefined
            ? { estimatedMinutes: dto.estimatedMinutes ?? null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (dto.questions) {
        await tx.learningQuestion.deleteMany({
          where: { tenantId: actor.tenantId, activityId },
        });
        if (dto.questions.length) {
          await tx.learningQuestion.createMany({
            data: this.toQuestionRows(
              actor.tenantId,
              activityId,
              dto.questions,
            ),
          });
        }
      }
    });

    await this.auditService.record({
      action: 'update',
      resource: LEARNING_AUDIT_RESOURCES.ACTIVITY,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: activityId,
      before: {
        classId: existing.classId,
        sectionId: existing.sectionId,
        subjectId: existing.subjectId,
        teacherId: existing.teacherId,
        status: existing.status,
      },
      after: dto,
    });

    return this.getActivity(actor, activityId);
  }

  async archiveActivity(activityId: string, actor: AuthContext) {
    const existing = await this.getActivity(actor, activityId);
    await this.permissions.assertActorCanControlScope(
      actor,
      existing.teacherId,
      {
        classId: existing.classId,
        sectionId: existing.sectionId,
        subjectId: existing.subjectId,
        topicId: existing.topicId,
      },
    );

    const archived = await this.prisma.learningActivity.update({
      where: { id: activityId },
      data: {
        status: LearningActivityStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedBy: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'archive',
      resource: LEARNING_AUDIT_RESOURCES.ACTIVITY,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: activityId,
      before: { status: existing.status },
      after: { status: archived.status },
    });

    return archived;
  }

  private scopeFromDto(dto: CreateLearningActivityDto) {
    return {
      classId: dto.classId,
      sectionId: dto.sectionId ?? null,
      subjectId: dto.subjectId,
      topicId: dto.topicId ?? null,
    };
  }

  private toQuestionRows(
    tenantId: string,
    activityId: string,
    questions: LearningQuestionDto[],
  ) {
    return questions.map((question, index) => ({
      tenantId,
      activityId,
      type: question.type,
      prompt: question.prompt,
      options: toJsonOrNull(question.options),
      correctAnswer: toJsonOrNull(question.correctAnswer),
      explanation: question.explanation ?? null,
      points: question.points ?? 1,
      sortOrder: question.sortOrder ?? index,
      metadata: toJsonOrNull(question.metadata),
    }));
  }
}

export function activityDetailInclude() {
  return {
    class: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
    subject: { select: { id: true, name: true, code: true } },
    teacher: { select: { id: true, firstName: true, lastName: true } },
    questions: { orderBy: [{ sortOrder: 'asc' as const }] },
    resources: true,
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
