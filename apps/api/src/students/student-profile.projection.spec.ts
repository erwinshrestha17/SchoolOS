import type { AuthContext } from '../auth/auth.types';
import {
  authorizeStudentProfile,
  projectStudentProfile,
  STUDENT_PROFILE_KEY_SECTIONS,
  STUDENT_RECORD_KEY_SECTIONS,
} from './student-profile.projection';

const enabled = { module: 'students', state: 'ENABLED' } as const;
const resource = { TENANT: 'tenant-1', STUDENT: 'student-1' };

function actorWith(permissions: string[], roles = ['admin']): AuthContext {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    roles,
    permissions,
  } as unknown as AuthContext;
}

function authorize(permissions: string[], teacher = false) {
  return authorizeStudentProfile({
    actor: actorWith(permissions, teacher ? ['teacher'] : ['admin']),
    resource,
    teacherAssignmentVerified: teacher,
    lifecycleState: 'ACTIVE',
    entitlementState: enabled,
  });
}

describe('Student profile projection policy (Phase 3B)', () => {
  it('never offers UPDATE_PROFILE without the fields the edit form round-trips', () => {
    const permissionSets = [
      ['students:read'],
      ['students:read', 'students:update'],
      ['students:update'],
      ['students:read', 'guardians:read', 'ledger:read'],
    ];
    for (const permissions of permissionSets) {
      const authorization = authorize(permissions);
      if (authorization.allowedActions.includes('UPDATE_PROFILE')) {
        expect(authorization.authorizedSections).toEqual(
          expect.arrayContaining(['health', 'identityCredentials']),
        );
      }
    }
  });

  it('students:read alone releases identity only', () => {
    const authorization = authorize(['students:read']);
    expect(authorization.authorizedSections).toEqual(['identity']);
    expect(authorization.allowedActions).toEqual([]);
  });

  it('an accountant-style reader gets fees but not health or guardians', () => {
    const authorization = authorize(['students:read', 'ledger:read']);
    expect(authorization.authorizedSections).toEqual(['fees', 'identity']);
  });

  it('a verified teacher assignment releases guardian contacts, not administration', () => {
    const authorization = authorize(['students:read', 'attendance:read'], true);
    expect(authorization.authorizedSections).toEqual([
      'attendance',
      'guardianContacts',
      'identity',
    ]);
  });

  it('binds every protected key to a declared section', () => {
    const declared = new Set([
      'identity',
      'guardianContacts',
      'guardianAdministration',
      'health',
      'identityCredentials',
      'qrCredential',
      'documents',
      'fees',
      'attendance',
      'activity',
      'academics',
      'homework',
    ]);
    for (const section of [
      ...Object.values(STUDENT_RECORD_KEY_SECTIONS),
      ...Object.values(STUDENT_PROFILE_KEY_SECTIONS),
    ])
      expect(declared.has(section)).toBe(true);
  });

  it('projects nested and top-level keys from the same decisions', () => {
    const projected = projectStudentProfile(
      {
        student: {
          id: 'student-1',
          medicalConditions: 'secret',
          nationalStudentId: 'secret-id',
          guardians: [],
        },
        guardians: [],
        invoices: [{ id: 'invoice' }],
        enrollments: [],
      },
      authorize(['students:read']),
    );

    expect(projected.student).toEqual({ id: 'student-1' });
    expect(projected).not.toHaveProperty('invoices');
    expect(projected).not.toHaveProperty('guardians');
    expect(projected).toHaveProperty('enrollments');
    expect(JSON.stringify(projected)).not.toContain('secret');
  });
});

describe('Student 360 persona projection (Phase 5F)', () => {
  // Bind to the shipped role templates, not hand-picked permission lists, so
  // a template change that leaks academics to finance fails here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { systemRolePermissions } = require('@schoolos/core') as {
    systemRolePermissions: Record<string, string[]>;
  };
  const sectionsFor = (role: string, teacher = false) =>
    authorizeStudentProfile({
      actor: actorWith(systemRolePermissions[role], [role]),
      resource,
      teacherAssignmentVerified: teacher,
      lifecycleState: 'ACTIVE',
      entitlementState: enabled,
    }).authorizedSections;

  it('teacher: identity, attendance, academics, homework, permitted guardian contact — no fees, health or documents', () => {
    const sections = sectionsFor('teacher', true);
    expect(sections).toEqual(
      expect.arrayContaining([
        'identity',
        'attendance',
        'academics',
        'homework',
        'guardianContacts',
      ]),
    );
    for (const denied of [
      'fees',
      'health',
      'documents',
      'guardianAdministration',
    ])
      expect(sections).not.toContain(denied);
  });

  it('accountant: identity and fees — never marks, homework, attendance or health', () => {
    const sections = sectionsFor('accountant');
    expect(sections).toEqual(expect.arrayContaining(['identity', 'fees']));
    for (const denied of ['academics', 'homework', 'attendance', 'health'])
      expect(sections).not.toContain(denied);
  });

  it('principal: oversight includes academics, attendance and guardian administration — not fees or health', () => {
    const sections = sectionsFor('principal');
    expect(sections).toEqual(
      expect.arrayContaining(['identity', 'academics', 'attendance']),
    );
    for (const denied of ['fees', 'health'])
      expect(sections).not.toContain(denied);
  });

  it('denied academic sections are absent from the JSON, not empty', () => {
    const projected = projectStudentProfile(
      {
        student: { id: 'student-1' },
        academicResults: [{ id: 'rc-1', grade: 'A' }],
        homeworkSubmissions: [{ id: 'hs-1' }],
        invoices: [{ id: 'inv-1' }],
      },
      authorize(['students:read', 'ledger:read']),
    );
    expect(projected).not.toHaveProperty('academicResults');
    expect(projected).not.toHaveProperty('homeworkSubmissions');
    expect(projected).toHaveProperty('invoices');
  });
});
