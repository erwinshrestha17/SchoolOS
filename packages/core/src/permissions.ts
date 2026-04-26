export const permissionCatalog = [
  { resource: 'users', action: 'create', description: 'Create users inside a tenant' },
  { resource: 'users', action: 'read', description: 'Read users inside a tenant' },
  { resource: 'users', action: 'update_status', description: 'Suspend or activate users inside a tenant' },
  { resource: 'users', action: 'reset_password', description: 'Reset user passwords and revoke active sessions' },
  { resource: 'roles', action: 'read', description: 'Read roles and permission catalog' },
  { resource: 'roles', action: 'create', description: 'Create custom roles inside a tenant' },
  { resource: 'roles', action: 'assign', description: 'Assign roles to tenant users' },
  { resource: 'roles', action: 'manage_permissions', description: 'Attach permissions to roles' },
  { resource: 'classes', action: 'create', description: 'Create classes inside a tenant' },
  { resource: 'classes', action: 'read', description: 'Read classes inside a tenant' },
  { resource: 'academic_years', action: 'create', description: 'Create academic years inside a tenant' },
  { resource: 'academic_years', action: 'read', description: 'Read academic years inside a tenant' },
  { resource: 'sections', action: 'create', description: 'Create sections inside a tenant' },
  { resource: 'sections', action: 'read', description: 'Read sections inside a tenant' },
  { resource: 'students', action: 'create', description: 'Create student records inside a tenant' },
  { resource: 'students', action: 'read', description: 'Read student records inside a tenant' },
  { resource: 'guardians', action: 'create', description: 'Create guardian records inside a tenant' },
  { resource: 'guardians', action: 'read', description: 'Read guardian records inside a tenant' },
  { resource: 'student_documents', action: 'manage', description: 'Upload and manage student documents inside a tenant' },
  { resource: 'siblings', action: 'manage', description: 'Manage sibling groups for fee discounts and family views' },
  { resource: 'enrollments', action: 'create', description: 'Create student enrollment records and side effects' },
  { resource: 'enrollments', action: 'read', description: 'Read student enrollment history' },
  { resource: 'staff', action: 'create', description: 'Create staff accounts and profiles inside a tenant' },
  { resource: 'staff', action: 'read', description: 'Read staff accounts and profiles inside a tenant' },
  { resource: 'attendance', action: 'mark', description: 'Submit and lock attendance sessions' },
  { resource: 'attendance', action: 'read', description: 'Read attendance sessions and analytics' },
  { resource: 'attendance', action: 'review_conflicts', description: 'Review conflicting attendance submissions' },
  { resource: 'fees', action: 'manage', description: 'Manage fee heads, plans, and student assignments' },
  { resource: 'fees', action: 'bill', description: 'Generate recurring fee invoices and billing runs' },
  { resource: 'fees', action: 'discount', description: 'Manage discounts and waivers' },
  { resource: 'payments', action: 'collect', description: 'Collect payments and issue receipts' },
  { resource: 'receipts', action: 'read', description: 'Read payment receipts and receipt PDFs' },
  { resource: 'ledger', action: 'read', description: 'Read ledger entries and journal lines' },
  { resource: 'activity_feed', action: 'create', description: 'Create classroom activity feed posts and mood logs' },
  { resource: 'activity_feed', action: 'read', description: 'Read activity feed posts and mood logs' },
  { resource: 'notices', action: 'create', description: 'Create and publish school notices' },
  { resource: 'notices', action: 'read', description: 'Read school notices' },
  { resource: 'events', action: 'create', description: 'Create school events' },
  { resource: 'events', action: 'read', description: 'Read school events' },
  { resource: 'communications', action: 'read_deliveries', description: 'Read notification delivery records' },
  { resource: 'consents', action: 'manage', description: 'Capture and revoke guardian consent records' },
  { resource: 'tenants', action: 'read', description: 'Read the current tenant profile' }
] as const;

export type PermissionResource = (typeof permissionCatalog)[number]['resource'];
export type PermissionAction = (typeof permissionCatalog)[number]['action'];
export type PermissionKey =
  `${(typeof permissionCatalog)[number]['resource']}:${(typeof permissionCatalog)[number]['action']}`;

export const systemRoleDefinitions = [
  { name: 'admin', description: 'System preset role for admin' },
  { name: 'teacher', description: 'System preset role for teacher' },
  { name: 'student', description: 'System preset role for student' },
  { name: 'parent', description: 'System preset role for parent' },
  { name: 'accountant', description: 'System preset role for accountant' },
  { name: 'librarian', description: 'System preset role for librarian' },
  { name: 'driver', description: 'System preset role for driver' }
] as const;

export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

export const systemRolePermissions: Record<string, string[]> = {
  admin: permissionCatalog.map(({ resource, action }) => buildPermissionKey(resource, action)),
  teacher: [
    'roles:read',
    'classes:read',
    'sections:read',
    'students:read',
    'activity_feed:create',
    'activity_feed:read',
    'attendance:mark',
    'attendance:read',
    'notices:read',
    'events:read'
  ],
  student: ['events:read', 'notices:read', 'activity_feed:read'],
  parent: ['events:read', 'notices:read', 'students:read', 'activity_feed:read'],
  accountant: [
    'roles:read',
    'users:read',
    'staff:read',
    'students:read',
    'fees:manage',
    'fees:bill',
    'fees:discount',
    'payments:collect',
    'receipts:read',
    'ledger:read'
  ],
  librarian: ['roles:read', 'classes:read', 'sections:read', 'students:read'],
  driver: ['roles:read', 'students:read', 'events:read']
};
