import { TeacherAssignmentType } from '@prisma/client';

/**
 * Every action a Teacher can request through TeacherScopeService. Adding a
 * new Teacher-facing action means adding it here plus a matching rule in
 * CAPABILITY_RULES -- there is deliberately no way to call `requireAccess`
 * with a capability that isn't in this list.
 */
export enum TeacherCapability {
  CLASS_ROSTER_READ = 'CLASS_ROSTER_READ',
  HOMEROOM_ATTENDANCE_MARK = 'HOMEROOM_ATTENDANCE_MARK',
  PERIOD_ATTENDANCE_MARK = 'PERIOD_ATTENDANCE_MARK',
  SUBJECT_HOMEWORK_CREATE = 'SUBJECT_HOMEWORK_CREATE',
  CLASS_TASK_CREATE = 'CLASS_TASK_CREATE',
  MARKS_ENTER = 'MARKS_ENTER',
  MARKS_SUBMIT = 'MARKS_SUBMIT',
  CLASS_TEACHER_REMARK = 'CLASS_TEACHER_REMARK',
}

export interface CapabilityRule {
  allowedAssignmentTypes: TeacherAssignmentType[];
  requiresSubject: boolean;
}

export const CAPABILITY_RULES: Record<TeacherCapability, CapabilityRule> = {
  [TeacherCapability.CLASS_ROSTER_READ]: {
    allowedAssignmentTypes: [
      TeacherAssignmentType.CLASS_TEACHER,
      TeacherAssignmentType.SUBJECT_TEACHER,
      TeacherAssignmentType.ASSISTANT_TEACHER,
      TeacherAssignmentType.SUBSTITUTE_TEACHER,
    ],
    requiresSubject: false,
  },
  [TeacherCapability.HOMEROOM_ATTENDANCE_MARK]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
  },
  [TeacherCapability.PERIOD_ATTENDANCE_MARK]: {
    allowedAssignmentTypes: [
      TeacherAssignmentType.SUBJECT_TEACHER,
      TeacherAssignmentType.SUBSTITUTE_TEACHER,
    ],
    requiresSubject: true,
  },
  [TeacherCapability.SUBJECT_HOMEWORK_CREATE]: {
    allowedAssignmentTypes: [
      TeacherAssignmentType.SUBJECT_TEACHER,
      TeacherAssignmentType.SUBSTITUTE_TEACHER,
    ],
    requiresSubject: true,
  },
  [TeacherCapability.CLASS_TASK_CREATE]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
  },
  [TeacherCapability.MARKS_ENTER]: {
    allowedAssignmentTypes: [
      TeacherAssignmentType.SUBJECT_TEACHER,
      TeacherAssignmentType.SUBSTITUTE_TEACHER,
    ],
    requiresSubject: true,
  },
  [TeacherCapability.MARKS_SUBMIT]: {
    allowedAssignmentTypes: [
      TeacherAssignmentType.SUBJECT_TEACHER,
      TeacherAssignmentType.SUBSTITUTE_TEACHER,
    ],
    requiresSubject: true,
  },
  [TeacherCapability.CLASS_TEACHER_REMARK]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
  },
};
