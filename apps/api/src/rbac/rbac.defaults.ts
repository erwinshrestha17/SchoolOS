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
    resource: 'students',
    action: 'update',
    description: 'Update mutable student profile fields inside a tenant',
  },
  {
    resource: 'students',
    action: 'delete',
    description: 'Delete or withdraw student records',
  },
  {
    resource: 'students',
    action: 'manage_lifecycle',
    description:
      'Transfer, exit, archive, and manage student lifecycle transitions',
  },
  {
    resource: 'tenants',
    action: 'manage',
    description: 'Deactivate or manage tenants (super_admin only)',
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
    resource: 'guardians',
    action: 'update',
    description: 'Update linked guardian records inside a tenant',
  },
  {
    resource: 'guardians',
    action: 'verify',
    description: 'Review and approve guardian identity verification records',
  },
  {
    resource: 'student_documents',
    action: 'manage',
    description: 'Upload and manage student documents inside a tenant',
  },
  {
    resource: 'siblings',
    action: 'manage',
    description: 'Manage sibling groups for fee discounts and family views',
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
    resource: 'academics',
    action: 'manage',
    description: 'Manage subjects, exams, CAS, marks, and report cards',
  },
  {
    resource: 'academics',
    action: 'read',
    description: 'Read academic setup, marks, CAS, and report cards',
  },
  {
    resource: 'academics',
    action: 'enter_marks',
    description: 'Enter and update academic marks and CAS records',
  },
  {
    resource: 'academics',
    action: 'manage_report_cards',
    description: 'Generate, lock, and publish academic report cards',
  },
  {
    resource: 'timetable',
    action: 'manage',
    description: 'Create timetable slots and teacher workload schedules',
  },
  {
    resource: 'timetable',
    action: 'read',
    description: 'Read timetable slots and teacher workload schedules',
  },
  {
    resource: 'homework',
    action: 'create',
    description: 'Publish homework assignments to class and student audiences',
  },
  {
    resource: 'homework',
    action: 'read',
    description: 'Read homework assignments and submissions',
  },
  {
    resource: 'homework',
    action: 'review',
    description: 'Review homework submissions and scores',
  },
  {
    resource: 'hr',
    action: 'manage',
    description: 'Manage HR contracts and staff employment records',
  },
  {
    resource: 'hr',
    action: 'read',
    description: 'Read HR contracts and staff employment records',
  },
  {
    resource: 'payroll',
    action: 'manage',
    description: 'Run, approve, and post payroll',
  },
  {
    resource: 'payroll',
    action: 'read',
    description: 'Read payroll runs and payslips',
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
    resource: 'attendance',
    action: 'review_conflicts',
    description: 'Review conflicting attendance submissions',
  },
  {
    resource: 'fees',
    action: 'manage',
    description: 'Manage fee heads, plans, and student assignments',
  },
  {
    resource: 'fees',
    action: 'bill',
    description: 'Generate recurring fee invoices and billing runs',
  },
  {
    resource: 'fees',
    action: 'discount',
    description: 'Manage discounts and waivers',
  },
  {
    resource: 'fees',
    action: 'adjust',
    description: 'Void invoices and post audited fee invoice adjustments',
  },
  {
    resource: 'payments',
    action: 'collect',
    description: 'Collect payments and issue receipts',
  },
  {
    resource: 'payments',
    action: 'refund',
    description: 'Refund collected payments with immutable journal posting',
  },
  {
    resource: 'payments',
    action: 'close',
    description: 'Preview and finalize cashier close snapshots',
  },
  {
    resource: 'receipts',
    action: 'read',
    description: 'Read payment receipts and receipt PDFs',
  },
  {
    resource: 'ledger',
    action: 'read',
    description: 'Read ledger entries and journal lines',
  },
  {
    resource: 'accounting',
    action: 'read',
    description: 'Read accounting periods and financial reports',
  },
  {
    resource: 'accounting',
    action: 'close',
    description: 'Close accounting periods with audit visibility',
  },
  {
    resource: 'accounting',
    action: 'reverse',
    description:
      'Create reversing journal entries for posted accounting records',
  },
  {
    resource: 'activity_feed',
    action: 'create',
    description: 'Create classroom activity feed posts and mood logs',
  },
  {
    resource: 'activity_feed',
    action: 'read',
    description: 'Read activity feed posts and mood logs',
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
    resource: 'communications',
    action: 'read_deliveries',
    description: 'Read notification delivery records',
  },
  {
    resource: 'messaging',
    action: 'create',
    description: 'Create parent-teacher conversations and messages',
  },
  {
    resource: 'messaging',
    action: 'read',
    description: 'Read parent-teacher conversations and message status',
  },
  {
    resource: 'library',
    action: 'read',
    description: 'Read library catalog, circulation, and overdue records',
  },
  {
    resource: 'library',
    action: 'manage',
    description: 'Manage books, copies, issue/return, fines, and lost items',
  },
  {
    resource: 'transport',
    action: 'read',
    description: 'Read routes, vehicles, enrollments, and transport logs',
  },
  {
    resource: 'transport',
    action: 'manage',
    description: 'Manage transport setup, enrollments, boarding, and delays',
  },
  {
    resource: 'transport',
    action: 'operate',
    description: 'Record assigned route logs and transport delay updates',
  },
  {
    resource: 'consents',
    action: 'manage',
    description: 'Capture and revoke guardian consent records',
  },
  {
    resource: 'tenants',
    action: 'read',
    description: 'Read the current tenant profile',
  },
  {
    resource: 'platform',
    action: 'read',
    description: 'Read platform global data (platform admins only)',
  },
  {
    resource: 'platform',
    action: 'manage',
    description: 'Manage platform, tenants, and global settings',
  },
  {
    resource: 'settings',
    action: 'read_public',
    description: 'Read public-safe tenant branding and localization settings',
  },
  {
    resource: 'settings',
    action: 'read',
    description: 'Read tenant settings and preferences',
  },
  {
    resource: 'settings',
    action: 'manage',
    description: 'Manage tenant branding, localization, and operational settings',
  },
];

export const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: 'super_admin',
    description: 'System preset role with every SchoolOS permission',
  },
  {
    name: 'platform_super_admin',
    description: 'Global platform role with full access to all tenants and settings',
  },
  {
    name: 'platform_support',
    description: 'Global platform role for support access and tenant viewing',
  },
  {
    name: 'platform_billing_admin',
    description: 'Global platform role for managing SaaS billing and plans',
  },
  {
    name: 'admin',
    description: 'System preset role for admin',
  },
  {
    name: 'teacher',
    description: 'System preset role for teacher',
  },
  {
    name: 'principal',
    description: 'System preset role for school principal',
  },
  {
    name: 'subject_teacher',
    description: 'System preset role for subject teachers',
  },
  {
    name: 'support_staff',
    description: 'System preset role for non-teaching support staff',
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
  super_admin: PERMISSION_CATALOG.map(({ resource, action }) =>
    buildPermissionKey(resource, action),
  ),
  admin: PERMISSION_CATALOG.map(({ resource, action }) =>
    buildPermissionKey(resource, action),
  ),
  teacher: [
    'roles:read',
    'classes:read',
    'sections:read',
    'students:read',
    'academics:read',
    'academics:enter_marks',
    'timetable:read',
    'homework:create',
    'homework:read',
    'homework:review',
    'messaging:create',
    'messaging:read',
    'activity_feed:create',
    'activity_feed:read',
    'attendance:mark',
    'attendance:read',
    'notices:read',
    'events:read',
    'settings:read_public',
    'settings:read',
  ],
  principal: PERMISSION_CATALOG.map(({ resource, action }) =>
    buildPermissionKey(resource, action),
  ).filter(
    (permission) =>
      ![
        'roles:manage_permissions',
        'accounting:close',
        'accounting:reverse',
        'tenants:manage',
        'settings:manage',
      ].includes(permission),
  ),
  subject_teacher: [
    'roles:read',
    'classes:read',
    'sections:read',
    'students:read',
    'academics:read',
    'academics:enter_marks',
    'timetable:read',
    'homework:create',
    'homework:read',
    'homework:review',
    'messaging:create',
    'messaging:read',
    'activity_feed:create',
    'activity_feed:read',
    'attendance:read',
    'notices:read',
    'events:read',
    'settings:read_public',
  ],
  support_staff: [
    'roles:read',
    'students:read',
    'staff:read',
    'notices:read',
    'events:read',
    'messaging:read',
    'settings:read_public',
  ],
  student: [
    'notices:read',
    'events:read',
    'activity_feed:read',
    'homework:read',
    'settings:read_public',
  ],
  parent: [
    'students:read',
    'notices:read',
    'events:read',
    'activity_feed:read',
    'homework:read',
    'messaging:create',
    'messaging:read',
    'settings:read_public',
  ],
  accountant: [
    'roles:read',
    'users:read',
    'staff:read',
    'students:read',
    'fees:manage',
    'fees:bill',
    'fees:discount',
    'fees:adjust',
    'payments:collect',
    'payments:refund',
    'payments:close',
    'receipts:read',
    'ledger:read',
    'accounting:read',
    'accounting:close',
    'accounting:reverse',
    'payroll:read',
    'payroll:manage',
    'settings:read_public',
    'settings:read',
  ],
  librarian: [
    'roles:read',
    'classes:read',
    'sections:read',
    'students:read',
    'library:read',
    'library:manage',
    'fees:manage',
    'settings:read_public',
  ],
  driver: [
    'roles:read',
    'students:read',
    'events:read',
    'transport:read',
    'transport:operate',
    'settings:read_public',
  ],
  platform_super_admin: [
    'platform:read',
    'platform:manage',
    ...PERMISSION_CATALOG.map(({ resource, action }) =>
      buildPermissionKey(resource, action),
    ),
  ],
  platform_support: ['platform:read', 'students:read', 'staff:read', 'tenants:read'],
  platform_billing_admin: ['platform:read', 'tenants:read'],
};

export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}
