import { resolveSchoolWebPersona } from '@schoolos/core';

describe('resolveSchoolWebPersona', () => {
  it('returns teacher for teaching-only roles', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['teacher'],
        permissions: ['attendance:mark', 'homework:read'],
      }),
    ).toBe('teacher');
  });

  it('returns principal ahead of accountant when both roles are present', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['principal', 'accountant'],
        permissions: ['fees:manage', 'accounting:read'],
      }),
    ).toBe('principal');
  });

  it('returns accountant for accountant-only sessions', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['accountant'],
        permissions: ['fees:manage', 'payments:collect', 'accounting:read'],
      }),
    ).toBe('accountant');
  });

  it('returns hr for hr_manager sessions', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['hr_manager'],
        permissions: ['hr:read', 'payroll:read'],
      }),
    ).toBe('hr');
  });

  it('returns librarian for librarian role', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['librarian'],
        permissions: ['library:read', 'library:manage'],
      }),
    ).toBe('librarian');
  });

  it('returns cashier for payment-collect without accounting admin', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['support_staff'],
        permissions: ['payments:collect', 'payments:close', 'receipts:read'],
      }),
    ).toBe('cashier');
  });

  it('returns admin for school admin roles', () => {
    expect(
      resolveSchoolWebPersona({
        roles: ['admin'],
        permissions: ['settings:manage', 'students:create'],
      }),
    ).toBe('admin');
  });
});
