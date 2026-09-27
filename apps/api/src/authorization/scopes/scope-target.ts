import type { Prisma } from '@prisma/client';
import type { SchoolScopeType } from './scope.types';

/** Every supported target is queried under an explicit tenant, including its parent. */
export async function scopeTargetExists(
  db: Prisma.TransactionClient,
  tenantId: string,
  type: SchoolScopeType,
  id: string,
): Promise<boolean> {
  switch (type) {
    case 'TENANT':
      return id === tenantId;
    case 'ACADEMIC_YEAR':
      return !!(await db.academicYear.findFirst({
        where: { tenantId, id },
        select: { id: true },
      }));
    case 'CLASS':
      return !!(await db.class.findFirst({
        where: { tenantId, id },
        select: { id: true },
      }));
    case 'SECTION':
      return !!(await db.section.findFirst({
        where: { tenantId, id, class: { tenantId } },
        select: { id: true },
      }));
    case 'SUBJECT':
      return !!(await db.subject.findFirst({
        where: { tenantId, id, class: { tenantId } },
        select: { id: true },
      }));
    case 'STUDENT':
      return !!(await db.student.findFirst({
        where: { tenantId, id, class: { tenantId } },
        select: { id: true },
      }));
    case 'STAFF':
      return !!(await db.staff.findFirst({
        where: {
          tenantId,
          id,
          status: 'ACTIVE',
          user: { tenantId, status: 'ACTIVE' },
        },
        select: { id: true },
      }));
    case 'FINANCE_ACCOUNT':
      return !!(await db.chartAccount.findFirst({
        where: { tenantId, id, isActive: true },
        select: { id: true },
      }));
    // Vocabulary is ready; these dimensions have no authoritative entity in P0.
    case 'BRANCH':
    case 'DEPARTMENT':
      return false;
  }
}
