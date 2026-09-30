import { GuardianCapability } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  isTeacherOnly,
} from '../common/security/parent-scope';
import type { PrismaService } from '../prisma/prisma.service';
import type { TeacherScopeService } from '../teacher-scope/teacher-scope.service';

/**
 * Which students an actor may see in collection reads (directory, search,
 * selectors). One resolver so the directory, its inspector and global search
 * cannot scope differently.
 *
 * - guardian/parent actors: only actively linked children (ACADEMICS_VIEW);
 * - teacher-only actors: only sections of live, eligibility-checked
 *   assignments (TeacherScopeService); none when no assignment is active;
 * - other school roles: the tenant (route permission already required).
 */
export type StudentActorScope =
  | { kind: 'tenant' }
  | { kind: 'students'; studentIds: string[] }
  | { kind: 'sections'; sectionIds: string[] };

export async function resolveStudentActorScope(
  prisma: PrismaService,
  teacherScope: Pick<TeacherScopeService, 'resolveReadableScope'>,
  actor: AuthContext,
  academicYearId?: string,
): Promise<StudentActorScope> {
  const parentStudentIds = await getParentStudentIds(
    prisma,
    actor,
    GuardianCapability.ACADEMICS_VIEW,
  );
  if (parentStudentIds !== null) {
    return { kind: 'students', studentIds: parentStudentIds };
  }
  if (!isTeacherOnly(actor)) return { kind: 'tenant' };
  const scope = await teacherScope.resolveReadableScope(actor, {
    academicYearId,
  });
  return { kind: 'sections', sectionIds: [...scope.allSectionIds] };
}
