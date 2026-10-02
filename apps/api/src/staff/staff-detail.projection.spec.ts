import type { AuthContext } from '../auth/auth.types';
import {
  bankLastFour,
  fixedMask,
  projectStaffDetail,
  type StaffDetailSource,
} from './staff-detail.projection';

const actorWith = (...permissions: string[]): AuthContext => ({
  tenantId: 'tenant',
  userId: 'actor',
  tenantSlug: 'school',
  email: 'actor@example.test',
  roles: ['hr'],
  permissions,
  authMethod: 'PASSWORD',
});

const source = (): StaffDetailSource => ({
  id: 'staff-1',
  userId: 'user-1',
  tenantId: 'tenant',
  firstName: 'Sita',
  lastName: 'Rai',
  citizenshipNo: '12-34-56-78901',
  panNumber: '123456789',
  bankAccount: '00112233445566',
  bankName: 'Example Bank',
  passwordHash: 'must-never-appear',
  internalNote: 'unlisted column',
  user: {
    email: 'sita@example.test',
    userRoles: [{ role: { name: 'teacher' } }],
  },
  staffContracts: [{ id: 'c1', basicSalary: '90000', secretField: 'x' }],
  salaryStructures: [
    { id: 's1', basicSalary: '90000', bankAccount: '9999', pfEnabled: true },
  ],
  payrollLines: [
    {
      id: 'p1',
      netSalary: '80000',
      paymentStatus: 'PAID',
      payrollRun: {
        id: 'r1',
        periodMonth: 1,
        periodYear: 2083,
        status: 'POSTED',
        journalId: 'j',
      },
    },
  ],
  attendanceRecords: [
    {
      id: 'a1',
      attendanceDate: '2026-01-01',
      status: 'PRESENT',
      deviceId: 'd',
    },
  ],
  leaveBalances: [{ id: 'b1', leaveType: 'ANNUAL', used: 2, internal: 1 }],
  leaveRequests: [
    {
      id: 'l1',
      leaveType: 'SICK',
      reason: 'flu',
      status: 'APPROVED',
      medicalRef: 'm',
    },
  ],
  qualificationsRecords: [{ id: 'q1', degree: 'B.Ed', hidden: 'x' }],
  experienceRecords: [{ id: 'e1', organization: 'Org', hidden: 'x' }],
  teacherAssignments: [],
});

describe('Staff 360 projection', () => {
  it('masks with fixed characters and never reveals leading digits', () => {
    expect(fixedMask('12-34')).toBe('****');
    expect(fixedMask(null)).toBeNull();
    expect(bankLastFour('00112233445566')).toBe('****5566');
    expect(bankLastFour('123')).toBe('****');
    expect(bankLastFour(undefined)).toBeUndefined();
  });

  it('a basic HR caller sees masked identity, last-four bank and no financial detail', () => {
    const result = projectStaffDetail(
      source(),
      actorWith('hr:staff:read', 'hr:manage'),
    );
    expect(result.citizenshipNo).toBe('****');
    expect(result.panNumber).toBe('****');
    expect(result.bankAccount).toBe('****5566');
    expect(result.bankName).toBeNull();
    expect(result.salaryStructures).toEqual([
      expect.objectContaining({ id: 's1', basicSalary: null, masked: true }),
    ]);
    expect(result.payrollLines).toEqual([
      expect.objectContaining({ id: 'p1', netSalary: null, masked: true }),
    ]);
    expect(result.qualificationsRecords).toEqual([]);
    expect(result.attendanceRecords).toEqual([]);
    expect(result.leaveRequests).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /12-34-56|123456789|00112233|9999|80000|90000/,
    );
  });

  it('never emits columns that are not on an allowlist', () => {
    const result = projectStaffDetail(
      source(),
      actorWith(
        'hr:manage',
        'payroll:salary:read',
        'hr:documents:read',
        'hr:attendance:read',
        'hr:leave:read',
        'hr:identity:read',
        'hr:tax:read',
        'hr:bank:read',
      ),
    );
    const text = JSON.stringify(result);
    for (const leaked of [
      'passwordHash',
      'must-never-appear',
      'internalNote',
      'secretField',
      'deviceId',
      'medicalRef',
      'journalId',
      'hidden',
    ])
      expect(text).not.toContain(leaked);
    expect('user' in result).toBe(false);
    expect(result.citizenshipNo).toBe('12-34-56-78901');
    expect(result.panNumber).toBe('123456789');
    expect(result.bankAccount).toBe('00112233445566');
    expect(result.bankName).toBe('Example Bank');
    expect(result.payrollLines[0]).toEqual(
      expect.objectContaining({ paymentStatus: 'PAID' }),
    );
    expect(result.payrollLines[0]).toHaveProperty('payrollRun', {
      id: 'r1',
      periodMonth: 1,
      periodYear: 2083,
      status: 'POSTED',
    });
  });

  it('attendance and leave are separate permissions, open to the owner', () => {
    const hr = actorWith('hr:manage');
    expect(projectStaffDetail(source(), hr).attendanceRecords).toHaveLength(0);
    const own = projectStaffDetail(source(), hr, { isSelf: true });
    expect(own.attendanceRecords).toHaveLength(1);
    expect(own.leaveRequests).toHaveLength(1);
    expect(own.salaryStructures[0]).toHaveProperty('masked', true);
    const attendanceOnly = projectStaffDetail(
      source(),
      actorWith('hr:manage', 'hr:attendance:read'),
    );
    expect(attendanceOnly.attendanceRecords).toHaveLength(1);
    expect(attendanceOnly.leaveRequests).toHaveLength(0);
  });

  it('exposes medical and safeguarding flags only to holders', () => {
    const none = projectStaffDetail(source(), actorWith('hr:manage'));
    expect(none.allowedSensitiveFields).toMatchObject({
      medicalRead: false,
      safeguardingRead: false,
      disciplinaryRead: false,
    });
    const some = projectStaffDetail(
      source(),
      actorWith('hr:manage', 'hr:medical:read'),
    );
    expect(some.allowedSensitiveFields).toMatchObject({
      medicalRead: true,
      safeguardingRead: false,
    });
  });

  it('Platform and support callers get no sensitive reveal', () => {
    const permissions = [
      'hr:manage',
      'payroll:salary:read',
      'hr:identity:read',
      'hr:bank:read',
    ];
    for (const actor of [
      { ...actorWith(...permissions), securityDomain: 'PLATFORM' as const },
      { ...actorWith(...permissions), isSupportOverride: true },
    ]) {
      const result = projectStaffDetail(source(), actor);
      expect(result.citizenshipNo).toBe('****');
      expect(result.bankAccount).toBe('****5566');
      expect(result.payrollLines[0]).toHaveProperty('masked', true);
    }
  });
});
