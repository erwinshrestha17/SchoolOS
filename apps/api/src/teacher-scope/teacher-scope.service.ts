import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AssessmentType,
  TeacherAssignmentComponentScope,
  TeacherAssignmentType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  activeTeacherStaffWhere,
  teacherAuthorityWindow,
  teacherRecordDenial,
} from '../authorization/policies/teacher.policy';
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
  /** Server-only aggregate preflight. Callers must filter every returned
   * record to the capability's permitted lifecycle states. */
  scopeOnly?: boolean;
  /**
   * The date the record applies to (attendance date, homework assigned date,
   * marks entry date). Defaults to now. Authority must be active both today
   * and on this date; an old record date cannot restore an expired assignment.
   */
  effectiveOn?: Date;
}

export type RequireTeacherActorAccessParams = Omit<
  RequireTeacherAccessParams,
  'tenantId' | 'staffId'
>;

export interface DenyTeacherActorAccessParams {
  capability: TeacherCapability;
  reason: 'missing_scope' | 'no_assignment' | 'unsupported_teacher_action';
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  recordStatus?: TeacherRecordStatus | null;
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
  /**
   * Permanent assignments derive capabilities from their assignment type.
   * Delegations carry an explicit capability allow-list and must never be
   * treated as granting every substitute-teacher capability.
   */
  allowedCapabilities?: readonly string[];
}

const DENIAL_MESSAGE = 'You are not authorized for this teaching scope';
export const TEACHER_SCOPE_DENIED_CODE = 'TEACHER_SCOPE_DENIED';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function teacherScopeFingerprint(value: unknown): string {
  const digest = createHash('sha256')
    .update('schoolos:teacher-scope:v1\0')
    .update(stableJson(value))
    .digest('hex');

  // Keep the existing decimal-string wire shape while making the value an
  // opaque fingerprint rather than a timestamp that clients can order.
  return BigInt(`0x${digest}`).toString(10);
}

export function createTeacherScopeDeniedException() {
  return new ForbiddenException({
    statusCode: 403,
    code: TEACHER_SCOPE_DENIED_CODE,
    message: DENIAL_MESSAGE,
  });
}

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
        ...activeTeacherStaffWhere(actor.tenantId, new Date()),
        userId: actor.userId,
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

  async requireAccessAnySectionOfClass(
    params: Omit<RequireTeacherAccessParams, 'sectionId'>,
    actor?: AuthContext,
  ): Promise<TeacherScopeGrant> {
    const grant = await this.resolveGrant(
      { ...params, sectionId: undefined as unknown as string },
      actor,
      { audit: true },
    );
    if (!grant) {
      throw createTeacherScopeDeniedException();
    }
    return grant;
  }

  async requireAccess(
    params: RequireTeacherAccessParams,
    actor?: AuthContext,
  ): Promise<TeacherScopeGrant> {
    const grant = await this.resolveGrant(params, actor, { audit: true });
    if (!grant) {
      throw createTeacherScopeDeniedException();
    }
    return grant;
  }

  /**
   * Actor-oriented entry point for controllers and feature services. Keeping
   * active Staff resolution here prevents every consumer from reimplementing
   * the same user -> staff lookup before applying the canonical assignment
   * rules.
   */
  async requireActorAccess(
    params: RequireTeacherActorAccessParams,
    actor: AuthContext,
  ): Promise<TeacherScopeGrant> {
    const staffId = await this.resolveActiveStaffId(actor);
    if (!staffId) {
      await this.recordActorDenial(params, actor, 'no_active_staff');
      throw createTeacherScopeDeniedException();
    }

    return this.requireAccess(
      {
        ...params,
        tenantId: actor.tenantId,
        staffId,
      },
      actor,
    );
  }

  /**
   * Non-throwing actor-oriented lookup for list filters and option rendering.
   * Actual reads, writes and downloads must use `requireActorAccess`.
   */
  async canActorAccess(
    params: RequireTeacherActorAccessParams,
    actor: AuthContext,
  ): Promise<TeacherScopeGrant | null> {
    const staffId = await this.resolveActiveStaffId(actor);
    if (!staffId) return null;

    return this.canAccess(
      {
        ...params,
        tenantId: actor.tenantId,
        staffId,
      },
      actor,
    );
  }

  async canActorAccessAnySectionOfClass(
    params: Omit<RequireTeacherActorAccessParams, 'sectionId'>,
    actor: AuthContext,
  ): Promise<TeacherScopeGrant | null> {
    const staffId = await this.resolveActiveStaffId(actor);
    if (!staffId) return null;

    return this.canAccessAnySectionOfClass(
      {
        ...params,
        tenantId: actor.tenantId,
        staffId,
      },
      actor,
    );
  }

  /**
   * Fail-closed entry point for a teacher action whose request does not carry
   * enough scope to evaluate safely, or whose functional area is not
   * available to teachers. This keeps the stable denial envelope and audit
   * vocabulary inside the canonical resolver instead of reimplementing them
   * in each feature module.
   */
  async denyActorAccess(
    params: DenyTeacherActorAccessParams,
    actor: AuthContext,
  ): Promise<never> {
    await this.auditService.record({
      action: 'teacher_scope.denied',
      resource: params.capability,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: `${params.classId ?? ''}:${params.sectionId ?? ''}:${params.subjectId ?? ''}`,
      after: {
        capability: params.capability,
        staffId: null,
        reason: params.reason,
        recordStatus: params.recordStatus ?? null,
      },
    });
    throw createTeacherScopeDeniedException();
  }

  /**
   * Compatibility bridge for a legacy class-wide record that has no section
   * id. Canonical assignments remain section-precise; this succeeds only when
   * at least one active assignment covers the requested class/subject/action.
   */
  async requireActorAccessAnySectionOfClass(
    params: Omit<RequireTeacherActorAccessParams, 'sectionId'>,
    actor: AuthContext,
  ): Promise<TeacherScopeGrant> {
    const staffId = await this.resolveActiveStaffId(actor);
    if (!staffId) {
      await this.recordActorDenial(
        { ...params, sectionId: '' },
        actor,
        'no_active_staff',
      );
      throw createTeacherScopeDeniedException();
    }

    return this.requireAccessAnySectionOfClass(
      {
        ...params,
        tenantId: actor.tenantId,
        staffId,
      },
      actor,
    );
  }

  private async resolveGrant(
    params: RequireTeacherAccessParams,
    actor: AuthContext | undefined,
    options: { audit: boolean },
  ): Promise<TeacherScopeGrant | null> {
    const rule = CAPABILITY_RULES[params.capability];
    const now = new Date();
    const effectiveOn = params.effectiveOn ?? now;
    if (
      !rule ||
      !Number.isFinite(+effectiveOn) ||
      !params.tenantId ||
      !params.staffId ||
      !params.classId ||
      (actor && actor.tenantId !== params.tenantId)
    ) {
      if (options.audit)
        await this.recordDenial(params, actor, 'missing_scope');
      return null;
    }

    const denial = teacherRecordDenial(params);
    if (denial) {
      if (options.audit) await this.recordDenial(params, actor, denial);
      return null;
    }

    // Staff-oriented callers must obey the same live employment boundary as
    // actor-oriented callers. A retained assignment never restores inactive staff.
    const staff = await this.prisma.staff.findFirst({
      where: {
        ...activeTeacherStaffWhere(params.tenantId, now),
        id: params.staffId,
        ...(actor ? { userId: actor.userId } : {}),
      },
      select: { id: true },
    });
    if (!staff) {
      if (options.audit) await this.recordDenial(params, actor, 'employment');
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
        ...teacherAuthorityWindow(now, effectiveOn),
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
        ...(params.academicYearId
          ? { academicYearId: params.academicYearId }
          : {}),
        classId: params.classId,
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        status: 'ACTIVE',
        effectiveFrom: { lte: new Date(Math.min(+now, +effectiveOn)) },
        effectiveUntil: { gt: new Date(Math.max(+now, +effectiveOn)) },
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
    reason:
      | 'lifecycle'
      | 'ownership'
      | 'no_assignment'
      | 'missing_scope'
      | 'employment',
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

  private async recordActorDenial(
    params: RequireTeacherActorAccessParams,
    actor: AuthContext,
    reason: 'no_active_staff',
  ) {
    await this.auditService.record({
      action: 'teacher_scope.denied',
      resource: params.capability,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: `${params.classId}:${params.sectionId}:${params.subjectId ?? ''}`,
      after: {
        capability: params.capability,
        staffId: null,
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

    const now = new Date();
    const effectiveOn = options.effectiveOn ?? now;

    const [assignments, delegations] = await Promise.all([
      this.prisma.teacherAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId,
          status: 'ACTIVE',
          ...(options.academicYearId
            ? { academicYearId: options.academicYearId }
            : {}),
          ...teacherAuthorityWindow(now, effectiveOn),
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
          effectiveFrom: { lte: new Date(Math.min(+now, +effectiveOn)) },
          effectiveUntil: { gt: new Date(Math.max(+now, +effectiveOn)) },
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
        allowedCapabilities: delegation.allowedCapabilities,
      })),
    ];
  }

  /**
   * Active scopes that can satisfy one capability. List endpoints use this
   * instead of treating every assignment/delegation as interchangeable.
   */
  async listActiveAssignmentsForCapability(
    actor: AuthContext,
    capability: TeacherCapability,
    options: { academicYearId?: string; effectiveOn?: Date } = {},
  ): Promise<TeacherAssignmentScope[]> {
    const rule = CAPABILITY_RULES[capability];
    const assignments = await this.listActiveAssignments(actor, options);

    return assignments.filter((assignment) => {
      if (assignment.source === 'DELEGATION') {
        return (
          assignment.allowedCapabilities?.includes(capability) === true &&
          this.assignmentMatchesSubjectRule(assignment, rule.subjectMatch)
        );
      }

      return (
        rule.allowedAssignmentTypes.includes(assignment.assignmentType) &&
        this.assignmentMatchesSubjectRule(assignment, rule.subjectMatch)
      );
    });
  }

  private assignmentMatchesSubjectRule(
    assignment: TeacherAssignmentScope,
    subjectMatch: 'EXACT' | 'ANY' | 'NONE',
  ) {
    if (subjectMatch === 'EXACT') return assignment.subjectId !== null;
    if (subjectMatch === 'NONE') return assignment.subjectId === null;
    return true;
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

  /**
   * Opaque scope fingerprint for mobile offline cache invalidation (P0-03).
   * It represents the caller's current effective authority, so an assignment
   * or delegation crossing its effective-date boundary changes the value even
   * when no database row was updated at that moment.
   */
  async getScopeVersion(actor: AuthContext): Promise<{ scopeVersion: string }> {
    const now = new Date();
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
      },
      select: {
        id: true,
        status: true,
        joiningDate: true,
        teacherAssignmentRecords: {
          where: {
            tenantId: actor.tenantId,
            status: 'ACTIVE',
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
          select: {
            id: true,
            tenantId: true,
            academicYearId: true,
            staffId: true,
            assignmentType: true,
            classId: true,
            sectionId: true,
            subjectId: true,
            componentScope: true,
            isPrimary: true,
            effectiveFrom: true,
            effectiveUntil: true,
            status: true,
          },
          orderBy: { id: 'asc' },
        },
        delegationsReceived: {
          where: {
            tenantId: actor.tenantId,
            status: 'ACTIVE',
            effectiveFrom: { lte: now },
            effectiveUntil: { gt: now },
          },
          select: {
            id: true,
            tenantId: true,
            academicYearId: true,
            grantorStaffId: true,
            recipientStaffId: true,
            sourceAssignmentId: true,
            classId: true,
            sectionId: true,
            subjectId: true,
            componentScope: true,
            allowedCapabilities: true,
            timetableSubstitutionId: true,
            effectiveFrom: true,
            effectiveUntil: true,
            status: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    const isActive = staff?.status === 'ACTIVE' && staff.joiningDate <= now;
    const assignments = isActive
      ? staff.teacherAssignmentRecords
          .map((assignment) => ({
            id: assignment.id,
            tenantId: assignment.tenantId,
            academicYearId: assignment.academicYearId,
            staffId: assignment.staffId,
            assignmentType: assignment.assignmentType,
            classId: assignment.classId,
            sectionId: assignment.sectionId,
            subjectId: assignment.subjectId,
            componentScope: assignment.componentScope,
            isPrimary: assignment.isPrimary,
            effectiveFrom: assignment.effectiveFrom.toISOString(),
            effectiveUntil: assignment.effectiveUntil?.toISOString() ?? null,
            status: assignment.status,
          }))
          .sort((left, right) => left.id.localeCompare(right.id))
      : [];
    const delegations = isActive
      ? staff.delegationsReceived
          .map((delegation) => ({
            id: delegation.id,
            tenantId: delegation.tenantId,
            academicYearId: delegation.academicYearId,
            grantorStaffId: delegation.grantorStaffId,
            recipientStaffId: delegation.recipientStaffId,
            sourceAssignmentId: delegation.sourceAssignmentId,
            classId: delegation.classId,
            sectionId: delegation.sectionId,
            subjectId: delegation.subjectId,
            componentScope: delegation.componentScope,
            allowedCapabilities: [...delegation.allowedCapabilities].sort(),
            timetableSubstitutionId: delegation.timetableSubstitutionId,
            effectiveFrom: delegation.effectiveFrom.toISOString(),
            effectiveUntil: delegation.effectiveUntil.toISOString(),
            status: delegation.status,
          }))
          .sort((left, right) => left.id.localeCompare(right.id))
      : [];

    return {
      scopeVersion: teacherScopeFingerprint({
        schemaVersion: 1,
        tenantId: actor.tenantId,
        userId: actor.userId,
        staff: staff ? { id: staff.id, status: staff.status } : null,
        assignments,
        delegations,
      }),
    };
  }
}
