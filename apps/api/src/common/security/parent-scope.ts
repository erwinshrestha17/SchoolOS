import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Determines if the authenticated user is a parent-only role
 * (i.e., they do NOT have admin, teacher, principal, super_admin, accountant, etc.)
 */
export function isParentOnly(actor: AuthContext): boolean {
  const staffRoles = [
    'super_admin',
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
    actor.roles.includes('parent') &&
    !actor.roles.some((role) => staffRoles.includes(role))
  );
}

/**
 * Determines if the authenticated user is a student-only role.
 */
export function isStudentOnly(actor: AuthContext): boolean {
  const staffRoles = [
    'super_admin',
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
