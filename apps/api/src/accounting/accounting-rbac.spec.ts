import { permissionCatalog, systemRolePermissions } from '@schoolos/core';

describe('Accounting RBAC Hardening', () => {
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
  ];

  const accountingReadKeys = permissionCatalog
    .filter(
      ({ resource, action }) =>
        (resource.startsWith('accounting') || resource === 'accounting') &&
        (action === 'read' || resource === 'accounting:reports'),
    )
    .map(({ resource, action }) => `${resource}:${action}`);

  it('has a non-empty read/reports surface to assert against', () => {
    // Guards this spec itself against silently testing nothing if the
    // catalog is ever restructured.
    expect(accountingReadKeys.length).toBeGreaterThan(5);
  });

  it('PRD 11.12: principal keeps read-only accounting visibility, not operations', () => {
    for (const key of accountingOperationalKeys) {
      expect(systemRolePermissions.principal).not.toContain(key);
    }
  });

  it('principal retains every accounting read/reports permission', () => {
    for (const key of accountingReadKeys) {
      expect(systemRolePermissions.principal).toContain(key);
    }
  });

  it('accountant keeps full operational accounting access (unaffected by the principal fix)', () => {
    for (const key of accountingOperationalKeys) {
      expect(systemRolePermissions.accountant).toContain(key);
    }
  });
});
