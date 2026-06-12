import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LearningProgressLabel, Prisma } from '@prisma/client';
import type { AuthContext } from '../../auth/auth.types';
import {
  getParentStudentIds,
  getStudentOwnId,
} from '../../common/security/parent-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningActivityPermissionsService } from '../activities/learning-activity-permissions.service';
import { LEARNING_PROGRESS_LABELS } from '../learning.constants';
import { LearningProgressQueryDto } from './dto/learning-progress-query.dto';

@Injectable()
export class LearningProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: LearningActivityPermissionsService,
  ) {}

  async recordSubmittedAttempt(input: {
    tenantId: string;
    studentId: string;
    activityId: string;
    subjectId: string;
    topicId?: string | null;
    attemptId: string;
    score: number;
    totalPossibleScore: number;
    submittedAt: Date;
  }) {
    const progressKey = buildProgressKey(
      input.subjectId,
      input.topicId,
      input.activityId,
    );
    const existing = await this.prisma.learningProgress.findUnique({
      where: {
        tenantId_studentId_progressKey: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          progressKey,
        },
      },
    });

    const totalScore = money(existing?.totalScore) + input.score;
    const totalPossibleScore =
      money(existing?.totalPossibleScore) + input.totalPossibleScore;
    const completedCount = (existing?.completedCount ?? 0) + 1;
    const averageAccuracy =
      totalPossibleScore > 0 ? (totalScore / totalPossibleScore) * 100 : 0;

    return this.prisma.learningProgress.upsert({
      where: {
        tenantId_studentId_progressKey: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          progressKey,
        },
      },
      create: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        progressKey,
        subjectId: input.subjectId,
        topicId: input.topicId ?? null,
        activityId: input.activityId,
        completedCount,
        totalScore: new Prisma.Decimal(totalScore),
        totalPossibleScore: new Prisma.Decimal(totalPossibleScore),
        averageAccuracy: new Prisma.Decimal(averageAccuracy),
        label: labelForAccuracy(averageAccuracy),
        lastAttemptId: input.attemptId,
        lastAttemptAt: input.submittedAt,
      },
      update: {
        completedCount,
        totalScore: new Prisma.Decimal(totalScore),
        totalPossibleScore: new Prisma.Decimal(totalPossibleScore),
        averageAccuracy: new Prisma.Decimal(averageAccuracy),
        label: labelForAccuracy(averageAccuracy),
        lastAttemptId: input.attemptId,
        lastAttemptAt: input.submittedAt,
      },
    });
  }

  async getClassProgress(
    actor: AuthContext,
    classId: string,
    query: LearningProgressQueryDto = {},
  ) {
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId: actor.tenantId },
      select: { id: true, name: true },
    });
    if (!classRecord) {
      throw new NotFoundException('Class not found in this school');
    }

    if (!isSchoolAdmin(actor)) {
      const staffId = await this.permissions.resolveActorStaffId(actor);
      if (!staffId) {
        throw new ForbiddenException('Class learning progress access denied');
      }
      const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
        where: { tenantId: actor.tenantId, staffId, classId },
        select: { id: true },
      });
      if (!assignment) {
        throw new ForbiddenException('Class learning progress access denied');
      }
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId,
        lifecycleStatus: 'ACTIVE',
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      },
      select: {
        id: true,
        firstNameEn: true,
        lastNameEn: true,
        classId: true,
        sectionId: true,
      },
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
      take: 200,
    });

    const progress = await this.prisma.learningProgress.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId: { in: students.map((student) => student.id) },
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.from || query.to
          ? {
              lastAttemptAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 1000,
    });

    return {
      class: classRecord,
      items: students.map((student) => ({
        student: {
          id: student.id,
          name: [student.firstNameEn, student.lastNameEn]
            .filter(Boolean)
            .join(' '),
          classId: student.classId,
          sectionId: student.sectionId,
        },
        progress: progress
          .filter((item) => item.studentId === student.id)
          .map(toProgressSummary),
      })),
    };
  }

  async getStudentProgress(
    actor: AuthContext,
    studentId: string,
    query: LearningProgressQueryDto = {},
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: {
        id: true,
        firstNameEn: true,
        lastNameEn: true,
        classId: true,
        sectionId: true,
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this school');
    }

    await this.assertCanReadStudent(actor, student);

    const progress = await this.prisma.learningProgress.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.from || query.to
          ? {
              lastAttemptAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        activity: { select: { id: true, title: true, difficulty: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });

    return {
      student: {
        id: student.id,
        name: [student.firstNameEn, student.lastNameEn]
          .filter(Boolean)
          .join(' '),
        classId: student.classId,
        sectionId: student.sectionId,
      },
      items: progress.map(toProgressSummary),
    };
  }

  async assertCanReadStudent(
    actor: AuthContext,
    student: { id: string; classId: string; sectionId: string | null },
  ) {
    const ownStudentId = await getStudentOwnId(this.prisma, actor);
    if (ownStudentId !== null) {
      if (ownStudentId !== student.id) {
        throw new ForbiddenException('Learning progress access denied');
      }
      return;
    }

    const parentStudentIds = await getParentStudentIds(this.prisma, actor);
    if (parentStudentIds !== null) {
      if (!parentStudentIds.includes(student.id)) {
        throw new ForbiddenException('Learning progress access denied');
      }
      return;
    }

    await this.permissions.assertActorCanReadStudentProgress(actor, student);
  }
}

function toProgressSummary(item: LearningProgressSummaryItem) {
  return {
    id: item.id,
    subject: item.subject,
    activity: item.activity ?? null,
    completedCount: item.completedCount,
    averageAccuracy: money(item.averageAccuracy),
    label: item.label,
    labelText: LEARNING_PROGRESS_LABELS[item.label],
    lastAttemptAt: item.lastAttemptAt,
  };
}

interface LearningProgressSummaryItem {
  id: string;
  subject: unknown;
  activity?: unknown;
  completedCount: number;
  averageAccuracy: unknown;
  label: LearningProgressLabel;
  lastAttemptAt: Date | null;
}

function buildProgressKey(
  subjectId: string,
  topicId: string | null | undefined,
  activityId: string,
) {
  return `subject:${subjectId}:topic:${topicId ?? 'none'}:activity:${activityId}`;
}

function labelForAccuracy(accuracy: number) {
  if (accuracy >= 85) return LearningProgressLabel.STRONG;
  if (accuracy >= 70) return LearningProgressLabel.READY;
  if (accuracy >= 50) return LearningProgressLabel.IMPROVING;
  return LearningProgressLabel.NEEDS_PRACTICE;
}

function money(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (hasToNumber(value)) {
    return value.toNumber();
  }
  return Number(value);
}

interface NumericLike {
  toNumber(): number;
}

function hasToNumber(value: unknown): value is NumericLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<NumericLike>;
  return typeof candidate.toNumber === 'function';
}

function isSchoolAdmin(actor: AuthContext) {
  return actor.roles.some((role) =>
    ['admin', 'principal', 'platform_super_admin'].includes(role),
  );
}
