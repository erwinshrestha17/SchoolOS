import type { AuthContext } from '../auth/auth.types';
import { hasDomainPermission } from '../authorization/policies/domain-permission';
import { projectStaffFinancialRecord } from '../authorization/policies/staff.policy';

/**
 * Phase 7.2 — Staff 360 projection.
 *
 * Every category below is an explicit allowlist. Nothing is spread from the
 * stored record, so a new column (or a new relation field) is invisible to the
 * API until someone deliberately adds it here with its permission. Masking is
 * fixed ("****"); the only partial reveal is the last four digits of a bank
 * account for callers without `hr:bank:read`. No leading characters.
 *
 * Categories and what unlocks them (all within the owner-or-HR-manager guard
 * enforced by the caller):
 *   identity/personal/employment ........ the guard itself
 *   identity numbers (citizenship) ...... hr:identity:read
 *   tax identity (PAN) .................. hr:tax:read
 *   bank ................................ hr:bank:read (else last 4 only)
 *   compensation / payroll .............. payroll:salary:read (else placeholders)
 *   attendance .......................... hr:attendance:read, or the owner
 *   leave ............................... hr:leave:read, or the owner
 *   qualifications / experience ......... hr:documents:read
 *   documents / disciplinary / medical /
 *   safeguarding ........................ see staff-restricted.policy.ts
 */
type Row = Record<string, unknown>;

const MASK = '****';

function pick(source: unknown, keys: readonly string[]): Row {
  const value = (source && typeof source === 'object' ? source : {}) as Row;
  return Object.fromEntries(
    keys.filter((key) => key in value).map((key) => [key, value[key]]),
  );
}

export function fixedMask(value: string | null | undefined) {
  return value ? MASK : value;
}

export function bankLastFour(value: string | null | undefined) {
  if (!value) return value;
  const digits = value.trim();
  return digits.length > 4 ? `${MASK}${digits.slice(-4)}` : MASK;
}

const BASIC_KEYS = [
  'id',
  'employeeId',
  'staffCode',
  'firstName',
  'lastName',
  'firstNameNp',
  'lastNameNp',
  'photoUrl',
  'status',
  'department',
  'designation',
  'employmentType',
  'contractType',
  'contractStatus',
  'teacherRegistryId',
  'qualifications',
  'experience',
  'joiningDate',
  'probationEndDate',
  'dateOfBirth',
  'gender',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelation',
  'createdAt',
  'updatedAt',
] as const;

const ATTENDANCE_KEYS = [
  'id',
  'attendanceDate',
  'status',
  'leaveType',
  'note',
  'checkInAt',
  'checkOutAt',
] as const;
const LEAVE_BALANCE_KEYS = [
  'id',
  'leaveType',
  'year',
  'opening',
  'accrued',
  'allocated',
  'used',
  'carried',
  'adjusted',
] as const;
const LEAVE_REQUEST_KEYS = [
  'id',
  'leaveType',
  'isPaid',
  'startsOn',
  'endsOn',
  'days',
  'reason',
  'status',
  'reviewedAt',
  'reviewNote',
  'createdAt',
] as const;
const QUALIFICATION_KEYS = [
  'id',
  'degree',
  'institution',
  'year',
  'notes',
] as const;
const EXPERIENCE_KEYS = [
  'id',
  'organization',
  'role',
  'startsOn',
  'endsOn',
  'notes',
] as const;
const ASSIGNMENT_KEYS = [
  'id',
  'academicYearId',
  'subjectId',
  'classId',
  'sectionId',
] as const;

export interface StaffDetailSource extends Row {
  id: string;
  userId?: string | null;
  user?: {
    email?: string | null;
    userRoles?: Array<{ role: { name: string } }>;
  } | null;
  staffContracts?: unknown[];
  salaryStructures?: unknown[];
  attendanceRecords?: unknown[];
  leaveBalances?: unknown[];
  leaveRequests?: unknown[];
  payrollLines?: unknown[];
  qualificationsRecords?: unknown[];
  experienceRecords?: unknown[];
  teacherAssignments?: unknown[];
}

const SENSITIVE_FLAGS: Array<[string, string]> = [
  ['identityRead', 'hr:identity:read'],
  ['identityWrite', 'hr:identity:write'],
  ['bankRead', 'hr:bank:read'],
  ['bankWrite', 'hr:bank:write'],
  ['taxRead', 'hr:tax:read'],
  ['taxWrite', 'hr:tax:write'],
  ['documentsRead', 'hr:documents:read'],
  ['documentsManage', 'hr:documents:manage'],
  ['salaryRead', 'payroll:salary:read'],
  ['disciplinaryRead', 'hr:disciplinary:read'],
  ['medicalRead', 'hr:medical:read'],
  ['safeguardingRead', 'hr:safeguarding:read'],
  ['attendanceRead', 'hr:attendance:read'],
  ['leaveRead', 'hr:leave:read'],
];

function maskSalaryStructures(items: unknown[] | undefined) {
  return (items ?? []).map((item) => ({
    ...pick(item, ['id']),
    basicSalary: null,
    allowances: null,
    deductions: null,
    bankAccount: null,
    bankName: null,
    components: [],
    masked: true,
  }));
}

function maskPayrollLines(items: unknown[] | undefined) {
  return (items ?? []).map((item) => ({
    ...pick(item, ['id']),
    basicSalary: null,
    earnings: null,
    grossSalary: null,
    allowances: null,
    deductions: null,
    netSalary: null,
    masked: true,
  }));
}

function projectPayrollLine(item: unknown, actor: AuthContext) {
  const value = (item && typeof item === 'object' ? item : {}) as Row;
  return {
    ...projectStaffFinancialRecord(item, actor, 'PAYROLL'),
    // Period and settlement state carry no salary figure.
    paymentStatus: value.paymentStatus,
    payrollRun: pick(value.payrollRun, [
      'id',
      'periodMonth',
      'periodYear',
      'status',
    ]),
  };
}

export function projectStaffDetail(
  staff: StaffDetailSource,
  actor: AuthContext,
  options: { isSelf?: boolean } = {},
) {
  const can = (permission: string) => hasDomainPermission(actor, permission);
  const isSelf = options.isSelf === true;
  const canSalary = can('payroll:salary:read');
  const canDocuments = can('hr:documents:read');
  const canAttendance = isSelf || can('hr:attendance:read');
  const canLeave = isSelf || can('hr:leave:read');
  const basic = pick(staff, BASIC_KEYS);

  return {
    ...basic,
    id: staff.id,
    userId: staff.userId ?? null,
    email: staff.user?.email ?? null,
    roles: staff.user?.userRoles?.map(({ role }) => role.name) ?? [],
    allowedSensitiveFields: Object.fromEntries(
      SENSITIVE_FLAGS.map(([key, permission]) => [key, can(permission)]),
    ),
    citizenshipNo: can('hr:identity:read')
      ? (staff.citizenshipNo ?? null)
      : fixedMask(staff.citizenshipNo as string | null | undefined),
    panNumber: can('hr:tax:read')
      ? (staff.panNumber ?? null)
      : fixedMask(staff.panNumber as string | null | undefined),
    bankAccount: can('hr:bank:read')
      ? (staff.bankAccount ?? null)
      : bankLastFour(staff.bankAccount as string | null | undefined),
    bankName: can('hr:bank:read') ? (staff.bankName ?? null) : null,
    staffContracts: (staff.staffContracts ?? []).map((item) =>
      projectStaffFinancialRecord(item, actor, 'CONTRACT'),
    ),
    qualificationsRecords: canDocuments
      ? (staff.qualificationsRecords ?? []).map((item) =>
          pick(item, QUALIFICATION_KEYS),
        )
      : [],
    experienceRecords: canDocuments
      ? (staff.experienceRecords ?? []).map((item) =>
          pick(item, EXPERIENCE_KEYS),
        )
      : [],
    salaryStructures: canSalary
      ? (staff.salaryStructures ?? []).map((item) => ({
          ...projectStaffFinancialRecord(item, actor, 'SALARY'),
          ...pick(item, ['pfEnabled', 'tdsEnabled']),
        }))
      : maskSalaryStructures(staff.salaryStructures),
    payrollLines: canSalary
      ? (staff.payrollLines ?? []).map((item) =>
          projectPayrollLine(item, actor),
        )
      : maskPayrollLines(staff.payrollLines),
    attendanceRecords: canAttendance
      ? (staff.attendanceRecords ?? []).map((item) =>
          pick(item, ATTENDANCE_KEYS),
        )
      : [],
    leaveBalances: canLeave
      ? (staff.leaveBalances ?? []).map((item) =>
          pick(item, LEAVE_BALANCE_KEYS),
        )
      : [],
    leaveRequests: canLeave
      ? (staff.leaveRequests ?? []).map((item) =>
          pick(item, LEAVE_REQUEST_KEYS),
        )
      : [],
    teacherAssignments: (staff.teacherAssignments ?? []).map((item) => {
      const value = (item && typeof item === 'object' ? item : {}) as Row;
      return {
        ...pick(item, ASSIGNMENT_KEYS),
        subject: pick(value.subject, ['id', 'name', 'code']),
        class: pick(value.class, ['id', 'name']),
        section: pick(value.section, ['id', 'name']),
      };
    }),
    personal: {
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      address: staff.address,
      emergencyContact: {
        name: staff.emergencyContactName,
        phone: staff.emergencyContactPhone,
        relation: staff.emergencyContactRelation,
      },
    },
    employment: {
      department: staff.department,
      designation: staff.designation,
      employmentType: staff.employmentType ?? staff.contractType,
      joiningDate: staff.joiningDate,
      contractStatus: staff.contractStatus,
      teacherRegistryId: staff.teacherRegistryId,
    },
  };
}
