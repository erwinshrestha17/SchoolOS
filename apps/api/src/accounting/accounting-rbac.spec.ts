import { systemRolePermissions } from '@schoolos/core';

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

  const principalAccountingReadKeys = [
    'accounting:read',
    'accounting:accounts:read',
    'accounting:journals:read',
    'accounting:reports:read',
    'accounting:reports:trial-balance',
  ];

  it('PRD 11.12: principal keeps read-only accounting visibility, not operations', () => {
    for (const key of accountingOperationalKeys) {
      expect(systemRolePermissions.principal).not.toContain(key);
    }
  });

  it('principal retains the reviewed accounting visibility needed by oversight', () => {
    for (const key of principalAccountingReadKeys) {
      expect(systemRolePermissions.principal).toContain(key);
    }
  });

  it('accountant keeps full operational accounting access (unaffected by the principal fix)', () => {
    for (const key of accountingOperationalKeys) {
      expect(systemRolePermissions.accountant).toContain(key);
    }
  });
});
