import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import {
  projectStaffFinancialRecord,
  requireStaffFieldWrites,
} from './staff.policy';

const actor: AuthContext = {
  tenantId: 'tenant',
  userId: 'hr',
  tenantSlug: 'school',
  email: 'hr@example.test',
  roles: ['hr_manager'],
  permissions: ['hr:manage', 'payroll:salary:read'],
  authMethod: 'PASSWORD',
};
describe('Staff protected field policy', () => {
  it.each(['bankAccount', 'bankName', 'panNumber', 'citizenshipNo'])(
    'denies basic HR writing %s, including clearing the field',
    (key) => {
      expect(() => {
        requireStaffFieldWrites(actor, { [key]: null });
      }).toThrow(ForbiddenException);
    },
  );
  it('allows an explicit bank writer without granting tax or identity authority', () => {
    const bankActor = { ...actor, permissions: ['hr:bank:write'] };
    expect(() => {
      requireStaffFieldWrites(bankActor, { bankAccount: 'changed' });
    }).not.toThrow();
    expect(() => {
      requireStaffFieldWrites(bankActor, { panNumber: 'tax' });
    }).toThrow(ForbiddenException);
  });
  it('projects salary separately from bank, tax and nested raw records', () => {
    const row = {
      id: 'salary',
      basicSalary: '10000',
      bankAccount: 'secret-bank',
      panNumber: 'secret-tax',
      tdsAmount: '500',
      payslip: { documentId: 'secret' },
      payrollRun: { approvedSourceFingerprint: 'private' },
      disciplinaryNotes: 'private',
    };
    expect(projectStaffFinancialRecord(row, actor, 'SALARY')).toEqual({
      id: 'salary',
      basicSalary: '10000',
    });
    expect(
      projectStaffFinancialRecord(
        row,
        { ...actor, permissions: ['hr:bank:read'] },
        'SALARY',
      ),
    ).toEqual({ id: 'salary', bankAccount: 'secret-bank' });
    expect(
      projectStaffFinancialRecord(
        row,
        { ...actor, permissions: ['hr:tax:read'] },
        'SALARY',
      ),
    ).toEqual({ id: 'salary', panNumber: 'secret-tax', tdsAmount: '500' });
  });
  it.each([
    { ...actor, securityDomain: 'PLATFORM' as const },
    { ...actor, roles: ['platform_super_admin'] },
    { ...actor, isSupportOverride: true },
  ])(
    'denies protected-field authority across the Platform/support boundary',
    (invalidActor) => {
      expect(
        projectStaffFinancialRecord(
          { id: 'contract', basicSalary: '10000' },
          invalidActor,
          'CONTRACT',
        ),
      ).toEqual({ id: 'contract' });
      expect(() => {
        requireStaffFieldWrites(
          { ...invalidActor, permissions: ['hr:bank:write'] },
          { bankAccount: 'changed' },
        );
      }).toThrow(ForbiddenException);
    },
  );
});
