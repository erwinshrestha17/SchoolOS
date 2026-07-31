import { TeacherCapability } from './teacher-capability';

/**
 * P0-01 required capability names mapped onto the SchoolOS enforcement surface.
 *
 * Where an equivalent TeacherCapability already exists, the existing name is
 * preserved and this contract documents the equivalence. Administrative
 * publish/unlock/guardian-manage/file capabilities stay on RBAC permissions
 * or FileRegistry checks rather than inventing a second TeacherCapability
 * vocabulary for non-assignment actions.
 */
export type P001CapabilityEnforcement =
  | {
      kind: 'teacher_capability';
      capability: TeacherCapability;
    }
  | {
      kind: 'rbac_permission';
      permissions: readonly string[];
    }
  | {
      kind: 'file_registry';
      check: 'assertFileAccessForAuth' | 'reports_export_permissions';
    }
  | {
      kind: 'guardian_admin';
      permissions: readonly string[];
    };

export const P0_01_CAPABILITY_CONTRACT: Record<
  string,
  P001CapabilityEnforcement
> = {
  HOMEROOM_ATTENDANCE_MARK: {
    kind: 'teacher_capability',
    capability: TeacherCapability.HOMEROOM_ATTENDANCE_MARK,
  },
  PERIOD_ATTENDANCE_MARK: {
    kind: 'teacher_capability',
    capability: TeacherCapability.PERIOD_ATTENDANCE_MARK,
  },
  /** Alias: authoritative write uses SUBJECT_HOMEWORK_CREATE. */
  SUBJECT_HOMEWORK_WRITE: {
    kind: 'teacher_capability',
    capability: TeacherCapability.SUBJECT_HOMEWORK_CREATE,
  },
  SUBJECT_HOMEWORK_CREATE: {
    kind: 'teacher_capability',
    capability: TeacherCapability.SUBJECT_HOMEWORK_CREATE,
  },
  /** Alias: authoritative write uses MARKS_ENTER. */
  SUBJECT_MARKS_WRITE: {
    kind: 'teacher_capability',
    capability: TeacherCapability.MARKS_ENTER,
  },
  MARKS_ENTER: {
    kind: 'teacher_capability',
    capability: TeacherCapability.MARKS_ENTER,
  },
  /** Alias: class academic overview uses HOMEROOM_ACADEMIC_SUMMARY_READ. */
  CLASS_ACADEMIC_OVERVIEW: {
    kind: 'teacher_capability',
    capability: TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
  },
  HOMEROOM_ACADEMIC_SUMMARY_READ: {
    kind: 'teacher_capability',
    capability: TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
  },
  /** Alias: class-teacher remarks use CLASS_TEACHER_REMARK. */
  CLASS_TEACHER_REMARK_WRITE: {
    kind: 'teacher_capability',
    capability: TeacherCapability.CLASS_TEACHER_REMARK,
  },
  CLASS_TEACHER_REMARK: {
    kind: 'teacher_capability',
    capability: TeacherCapability.CLASS_TEACHER_REMARK,
  },
  RESULT_REVIEW: {
    kind: 'teacher_capability',
    capability: TeacherCapability.RESULT_REVIEW,
  },
  RESULT_PUBLISH: {
    kind: 'rbac_permission',
    permissions: ['academics:manage_report_cards'],
  },
  MARKS_UNLOCK: {
    kind: 'rbac_permission',
    permissions: ['exam-terms:manage', 'academics:manage'],
  },
  GUARDIAN_RELATIONSHIP_MANAGE: {
    kind: 'guardian_admin',
    permissions: ['guardians:update', 'guardians:verify', 'guardians:create'],
  },
  PROTECTED_FILE_READ: {
    kind: 'file_registry',
    check: 'assertFileAccessForAuth',
  },
  PROTECTED_FILE_EXPORT: {
    kind: 'file_registry',
    check: 'reports_export_permissions',
  },
};

export const P0_01_REQUIRED_CAPABILITY_NAMES = [
  'HOMEROOM_ATTENDANCE_MARK',
  'PERIOD_ATTENDANCE_MARK',
  'SUBJECT_HOMEWORK_WRITE',
  'SUBJECT_MARKS_WRITE',
  'CLASS_ACADEMIC_OVERVIEW',
  'CLASS_TEACHER_REMARK_WRITE',
  'RESULT_REVIEW',
  'RESULT_PUBLISH',
  'MARKS_UNLOCK',
  'GUARDIAN_RELATIONSHIP_MANAGE',
  'PROTECTED_FILE_READ',
  'PROTECTED_FILE_EXPORT',
] as const;
