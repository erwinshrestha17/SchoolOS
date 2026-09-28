import type { AuthContext } from '../../auth/auth.types';
import {
  hasDomainPermission,
  requireDomainPermission,
} from './domain-permission';

/** Basic HR management never implies financial or identity-field authority. */
export function requireStaffFieldWrites(
  actor: AuthContext,
  fields: object,
): void {
  for (const permission of staffFieldWritePermissions(fields))
    requireDomainPermission(actor, permission);
}

export function staffFieldWritePermissions(fields: object): string[] {
  const values = fields as Record<string, unknown>;
  const permissions: string[] = [];
  for (const [keys, permission] of [
    [['bankAccount', 'bankName'], 'hr:bank:write'],
    [['panNumber'], 'hr:tax:write'],
    [['citizenshipNo'], 'hr:identity:write'],
  ] as const) {
    if (keys.some((key) => values[key] !== undefined))
      permissions.push(permission);
  }
  return permissions;
}

const recordKeys = {
  CONTRACT: [
    'id',
    'contractNumber',
    'position',
    'startDate',
    'endDate',
    'status',
    'employmentType',
    'contractType',
  ],
  SALARY: ['id', 'effectiveFrom', 'effectiveTo', 'status', 'paymentMethod'],
  PAYROLL: ['id', 'payrollRunId', 'status', 'createdAt'],
} as const;
const salaryKeys = [
  'baseSalary',
  'basicSalary',
  'allowances',
  'deductions',
  'earnings',
  'grossSalary',
  'netSalary',
  'proratedSalary',
  'payableDays',
  'totalDays',
  'pfEmployeeAmount',
  'pfEmployerAmount',
];

/** Allowlist relations; raw contracts, payslips and runs cannot leak hidden fields. */
export function projectStaffFinancialRecord(
  item: unknown,
  actor: AuthContext | undefined,
  kind: keyof typeof recordKeys,
): Record<string, unknown> {
  const value =
    item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const keys: string[] = [...recordKeys[kind]];
  if (actor && hasDomainPermission(actor, 'payroll:salary:read'))
    keys.push(...salaryKeys);
  if (actor && hasDomainPermission(actor, 'hr:bank:read'))
    keys.push('bankAccount', 'bankName');
  if (actor && hasDomainPermission(actor, 'hr:tax:read'))
    keys.push('panNumber', 'tdsAmount', 'tdsPercent');
  return Object.fromEntries(
    keys.filter((key) => key in value).map((key) => [key, value[key]]),
  );
}
