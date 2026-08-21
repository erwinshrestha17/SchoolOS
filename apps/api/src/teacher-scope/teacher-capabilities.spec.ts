import {
  ATTENDANCE_SESSION_STATE_LABELS,
  resolveAttendanceSessionState,
  resolveTeacherPersona,
  resolveTeacherRouteRestriction,
  systemRolePermissions,
  TeacherCapability,
} from '@schoolos/core';

/**
 * The Teacher Web capability matrix is the single gate deciding which
 * administrative surfaces a teacher may reach. These assertions pin the
 * validation identities from the Teacher Persona spec so a permission added
 * to the `teacher` preset can never silently hand ordinary teachers the exam,
 * moderation, library or settings consoles.
 */

const TEACHER_PERMISSIONS = systemRolePermissions.teacher;
const SUBJECT_TEACHER_PERMISSIONS = systemRolePermissions.subject_teacher;

function personaFor(roles: string[], permissions: string[]) {
  return resolveTeacherPersona({ roles, permissions });
}

function restrictionFor(
  pathname: string,
  roles: string[],
  permissions: string[],
) {
  const { isTeacherPersona, capabilities } = personaFor(roles, permissions);
  if (!isTeacherPersona) return null;
  return resolveTeacherRouteRestriction(pathname, capabilities);
}

describe('teacher capability matrix', () => {
  describe('persona resolution', () => {
    it('treats an ordinary class teacher as the teacher persona', () => {
      expect(
        personaFor(['teacher'], TEACHER_PERMISSIONS).isTeacherPersona,
      ).toBe(true);
    });

    it('treats a subject teacher without a homeroom as the teacher persona', () => {
      expect(
        personaFor(['subject_teacher'], SUBJECT_TEACHER_PERMISSIONS)
          .isTeacherPersona,
      ).toBe(true);
    });

    it('does not apply teacher restrictions to an admin or principal who also teaches', () => {
      expect(
        personaFor(['teacher', 'principal'], TEACHER_PERMISSIONS)
          .isTeacherPersona,
      ).toBe(false);
      expect(
        personaFor(['teacher', 'admin'], TEACHER_PERMISSIONS).isTeacherPersona,
      ).toBe(false);
    });

    it('does not apply teacher restrictions to a teacher-librarian holding the librarian role', () => {
      expect(
        personaFor(['teacher', 'librarian'], TEACHER_PERMISSIONS)
          .isTeacherPersona,
      ).toBe(false);
    });
  });

  describe('ordinary teacher has no administrative capability', () => {
    const administrative = [
      TeacherCapability.TIMETABLE_ADMIN,
      TeacherCapability.SUBSTITUTION_ADMIN,
      TeacherCapability.EXAM_TERM_ADMIN,
      TeacherCapability.ACADEMIC_STRUCTURE_ADMIN,
      TeacherCapability.REPORT_CARD_ADMIN,
      TeacherCapability.ACTIVITY_MODERATE,
      TeacherCapability.NOTICE_ADMIN,
      TeacherCapability.NOTICE_DELIVERY_OPS,
      TeacherCapability.LIBRARY_ADMIN,
      TeacherCapability.SCHOOL_SETTINGS_ADMIN,
      TeacherCapability.STUDENT_DIRECTORY_ADMIN,
      TeacherCapability.STAFF_ADMIN,
    ];

    it.each(administrative)(
      'withholds %s from the teacher preset',
      (capability) => {
        const { capabilities } = personaFor(['teacher'], TEACHER_PERMISSIONS);
        expect(capabilities.has(capability)).toBe(false);
      },
    );

    it.each(administrative)(
      'withholds %s from the subject_teacher preset',
      (capability) => {
        const { capabilities } = personaFor(
          ['subject_teacher'],
          SUBJECT_TEACHER_PERMISSIONS,
        );
        expect(capabilities.has(capability)).toBe(false);
      },
    );

    it('still grants the everyday teaching capabilities', () => {
      const { capabilities } = personaFor(['teacher'], TEACHER_PERMISSIONS);
      expect(capabilities.has(TeacherCapability.MARKS_ENTRY)).toBe(true);
      expect(capabilities.has(TeacherCapability.ATTENDANCE_MARK)).toBe(true);
      expect(capabilities.has(TeacherCapability.HOMEWORK_AUTHOR)).toBe(true);
      expect(capabilities.has(TeacherCapability.ACTIVITY_AUTHOR)).toBe(true);
    });
  });

  describe('restricted routes', () => {
    const blockedForOrdinaryTeachers = [
      '/dashboard/timetable/builder',
      '/dashboard/timetable/versions',
      '/dashboard/timetable/conflicts',
      '/dashboard/timetable/substitutions',
      '/dashboard/academics/exam-terms',
      '/dashboard/academics/assessment-components',
      '/dashboard/academics/publishing',
      '/dashboard/academics/locks',
      '/dashboard/activity/moderation',
      '/dashboard/activity/reports',
      '/dashboard/notifications/deliveries',
      '/dashboard/notifications/failures',
      '/dashboard/notices/deliveries',
      '/dashboard/notices/failures',
      '/dashboard/library/catalog',
      '/dashboard/library/borrowers',
      '/dashboard/library/fines',
      '/dashboard/library/issue-return',
      '/dashboard/settings/access/roles',
      '/dashboard/settings/system/integrations',
      '/dashboard/settings/school/modules',
      '/dashboard/students',
      '/dashboard/hr',
      '/dashboard/payroll',
    ];

    it.each(blockedForOrdinaryTeachers)(
      'blocks %s for an ordinary teacher',
      (pathname) => {
        const restriction = restrictionFor(
          pathname,
          ['teacher'],
          TEACHER_PERMISSIONS,
        );
        expect(restriction).not.toBeNull();
        expect(restriction?.redirectTo).toMatch(/^\/dashboard/);
        // The redirect must not bounce back into a restricted route.
        const { capabilities } = personaFor(['teacher'], TEACHER_PERMISSIONS);
        expect(
          resolveTeacherRouteRestriction(restriction!.redirectTo, capabilities),
        ).toBeNull();
      },
    );

    const allowedForOrdinaryTeachers = [
      '/dashboard',
      '/dashboard/my-students',
      '/dashboard/my-workspace',
      '/dashboard/timetable',
      '/dashboard/attendance',
      '/dashboard/attendance/register/monthly',
      '/dashboard/homework',
      '/dashboard/homework/new',
      '/dashboard/academics/marks',
      '/dashboard/academics/cas',
      '/dashboard/academics/results',
      '/dashboard/activity',
      '/dashboard/activity/new',
      '/dashboard/notices',
      '/dashboard/library',
      '/dashboard/settings/personal/profile',
      '/dashboard/settings/personal/security',
      '/dashboard/settings/personal/notifications',
    ];

    it.each(allowedForOrdinaryTeachers)(
      'allows %s for an ordinary teacher',
      (pathname) => {
        expect(
          restrictionFor(pathname, ['teacher'], TEACHER_PERMISSIONS),
        ).toBeNull();
      },
    );

    it('leaves every route open for an administrator', () => {
      for (const pathname of blockedForOrdinaryTeachers) {
        expect(
          restrictionFor(pathname, ['admin'], ['settings:manage']),
        ).toBeNull();
      }
    });
  });

  describe('delegated capabilities', () => {
    it('opens exam-term administration for a delegated exam coordinator only', () => {
      const coordinator = [...TEACHER_PERMISSIONS, 'exam-terms:manage'];
      expect(
        restrictionFor(
          '/dashboard/academics/exam-terms',
          ['teacher'],
          coordinator,
        ),
      ).toBeNull();
      // and nothing else
      expect(
        restrictionFor(
          '/dashboard/activity/moderation',
          ['teacher'],
          coordinator,
        ),
      ).not.toBeNull();
      expect(
        restrictionFor('/dashboard/library/fines', ['teacher'], coordinator),
      ).not.toBeNull();
    });

    it('opens activity moderation for a delegated moderator only', () => {
      const moderator = [...TEACHER_PERMISSIONS, 'activity_feed:moderate'];
      expect(
        restrictionFor(
          '/dashboard/activity/moderation',
          ['teacher'],
          moderator,
        ),
      ).toBeNull();
      expect(
        restrictionFor('/dashboard/timetable/builder', ['teacher'], moderator),
      ).not.toBeNull();
    });

    it('opens the timetable builder for a delegated timetable coordinator only', () => {
      const coordinator = [...TEACHER_PERMISSIONS, 'timetable:manage'];
      expect(
        restrictionFor(
          '/dashboard/timetable/builder',
          ['teacher'],
          coordinator,
        ),
      ).toBeNull();
      expect(
        restrictionFor(
          '/dashboard/academics/exam-terms',
          ['teacher'],
          coordinator,
        ),
      ).not.toBeNull();
    });

    it('opens the library desk for a delegated teacher-librarian only', () => {
      const teacherLibrarian = [...TEACHER_PERMISSIONS, 'library:manage'];
      expect(
        restrictionFor(
          '/dashboard/library/catalog',
          ['teacher'],
          teacherLibrarian,
        ),
      ).toBeNull();
      expect(
        restrictionFor(
          '/dashboard/notifications/deliveries',
          ['teacher'],
          teacherLibrarian,
        ),
      ).not.toBeNull();
    });

    it('keeps school settings shut for every delegation short of settings management', () => {
      for (const delegated of [
        'exam-terms:manage',
        'activity_feed:moderate',
        'timetable:manage',
        'library:manage',
      ]) {
        expect(
          restrictionFor(
            '/dashboard/settings/access/roles',
            ['teacher'],
            [...TEACHER_PERMISSIONS, delegated],
          ),
        ).not.toBeNull();
      }
    });
  });

  describe('teacher with no permissions at all', () => {
    it('fails closed: every administrative route stays blocked', () => {
      expect(
        restrictionFor('/dashboard/academics/exam-terms', ['teacher'], []),
      ).not.toBeNull();
      expect(
        restrictionFor('/dashboard/settings', ['teacher'], []),
      ).not.toBeNull();
    });
  });
});

describe('canonical attendance session state', () => {
  const lockPast = new Date('2026-07-01T00:00:00.000Z');
  const lockFuture = new Date('2099-01-01T00:00:00.000Z');
  const submitted = new Date('2026-06-30T10:00:00.000Z');

  it('reports NOT_STARTED when nothing has been marked', () => {
    expect(
      resolveAttendanceSessionState({
        submittedAt: null,
        lockAt: lockFuture,
        conflictStatus: 'NONE',
        hasRecords: false,
      }),
    ).toBe('NOT_STARTED');
  });

  it('reports DRAFT once records exist but nothing is submitted', () => {
    expect(
      resolveAttendanceSessionState({
        submittedAt: null,
        lockAt: lockFuture,
        conflictStatus: 'NONE',
        hasRecords: true,
      }),
    ).toBe('DRAFT');
  });

  it('reports SUBMITTED before the lock time passes', () => {
    expect(
      resolveAttendanceSessionState({
        submittedAt: submitted,
        lockAt: lockFuture,
        conflictStatus: 'NONE',
        hasRecords: true,
      }),
    ).toBe('SUBMITTED');
  });

  it('reports LOCKED once the lock time has passed', () => {
    expect(
      resolveAttendanceSessionState({
        submittedAt: submitted,
        lockAt: lockPast,
        conflictStatus: 'NONE',
        hasRecords: true,
      }),
    ).toBe('LOCKED');
  });

  it('reports CONFLICT ahead of every other state, because it needs a human', () => {
    expect(
      resolveAttendanceSessionState({
        submittedAt: submitted,
        lockAt: lockPast,
        conflictStatus: 'FLAGGED',
        hasRecords: true,
      }),
    ).toBe('CONFLICT');
  });

  it('never leaves a state without a school-facing label', () => {
    for (const state of [
      'NOT_STARTED',
      'DRAFT',
      'SUBMITTED',
      'LOCKED',
      'CONFLICT',
    ] as const) {
      expect(ATTENDANCE_SESSION_STATE_LABELS[state]).toBeTruthy();
    }
  });
});
