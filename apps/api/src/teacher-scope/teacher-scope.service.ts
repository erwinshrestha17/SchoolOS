import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssessmentType,
  TeacherAssignmentComponentScope,
  TeacherAssignmentType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAPABILITY_RULES,
  TeacherCapability,
  type TeacherRecordStatus,
} from './teacher-capability';

export interface TeacherScopeGrant {
  source: 'ASSIGNMENT' | 'DELEGATION';
  assignmentId: string;
  componentScope: TeacherAssignmentComponentScope | null;
  /**
   * Which assignment family satisfied the request. Callers use this to label
   * the action ("acting as Class Teacher") and to decide how much of a
   * record to return.
   */
  assignmentType: TeacherAssignmentType | null;
}

export interface RequireTeacherAccessParams {
  tenantId: string;
  staffId: string;
  /**
   * Omit only when the calling path genuinely carries no year (e.g. a
   * correction request resolved from a student record). Omitting matches
   * assignments in any year for that class/section -- it never widens beyond
   * tenant + staff + class + section.
   */
  academicYearId?: string;
  classId: string;
  sectionId: string;
  subjectId?: string;
  /** AssessmentComponent.type of the record being touched, when relevant. */
  componentType?: AssessmentType;
  capability: TeacherCapability;
  /**
   * The staff member who authored the record being touched. Required for
   * capabilities whose rule sets `requiresRecordOwnership`; a mismatch is
   * denied even when the caller teaches the subject, which is what stops
   * co-teachers overwriting each other.
   */
  recordOwnerStaffId?: string | null;
  /**
   * Normalized lifecycle status of the record. Gates both the Class Teacher's
   * non-draft-only visibility and write-after-submit attempts.
   */
  recordStatus?: TeacherRecordStatus | null;
  /**
   * The date the record applies to (attendance date, homework assigned date,
   * marks entry date). Defaults to now. An assignment that had ended by this
   * date does not authorize the action.
   */
  effectiveOn?: Date;
}

/** A single active assignment, flattened for callers and the UI. */
export interface TeacherAssignmentScope {
  assignmentId: string;
  assignmentType: TeacherAssignmentType;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string | null;
  componentScope: TeacherAssignmentComponentScope | null;
  isPrimary: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  source: 'ASSIGNMENT' | 'DELEGATION';
}

const DENIAL_MESSAGE = 'You are not authorized for this teaching scope';

/**
 * Canonical Teacher authorization resolver (Teacher Persona spec sections
 * B2/B3/17/18). This is the single place that answers "does this teacher have
 * an active assignment or delegation covering this exact
 * tenant+year+class+section+subject+component+capability" -- callers must
 * not re-derive that answer from Section.classTeacherId or
 * SubjectTeacherAssignment directly.
 *
 * The authorization principle it implements:
 *
 *   Subject ownership grants academic WRITE access.
 *   Class Teacher responsibility grants broader class-level READ access and
 *   limited homeroom-management WRITE access.
 *
 * Primary invariant: no active assignment (or delegation) means no access. On
 * any mismatch this throws a single generic ForbiddenException -- it never
 * reveals *why* (wrong section vs. wrong subject vs. nothing exists at all),
 * so probing can't be used to enumerate scope.
 *
 * Note on tenancy: SchoolOS has no separate School entity; `tenantId` IS the
 * school boundary (see AGENTS.md). Every query here is tenant-scoped, so
 * cross-school access is structurally impossible rather than rule-based.
 */
@Injectable()
export class TeacherScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Resolves the caller's active Staff row. Inactive/missing staff -> null. */
  async resolveActiveStaffId(actor: AuthContext): Promise<string | null> {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    return staff?.id ?? null;
  }

  /**
   * Non-throwing counterpart to `requireAccess`. Use this to decide what to
   * render or which rows to include; use `requireAccess` to authorize an
   * actual operation.
   */
  async canAccess(
    params: RequireTeacherAccessParams,
    actor?: AuthContext,
  ): Promise<TeacherScopeGrant | null> {
    return this.resolveGrant(params, actor, { audit: false });
  }

  /**
   * Same rules, but satisfied by an assignment covering ANY section of the
   * class. Only for legacy call sites whose record carries no sectionId --
   * historically meaning "every section of this class". Prefer the
   * section-precise `canAccess` for anything new.
   */
  async canAccessAnySectionOfClass(
    params: Omit<RequireTeacherAccessParams, 'sectionId'>,
    actor?: AuthContext,
  ): Promise<TeacherScopeGrant | null> {
    return this.resolveGrant(
      { ...params, sectionId: undefined as unknown as string },
      actor,
      { audit: false },
    );
  }

  async requireAccess(
    params: RequireTeacherAccessParams,
    actor?: AuthContext,
  ): Promise<TeacherScopeGrant> {
    const grant = await this.resolveGrant(params, actor, { audit: true });
    if (!grant) {
      throw new ForbiddenException(DENIAL_MESSAGE);
    }
    return grant;
  }

  private async resolveGrant(
    params: RequireTeacherAccessParams,
    actor: AuthContext | undefined,
    options: { audit: boolean },
  ): Promise<TeacherScopeGrant | null> {
    const rule = CAPABILITY_RULES[params.capability];
    const now = params.effectiveOn ?? new Date();

    // Lifecycle gate. Checked before any assignment lookup because it applies
    // regardless of who is asking: a status the capability does not cover is
    // simply not reachable through that capability.
    if (
      rule.visibleRecordStatuses &&
      params.recordStatus &&
      !rule.visibleRecordStatuses.includes(params.recordStatus)
    ) {
      if (options.audit) await this.recordDenial(params, actor, 'lifecycle');
      return null;
    }

    // Record-ownership gate. `requiresRecordOwnership` capabilities are for
    // acting on your own work; teaching the subject is necessary but not
    // sufficient.
    if (
      rule.requiresRecordOwnership &&
      params.recordOwnerStaffId != null &&
      params.recordOwnerStaffId !== params.staffId
    ) {
      if (options.audit) await this.recordDenial(params, actor, 'ownership');
      return null;
    }

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId: params.tenantId,
        staffId: params.staffId,
        ...(params.academicYearId
          ? { academicYearId: params.academicYearId }
          : {}),
        classId: params.classId,
        // Omitted entirely (rather than matched) when the caller asked about
        // the whole class -- see canAccessAnySectionOfClass.
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        status: 'ACTIVE',
        assignmentType: { in: rule.allowedAssignmentTypes },
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
      },
    });

    const matchingAssignment = assignments.find((assignment) =>
      this.matchesScope(assignment, rule, params),
    );

    if (matchingAssignment) {
      return {
        source: 'ASSIGNMENT',
        assignmentId: matchingAssignment.id,
        componentScope: matchingAssignment.componentScope,
        assignmentType: matchingAssignment.assignmentType,
      };
    }

    const delegations = await this.prisma.teacherDelegation.findMany({
      where: {
        tenantId: params.tenantId,
        recipientStaffId: params.staffId,
        classId: params.classId,
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        status: 'ACTIVE',
        effectiveFrom: { lte: now },
        effectiveUntil: { gte: now },
      },
    });

    const matchingDelegation = delegations.find(
      (delegation) =>
        delegation.allowedCapabilities.includes(params.capability) &&
        this.matchesScope(delegation, rule, params),
    );

    if (matchingDelegation) {
      return {
        source: 'DELEGATION',
        assignmentId: matchingDelegation.id,
        componentScope: matchingDelegation.componentScope,
        assignmentType: null,
      };
    }

    if (options.audit) await this.recordDenial(params, actor, 'no_assignment');
    return null;
  }

  private async recordDenial(
    params: RequireTeacherAccessParams,
    actor: AuthContext | undefined,
    reason: 'lifecycle' | 'ownership' | 'no_assignment',
  ) {
    await this.auditService.record({
      action: 'teacher_scope.denied',
      resource: params.capability,
      tenantId: params.tenantId,
      userId: actor?.userId,
      resourceId: `${params.classId}:${params.sectionId}:${params.subjectId ?? ''}`,
      after: {
        capability: params.capability,
        staffId: params.staffId,
        reason,
        recordStatus: params.recordStatus ?? null,
      },
    });
  }

  private matchesScope(
    record: {
      subjectId: string | null;
      componentScope: TeacherAssignmentComponentScope | null;
    },
    rule: (typeof CAPABILITY_RULES)[TeacherCapability],
    params: RequireTeacherAccessParams,
  ): boolean {
    // EXACT: the assignment's subject must be the requested subject. This is
    // what confines a Mathematics teacher to Mathematics in a class they also
    // happen to be the Class Teacher of.
    if (
      rule.subjectMatch === 'EXACT' &&
      record.subjectId !== (params.subjectId ?? null)
    ) {
      return false;
    }

    // NONE: a homeroom capability. The assignment carries no subject, and a
    // subject-bearing assignment must not satisfy it -- otherwise a Subject
    // Teacher would inherit homeroom write access.
    if (rule.subjectMatch === 'NONE' && record.subjectId !== null) {
      return false;
    }

    // ANY: the class+section match (already applied in the query) is enough;
    // the subject is deliberately not compared. Only paired with READ.

    if (
      params.componentType &&
      record.componentScope &&
      record.componentScope !==
        TeacherAssignmentComponentScope.ALL_COMPONENTS &&
      record.componentScope !==
        (params.componentType as unknown as TeacherAssignmentComponentScope)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Every active assignment for a teacher, newest first. Backs the "Working
   * as" context selector and every scoped option list in the Teacher Web, so
   * the UI never has to guess which classes/subjects are legitimate.
   */
  async listActiveAssignments(
    actor: AuthContext,
    options: { academicYearId?: string; effectiveOn?: Date } = {},
  ): Promise<TeacherAssignmentScope[]> {
    const staffId = await this.resolveActiveStaffId(actor);
    if (!staffId) return [];

    const now = options.effectiveOn ?? new Date();

    const [assignments, delegations] = await Promise.all([
      this.prisma.teacherAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId,
          status: 'ACTIVE',
          ...(options.academicYearId
            ? { academicYearId: options.academicYearId }
            : {}),
          effectiveFrom: { lte: now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
        },
        orderBy: [{ assignmentType: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.teacherDelegation.findMany({
        where: {
          tenantId: actor.tenantId,
          recipientStaffId: staffId,
          status: 'ACTIVE',
          ...(options.academicYearId
            ? { academicYearId: options.academicYearId }
            : {}),
          effectiveFrom: { lte: now },
          effectiveUntil: { gte: now },
        },
      }),
    ]);

    return [
      ...assignments.map((assignment) => ({
        assignmentId: assignment.id,
        assignmentType: assignment.assignmentType,
        academicYearId: assignment.academicYearId,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
        componentScope: assignment.componentScope,
        isPrimary: assignment.isPrimary,
        effectiveFrom: assignment.effectiveFrom,
        effectiveUntil: assignment.effectiveUntil,
        source: 'ASSIGNMENT' as const,
      })),
      // A temporary substitution is a real, time-bounded teaching scope, so
      // it belongs in the selector alongside permanent assignments -- clearly
      // marked, and it disappears on its own when `effectiveUntil` passes.
      ...delegations.map((delegation) => ({
        assignmentId: delegation.id,
        assignmentType: TeacherAssignmentType.SUBSTITUTE_TEACHER,
        academicYearId: delegation.academicYearId,
        classId: delegation.classId,
        sectionId: delegation.sectionId,
        subjectId: delegation.subjectId,
        componentScope: delegation.componentScope,
        isPrimary: false,
        effectiveFrom: delegation.effectiveFrom,
        effectiveUntil: delegation.effectiveUntil,
        source: 'DELEGATION' as const,
      })),
    ];
  }

  /**
   * Every class+section combination this teacher touches, from either an
   * assignment or an active delegation.
   *
   * Replaces the hand-rolled "union of SubjectTeacherAssignment rows and
   * Section.classTeacherId rows" that CAS, results and attendance each used
   * to build for themselves. Going through here means all three now honour
   * assignment effective dates and ACTIVE status, which none of the ad hoc
   * versions did.
   */
  async listTeacherClassSectionCombos(
    actor: AuthContext,
    options: { academicYearId?: string } = {},
  ): Promise<Array<{ classId: string; sectionId: string | null }>> {
    const assignments = await this.listActiveAssignments(actor, options);

    const combos = new Map<
      string,
      { classId: string; sectionId: string | null }
    >();
    for (const assignment of assignments) {
      combos.set(`${assignment.classId}:${assignment.sectionId}`, {
        classId: assignment.classId,
        sectionId: assignment.sectionId,
      });
    }
    return [...combos.values()];
  }

  /**
   * Section ids the teacher may read *something* in, split by how much.
   * `homeroomSectionIds` carry cross-subject read; `subjectSectionIds` carry
   * only the subjects listed against them.
   */
  async resolveReadableScope(
    actor: AuthContext,
    options: { academicYearId?: string } = {},
  ) {
    const assignments = await this.listActiveAssignments(actor, options);

    const homeroomSectionIds = new Set<string>();
    const subjectsBySection = new Map<string, Set<string>>();

    for (const assignment of assignments) {
      if (assignment.assignmentType === TeacherAssignmentType.CLASS_TEACHER) {
        homeroomSectionIds.add(assignment.sectionId);
        continue;
      }
      if (!assignment.subjectId) continue;
      const bucket =
        subjectsBySection.get(assignment.sectionId) ?? new Set<string>();
      bucket.add(assignment.subjectId);
      subjectsBySection.set(assignment.sectionId, bucket);
    }

    return {
      assignments,
      homeroomSectionIds,
      subjectsBySection,
      /** Every section the teacher touches at all. */
      allSectionIds: new Set([
        ...homeroomSectionIds,
        ...subjectsBySection.keys(),
      ]),
    };
  }
}
