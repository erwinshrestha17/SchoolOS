import { systemRolePermissions } from '@schoolos/core';

describe('Communications/Notices RBAC Hardening', () => {
  const consentManagementKeys = [
    'consents:manage',
    'communications:manage_consent',
  ];

  const broadNoticesReadRoles = [
    'teacher',
    'subject_teacher',
    'support_staff',
    'student',
    'parent',
    'hr_manager',
  ];

  it('grants consent management only to admin and school_config_owner', () => {
    for (const role of broadNoticesReadRoles) {
      for (const key of consentManagementKeys) {
        expect(systemRolePermissions[role]).not.toContain(key);
      }
    }

    for (const key of consentManagementKeys) {
      expect(systemRolePermissions.admin).toContain(key);
      expect(systemRolePermissions.school_config_owner).toContain(key);
    }
  });

  it('keeps notices:read broadly granted for self-scoped preference access', () => {
    for (const role of broadNoticesReadRoles) {
      expect(systemRolePermissions[role]).toContain('notices:read');
    }
  });

  it('does not grant notices:approve or notices:send_emergency to hr_manager, the one built-in role holding notices:create without full notice-lifecycle authority', () => {
    // hr_manager is the profile the removed notices:create alias used to
    // silently elevate: it holds notices:create but not
    // publish/cancel/archive/schedule. See roles-permissions.guard.ts —
    // notices:approve and notices:send_emergency are catalog permissions
    // enforced nowhere; real high-impact approval runs through the
    // independent advanced:approvals:decide workflow.
    expect(systemRolePermissions.hr_manager).toContain('notices:create');
    expect(systemRolePermissions.hr_manager).not.toContain('notices:approve');
    expect(systemRolePermissions.hr_manager).not.toContain(
      'notices:send_emergency',
    );
  });
});
