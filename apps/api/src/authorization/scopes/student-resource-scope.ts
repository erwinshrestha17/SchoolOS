import type { ResourceScope } from './scope.types';

interface ScopeStudent {
  readonly id: string;
  readonly tenantId: string;
  readonly classId: string;
  readonly sectionId: string | null;
  readonly enrollments: ReadonlyArray<{
    readonly academicYearId: string;
    readonly classId: string;
    readonly sectionId: string | null;
    readonly status: string;
    readonly effectiveFrom: Date;
    readonly effectiveUntil: Date | null;
    readonly academicYear: { readonly isCurrent: boolean };
  }>;
}

/** Ownership dimensions come from the row being returned, including the current school year. */
export function studentResourceScope(
  row: ScopeStudent,
  now = new Date(),
): ResourceScope {
  const scope: Partial<Record<keyof ResourceScope, string>> = {
    TENANT: row.tenantId,
    STUDENT: row.id,
    CLASS: row.classId,
    ...(row.sectionId ? { SECTION: row.sectionId } : {}),
  };
  const current = row.enrollments.filter(
    (e) =>
      e.status === 'ACTIVE' &&
      e.academicYear.isCurrent &&
      e.effectiveFrom <= now &&
      (!e.effectiveUntil || e.effectiveUntil > now),
  );
  if (
    current.length === 1 &&
    current[0].classId === row.classId &&
    current[0].sectionId === row.sectionId
  )
    scope.ACADEMIC_YEAR = current[0].academicYearId;
  return scope;
}
