import type { Prisma } from '@prisma/client';
import {
  CAPABILITY_RULES,
  EDITABLE_STATUSES,
  TeacherCapability,
  type TeacherRecordStatus,
} from '../../teacher-scope/teacher-capability';

/** Current authority and the record's effective date are independent checks. */
export function teacherAuthorityWindow(now: Date, effectiveOn = now) {
  return {
    effectiveFrom: { lte: new Date(Math.min(+now, +effectiveOn)) },
    OR: [
      { effectiveUntil: null },
      { effectiveUntil: { gt: new Date(Math.max(+now, +effectiveOn)) } },
    ],
  };
}

export function activeTeacherStaffWhere(
  tenantId: string,
  now: Date,
): Prisma.StaffWhereInput {
  return { tenantId, status: 'ACTIVE', joiningDate: { lte: now } };
}

export function teacherRecordDenial(params: {
  capability: TeacherCapability;
  subjectId?: string;
  staffId: string;
  recordStatus?: TeacherRecordStatus | null;
  recordOwnerStaffId?: string | null;
  scopeOnly?: boolean;
}): 'missing_scope' | 'lifecycle' | 'ownership' | null {
  const rule = CAPABILITY_RULES[params.capability];
  if (!rule) return 'missing_scope';
  if (
    (rule.subjectMatch === 'EXACT' && !params.subjectId) ||
    (rule.subjectMatch === 'NONE' && params.subjectId)
  )
    return 'missing_scope';
  if (
    (rule.visibleRecordStatuses &&
      !params.scopeOnly &&
      (!params.recordStatus ||
        !rule.visibleRecordStatuses.includes(params.recordStatus))) ||
    (rule.access === 'WRITE' &&
      params.capability !== TeacherCapability.SUBJECT_CORRECTION_REQUEST &&
      params.recordStatus &&
      !EDITABLE_STATUSES.includes(params.recordStatus))
  )
    return 'lifecycle';
  if (
    rule.requiresRecordOwnership &&
    params.recordOwnerStaffId !== params.staffId
  )
    return 'ownership';
  return null;
}
