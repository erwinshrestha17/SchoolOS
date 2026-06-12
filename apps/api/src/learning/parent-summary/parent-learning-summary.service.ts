import { ForbiddenException, Injectable } from '@nestjs/common';
import { LearningProgressLabel } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth.types';
import { getParentStudentIds } from '../../common/security/parent-scope';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LEARNING_AUDIT_RESOURCES,
  LEARNING_PROGRESS_LABELS,
} from '../learning.constants';

@Injectable()
export class ParentLearningSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getSummary(actor: AuthContext, requestedStudentId?: string) {
    const allowedStudentIds = await getParentStudentIds(this.prisma, actor);
    if (allowedStudentIds === null) {
      throw new ForbiddenException('Parent learning summary is child-scoped');
    }

    const studentIds = requestedStudentId
      ? allowedStudentIds.filter((id) => id === requestedStudentId)
      : allowedStudentIds;

    if (requestedStudentId && studentIds.length === 0) {
      throw new ForbiddenException('Parent learning summary access denied');
    }

    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId, id: { in: studentIds } },
      select: {
        id: true,
        firstNameEn: true,
        lastNameEn: true,
        class: { select: { id: true, name: true } },
        sectionRef: { select: { id: true, name: true } },
      },
      orderBy: [{ firstNameEn: 'asc' }],
    });

    const [progress, attempts] = await Promise.all([
      this.prisma.learningProgress.findMany({
        where: { tenantId: actor.tenantId, studentId: { in: studentIds } },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          activity: { select: { id: true, title: true, difficulty: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 200,
      }),
      this.prisma.learningAttempt.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId: { in: studentIds },
          status: 'SUBMITTED',
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              subject: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: [{ submittedAt: 'desc' }],
        take: 30,
      }),
    ]);

    await this.auditService.record({
      action: 'view',
      resource: LEARNING_AUDIT_RESOURCES.PARENT_SUMMARY,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { studentIds },
    });

    return {
      items: students.map((student) => {
        const studentProgress = progress.filter(
          (item) => item.studentId === student.id,
        );
        const studentAttempts = attempts.filter(
          (item) => item.studentId === student.id,
        );
        return {
          child: {
            id: student.id,
            name: [student.firstNameEn, student.lastNameEn]
              .filter(Boolean)
              .join(' '),
            class: student.class,
            section: student.sectionRef,
          },
          activityCount: studentAttempts.length,
          supportiveLabel: summarizeLabel(studentProgress),
          recentCompletedActivities: studentAttempts
            .slice(0, 5)
            .map((attempt) => ({
              id: attempt.activity.id,
              title: attempt.activity.title,
              subject: attempt.activity.subject,
              difficulty: attempt.activity.difficulty,
              submittedAt: attempt.submittedAt,
              score: money(attempt.score),
              accuracy: money(attempt.accuracy),
            })),
          strongTopics: studentProgress
            .filter((item) => item.label === LearningProgressLabel.STRONG)
            .slice(0, 5)
            .map(toTopicSummary),
          needsPracticeTopics: studentProgress
            .filter(
              (item) => item.label === LearningProgressLabel.NEEDS_PRACTICE,
            )
            .slice(0, 5)
            .map(toTopicSummary),
        };
      }),
    };
  }
}

function summarizeLabel(items: Array<{ label: LearningProgressLabel }>) {
  if (
    items.some((item) => item.label === LearningProgressLabel.NEEDS_PRACTICE)
  ) {
    return {
      label: LearningProgressLabel.NEEDS_PRACTICE,
      text: LEARNING_PROGRESS_LABELS.NEEDS_PRACTICE,
    };
  }
  if (items.some((item) => item.label === LearningProgressLabel.IMPROVING)) {
    return {
      label: LearningProgressLabel.IMPROVING,
      text: LEARNING_PROGRESS_LABELS.IMPROVING,
    };
  }
  if (items.some((item) => item.label === LearningProgressLabel.READY)) {
    return {
      label: LearningProgressLabel.READY,
      text: LEARNING_PROGRESS_LABELS.READY,
    };
  }
  if (items.some((item) => item.label === LearningProgressLabel.STRONG)) {
    return {
      label: LearningProgressLabel.STRONG,
      text: LEARNING_PROGRESS_LABELS.STRONG,
    };
  }
  return {
    label: LearningProgressLabel.NEEDS_PRACTICE,
    text: LEARNING_PROGRESS_LABELS.NEEDS_PRACTICE,
  };
}

function toTopicSummary(item: ParentTopicSummaryItem) {
  return {
    subject: item.subject,
    activity: item.activity,
    label: item.label,
    labelText: LEARNING_PROGRESS_LABELS[item.label],
    averageAccuracy: money(item.averageAccuracy),
    completedCount: item.completedCount,
  };
}

interface ParentTopicSummaryItem {
  subject: unknown;
  activity: unknown;
  label: LearningProgressLabel;
  averageAccuracy: unknown;
  completedCount: number;
}

function money(value: unknown): number | null {
  if (value === null || value === undefined) return null;
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
