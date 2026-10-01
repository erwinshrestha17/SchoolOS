import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarkEntryStatus,
  MarkSheetAction,
  MarkSheetStatus,
  Prisma,
  StudentLifecycleStatus,
  type MarkSheet,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  hasDomainPermission,
  requireIndependentActor,
} from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import {
  TeacherScopeService,
  type TeacherScopeGrant,
} from '../teacher-scope/teacher-scope.service';
import {
  ListMarkSheetsDto,
  ReviewMarkSheetDto,
  SubmitMarkSheetDto,
  UnlockMarkSheetDto,
} from './dto/mark-sheet.dto';

/**
 * Phase 6G marks lifecycle, one sheet per assessment component + section:
 *
 *   DRAFT -> SUBMITTED -> REVIEWED -> LOCKED
 *              |  ^          |
 *              v  |          v
 *           RETURNED -> RESUBMITTED
 *
 * Publication, withdrawal and correction of results are carried by report
 * cards (ReportCard version history), so a sheet's lifecycle ends at LOCKED.
 */
export const MARK_SHEET_TRANSITIONS: Readonly<
  Record<
    MarkSheetAction,
    { from: readonly MarkSheetStatus[]; to: MarkSheetStatus }
  >
> = {
  SUBMIT: { from: [MarkSheetStatus.DRAFT], to: MarkSheetStatus.SUBMITTED },
  RESUBMIT: {
    from: [MarkSheetStatus.RETURNED],
    to: MarkSheetStatus.RESUBMITTED,
  },
  RETURN: {
    from: [
      MarkSheetStatus.SUBMITTED,
      MarkSheetStatus.RESUBMITTED,
      MarkSheetStatus.REVIEWED,
    ],
    to: MarkSheetStatus.RETURNED,
  },
  REVIEW: {
    from: [MarkSheetStatus.SUBMITTED, MarkSheetStatus.RESUBMITTED],
    to: MarkSheetStatus.REVIEWED,
  },
  LOCK: { from: [MarkSheetStatus.REVIEWED], to: MarkSheetStatus.LOCKED },
  UNLOCK: { from: [MarkSheetStatus.LOCKED], to: MarkSheetStatus.RETURNED },
};

/** Statuses in which marks may be written by entry teachers. */
export const MARK_SHEET_EDITABLE_STATUSES: readonly MarkSheetStatus[] = [
  MarkSheetStatus.DRAFT,
  MarkSheetStatus.RETURNED,
];

export const MARK_SHEET_NOT_EDITABLE_CODE = 'MARK_SHEET_NOT_EDITABLE';
export const MARK_SHEET_VERSION_CONFLICT_CODE = 'MARK_SHEET_VERSION_CONFLICT';
export const MARK_SHEET_INVALID_TRANSITION_CODE =
  'MARK_SHEET_INVALID_TRANSITION';
export const MARK_SHEET_INCOMPLETE_CODE = 'MARK_SHEET_INCOMPLETE';
export const IDEMPOTENCY_KEY_REUSED_CODE = 'IDEMPOTENCY_KEY_REUSED';

const ACTION_PERMISSION: Record<MarkSheetAction, string> = {
  SUBMIT: 'academics:enter_marks',
  RESUBMIT: 'academics:enter_marks',
  RETURN: 'marks:review_lock',
  REVIEW: 'marks:review_lock',
  LOCK: 'marks:review_lock',
  UNLOCK: 'exam-terms:unlock',
};

export interface MarkSheetScope {
  examTermId: string;
  assessmentComponentId: string;
  subjectId: string;
  classId: string;
  sectionId: string | null;
}

export type MarkSheetView = MarkSheet & {
  allowedActions: MarkSheetAction[];
};

/** Internal signal: the same idempotency key already committed. */
class IdempotentReplay extends Error {
  constructor(
    readonly transition: {
      action: MarkSheetAction;
      actorId: string;
      markSheetId: string;
    },
  ) {
    super('idempotent replay');
  }
}

function sheetNotEditable(sheet: Pick<MarkSheet, 'status' | 'id'>) {
  return new ConflictException({
    statusCode: 409,
    code: MARK_SHEET_NOT_EDITABLE_CODE,
    markSheetId: sheet.id,
    status: sheet.status,
    message:
      sheet.status === MarkSheetStatus.LOCKED
        ? 'These marks are locked. Request a correction to change them.'
        : 'These marks have been submitted for review and can no longer be edited. Ask the reviewer to return the sheet if a change is needed.',
  });
}

@Injectable()
export class MarkSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly teacherScopeService: TeacherScopeService,
  ) {}

  /**
   * Returns the sheet for a component/section, creating a DRAFT one on first
   * use. Safe under concurrency: a losing create re-reads the winner.
   */
  async ensureSheet(
    client: Prisma.TransactionClient,
    tenantId: string,
    scope: MarkSheetScope,
  ): Promise<MarkSheet> {
    const where = {
      tenantId,
      assessmentComponentId: scope.assessmentComponentId,
      sectionId: scope.sectionId,
    };
    const existing = await client.markSheet.findFirst({ where });
    if (existing) return existing;
    try {
      return await client.markSheet.create({
        data: { tenantId, ...scope },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await client.markSheet.findFirst({ where });
        if (winner) return winner;
      }
      throw error;
    }
  }

  /**
   * Claims a sheet for a mark write inside the caller's transaction. Only
   * DRAFT/RETURNED sheets can be written (unless `allowLockedCorrection` is
   * set by an approved report-card correction). The version bump row-locks
   * the sheet, so a submit/lock that commits first makes this write fail with
   * a clear 409 instead of silently changing submitted marks.
   */
  async claimForMarkWrite(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sheet: MarkSheet,
    options: { allowLockedCorrection?: boolean } = {},
  ): Promise<void> {
    const claimed = await tx.markSheet.updateMany({
      where: {
        id: sheet.id,
        tenantId,
        ...(options.allowLockedCorrection
          ? {}
          : { status: { in: [...MARK_SHEET_EDITABLE_STATUSES] } }),
      },
      data: { version: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      const current = await tx.markSheet.findFirst({
        where: { id: sheet.id, tenantId },
        select: { id: true, status: true },
      });
      throw sheetNotEditable(current ?? sheet);
    }
  }

  async list(dto: ListMarkSheetsDto, actor: AuthContext) {
    const sheets = await this.prisma.markSheet.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
        ...(dto.classId ? { classId: dto.classId } : {}),
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
        ...(dto.assessmentComponentId
          ? { assessmentComponentId: dto.assessmentComponentId }
          : {}),
        ...(dto.status ? { status: dto.status as MarkSheetStatus } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 500,
    });
    const visible: MarkSheetView[] = [];
    for (const sheet of sheets) {
      if (!(await this.canRead(sheet, actor))) continue;
      visible.push({
        ...sheet,
        allowedActions: this.allowedActions(sheet, actor),
      });
    }
    return { items: visible };
  }

  async get(id: string, actor: AuthContext): Promise<MarkSheetView> {
    const sheet = await this.findOrThrow(this.prisma, id, actor);
    if (!(await this.canRead(sheet, actor))) {
      throw new NotFoundException('Mark sheet not found');
    }
    return { ...sheet, allowedActions: this.allowedActions(sheet, actor) };
  }

  async history(id: string, actor: AuthContext) {
    await this.get(id, actor);
    return this.prisma.markSheetTransition.findMany({
      where: { tenantId: actor.tenantId, markSheetId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        actorId: true,
        reason: true,
        sheetVersion: true,
        createdAt: true,
      },
      take: 200,
    });
  }

  /** Teacher (or entry clerk) submits a DRAFT sheet or resubmits a RETURNED one. */
  async submit(id: string, dto: SubmitMarkSheetDto, actor: AuthContext) {
    const sheet = await this.findOrThrow(this.prisma, id, actor);
    const action =
      sheet.status === MarkSheetStatus.RETURNED
        ? MarkSheetAction.RESUBMIT
        : MarkSheetAction.SUBMIT;
    const replay = await this.findReplay(sheet.id, dto.idempotencyKey, actor);
    if (replay) return this.replayResult(replay, action, actor);
    const grant = await this.assertTeacherScope(sheet, actor);
    await this.assertComplete(sheet, actor);
    return this.transition(sheet, action, dto, actor, {
      assignmentId: grant?.assignmentId ?? null,
      eligibilityAssessmentId: grant?.eligibilityAssessmentId ?? null,
    });
  }

  /** Reviewer returns, reviews or locks a sheet (marks:review_lock). */
  async review(id: string, dto: ReviewMarkSheetDto, actor: AuthContext) {
    const sheet = await this.findOrThrow(this.prisma, id, actor);
    const action = MarkSheetAction[dto.action];
    const replay = await this.findReplay(sheet.id, dto.idempotencyKey, actor);
    if (replay) return this.replayResult(replay, action, actor);
    if (action === MarkSheetAction.RETURN && !dto.reason?.trim()) {
      throw new ConflictException({
        statusCode: 409,
        code: 'MARK_SHEET_RETURN_REASON_REQUIRED',
        message: 'Explain what must change before returning these marks.',
      });
    }
    // Separation of duties: whoever submitted the marks cannot review or
    // lock them. Also enforced by MarkSheet_*_not_submitter_check.
    requireIndependentActor(actor, [sheet.submittedById]);
    if (action === MarkSheetAction.LOCK) {
      await this.assertComplete(sheet, actor);
    }
    return this.transition(sheet, action, dto, actor);
  }

  /** Elevated unlock of a LOCKED sheet back to RETURNED (reason required). */
  async unlock(id: string, dto: UnlockMarkSheetDto, actor: AuthContext) {
    const sheet = await this.findOrThrow(this.prisma, id, actor);
    const replay = await this.findReplay(sheet.id, dto.idempotencyKey, actor);
    if (replay) return this.replayResult(replay, MarkSheetAction.UNLOCK, actor);
    const term = await this.prisma.examTerm.findFirst({
      where: { id: sheet.examTermId, tenantId: actor.tenantId },
      select: { isLocked: true },
    });
    if (term?.isLocked) {
      throw new ConflictException({
        statusCode: 409,
        code: 'EXAM_TERM_LOCKED',
        message:
          'The whole exam term is locked. Unlock the term before unlocking a single mark sheet.',
      });
    }
    return this.transition(sheet, MarkSheetAction.UNLOCK, dto, actor);
  }

  allowedActions(sheet: MarkSheet, actor: AuthContext): MarkSheetAction[] {
    return (Object.keys(MARK_SHEET_TRANSITIONS) as MarkSheetAction[]).filter(
      (action) => {
        if (!MARK_SHEET_TRANSITIONS[action].from.includes(sheet.status)) {
          return false;
        }
        if (!hasDomainPermission(actor, ACTION_PERMISSION[action])) {
          return false;
        }
        if (
          (action === MarkSheetAction.RETURN ||
            action === MarkSheetAction.REVIEW ||
            action === MarkSheetAction.LOCK) &&
          sheet.submittedById === actor.userId
        ) {
          return false;
        }
        return true;
      },
    );
  }

  private async transition(
    sheet: MarkSheet,
    action: MarkSheetAction,
    dto: { expectedVersion: number; idempotencyKey: string; reason?: string },
    actor: AuthContext,
    authority: {
      assignmentId: string | null;
      eligibilityAssessmentId: string | null;
    } = { assignmentId: null, eligibilityAssessmentId: null },
  ): Promise<MarkSheetView> {
    if (!hasDomainPermission(actor, ACTION_PERMISSION[action])) {
      throw new ForbiddenException({
        code: 'DOMAIN_AUTHORIZATION_DENIED',
        message: 'You are not authorized for this school action',
      });
    }
    const rule = MARK_SHEET_TRANSITIONS[action];
    const now = new Date();
    const reason = dto.reason?.trim() || null;
    const data: Prisma.MarkSheetUpdateManyMutationInput = {
      status: rule.to,
      version: { increment: 1 },
    };
    switch (action) {
      case MarkSheetAction.SUBMIT:
      case MarkSheetAction.RESUBMIT:
        Object.assign(data, {
          submittedById: actor.userId,
          submittedAt: now,
          returnReason: null,
          reviewedById: null,
          reviewedAt: null,
        });
        break;
      case MarkSheetAction.RETURN:
      case MarkSheetAction.UNLOCK:
        Object.assign(data, {
          returnedById: actor.userId,
          returnedAt: now,
          returnReason: reason,
          reviewedById: null,
          reviewedAt: null,
          lockedById: null,
          lockedAt: null,
        });
        break;
      case MarkSheetAction.REVIEW:
        Object.assign(data, { reviewedById: actor.userId, reviewedAt: now });
        break;
      case MarkSheetAction.LOCK:
        Object.assign(data, { lockedById: actor.userId, lockedAt: now });
        break;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (action === MarkSheetAction.UNLOCK) {
          // Claim the exam-term row while it is unlocked; serializes with a
          // concurrent term-lock approval so a sheet cannot be reopened
          // inside a term that has just been locked.
          const termClaim = await tx.examTerm.updateMany({
            where: {
              id: sheet.examTermId,
              tenantId: actor.tenantId,
              isLocked: false,
            },
            data: { updatedAt: now },
          });
          if (termClaim.count !== 1) {
            throw new ConflictException({
              statusCode: 409,
              code: 'EXAM_TERM_LOCKED',
              message:
                'The whole exam term is locked. Unlock the term before unlocking a single mark sheet.',
            });
          }
        }
        const updated = await tx.markSheet.updateMany({
          where: {
            id: sheet.id,
            tenantId: actor.tenantId,
            status: { in: [...rule.from] },
            version: dto.expectedVersion,
          },
          data,
        });
        if (updated.count !== 1) {
          // A concurrent retry with this key may have committed while we
          // waited for the row lock: that is a replay, not a conflict.
          const committed = await tx.markSheetTransition.findFirst({
            where: {
              tenantId: actor.tenantId,
              markSheetId: sheet.id,
              idempotencyKey: dto.idempotencyKey,
            },
          });
          if (committed) throw new IdempotentReplay(committed);
          const current = await tx.markSheet.findFirst({
            where: { id: sheet.id, tenantId: actor.tenantId },
            select: { status: true, version: true },
          });
          if (current && !rule.from.includes(current.status)) {
            throw new ConflictException({
              statusCode: 409,
              code: MARK_SHEET_INVALID_TRANSITION_CODE,
              status: current.status,
              message: `These marks are ${current.status.toLowerCase()} and cannot be ${action.toLowerCase()}ed now.`,
            });
          }
          throw new ConflictException({
            statusCode: 409,
            code: MARK_SHEET_VERSION_CONFLICT_CODE,
            currentVersion: current?.version ?? null,
            message:
              'Someone else changed these marks. Reload the sheet and try again.',
          });
        }
        const after = await tx.markSheet.findFirstOrThrow({
          where: { id: sheet.id, tenantId: actor.tenantId },
        });

        // Keep the per-entry lock flag (read by existing correction and
        // retake gates) aligned with the sheet lock.
        if (
          action === MarkSheetAction.LOCK ||
          action === MarkSheetAction.UNLOCK
        ) {
          await tx.markEntry.updateMany({
            where: {
              tenantId: actor.tenantId,
              assessmentComponentId: sheet.assessmentComponentId,
              student: { sectionId: sheet.sectionId },
            },
            data: { isLocked: action === MarkSheetAction.LOCK },
          });
        }

        await tx.markSheetTransition.create({
          data: {
            tenantId: actor.tenantId,
            markSheetId: sheet.id,
            action,
            fromStatus: sheet.status,
            toStatus: rule.to,
            actorId: actor.userId,
            reason,
            idempotencyKey: dto.idempotencyKey,
            sheetVersion: after.version,
            assignmentId: authority.assignmentId,
            eligibilityAssessmentId: authority.eligibilityAssessmentId,
          },
        });
        await this.auditService.record(
          {
            action: `ACADEMICS_MARK_SHEET_${action}`,
            resource: 'mark_sheet',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: sheet.id,
            before: { status: sheet.status, version: sheet.version },
            after: { status: after.status, version: after.version, reason },
          },
          tx,
        );
        return { ...after, allowedActions: this.allowedActions(after, actor) };
      });
    } catch (error) {
      if (error instanceof IdempotentReplay) {
        return this.replayResult(error.transition, action, actor);
      }
      // A concurrent retry with the same idempotency key won the race: return
      // its outcome rather than an error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.findReplay(
          sheet.id,
          dto.idempotencyKey,
          actor,
        );
        if (replay) return this.replayResult(replay, action, actor);
      }
      throw error;
    }
  }

  private async findReplay(
    markSheetId: string,
    idempotencyKey: string,
    actor: AuthContext,
  ) {
    return this.prisma.markSheetTransition.findFirst({
      where: { tenantId: actor.tenantId, markSheetId, idempotencyKey },
    });
  }

  private async replayResult(
    replay: { action: MarkSheetAction; actorId: string; markSheetId: string },
    action: MarkSheetAction,
    actor: AuthContext,
  ): Promise<MarkSheetView> {
    if (replay.action !== action || replay.actorId !== actor.userId) {
      throw new ConflictException({
        statusCode: 409,
        code: IDEMPOTENCY_KEY_REUSED_CODE,
        message: 'This request key was already used for a different action.',
      });
    }
    const sheet = await this.findOrThrow(
      this.prisma,
      replay.markSheetId,
      actor,
    );
    return { ...sheet, allowedActions: this.allowedActions(sheet, actor) };
  }

  /** Every active student on the sheet has a final (non-draft) entry. */
  private async assertComplete(sheet: MarkSheet, actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: sheet.classId,
        sectionId: sheet.sectionId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: { id: true },
    });
    const entries = await this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        assessmentComponentId: sheet.assessmentComponentId,
        studentId: { in: students.map((student) => student.id) },
      },
      select: { studentId: true, status: true },
    });
    const finalStudentIds = new Set(
      entries
        .filter((entry) => entry.status !== MarkEntryStatus.DRAFT)
        .map((entry) => entry.studentId),
    );
    const missing = students.filter(
      (student) => !finalStudentIds.has(student.id),
    ).length;
    if (students.length === 0 || missing > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: MARK_SHEET_INCOMPLETE_CODE,
        missingOrDraftCount: missing,
        studentCount: students.length,
        message:
          students.length === 0
            ? 'There are no active students on this sheet.'
            : `${missing} student(s) still have no final mark. Enter a mark or mark them absent/withheld before submitting.`,
      });
    }
  }

  private async assertTeacherScope(
    sheet: MarkSheet,
    actor: AuthContext,
  ): Promise<TeacherScopeGrant | null> {
    const isTeacher =
      actor.roles.includes('teacher') ||
      actor.roles.includes('subject_teacher');
    const isExempt = ['admin', 'principal'].some((role) =>
      actor.roles.includes(role),
    );
    if (!isTeacher || isExempt) return null;
    const component = await this.prisma.assessmentComponent.findFirst({
      where: { id: sheet.assessmentComponentId, tenantId: actor.tenantId },
      select: { type: true, examTerm: { select: { academicYearId: true } } },
    });
    if (!component || !sheet.sectionId) {
      return this.teacherScopeService.denyActorAccess(
        {
          capability: TeacherCapability.MARKS_ENTER,
          reason: 'missing_scope',
          classId: sheet.classId,
          subjectId: sheet.subjectId,
        },
        actor,
      );
    }
    // Same eligibility-aware gate as mark entry: an assignment whose
    // professional eligibility lapsed cannot submit.
    return this.teacherScopeService.requireActorAccess(
      {
        academicYearId: component.examTerm.academicYearId,
        classId: sheet.classId,
        sectionId: sheet.sectionId,
        subjectId: sheet.subjectId,
        componentType: component.type,
        capability: TeacherCapability.MARKS_ENTER,
      },
      actor,
    );
  }

  private async canRead(sheet: MarkSheet, actor: AuthContext) {
    const isTeacher =
      actor.roles.includes('teacher') ||
      actor.roles.includes('subject_teacher');
    const isExempt = ['admin', 'principal'].some((role) =>
      actor.roles.includes(role),
    );
    if (
      !isTeacher ||
      isExempt ||
      hasDomainPermission(actor, 'marks:review_lock')
    ) {
      return true;
    }
    if (!sheet.sectionId) return false;
    const grant = await this.teacherScopeService.canActorAccess(
      {
        classId: sheet.classId,
        sectionId: sheet.sectionId,
        subjectId: sheet.subjectId,
        capability: TeacherCapability.MARKS_ENTER,
      },
      actor,
    );
    return Boolean(grant);
  }

  private async findOrThrow(
    client: Prisma.TransactionClient,
    id: string,
    actor: AuthContext,
  ) {
    const sheet = await client.markSheet.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!sheet) throw new NotFoundException('Mark sheet not found');
    return sheet;
  }
}
