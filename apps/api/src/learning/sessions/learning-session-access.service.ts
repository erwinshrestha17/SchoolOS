import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LearningParticipantStatus,
  LearningSessionStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { JoinLearningSessionDto } from './dto/join-learning-session.dto';

@Injectable()
export class LearningSessionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async joinSession(actor: AuthContext, dto: JoinLearningSessionDto) {
    const student = await this.resolveActorStudent(actor);
    const session = await this.findJoinableSession(actor, dto);
    await this.assertStudentCanUseSessionRecord(actor, student, session);

    const participant = await this.prisma.learningParticipant.upsert({
      where: {
        tenantId_sessionId_studentId: {
          tenantId: actor.tenantId,
          sessionId: session.id,
          studentId: student.id,
        },
      },
      create: {
        tenantId: actor.tenantId,
        sessionId: session.id,
        studentId: student.id,
        status: LearningParticipantStatus.JOINED,
      },
      update: {
        status: LearningParticipantStatus.JOINED,
        leftAt: null,
      },
    });

    return {
      participant,
      session: this.toSafeStudentSession(session),
    };
  }

  async assertStudentCanUseSession(actor: AuthContext, sessionId: string) {
    const student = await this.resolveActorStudent(actor);
    const session = await this.prisma.learningSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      include: studentSessionInclude(),
    });
    if (!session) {
      throw new NotFoundException('Learning session not found');
    }

    await this.assertStudentCanUseSessionRecord(actor, student, session);
    return { student, session };
  }

  toSafeStudentSession(session: StudentSessionRecord) {
    return {
      id: session.id,
      activityId: session.activityId,
      classId: session.classId,
      sectionId: session.sectionId,
      subjectId: session.subjectId,
      mode: session.mode,
      status: session.status,
      schoolOnly: session.schoolOnly,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      activity: {
        id: session.activity.id,
        title: session.activity.title,
        description: session.activity.description,
        difficulty: session.activity.difficulty,
        languageMode: session.activity.languageMode,
        estimatedMinutes: session.activity.estimatedMinutes,
        questions: session.activity.questions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          points: question.points,
          sortOrder: question.sortOrder,
        })),
      },
    };
  }

  async resolveActorStudent(actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: { id: true, classId: true, sectionId: true },
    });

    if (!student) {
      throw new ForbiddenException('Active student profile is required');
    }

    return student;
  }

  hashQrToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findJoinableSession(
    actor: AuthContext,
    dto: JoinLearningSessionDto,
  ) {
    const normalizedCode = dto.sessionCode?.trim().toUpperCase();
    const qrTokenHash = dto.qrToken ? this.hashQrToken(dto.qrToken) : undefined;

    if (!normalizedCode && !qrTokenHash) {
      throw new BadRequestException('Session code or QR token is required');
    }

    const session = await this.prisma.learningSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        OR: [
          ...(normalizedCode ? [{ sessionCode: normalizedCode }] : []),
          ...(qrTokenHash ? [{ qrTokenHash }] : []),
        ],
      },
      include: studentSessionInclude(),
    });

    if (!session) {
      throw new NotFoundException('Learning session not found');
    }

    return session;
  }

  private async assertStudentCanUseSessionRecord(
    actor: AuthContext,
    student: { id: string; classId: string; sectionId: string | null },
    session: StudentSessionRecord,
  ) {
    if (session.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Learning session access denied');
    }

    if (session.status !== LearningSessionStatus.LIVE) {
      throw new ForbiddenException('Learning session is not live');
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.learningSession.update({
        where: { id: session.id },
        data: { status: LearningSessionStatus.EXPIRED },
      });
      throw new ForbiddenException('Learning session has expired');
    }

    if (student.classId !== session.classId) {
      throw new ForbiddenException('Learning session is for another class');
    }

    if (session.sectionId && student.sectionId !== session.sectionId) {
      throw new ForbiddenException('Learning session is for another section');
    }

    if (!session.schoolOnly) {
      throw new ForbiddenException(
        'Learning session policy is not school-only',
      );
    }
  }
}

export function studentSessionInclude() {
  return {
    activity: {
      include: {
        questions: { orderBy: [{ sortOrder: 'asc' as const }] },
      },
    },
  };
}

interface StudentSessionRecord {
  id: string;
  tenantId: string;
  activityId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  mode: string;
  status: LearningSessionStatus;
  schoolOnly: boolean;
  startedAt: Date;
  expiresAt: Date;
  activity: {
    id: string;
    title: string;
    description: string | null;
    difficulty: string;
    languageMode: string;
    estimatedMinutes: number | null;
    questions: Array<{
      id: string;
      type: string;
      prompt: string;
      options: unknown;
      points: number;
      sortOrder: number;
    }>;
  };
}
