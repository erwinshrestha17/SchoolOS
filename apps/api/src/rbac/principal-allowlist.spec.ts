import {
  PRINCIPAL_PERMISSION_KEYS,
  permissionCatalog,
  systemRolePermissions,
} from '@schoolos/core';
import { buildPermissionKey } from '../rbac/rbac.defaults';

describe('Principal explicit permission allowlist (PPR-P0-01)', () => {
  const principal = systemRolePermissions.principal;

  const PRINCIPAL_FORBIDDEN_KEYS = [
    'students:create',
    'students:update',
    'students:manage_lifecycle',
    'guardians:create',
    'guardians:update',
    'enrollments:create',
    'attendance:mark',
    'attendance:manage_all',
    'academics:manage',
    'academics:enter_marks',
    'marks:manage',
    'staff:create',
    'staff:update',
    'hr:manage',
    'payroll:manage',
    'payroll:run:create',
    'fees:manage',
    'payments:collect',
    'payments:refund',
    'receipts:manage',
    'ledger:read',
    'accounting:journals:create',
    'accounting:journals:submit',
    'accounting:journals:approve',
    'accounting:journals:post',
    'accounting:settings:update',
    'accounting:expenses:write',
    'accounting:payables:write',
    'accounting:reconciliation:manage',
    'accounting:posting-batches:retry',
    'settings:manage',
    'settings:delegate',
    'settings:identity:manage',
    'library:manage',
    'transport:manage',
    'transport:operate',
    'canteen:pos:write',
    'learning:manage',
    'messaging:create',
    'messaging:manage',
    'users:create',
    'finance:approvals:decide',
  ];

  const PRINCIPAL_REQUIRED_READ_KEYS = [
    'students:read',
    'enrollments:read',
    'attendance:read',
    'academics:read',
    'staff:read',
    'hr:read',
    'notices:read',
    'reports:read',
    'accounting:read',
    'finance:principal:read',
  ];

  const PRINCIPAL_APPROVAL_KEYS = [
    'notices:approve',
    'advanced:approvals:read',
    'advanced:approvals:decide',
    'attendance:review_conflicts',
    'attendance:override_lock',
    'hr:leave:approve',
    'marks:review_lock',
    'exam-terms:unlock',
    'results:publish',
    'results:unpublish',
    'academics:report_cards:review',
  ];

  it('uses the exported explicit allowlist as the principal preset', () => {
    expect([...principal].sort()).toEqual([...PRINCIPAL_PERMISSION_KEYS].sort());
  });

  it('does not inherit tenant permissions by default (anti-inheritance)', () => {
    const allTenantKeys = permissionCatalog.map(({ resource, action }) =>
      buildPermissionKey(resource, action),
    );
    const inheritedOperational = allTenantKeys.filter(
      (key) => PRINCIPAL_FORBIDDEN_KEYS.includes(key) && principal.includes(key),
    );
    expect(inheritedOperational).toEqual([]);
  });

  it('denies operational keys from the PPR-P0-01 exclusion matrix', () => {
    for (const key of PRINCIPAL_FORBIDDEN_KEYS) {
      expect(principal).not.toContain(key);
    }
  });

  it('retains dashboard-critical read permissions', () => {
    for (const key of PRINCIPAL_REQUIRED_READ_KEYS) {
      expect(principal).toContain(key);
    }
  });

  it('retains designated approval permissions including narrow academic keys', () => {
    for (const key of PRINCIPAL_APPROVAL_KEYS) {
      expect(principal).toContain(key);
    }
  });

  it('retains every accounting read/reports permission and no operational accounting writes', () => {
    const accountingReadKeys = permissionCatalog
      .filter(
        ({ resource, action }) =>
          (resource.startsWith('accounting') || resource === 'accounting') &&
          (action === 'read' || resource === 'accounting:reports'),
      )
      .map(({ resource, action }) => buildPermissionKey(resource, action));

    const accountingOperationalKeys = [
      'accounting:close',
      'accounting:reverse',
      'accounting:accounts:write',
      'accounting:fiscal:manage',
      'accounting:fiscal:reopen',
      'accounting:journals:create',
      'accounting:journals:submit',
      'accounting:journals:approve',
      'accounting:journals:reject',
      'accounting:journals:post',
      'accounting:journals:cancel',
      'accounting:journals:reverse',
      'accounting:settings:update',
      'accounting:exports:create',
      'accounting:expenses:write',
      'accounting:vendors:write',
      'accounting:payables:write',
      'accounting:reconciliation:manage',
      'accounting:reconciliation:finalize',
      'accounting:posting-batches:retry',
      'accounting:payroll-handoff:post',
      'accounting:budgets:write',
    ];

    for (const key of accountingReadKeys) {
      expect(principal).toContain(key);
    }
    for (const key of accountingOperationalKeys) {
      expect(principal).not.toContain(key);
    }
  });

  it('is materially smaller than the previous denylist inheritance model', () => {
    expect(principal.length).toBeLessThan(100);
    expect(principal.length).toBeGreaterThan(50);
  });
});
