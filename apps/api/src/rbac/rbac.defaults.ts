export type PermissionDefinition = {
  resource: string;
  action: string;
  description: string;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    resource: 'users',
    action: 'create',
    description: 'Create users inside a tenant',
  },
  {
    resource: 'users',
    action: 'read',
    description: 'Read users inside a tenant',
  },
  {
    resource: 'users',
    action: 'update_status',
    description: 'Suspend or activate users inside a tenant',
  },
  {
    resource: 'users',
    action: 'reset_password',
    description: 'Reset user passwords and revoke active sessions',
  },
  {
    resource: 'roles',
    action: 'read',
    description: 'Read roles and permission catalog',
  },
  {
    resource: 'roles',
    action: 'create',
    description: 'Create custom roles inside a tenant',
  },
  {
    resource: 'roles',
    action: 'assign',
    description: 'Assign roles to tenant users',
  },
  {
    resource: 'roles',
    action: 'manage_permissions',
    description: 'Attach permissions to roles',
  },
  {
    resource: 'classes',
    action: 'create',
    description: 'Create classes inside a tenant',
  },
  {
    resource: 'classes',
    action: 'read',
    description: 'Read classes inside a tenant',
  },
  {
    resource: 'academic_years',
    action: 'create',
    description: 'Create academic years inside a tenant',
  },
  {
    resource: 'academic_years',
    action: 'read',
    description: 'Read academic years inside a tenant',
  },
  {
    resource: 'sections',
    action: 'create',
    description: 'Create sections inside a tenant',
  },
  {
    resource: 'sections',
    action: 'read',
    description: 'Read sections inside a tenant',
  },
  {
    resource: 'students',
    action: 'create',
    description: 'Create student records inside a tenant',
  },
  {
    resource: 'students',
    action: 'read',
    description: 'Read student records inside a tenant',
  },
  {
    resource: 'guardians',
    action: 'create',
    description: 'Create guardian records inside a tenant',
  },
  {
    resource: 'guardians',
    action: 'read',
    description: 'Read guardian records inside a tenant',
  },
  {
    resource: 'enrollments',
    action: 'create',
    description: 'Create student enrollment records and side effects',
  },
  {
    resource: 'enrollments',
    action: 'read',
    description: 'Read student enrollment history',
  },
  {
    resource: 'staff',
    action: 'create',
    description: 'Create staff accounts and profiles inside a tenant',
  },
  {
    resource: 'staff',
    action: 'read',
    description: 'Read staff accounts and profiles inside a tenant',
  },
  {
    resource: 'attendance',
    action: 'mark',
    description: 'Submit and lock attendance sessions',
  },
  {
    resource: 'attendance',
    action: 'read',
    description: 'Read attendance sessions and analytics',
  },
  {
    resource: 'fees',
    action: 'manage',
    description: 'Manage fee heads, plans, and student assignments',
  },
  {
    resource: 'payments',
    action: 'collect',
    description: 'Collect payments and issue receipts',
  },
  {
    resource: 'ledger',
    action: 'read',
    description: 'Read ledger entries and journal lines',
  },
  {
    resource: 'notices',
    action: 'create',
    description: 'Create and publish school notices',
  },
  {
    resource: 'notices',
    action: 'read',
    description: 'Read school notices',
  },
  {
    resource: 'events',
    action: 'create',
    description: 'Create school events',
  },
  {
    resource: 'events',
    action: 'read',
    description: 'Read school events',
  },
  {
    resource: 'tenants',
    action: 'read',
    description: 'Read the current tenant profile',
  },
];

export const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: 'admin',
    description: 'System preset role for admin',
  },
  {
    name: 'teacher',
    description: 'System preset role for teacher',
  },
  {
    name: 'student',
    description: 'System preset role for student',
  },
  {
    name: 'parent',
    description: 'System preset role for parent',
  },
  {
    name: 'accountant',
    description: 'System preset role for accountant',
  },
  {
    name: 'librarian',
    description: 'System preset role for librarian',
  },
  {
    name: 'driver',
    description: 'System preset role for driver',
  },
] as const;

export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSION_CATALOG.map(({ resource, action }) =>
    buildPermissionKey(resource, action),
  ),
  teacher: [
    'roles:read',
    'classes:read',
    'sections:read',
    'students:read',
    'attendance:mark',
    'attendance:read',
    'notices:read',
    'events:read',
  ],
  student: ['notices:read', 'events:read'],
  parent: ['students:read', 'notices:read', 'events:read'],
  accountant: [
    'roles:read',
    'users:read',
    'staff:read',
    'students:read',
    'fees:manage',
    'payments:collect',
    'ledger:read',
  ],
  librarian: ['roles:read', 'classes:read', 'sections:read', 'students:read'],
  driver: ['roles:read', 'students:read', 'events:read'],
};

export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}
