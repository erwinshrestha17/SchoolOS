import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Determines if the authenticated user is a parent-only role
 * (i.e., they do NOT have admin, teacher, principal, platform_super_admin, accountant, etc.)
 */
export function isParentOnly(actor: AuthContext): boolean {
  const staffRoles = [
    'platform_super_admin',
    'admin',
    'teacher',
    'principal',
    'accountant',
    'librarian',
    'driver',
    'subject_teacher',
    'support_staff',
  ];
  return (
    (actor.roles.includes('parent') || actor.roles.includes('guardian')) &&
    !actor.roles.some((role) => staffRoles.includes(role))
  );
}

/**
 * Determines if the authenticated user is a student-only role.
 */
export function isStudentOnly(actor: AuthContext): boolean {
  const staffRoles = [
    'platform_super_admin',
    'admin',
    'teacher',
    'principal',
    'accountant',
    'librarian',
    'driver',
    'subject_teacher',
    'support_staff',
    'parent',
  ];
  return (
    actor.roles.includes('student') &&
    !actor.roles.some((role) => staffRoles.includes(role))
  );
}

/**
 * Returns the student IDs that a parent user is allowed to access.
 * For non-parent users, returns null (meaning no restriction).
 */
export async function getParentStudentIds(
  prisma: PrismaService,
  actor: AuthContext,
): Promise<string[] | null> {
  if (!isParentOnly(actor)) {
    return null; // no restriction
  }

  // Find the guardian record linked to this user
  const guardian = await prisma.guardian.findFirst({
    where: {
      tenantId: actor.tenantId,
      userId: actor.userId,
    },
    include: {
      studentLinks: true,
    },
  });

  if (!guardian) {
    return []; // parent with no linked guardian record -> no access
  }

  return guardian.studentLinks.map((link) => link.studentId);
}

/**
 * Returns the student ID that a student user is allowed to access (their own).
 * For non-student users, returns null (meaning no restriction).
 */
export async function getStudentOwnId(
  prisma: PrismaService,
  actor: AuthContext,
): Promise<string | null> {
  if (!isStudentOnly(actor)) {
    return null; // no restriction
  }

  const student = await prisma.student.findFirst({
    where: {
      tenantId: actor.tenantId,
      userId: actor.userId,
    },
  });

  if (!student) {
    throw new ForbiddenException('No student profile linked to this account');
  }

  return student.id;
}

/**
 * Determines if the authenticated user is a teacher-only role (Class/Subject
 * Teacher without admin/principal/librarian-level authority). Several
 * read endpoints (library circulation/reservations, in particular) were
 * written assuming "any staff actor" meant "trusted with tenant-wide
 * visibility" -- true for admin/principal/librarian, but not for a base
 * Teacher role, which per the Teacher Persona spec must not see other
 * people's records just because it holds a base read permission.
 */
export function isTeacherOnly(actor: AuthContext): boolean {
  const privilegedRoles = [
    'platform_super_admin',
    'admin',
    'principal',
    'librarian',
  ];
  return (
    (actor.roles.includes('teacher') ||
      actor.roles.includes('subject_teacher')) &&
    !actor.roles.some((role) => privilegedRoles.includes(role))
  );
}

/**
 * Returns the Staff id a teacher-only actor is restricted to (their own).
 * For non-teacher-only actors, returns null (meaning no restriction).
 */
export async function getTeacherStaffOwnId(
  prisma: PrismaService,
  actor: AuthContext,
): Promise<string | null> {
  if (!isTeacherOnly(actor)) {
    return null; // no restriction
  }

  const staff = await prisma.staff.findFirst({
    where: {
      tenantId: actor.tenantId,
      userId: actor.userId,
      status: 'ACTIVE',
    },
  });

  if (!staff) {
    throw new ForbiddenException(
      'No active staff profile linked to this account',
    );
  }

  return staff.id;
}

/**
 * Builds a Prisma WHERE filter for studentId scoping.
 * Returns {} for staff/admin roles, or { studentId: { in: [...] } } for parents.
 */
export async function buildStudentScopeFilter(
  prisma: PrismaService,
  actor: AuthContext,
): Promise<Record<string, unknown>> {
  const parentStudentIds = await getParentStudentIds(prisma, actor);
  if (parentStudentIds !== null) {
    return { studentId: { in: parentStudentIds } };
  }

  const studentOwnId = await getStudentOwnId(prisma, actor);
  if (studentOwnId !== null) {
    return { studentId: studentOwnId };
  }

  return {};
}
