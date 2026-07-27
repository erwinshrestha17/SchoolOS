import { TeacherAssignmentType } from '@prisma/client';

/**
 * Every action a Teacher can request through TeacherScopeService. Adding a
 * new Teacher-facing action means adding it here plus a matching rule in
 * CAPABILITY_RULES -- there is deliberately no way to call `requireAccess`
 * with a capability that isn't in this list.
 *
 * The model implements one principle (Teacher Persona spec 4/18):
 *
 *   Subject ownership grants academic WRITE access.
 *   Class Teacher responsibility grants broader class-level READ access and
 *   limited homeroom-management WRITE access.
 *
 * So a capability belongs to exactly one of three families:
 *
 *   SUBJECT-owned   write, matched on the exact class+section+subject
 *   HOMEROOM-owned  write, matched on class+section, no subject at all
 *   CROSS-SUBJECT   read, matched on class+section for ANY subject, and
 *                   only over records that have left draft
 *
 * A teacher holding both a CLASS_TEACHER and a SUBJECT_TEACHER assignment for
 * the same section gets the union of the two, because each capability is
 * resolved independently against whichever assignment satisfies it.
 */
export enum TeacherCapability {
  // ---- Roster / student access -------------------------------------------
  CLASS_ROSTER_READ = 'CLASS_ROSTER_READ',

  // ---- Attendance ---------------------------------------------------------
  HOMEROOM_ATTENDANCE_MARK = 'HOMEROOM_ATTENDANCE_MARK',
  PERIOD_ATTENDANCE_MARK = 'PERIOD_ATTENDANCE_MARK',

  // ---- Subject-owned academic work ---------------------------------------
  SUBJECT_HOMEWORK_CREATE = 'SUBJECT_HOMEWORK_CREATE',
  CLASS_TASK_CREATE = 'CLASS_TASK_CREATE',
  MARKS_ENTER = 'MARKS_ENTER',
  MARKS_SUBMIT = 'MARKS_SUBMIT',
  CLASS_TEACHER_REMARK = 'CLASS_TEACHER_REMARK',

  // ---- Subject-owned, added for the assignment-authorization model --------
  /** Read a record belonging to one exact assigned subject. */
  SUBJECT_RECORD_READ = 'SUBJECT_RECORD_READ',
  /** Create/edit a record under one exact assigned subject. */
  SUBJECT_RECORD_WRITE = 'SUBJECT_RECORD_WRITE',
  /** Move an owned subject record out of draft. */
  SUBJECT_RECORD_SUBMIT = 'SUBJECT_RECORD_SUBMIT',
  /** Ask for a locked/approved owned record to be reopened. */
  SUBJECT_CORRECTION_REQUEST = 'SUBJECT_CORRECTION_REQUEST',
  /** Subject-scoped parent communication. */
  SUBJECT_PARENT_COMMUNICATION = 'SUBJECT_PARENT_COMMUNICATION',

  // ---- Homeroom cross-subject READ ---------------------------------------
  /**
   * The Class Teacher's defining privilege: read submitted/published academic
   * records across EVERY subject of the homeroom, including subjects taught
   * by other teachers. Read only -- it never implies write, and it never
   * exposes another teacher's draft.
   */
  HOMEROOM_ACADEMIC_SUMMARY_READ = 'HOMEROOM_ACADEMIC_SUMMARY_READ',

  // ---- Homeroom-owned WRITE ----------------------------------------------
  /** Class-wide announcement / parent follow-up for the homeroom. */
  HOMEROOM_COMMUNICATION_CREATE = 'HOMEROOM_COMMUNICATION_CREATE',
  /** Behaviour notes, general observations, class diary, leave follow-up. */
  HOMEROOM_RECORD_WRITE = 'HOMEROOM_RECORD_WRITE',
  /** Nudge a Subject Teacher about marks missing from the homeroom. */
  HOMEROOM_MISSING_MARK_ESCALATE = 'HOMEROOM_MISSING_MARK_ESCALATE',
}

/**
 * Which assignment family a capability is satisfied by, and how strictly the
 * subject must match.
 *
 *  EXACT   the assignment's subjectId must equal the requested subjectId.
 *          This is what stops a Mathematics teacher writing English marks
 *          for a class they do teach Mathematics in.
 *  ANY     the assignment covers the class+section; the subject is not
 *          compared. Only ever combined with READ access over
 *          non-draft records (the Class Teacher summary).
 *  NONE    the request carries no subject at all (homeroom records).
 */
export type SubjectMatch = 'EXACT' | 'ANY' | 'NONE';

export interface CapabilityRule {
  allowedAssignmentTypes: TeacherAssignmentType[];
  /**
   * Retained for backward compatibility with the original rule shape.
   * `requiresSubject: true` is equivalent to `subjectMatch: 'EXACT'`.
   */
  requiresSubject: boolean;
  subjectMatch: SubjectMatch;
  /** READ capabilities may never be used to authorize a mutation. */
  access: 'READ' | 'WRITE';
  /**
   * True when the capability only ever applies to records the caller
   * authored. Enforced by callers passing `recordOwnerStaffId`.
   */
  requiresRecordOwnership: boolean;
  /**
   * When set, the capability only covers records in these lifecycle states.
   * This is how a Class Teacher sees submitted work but never another
   * teacher's private draft.
   */
  visibleRecordStatuses?: readonly TeacherRecordStatus[];
}

/**
 * Canonical academic record lifecycle. Persisted status values across the
 * modules differ in name (`DRAFT`/`SUBMITTED`/`PUBLISHED`/`APPROVED`/...);
 * callers normalize into this shared vocabulary before asking for access, so
 * the authorization layer has one lifecycle to reason about.
 */
export type TeacherRecordStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED_FOR_CORRECTION'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'LOCKED'
  | 'CORRECTION_REQUESTED'
  | 'CORRECTION_APPROVED'
  | 'CANCELLED'
  | 'ARCHIVED';

/**
 * Statuses a record must have reached before anyone other than its author may
 * read it. A draft is the author's private working copy -- a Class Teacher's
 * broad homeroom visibility explicitly stops short of it.
 */
export const NON_DRAFT_STATUSES: readonly TeacherRecordStatus[] = [
  'SUBMITTED',
  'RETURNED_FOR_CORRECTION',
  'APPROVED',
  'PUBLISHED',
  'LOCKED',
  'CORRECTION_REQUESTED',
  'CORRECTION_APPROVED',
  'ARCHIVED',
];

/**
 * Lifecycle states in which the owning Subject Teacher may still edit.
 * Everything else is view-only and must go through a correction request.
 */
export const EDITABLE_STATUSES: readonly TeacherRecordStatus[] = [
  'DRAFT',
  'RETURNED_FOR_CORRECTION',
  'CORRECTION_APPROVED',
];

export function isEditableStatus(status: TeacherRecordStatus | null | undefined) {
  return status == null || EDITABLE_STATUSES.includes(status);
}

const SUBJECT_TEACHING_TYPES = [
  TeacherAssignmentType.SUBJECT_TEACHER,
  TeacherAssignmentType.SUBSTITUTE_TEACHER,
];

const ANY_TEACHING_TYPE = [
  TeacherAssignmentType.CLASS_TEACHER,
  TeacherAssignmentType.SUBJECT_TEACHER,
  TeacherAssignmentType.ASSISTANT_TEACHER,
  TeacherAssignmentType.SUBSTITUTE_TEACHER,
];

export const CAPABILITY_RULES: Record<TeacherCapability, CapabilityRule> = {
  [TeacherCapability.CLASS_ROSTER_READ]: {
    allowedAssignmentTypes: ANY_TEACHING_TYPE,
    requiresSubject: false,
    subjectMatch: 'ANY',
    access: 'READ',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.HOMEROOM_ATTENDANCE_MARK]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    subjectMatch: 'NONE',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.PERIOD_ATTENDANCE_MARK]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.SUBJECT_HOMEWORK_CREATE]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.CLASS_TASK_CREATE]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    subjectMatch: 'NONE',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.MARKS_ENTER]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.MARKS_SUBMIT]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.CLASS_TEACHER_REMARK]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    subjectMatch: 'NONE',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },

  // ---- Subject-owned ------------------------------------------------------
  [TeacherCapability.SUBJECT_RECORD_READ]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'READ',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.SUBJECT_RECORD_WRITE]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    // A Subject Teacher shares the subject with co-teachers and substitutes;
    // ownership of the individual record is what stops them overwriting a
    // colleague's work, so callers pass the record's author.
    requiresRecordOwnership: true,
  },
  [TeacherCapability.SUBJECT_RECORD_SUBMIT]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: true,
  },
  [TeacherCapability.SUBJECT_CORRECTION_REQUEST]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: true,
  },
  [TeacherCapability.SUBJECT_PARENT_COMMUNICATION]: {
    allowedAssignmentTypes: SUBJECT_TEACHING_TYPES,
    requiresSubject: true,
    subjectMatch: 'EXACT',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },

  // ---- Homeroom cross-subject READ ---------------------------------------
  [TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    // The whole point: the Class Teacher's assignment carries no subject, yet
    // authorizes reading records that belong to every subject in the section.
    subjectMatch: 'ANY',
    access: 'READ',
    requiresRecordOwnership: false,
    // ...but never another teacher's private draft.
    visibleRecordStatuses: NON_DRAFT_STATUSES,
  },

  // ---- Homeroom-owned WRITE ----------------------------------------------
  [TeacherCapability.HOMEROOM_COMMUNICATION_CREATE]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    subjectMatch: 'NONE',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.HOMEROOM_RECORD_WRITE]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    subjectMatch: 'NONE',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
  [TeacherCapability.HOMEROOM_MISSING_MARK_ESCALATE]: {
    allowedAssignmentTypes: [TeacherAssignmentType.CLASS_TEACHER],
    requiresSubject: false,
    subjectMatch: 'NONE',
    access: 'WRITE',
    requiresRecordOwnership: false,
  },
};

/** Capabilities that authorize a mutation. Used to keep READ off write paths. */
export const WRITE_CAPABILITIES: readonly TeacherCapability[] = (
  Object.keys(CAPABILITY_RULES) as TeacherCapability[]
).filter((capability) => CAPABILITY_RULES[capability].access === 'WRITE');
