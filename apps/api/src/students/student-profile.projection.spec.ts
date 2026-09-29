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
