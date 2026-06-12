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
import { ListLearningSessionsDto } from './dto/list-learning-sessions.dto';
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

  async listSessions(actor: AuthContext, query: ListLearningSessionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LearningSessionWhereInput = {
      tenantId: actor.tenantId,
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.activityId ? { activityId: query.activityId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startedFrom || query.startedTo
        ? {
            startedAt: {
              ...(query.startedFrom
                ? { gte: new Date(query.startedFrom) }
                : {}),
              ...(query.startedTo ? { lte: new Date(query.startedTo) } : {}),
            },
          }
        : {}),
    };

    if (isSchoolAdmin(actor)) {
      if (query.teacherId) {
        where.teacherId = query.teacherId;
      }
    } else {
      const actorStaffId = await this.permissions.resolveActorStaffId(actor);
      if (!actorStaffId) {
        return { items: [], total: 0, page, limit };
      }
      where.teacherId = actorStaffId;
    }

    const [items, total] = await Promise.all([
      this.prisma.learningSession.findMany({
        where,
        include: sessionListInclude(),
        orderBy: [{ startedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.learningSession.count({ where }),
    ]);

    const expiredIds = items
      .filter((session) => isExpiredOpenSession(session))
      .map((session) => session.id);

    if (expiredIds.length) {
      await this.prisma.learningSession.updateMany({
        where: { tenantId: actor.tenantId, id: { in: expiredIds } },
        data: { status: LearningSessionStatus.EXPIRED },
      });
    }

    return {
      items: items.map((session) =>
        this.toTeacherSessionSummary(
          expiredIds.includes(session.id)
            ? { ...session, status: LearningSessionStatus.EXPIRED }
            : session,
        ),
      ),
      total,
      page,
      limit,
    };
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
    if (isExpiredOpenSession(session)) {
      const expired = await this.expireSession(session.id);
      return this.toTeacherSession(expired);
    }
    return this.toTeacherSession(session);
  }

  async heartbeatSession(actor: AuthContext, sessionId: string) {
    const session = await this.findSessionForStaff(actor, sessionId);
    if (isExpiredOpenSession(session)) {
      const expired = await this.expireSession(session.id);
      return this.toTeacherSession(expired);
    }
    if (session.status !== LearningSessionStatus.LIVE) {
      throw new ConflictException(
        'Only live learning sessions accept heartbeat',
      );
    }

    const updated = await this.prisma.learningSession.update({
      where: { id: sessionId },
      data: { teacherHeartbeatAt: new Date() },
      include: sessionDetailInclude(),
    });

    return this.toTeacherSession(updated);
  }

  async listParticipants(actor: AuthContext, sessionId: string) {
    const session = await this.findSessionForStaff(actor, sessionId);
    if (isExpiredOpenSession(session)) {
      await this.expireSession(session.id);
    }

    const [participants, attempts] = await Promise.all([
      this.prisma.learningParticipant.findMany({
        where: { tenantId: actor.tenantId, sessionId },
        include: participantInclude(),
        orderBy: [{ joinedAt: 'asc' }],
      }),
      this.prisma.learningAttempt.findMany({
        where: { tenantId: actor.tenantId, sessionId },
        select: {
          id: true,
          studentId: true,
          status: true,
          attemptNumber: true,
          submittedAt: true,
          accuracy: true,
          score: true,
          updatedAt: true,
        },
        orderBy: [{ attemptNumber: 'desc' }],
      }),
    ]);

    return {
      session: this.toTeacherSession(
        isExpiredOpenSession(session)
          ? { ...session, status: LearningSessionStatus.EXPIRED }
          : session,
      ),
      items: participants.map((participant) => {
        const latestAttempt = attempts.find(
          (attempt) => attempt.studentId === participant.studentId,
        );
        return {
          participant: {
            id: participant.id,
            status: participant.status,
            joinedAt: participant.joinedAt,
            leftAt: participant.leftAt,
          },
          student: {
            id: participant.student.id,
            name: [
              participant.student.firstNameEn,
              participant.student.lastNameEn,
            ]
              .filter(Boolean)
              .join(' '),
            classId: participant.student.classId,
            sectionId: participant.student.sectionId,
          },
          attempt: latestAttempt
            ? {
                id: latestAttempt.id,
                status: latestAttempt.status,
                attemptNumber: latestAttempt.attemptNumber,
                submittedAt: latestAttempt.submittedAt,
                accuracy: money(latestAttempt.accuracy),
                score: money(latestAttempt.score),
                lastActivityAt: latestAttempt.updatedAt,
              }
            : null,
        };
      }),
    };
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
    const nextStatus = isExpiredOpenSession(existing)
      ? LearningSessionStatus.EXPIRED
      : status;
    if (
      existing.status === LearningSessionStatus.ENDED ||
      existing.status === LearningSessionStatus.EXPIRED
    ) {
      throw new ConflictException('Learning session is already closed');
    }

    const updated = await this.prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        status: nextStatus,
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

  private async expireSession(sessionId: string) {
    return this.prisma.learningSession.update({
      where: { id: sessionId },
      data: { status: LearningSessionStatus.EXPIRED },
      include: sessionDetailInclude(),
    });
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

  private toTeacherSessionSummary(session: LearningSessionListDetail) {
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
      class: session.class,
      section: session.section,
      subject: session.subject,
      participantCount: session._count.participants,
      attemptCount: session._count.attempts,
      submittedCount: countSubmittedAttempts(session.attempts),
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

export function sessionListInclude() {
  return {
    activity: {
      select: {
        id: true,
        title: true,
        difficulty: true,
        mode: true,
        status: true,
        estimatedMinutes: true,
      },
    },
    class: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
    subject: { select: { id: true, name: true, code: true } },
    attempts: { select: { status: true } },
    _count: { select: { participants: true, attempts: true } },
  };
}

export function participantInclude() {
  return {
    student: {
      select: {
        id: true,
        firstNameEn: true,
        lastNameEn: true,
        classId: true,
        sectionId: true,
      },
    },
  };
}

type LearningSessionDetail = Prisma.LearningSessionGetPayload<{
  include: ReturnType<typeof sessionDetailInclude>;
}>;
type LearningSessionListDetail = Prisma.LearningSessionGetPayload<{
  include: ReturnType<typeof sessionListInclude>;
}>;

const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function isSchoolAdmin(actor: AuthContext) {
  return actor.roles.some((role) =>
    ['admin', 'principal', 'platform_super_admin'].includes(role),
  );
}

function isExpiredOpenSession(session: {
  status: LearningSessionStatus;
  expiresAt: Date;
}) {
  const closedStatuses: LearningSessionStatus[] = [
    LearningSessionStatus.ENDED,
    LearningSessionStatus.EXPIRED,
  ];
  return (
    !closedStatuses.includes(session.status) && session.expiresAt <= new Date()
  );
}

function countSubmittedAttempts(attempts: Array<{ status: string }>) {
  return attempts.filter((attempt) => attempt.status === 'SUBMITTED').length;
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
