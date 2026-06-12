import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LearningActivityStatus,
  LearningSessionStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes, randomInt } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LEARNING_AUDIT_RESOURCES,
  LEARNING_SESSION_CODE_LENGTH,
  LEARNING_SESSION_TTL_MINUTES,
} from '../learning.constants';
import { LearningActivityPermissionsService } from '../activities/learning-activity-permissions.service';
import { CreateLearningSessionDto } from './dto/create-learning-session.dto';
import { LearningSessionAccessService } from './learning-session-access.service';

@Injectable()
export class LearningSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: LearningActivityPermissionsService,
    private readonly accessService: LearningSessionAccessService,
    private readonly auditService: AuditService,
  ) {}

  async launchSession(
    activityId: string,
    dto: CreateLearningSessionDto,
    actor: AuthContext,
  ) {
    const activity = await this.prisma.learningActivity.findFirst({
      where: { id: activityId, tenantId: actor.tenantId },
      include: { questions: true },
    });

    if (!activity) {
      throw new NotFoundException('Learning activity not found');
    }

    if (activity.status === LearningActivityStatus.ARCHIVED) {
      throw new ConflictException('Archived learning activity cannot launch');
    }

    const actorStaffId = await this.permissions.resolveTeacherIdForWrite(
      actor,
      activity.teacherId,
    );
    await this.permissions.assertActorCanControlScope(actor, actorStaffId, {
      classId: activity.classId,
      sectionId: activity.sectionId,
      subjectId: activity.subjectId,
      topicId: activity.topicId,
    });

    const sessionCode = await this.generateSessionCode(actor.tenantId);
    const qrToken = randomBytes(32).toString('base64url');
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(
          Date.now() +
            (dto.expiresInMinutes ?? LEARNING_SESSION_TTL_MINUTES) * 60_000,
        );

    if (expiresAt <= new Date()) {
      throw new ConflictException('Session expiry must be in the future');
    }

    const session = await this.prisma.learningSession.create({
      data: {
        tenantId: actor.tenantId,
        activityId: activity.id,
        classId: activity.classId,
        sectionId: activity.sectionId,
        subjectId: activity.subjectId,
        teacherId: actorStaffId,
        mode: dto.mode ?? activity.mode,
        sessionCode,
        qrTokenHash: this.accessService.hashQrToken(qrToken),
        status: LearningSessionStatus.LIVE,
        schoolOnly: dto.schoolOnly ?? true,
        expiresAt,
        teacherHeartbeatAt: new Date(),
      },
      include: sessionDetailInclude(),
    });

    await this.auditService.record({
      action: 'launch',
      resource: LEARNING_AUDIT_RESOURCES.SESSION,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: session.id,
      after: {
        activityId: activity.id,
        classId: activity.classId,
        sectionId: activity.sectionId,
        subjectId: activity.subjectId,
        mode: session.mode,
        expiresAt: session.expiresAt,
      },
    });

    return { ...this.toTeacherSession(session), qrToken };
  }

  async getSession(actor: AuthContext, sessionId: string) {
    if (actor.roles.includes('student')) {
      const { session } = await this.accessService.assertStudentCanUseSession(
        actor,
        sessionId,
      );
      return this.accessService.toSafeStudentSession(session);
    }

    const session = await this.findSessionForStaff(actor, sessionId);
    return this.toTeacherSession(session);
  }

  async pauseSession(actor: AuthContext, sessionId: string) {
    return this.transitionSession(
      actor,
      sessionId,
      LearningSessionStatus.PAUSED,
    );
  }

  async resumeSession(actor: AuthContext, sessionId: string) {
    const session = await this.findSessionForStaff(actor, sessionId);
    if (session.expiresAt <= new Date()) {
      return this.transitionSession(
        actor,
        sessionId,
        LearningSessionStatus.EXPIRED,
      );
    }
    return this.transitionSession(actor, sessionId, LearningSessionStatus.LIVE);
  }

  async endSession(actor: AuthContext, sessionId: string) {
    return this.transitionSession(
      actor,
      sessionId,
      LearningSessionStatus.ENDED,
      {
        endedAt: new Date(),
      },
    );
  }

  async joinSession(
    actor: AuthContext,
    dto: { sessionCode?: string; qrToken?: string },
  ) {
    return this.accessService.joinSession(actor, dto);
  }

  private async transitionSession(
    actor: AuthContext,
    sessionId: string,
    status: LearningSessionStatus,
    extra: { endedAt?: Date } = {},
  ) {
    const existing = await this.findSessionForStaff(actor, sessionId);
    if (
      existing.status === LearningSessionStatus.ENDED ||
      existing.status === LearningSessionStatus.EXPIRED
    ) {
      throw new ConflictException('Learning session is already closed');
    }

    const updated = await this.prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        status,
        teacherHeartbeatAt: new Date(),
        ...(extra.endedAt ? { endedAt: extra.endedAt } : {}),
      },
      include: sessionDetailInclude(),
    });

    await this.auditService.record({
      action: status.toLowerCase(),
      resource: LEARNING_AUDIT_RESOURCES.SESSION,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: sessionId,
      before: { status: existing.status },
      after: { status: updated.status },
    });

    return this.toTeacherSession(updated);
  }

  private async findSessionForStaff(actor: AuthContext, sessionId: string) {
    const session = await this.prisma.learningSession.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      include: sessionDetailInclude(),
    });

    if (!session) {
      throw new NotFoundException('Learning session not found');
    }

    await this.permissions.assertActorCanControlScope(
      actor,
      session.teacherId,
      {
        classId: session.classId,
        sectionId: session.sectionId,
        subjectId: session.subjectId,
      },
    );

    return session;
  }

  private toTeacherSession(session: LearningSessionDetail) {
    return {
      id: session.id,
      activityId: session.activityId,
      classId: session.classId,
      sectionId: session.sectionId,
      subjectId: session.subjectId,
      teacherId: session.teacherId,
      mode: session.mode,
      sessionCode: session.sessionCode,
      status: session.status,
      schoolOnly: session.schoolOnly,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      expiresAt: session.expiresAt,
      teacherHeartbeatAt: session.teacherHeartbeatAt,
      activity: session.activity,
      participantCount: session._count.participants,
      attemptCount: session._count.attempts,
    };
  }

  private async generateSessionCode(tenantId: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = Array.from(
        { length: LEARNING_SESSION_CODE_LENGTH },
        () => SESSION_CODE_ALPHABET[randomInt(0, SESSION_CODE_ALPHABET.length)],
      ).join('');
      const existing = await this.prisma.learningSession.findFirst({
        where: { tenantId, sessionCode: code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }

    throw new ConflictException('Could not generate a learning session code');
  }
}

export function sessionDetailInclude() {
  return {
    activity: {
      include: {
        questions: { orderBy: [{ sortOrder: 'asc' as const }] },
      },
    },
    _count: { select: { participants: true, attempts: true } },
  };
}

type LearningSessionDetail = Prisma.LearningSessionGetPayload<{
  include: ReturnType<typeof sessionDetailInclude>;
}>;

const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
