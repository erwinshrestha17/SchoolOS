import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import {
  requirePayrollDuty,
  payrollDutyAvailable,
  type PayrollDuty,
} from './payroll.policy';

const run = {
  generatedById: 'preparer',
  reviewedById: 'reviewer',
  approvedById: 'approver',
};
const actor = (
  userId: string,
  permissions: string[],
  overrides: Partial<AuthContext> = {},
): AuthContext => ({
  userId,
  tenantId: 'tenant',
  tenantSlug: 'school',
  email: null,
  authMethod: 'PASSWORD',
  roles: ['custom_school_role'],
  permissions,
  ...overrides,
});

describe('payroll separation of duties', () => {
  it.each([
    ['preparer', 'REVIEW', 'payroll:run:review'],
    ['preparer', 'APPROVE', 'payroll:run:approve'],
    ['reviewer', 'APPROVE', 'payroll:run:approve'],
    ['preparer', 'FINALIZE', 'payroll:run:finalize'],
    ['preparer', 'POST', 'payroll:run:post'],
    ['approver', 'POST', 'payroll:run:post'],
  ] as const)(
    'rejects %s performing %s even with its permission and multiple roles',
    (userId, duty, permission) => {
      const multipleRoles = actor(userId, [permission], {
        roles: [
          'admin',
          'payroll_preparer',
          'payroll_reviewer',
          'payroll_approver',
        ],
      });
      expect(() => {
        requirePayrollDuty(multipleRoles, duty, run);
      }).toThrow(ForbiddenException);
      expect(payrollDutyAvailable(multipleRoles, duty, run)).toBe(false);
    },
  );

  it.each([
    'VALIDATE',
    'SUBMIT_REVIEW',
    'REVIEW',
    'APPROVE',
    'FINALIZE',
    'POST',
  ] as const)('denies missing %s capability', (duty) => {
    expect(() => {
      requirePayrollDuty(actor('independent', []), duty, run);
    }).toThrow(ForbiddenException);
  });

  it.each([
    { securityDomain: 'PLATFORM' as const },
    { roles: ['platform_super_admin'] },
    { isSupportOverride: true, supportOverrideReadOnly: false },
  ])(
    'never lets platform or exceptional support access become a payroll duty',
    (overrides) => {
      expect(() => {
        requirePayrollDuty(
          actor('platform', ['payroll:run:approve'], overrides),
          'APPROVE',
          run,
        );
      }).toThrow(ForbiddenException);
    },
  );

  it('requires durable preparer, reviewer and independent approval evidence', () => {
    expect(() => {
      requirePayrollDuty(
        actor('reviewer', ['payroll:run:review']),
        'REVIEW',
        {},
      );
    }).toThrow(ConflictException);
    for (const invalid of [
      { ...run, reviewedById: null },
      { ...run, approvedById: null },
      { ...run, approvedById: 'preparer' },
      { ...run, reviewedById: 'preparer' },
      { ...run, approvedById: 'reviewer' },
    ])
      expect(() => {
        requirePayrollDuty(
          actor('posting', ['payroll:run:post']),
          'POST',
          invalid,
        );
      }).toThrow(ConflictException);
  });

  it.each([
    ['preparer', 'VALIDATE', 'payroll:run:validate'],
    ['preparer', 'SUBMIT_REVIEW', 'payroll:run:create'],
    ['reviewer', 'REVIEW', 'payroll:run:review'],
    ['approver', 'APPROVE', 'payroll:run:approve'],
    ['finalizer', 'FINALIZE', 'payroll:run:finalize'],
    ['posting', 'POST', 'payroll:run:post'],
  ] as const)(
    'allows independently authorized %s for %s',
    (userId, duty: PayrollDuty, permission) => {
      expect(() => {
        requirePayrollDuty(actor(userId, [permission]), duty, run);
      }).not.toThrow();
      expect(payrollDutyAvailable(actor(userId, [permission]), duty, run)).toBe(
        true,
      );
    },
  );
});
