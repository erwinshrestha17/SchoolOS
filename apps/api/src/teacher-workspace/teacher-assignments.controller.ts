import { Controller, Get, Injectable, UseGuards } from '@nestjs/common';
import { TeacherAssignmentType } from '@prisma/client';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';

/**
 * Resolves the caller's own teaching assignments into display-ready context.
 *
 * This is what the Teacher Web's "Working as" selector and every scoped
 * picker read, so the browser never has to guess which class/section/subject
 * combinations are legitimate -- and cannot widen them, because the backend
 * re-validates each id on every mutation regardless of what the UI sent.
 */
@Injectable()
export class TeacherAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherScopeService: TeacherScopeService,
  ) {}

  async getMyAssignmentContext(actor: AuthContext) {
    const assignments =
      await this.teacherScopeService.listActiveAssignments(actor);

    if (assignments.length === 0) {
      return {
        hasAnyAssignment: false,
        subjectAssignments: [],
        homerooms: [],
      };
    }

    const [classes, sections, subjects] = await Promise.all([
      this.prisma.class.findMany({
        where: {
          tenantId: actor.tenantId,
          id: { in: [...new Set(assignments.map((a) => a.classId))] },
        },
        select: { id: true, name: true },
      }),
      this.prisma.section.findMany({
        where: {
          tenantId: actor.tenantId,
          id: { in: [...new Set(assignments.map((a) => a.sectionId))] },
        },
        select: { id: true, name: true },
      }),
      this.prisma.subject.findMany({
        where: {
          tenantId: actor.tenantId,
          id: {
            in: [
              ...new Set(
                assignments
                  .map((a) => a.subjectId)
                  .filter((id): id is string => Boolean(id)),
              ),
            ],
          },
        },
        select: { id: true, name: true },
      }),
    ]);

    const className = (id: string) =>
      classes.find((item) => item.id === id)?.name ?? id;
    const sectionName = (id: string) =>
      sections.find((item) => item.id === id)?.name ?? null;
    const subjectName = (id: string | null) =>
      id ? (subjects.find((item) => item.id === id)?.name ?? null) : null;

    const decorate = (assignment: (typeof assignments)[number]) => ({
      assignmentId: assignment.assignmentId,
      assignmentType: assignment.assignmentType,
      academicYearId: assignment.academicYearId,
      classId: assignment.classId,
      className: className(assignment.classId),
      sectionId: assignment.sectionId,
      sectionName: sectionName(assignment.sectionId),
      subjectId: assignment.subjectId,
      subjectName: subjectName(assignment.subjectId),
      isPrimary: assignment.isPrimary,
      effectiveFrom: assignment.effectiveFrom,
      // Non-null on a temporary substitution, so the UI can say when the
      // access ends rather than letting it vanish without explanation.
      effectiveUntil: assignment.effectiveUntil,
      isTemporary: assignment.source === 'DELEGATION',
    });

    return {
      hasAnyAssignment: true,
      /** Subject-owned scopes: these carry academic WRITE access. */
      subjectAssignments: assignments
        .filter(
          (assignment) =>
            assignment.assignmentType !== TeacherAssignmentType.CLASS_TEACHER &&
            assignment.subjectId,
        )
        .map(decorate),
      /** Homeroom scopes: cross-subject READ plus homeroom-record write. */
      homerooms: assignments
        .filter(
          (assignment) =>
            assignment.assignmentType === TeacherAssignmentType.CLASS_TEACHER,
        )
        .map(decorate),
    };
  }
}

@Controller('teacher-workspace/assignments')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
@Roles('teacher', 'subject_teacher')
export class TeacherAssignmentsController {
  constructor(private readonly service: TeacherAssignmentsService) {}

  @Get()
  @Permissions('students:read')
  getMyAssignments(@CurrentAuth() auth: AuthContext) {
    return this.service.getMyAssignmentContext(auth);
  }
}
