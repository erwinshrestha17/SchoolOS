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
  teacher: ['roles:read', 'classes:read', 'students:read'],
  student: [],
  parent: [],
  accountant: ['roles:read', 'users:read', 'staff:read'],
  librarian: ['roles:read', 'classes:read', 'students:read'],
  driver: ['roles:read', 'students:read'],
};

export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}
