import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssessmentType,
  TeacherAssignmentComponentScope,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CAPABILITY_RULES, TeacherCapability } from './teacher-capability';

export interface TeacherScopeGrant {
  source: 'ASSIGNMENT' | 'DELEGATION';
  assignmentId: string;
  componentScope: TeacherAssignmentComponentScope | null;
}

export interface RequireTeacherAccessParams {
  tenantId: string;
  staffId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId?: string;
  /** AssessmentComponent.type of the record being touched, when relevant. */
  componentType?: AssessmentType;
  capability: TeacherCapability;
}

const DENIAL_MESSAGE = 'You are not authorized for this teaching scope';

/**
 * Canonical Teacher authorization resolver (Teacher Persona spec sections
 * B2/B3/17). This is the single place that answers "does this teacher have
 * an active assignment or delegation covering this exact
 * tenant+year+class+section+subject+component+capability" -- callers must
 * not re-derive that answer from Section.classTeacherId or
 * SubjectTeacherAssignment directly once they're wired to this service.
 *
 * Primary invariant enforced here: no active assignment (or delegation) means
 * no access. On any mismatch this throws a single generic ForbiddenException
 * -- it never reveals *why* (wrong section vs. wrong subject vs. nothing
 * exists at all), so probing can't be used to enumerate scope.
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

  async requireAccess(
    params: RequireTeacherAccessParams,
    actor?: AuthContext,
  ): Promise<TeacherScopeGrant> {
    const rule = CAPABILITY_RULES[params.capability];
    const now = new Date();

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId: params.tenantId,
        staffId: params.staffId,
        academicYearId: params.academicYearId,
        classId: params.classId,
        sectionId: params.sectionId,
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
      };
    }

    const delegations = await this.prisma.teacherDelegation.findMany({
      where: {
        tenantId: params.tenantId,
        recipientStaffId: params.staffId,
        classId: params.classId,
        sectionId: params.sectionId,
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
      };
    }

    await this.auditService.record({
      action: 'teacher_scope.denied',
      resource: params.capability,
      tenantId: params.tenantId,
      userId: actor?.userId,
      resourceId: `${params.classId}:${params.sectionId}:${params.subjectId ?? ''}`,
      after: { capability: params.capability, staffId: params.staffId },
    });

    throw new ForbiddenException(DENIAL_MESSAGE);
  }

  private matchesScope(
    record: {
      subjectId: string | null;
      componentScope: TeacherAssignmentComponentScope | null;
    },
    rule: (typeof CAPABILITY_RULES)[TeacherCapability],
    params: RequireTeacherAccessParams,
  ): boolean {
    if (
      rule.requiresSubject &&
      record.subjectId !== (params.subjectId ?? null)
    ) {
      return false;
    }
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
}
