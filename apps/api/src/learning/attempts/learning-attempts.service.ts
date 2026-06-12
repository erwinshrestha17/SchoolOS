import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LearningAttemptStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { LEARNING_AUDIT_RESOURCES } from '../learning.constants';
import { LearningProgressService } from '../progress/learning-progress.service';
import { LearningSessionAccessService } from '../sessions/learning-session-access.service';
import { AutosaveLearningAttemptDto } from './dto/autosave-learning-attempt.dto';
import { LearningAnswerDto } from './dto/learning-answer.dto';
import { SubmitLearningAttemptDto } from './dto/submit-learning-attempt.dto';
import { LearningAnswerEvaluatorService } from './learning-answer-evaluator.service';

@Injectable()
export class LearningAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: LearningSessionAccessService,
    private readonly evaluator: LearningAnswerEvaluatorService,
    private readonly progressService: LearningProgressService,
    private readonly auditService: AuditService,
  ) {}

  async startAttempt(sessionId: string, actor: AuthContext) {
    const { student, session } =
      await this.accessService.assertStudentCanUseSession(actor, sessionId);

    const existing = await this.prisma.learningAttempt.findFirst({
      where: {
        tenantId: actor.tenantId,
        sessionId,
        studentId: student.id,
        status: LearningAttemptStatus.IN_PROGRESS,
      },
      include: attemptInclude(),
      orderBy: [{ startedAt: 'desc' }],
    });

    if (existing) {
      return this.toAttemptResponse(existing);
    }

    const latest = await this.prisma.learningAttempt.findFirst({
      where: { tenantId: actor.tenantId, sessionId, studentId: student.id },
      orderBy: [{ attemptNumber: 'desc' }],
      select: { attemptNumber: true },
    });

    const attempt = await this.prisma.learningAttempt.create({
      data: {
        tenantId: actor.tenantId,
        sessionId,
        activityId: session.activityId,
        studentId: student.id,
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        status: LearningAttemptStatus.IN_PROGRESS,
      },
      include: attemptInclude(),
    });

    return this.toAttemptResponse(attempt);
  }

  async autosaveAttempt(
    attemptId: string,
    dto: AutosaveLearningAttemptDto,
    actor: AuthContext,
  ) {
    const attempt = await this.findStudentAttempt(actor, attemptId);
    if (attempt.status !== LearningAttemptStatus.IN_PROGRESS) {
      return this.toAttemptResponse(attempt);
    }

    await this.saveAnswers(
      actor.tenantId,
      attempt.id,
      dto.answers ?? [],
      new Set(attempt.activity.questions.map((question) => question.id)),
    );

    const updated = await this.prisma.learningAttempt.update({
      where: { id: attempt.id },
      data: {
        ...(dto.timeSpentSeconds !== undefined
          ? { timeSpentSeconds: dto.timeSpentSeconds }
          : {}),
        ...(dto.hintsUsed !== undefined ? { hintsUsed: dto.hintsUsed } : {}),
      },
      include: attemptInclude(),
    });

    return this.toAttemptResponse(updated);
  }

  async submitAttempt(
    attemptId: string,
    dto: SubmitLearningAttemptDto,
    actor: AuthContext,
  ) {
    const attempt = await this.findStudentAttempt(actor, attemptId);
    if (attempt.status === LearningAttemptStatus.SUBMITTED) {
      return this.toAttemptResponse(attempt);
    }

    if (attempt.session.status !== 'LIVE') {
      throw new ConflictException('Cannot submit to an inactive session');
    }

    await this.saveAnswers(
      actor.tenantId,
      attempt.id,
      dto.answers ?? [],
      new Set(attempt.activity.questions.map((question) => question.id)),
    );

    const refreshed = await this.findStudentAttempt(actor, attemptId);
    const answerByQuestionId = new Map(
      refreshed.answers.map((answer) => [answer.questionId, answer]),
    );

    let score = 0;
    let totalPossibleScore = 0;
    const evaluatedAnswers: Array<{
      questionId: string;
      isCorrect: boolean;
      score: number;
    }> = [];

    for (const question of refreshed.activity.questions) {
      totalPossibleScore += question.points;
      const saved = answerByQuestionId.get(question.id);
      const result = this.evaluator.evaluate(
        {
          id: question.id,
          type: question.type,
          correctAnswer: question.correctAnswer,
          points: question.points,
        },
        saved?.answer,
      );
      score += result.score;
      evaluatedAnswers.push({
        questionId: question.id,
        isCorrect: result.isCorrect,
        score: result.score,
      });
    }

    const submittedAt = new Date();
    const accuracy =
      totalPossibleScore > 0 ? (score / totalPossibleScore) * 100 : 0;

    await this.prisma.$transaction(async (tx) => {
      for (const answer of evaluatedAnswers) {
        await tx.learningAnswer.upsert({
          where: {
            tenantId_attemptId_questionId: {
              tenantId: actor.tenantId,
              attemptId: refreshed.id,
              questionId: answer.questionId,
            },
          },
          create: {
            tenantId: actor.tenantId,
            attemptId: refreshed.id,
            questionId: answer.questionId,
            answer: Prisma.JsonNull,
            isCorrect: answer.isCorrect,
            score: new Prisma.Decimal(answer.score),
          },
          update: {
            isCorrect: answer.isCorrect,
            score: new Prisma.Decimal(answer.score),
          },
        });
      }

      await tx.learningAttempt.update({
        where: { id: refreshed.id },
        data: {
          status: LearningAttemptStatus.SUBMITTED,
          submittedAt,
          score: new Prisma.Decimal(score),
          accuracy: new Prisma.Decimal(accuracy),
          ...(dto.timeSpentSeconds !== undefined
            ? { timeSpentSeconds: dto.timeSpentSeconds }
            : {}),
          ...(dto.hintsUsed !== undefined ? { hintsUsed: dto.hintsUsed } : {}),
        },
      });
    });

    await this.progressService.recordSubmittedAttempt({
      tenantId: actor.tenantId,
      studentId: refreshed.studentId,
      activityId: refreshed.activityId,
      subjectId: refreshed.activity.subjectId,
      topicId: refreshed.activity.topicId,
      attemptId: refreshed.id,
      score,
      totalPossibleScore,
      submittedAt,
    });

    await this.auditService.record({
      action: 'submit',
      resource: LEARNING_AUDIT_RESOURCES.ATTEMPT,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: refreshed.id,
      after: {
        sessionId: refreshed.sessionId,
        activityId: refreshed.activityId,
        studentId: refreshed.studentId,
        score,
        accuracy,
      },
    });

    const submitted = await this.findStudentAttempt(actor, attemptId);
    return this.toAttemptResponse(submitted);
  }

  private async findStudentAttempt(actor: AuthContext, attemptId: string) {
    const student = await this.accessService.resolveActorStudent(actor);
    const attempt = await this.prisma.learningAttempt.findFirst({
      where: {
        id: attemptId,
        tenantId: actor.tenantId,
        studentId: student.id,
      },
      include: attemptInclude(),
    });

    if (!attempt) {
      throw new NotFoundException('Learning attempt not found');
    }

    if (attempt.session.expiresAt <= new Date()) {
      throw new ForbiddenException('Learning session has expired');
    }

    return attempt;
  }

  private async saveAnswers(
    tenantId: string,
    attemptId: string,
    answers: LearningAnswerDto[],
    validQuestionIds: Set<string>,
  ) {
    for (const answer of answers) {
      if (!validQuestionIds.has(answer.questionId)) {
        throw new ForbiddenException(
          'Question does not belong to this attempt',
        );
      }

      await this.prisma.learningAnswer.upsert({
        where: {
          tenantId_attemptId_questionId: {
            tenantId,
            attemptId,
            questionId: answer.questionId,
          },
        },
        create: {
          tenantId,
          attemptId,
          questionId: answer.questionId,
          answer: toJsonOrNull(answer.answer),
        },
        update: {
          answer: toJsonOrNull(answer.answer),
          answeredAt: new Date(),
        },
      });
    }
  }

  private toAttemptResponse(attempt: LearningAttemptDetail) {
    return {
      id: attempt.id,
      sessionId: attempt.sessionId,
      activityId: attempt.activityId,
      studentId: attempt.studentId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      score: money(attempt.score),
      accuracy: money(attempt.accuracy),
      timeSpentSeconds: attempt.timeSpentSeconds,
      hintsUsed: attempt.hintsUsed,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      answers: attempt.answers.map((answer: LearningAttemptAnswerDetail) => ({
        id: answer.id,
        questionId: answer.questionId,
        answer: answer.answer,
        isCorrect: answer.isCorrect,
        score: money(answer.score),
        answeredAt: answer.answeredAt,
      })),
    };
  }
}

export function attemptInclude() {
  return {
    session: true,
    activity: {
      include: {
        questions: { orderBy: [{ sortOrder: 'asc' as const }] },
      },
    },
    answers: true,
  };
}

type LearningAttemptDetail = Prisma.LearningAttemptGetPayload<{
  include: ReturnType<typeof attemptInclude>;
}>;
type LearningAttemptAnswerDetail = LearningAttemptDetail['answers'][number];

function toJsonOrNull(value: unknown) {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
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
