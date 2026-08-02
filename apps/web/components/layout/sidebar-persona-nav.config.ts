import type { PermissionKey, SchoolWebPersona } from '@schoolos/core';
import { TeacherCapability } from '@schoolos/core';
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Calculator,
  CalendarCheck,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Images,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  School,
  Settings,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: PermissionKey[];
  /**
   * Frontend visibility only. The backend remains the authorization and
   * entitlement authority for every route and request.
   */
  moduleKeys?: string[];
  activeWhen?: string[];
  badge?: number | string;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const academicPermissions: PermissionKey[] = [
  'academics:read',
  'academics:manage',
];

const homeworkPermissions: PermissionKey[] = ['homework:read'];
const timetablePermissions: PermissionKey[] = ['timetable:read'];

const learningPermissions: PermissionKey[] = [
  'learning:read',
  'learning:create',
  'learning:update',
  'learning:launch',
  'learning:progress',
];

export const noticesPermissions: PermissionKey[] = [
  'notices:read',
  'notices:create',
];

const feeOperationsPermissions: PermissionKey[] = [
  'fees:manage',
  'fees:bill',
  'fees:discount',
  'fees:adjust',
  'payments:collect',
  'payments:refund',
  'payments:reverse',
  'payments:close',
  'receipts:read',
  'receipts:manage',
  'ledger:read',
];

const accountingReadPermissions: PermissionKey[] = [
  'accounting:read',
  'accounting:accounts:read',
  'accounting:reports:read',
];

const operationsHubPermissions: PermissionKey[] = [
  'library:read',
  'library:manage',
  'transport:read',
  'transport:manage',
  'transport:operate',
  'canteen:menu:read',
  'canteen:plans:read',
  'canteen:enrollments:read',
];

const principalReportsPermissions: PermissionKey[] = [
  'reports:read',
  'accounting:reports:read',
  'library:reports:read',
];

const principalAuditPermissions: PermissionKey[] = [
  'accounting:audit:read',
  'settings:audit:read',
];

/**
 * Whether the administrative Settings hub appears in sidebar / command palette.
 * Teachers and operational personas reach personal settings through other paths.
 */
export function shouldShowSettingsHub(
  settingsCaps: {
    institutionalNavEnabled: boolean;
    canAccessInstitutionalSettings: boolean;
  },
  isTeacherPersona: boolean,
  personalOnly: boolean,
): boolean {
  if (isTeacherPersona || personalOnly) return false;
  return (
    settingsCaps.institutionalNavEnabled &&
    settingsCaps.canAccessInstitutionalSettings
  );
}

/**
 * Admin / school_config_owner nav (persona mapping §4 Admin Web).
 * Finance, payroll, and accounting entries remain permission-gated — the admin
 * preset excludes finance keys by default.
 */
export const adminNavGroups: NavGroup[] = [
  {
    label: 'Home',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
      {
        href: '/dashboard/service-requests',
        label: 'Action Centre',
        icon: LifeBuoy,
        permissions: ['service_requests:read', 'service_requests:manage'],
      },
    ],
  },
  {
    label: 'Students & Admissions',
    icon: Users,
    items: [
      {
        href: '/dashboard/students',
        label: 'Students',
        icon: Users,
        permissions: ['students:read', 'students:create'],
      },
      {
        href: '/dashboard/admissions',
        label: 'Admissions',
        icon: UserPlus,
        permissions: ['students:read', 'students:create'],
      },
    ],
  },
  {
    label: 'Attendance',
    icon: CalendarCheck,
    items: [
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['attendance:read', 'attendance:mark'],
      },
    ],
  },
  {
    label: 'Fees & Receipts',
    icon: Wallet,
    items: [
      {
        href: '/dashboard/fees',
        label: 'Fees & Receipts',
        icon: Wallet,
        permissions: feeOperationsPermissions,
        activeWhen: ['/dashboard/fees', '/dashboard/finance'],
      },
    ],
  },
  {
    label: 'Academics',
    icon: GraduationCap,
    items: [
      {
        href: '/dashboard/academics',
        label: 'Academics',
        icon: GraduationCap,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/exams',
        label: 'Exams & Results',
        icon: FileCheck2,
        permissions: academicPermissions,
        activeWhen: [
          '/dashboard/academics/exams',
          '/dashboard/academics/cas',
          '/dashboard/academics/report-cards',
        ],
      },
      {
        href: '/dashboard/learning',
        label: 'Learning',
        icon: BookOpen,
        permissions: learningPermissions,
      },
    ],
  },
  {
    label: 'Activities',
    icon: Images,
    items: [
      {
        href: '/dashboard/activity',
        label: 'Activity Feed',
        icon: Images,
        permissions: ['activity_feed:read', 'activity_feed:create'],
      },
    ],
  },
  {
    label: 'Homework & Timetable',
    icon: CalendarDays,
    items: [
      {
        href: '/dashboard/homework',
        label: 'Homework',
        icon: ClipboardList,
        permissions: homeworkPermissions,
        moduleKeys: ['homework'],
      },
      {
        href: '/dashboard/timetable',
        label: 'Timetable',
        icon: CalendarDays,
        permissions: timetablePermissions,
        moduleKeys: ['timetable'],
      },
    ],
  },
  {
    label: 'Staff & Finance',
    icon: UserCog,
    items: [
      {
        href: '/dashboard/hr',
        label: 'Staff',
        icon: UserCog,
        permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
        activeWhen: ['/dashboard/hr'],
      },
      {
        href: '/dashboard/payroll',
        label: 'Payroll',
        icon: Wallet,
        permissions: ['payroll:read', 'payroll:manage'],
      },
      {
        href: '/dashboard/accounting',
        label: 'Accounting',
        icon: Calculator,
        permissions: accountingReadPermissions,
      },
    ],
  },
  {
    label: 'School Operations',
    icon: School,
    items: [
      {
        href: '/dashboard/library',
        label: 'Library',
        icon: BookOpen,
        permissions: ['library:read', 'library:manage'],
      },
      {
        href: '/dashboard/transport',
        label: 'Transport',
        icon: Bus,
        permissions: [
          'transport:read',
          'transport:manage',
          'transport:operate',
        ],
      },
      {
        href: '/dashboard/canteen',
        label: 'Canteen',
        icon: Utensils,
        permissions: [
          'canteen:menu:read',
          'canteen:plans:read',
          'canteen:enrollments:read',
        ],
      },
    ],
  },
  {
    label: 'Notifications',
    icon: Bell,
    items: [
      {
        href: '/dashboard/notifications',
        label: 'Notifications',
        icon: Bell,
        permissions: ['notifications:view_own'],
      },
    ],
  },
  {
    label: 'Notices',
    icon: MessageSquare,
    items: [
      {
        href: '/dashboard/notices',
        label: 'Notices & Announcements',
        icon: MessageSquare,
        permissions: noticesPermissions,
        activeWhen: ['/dashboard/communications', '/dashboard/notices'],
      },
    ],
  },
  {
    label: 'Reports',
    icon: ClipboardList,
    items: [
      {
        href: '/dashboard/reports',
        label: 'Reports & Exports',
        icon: ClipboardList,
        permissions: [
          'accounting:reports:read',
          'library:reports:read',
          'reports:read',
          'settings:manage',
        ],
      },
      {
        href: '/dashboard/settings/system/audit-log',
        label: 'Audit',
        icon: ShieldCheck,
        permissions: ['settings:manage', 'settings:audit:read', 'settings:read'],
      },
    ],
  },
];

/** Backward-compatible alias for adminNavGroups. */
export const dashboardNavGroups = adminNavGroups;

/**
 * Teacher-persona navigation (Teacher Persona spec section 14, P0.2).
 * Delegated administrative entries are appended by `buildTeacherNavGroups`.
 */
export const teacherNavGroups: NavGroup[] = [
  {
    label: 'Today',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
      {
        href: '/dashboard/timetable',
        label: 'My Schedule',
        icon: CalendarDays,
        permissions: timetablePermissions,
      },
    ],
  },
  {
    label: 'Teaching',
    icon: GraduationCap,
    items: [
      {
        href: '/dashboard/my-students',
        label: 'My Students',
        icon: Users,
        permissions: ['students:read'],
      },
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['attendance:read', 'attendance:mark'],
      },
      {
        href: '/dashboard/homework',
        label: 'Homework',
        icon: ClipboardList,
        permissions: homeworkPermissions,
      },
      {
        href: '/dashboard/academics/marks',
        label: 'Assessments & Marks',
        icon: FileCheck2,
        permissions: ['academics:read', 'academics:enter_marks'],
        activeWhen: ['/dashboard/academics'],
      },
      {
        href: '/dashboard/activity',
        label: 'Activities',
        icon: Images,
        permissions: ['activity_feed:read', 'activity_feed:create'],
      },
      {
        href: '/dashboard/notices',
        label: 'Messages & Announcements',
        icon: MessageSquare,
        permissions: ['notices:read'],
      },
      {
        href: '/dashboard/notifications',
        label: 'Notifications',
        icon: Bell,
        permissions: ['notifications:view_own'],
      },
    ],
  },
  {
    label: 'Resources',
    icon: BookOpen,
    items: [
      {
        href: '/dashboard/library',
        label: 'Library',
        icon: BookOpen,
        permissions: ['library:books:read', 'library:issues:read'],
      },
    ],
  },
  {
    label: 'My Account',
    icon: BriefcaseBusiness,
    items: [
      {
        href: '/dashboard/my-workspace',
        label: 'My Workspace',
        icon: BriefcaseBusiness,
      },
      {
        href: '/dashboard/settings/personal/profile',
        label: 'Profile',
        icon: CircleUserRound,
      },
      {
        href: '/dashboard/settings/personal/notifications',
        label: 'Preferences',
        icon: Bell,
      },
      {
        href: '/dashboard/settings/personal/security',
        label: 'Security',
        icon: ShieldCheck,
      },
    ],
  },
];

const DELEGATED_TEACHER_NAV: Array<{
  capability: TeacherCapability;
  group: string;
  item: NavItem;
}> = [
  {
    capability: TeacherCapability.TIMETABLE_ADMIN,
    group: 'Coordination',
    item: {
      href: '/dashboard/timetable/builder',
      label: 'Timetable Builder',
      icon: LayoutDashboard,
      permissions: ['timetable:manage'],
    },
  },
  {
    capability: TeacherCapability.SUBSTITUTION_ADMIN,
    group: 'Coordination',
    item: {
      href: '/dashboard/timetable/substitutions',
      label: 'Substitutions',
      icon: CalendarDays,
      permissions: ['timetable:substitute'],
    },
  },
  {
    capability: TeacherCapability.SUBSTITUTION_ADMIN,
    group: 'Coordination',
    item: {
      href: '/dashboard/timetable/replacements',
      label: 'Replacements',
      icon: CalendarDays,
      permissions: ['timetable:substitute'],
    },
  },
  {
    capability: TeacherCapability.EXAM_TERM_ADMIN,
    group: 'Coordination',
    item: {
      href: '/dashboard/academics/exam-terms',
      label: 'Exam Terms',
      icon: FileCheck2,
      permissions: ['exam-terms:manage'],
    },
  },
  {
    capability: TeacherCapability.ACTIVITY_MODERATE,
    group: 'Coordination',
    item: {
      href: '/dashboard/activity/moderation',
      label: 'Activity Moderation',
      icon: ShieldCheck,
      permissions: ['activity_feed:moderate'],
    },
  },
  {
    capability: TeacherCapability.LIBRARY_ADMIN,
    group: 'Coordination',
    item: {
      href: '/dashboard/library/catalog',
      label: 'Library Desk',
      icon: BookOpen,
      permissions: ['library:manage'],
    },
  },
];

export function buildTeacherNavGroups(
  capabilities: ReadonlySet<TeacherCapability>,
): NavGroup[] {
  const delegated = DELEGATED_TEACHER_NAV.filter((entry) =>
    capabilities.has(entry.capability),
  );

  if (delegated.length === 0) return teacherNavGroups;

  return [
    ...teacherNavGroups,
    {
      label: 'Coordination',
      icon: ShieldCheck,
      items: delegated.map((entry) => entry.item),
    },
  ];
}

/**
 * Principal oversight nav (persona mapping §4). Read-only finance via
 * accounting; no fee-collection permissions on nav items.
 */
export const principalNavGroups: NavGroup[] = [
  {
    label: 'Leadership',
    icon: LayoutDashboard,
    items: [
      {
        href: '/dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
      },
      {
        href: '/dashboard#needs-attention',
        label: 'Attention Items',
        icon: ClipboardList,
        activeWhen: ['/dashboard'],
      },
      {
        href: '/dashboard/notices/approvals',
        label: 'Approvals',
        icon: ShieldCheck,
        permissions: noticesPermissions,
      },
    ],
  },
  {
    label: 'Students and Admissions',
    icon: Users,
    items: [
      {
        href: '/dashboard/students',
        label: 'Students',
        icon: Users,
        permissions: ['students:read', 'students:create'],
      },
      {
        href: '/dashboard/admissions',
        label: 'Admissions',
        icon: UserPlus,
        permissions: ['students:read', 'students:create'],
      },
    ],
  },
  {
    label: 'Oversight',
    icon: School,
    items: [
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['attendance:read'],
      },
      {
        href: '/dashboard/accounting',
        label: 'Finance Overview',
        icon: Wallet,
        permissions: accountingReadPermissions,
        activeWhen: ['/dashboard/accounting', '/dashboard/reports'],
      },
      {
        href: '/dashboard/academics',
        label: 'Academic Readiness',
        icon: GraduationCap,
        permissions: ['academics:read'],
      },
      {
        href: '/dashboard/hr',
        label: 'Staff Overview',
        icon: UserCog,
        permissions: ['hr:read'],
      },
    ],
  },
  {
    label: 'Operations',
    icon: School,
    items: [
      {
        href: '/dashboard/operations',
        label: 'Operations',
        icon: School,
        permissions: operationsHubPermissions,
        activeWhen: [
          '/dashboard/operations',
          '/dashboard/library',
          '/dashboard/transport',
          '/dashboard/canteen',
        ],
      },
    ],
  },
  {
    label: 'Communication',
    icon: MessageSquare,
    items: [
      {
        href: '/dashboard/notices',
        label: 'Notices',
        icon: MessageSquare,
        permissions: noticesPermissions,
        activeWhen: ['/dashboard/communications', '/dashboard/notices'],
      },
      {
        href: '/dashboard/activity',
        label: 'Activity Feed',
        icon: Images,
        permissions: ['activity_feed:read', 'activity_feed:create'],
      },
      {
        href: '/dashboard/notifications',
        label: 'Notifications',
        icon: Bell,
        permissions: ['notifications:view_own'],
      },
    ],
  },
  {
    label: 'Reports and Audit',
    icon: FileCheck2,
    items: [
      {
        href: '/dashboard/reports',
        label: 'Reports',
        icon: FileCheck2,
        permissions: principalReportsPermissions,
      },
      {
        href: '/dashboard/accounting/audit',
        label: 'Audit',
        icon: ShieldCheck,
        permissions: principalAuditPermissions,
        activeWhen: [
          '/dashboard/accounting/audit',
          '/dashboard/settings/system/audit-log',
        ],
      },
    ],
  },
];

/** HR-first nav (persona mapping §4). */
export const hrNavGroups: NavGroup[] = [
  {
    label: 'HR',
    icon: UserCog,
    items: [
      {
        href: '/dashboard/hr',
        label: 'HR Dashboard',
        icon: LayoutDashboard,
        permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
      },
      {
        href: '/dashboard/hr/staff',
        label: 'Staff',
        icon: Users,
        permissions: ['hr:read', 'staff:read'],
      },
      {
        href: '/dashboard/hr/contracts',
        label: 'Contracts',
        icon: BriefcaseBusiness,
        permissions: ['hr:read', 'hr:manage'],
      },
      {
        href: '/dashboard/hr/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['hr:read', 'attendance:read'],
      },
      {
        href: '/dashboard/hr/leave',
        label: 'Leave',
        icon: CalendarDays,
        permissions: ['hr:read', 'hr:manage'],
      },
    ],
  },
  {
    label: 'Payroll',
    icon: Wallet,
    items: [
      {
        href: '/dashboard/payroll',
        label: 'Payroll',
        icon: Wallet,
        permissions: ['payroll:read', 'payroll:manage'],
      },
      {
        href: '/dashboard/payroll/payslips',
        label: 'Payslips',
        icon: FileCheck2,
        permissions: ['payroll:read', 'payroll:payslip:read'],
      },
    ],
  },
  {
    label: 'Communication',
    icon: MessageSquare,
    items: [
      {
        href: '/dashboard/notices',
        label: 'HR Notices',
        icon: MessageSquare,
        permissions: noticesPermissions,
        activeWhen: ['/dashboard/communications', '/dashboard/notices'],
      },
      {
        href: '/dashboard/reports',
        label: 'Reports',
        icon: FileCheck2,
        permissions: ['reports:read', 'payroll:reports:read', 'hr:read'],
      },
    ],
  },
];

/** Accountant-first nav (persona mapping §4). */
export const accountantNavGroups: NavGroup[] = [
  {
    label: 'Finance',
    icon: Wallet,
    items: [
      {
        href: '/dashboard/accounting',
        label: 'Finance Dashboard',
        icon: LayoutDashboard,
        permissions: ['accounting:read', 'accounting:journals:read'],
      },
      {
        href: '/dashboard/accounting/receivables',
        label: 'Fees & Receivables',
        icon: ClipboardList,
        permissions: ['ledger:read', 'fees:manage'],
        activeWhen: [
          '/dashboard/accounting/receivables',
          '/dashboard/fees/invoices',
          '/dashboard/fees/ledgers',
        ],
      },
      {
        href: '/dashboard/accounting/collections',
        label: 'Collections & Receipts',
        icon: Wallet,
        permissions: ['payments:collect', 'receipts:read'],
        activeWhen: [
          '/dashboard/accounting/collections',
          '/dashboard/fees/collect',
          '/dashboard/fees/receipts',
        ],
      },
      {
        href: '/dashboard/fees/cashier-close',
        label: 'Cashier Close',
        icon: ClipboardList,
        permissions: ['payments:close', 'payments:collect'],
      },
      {
        href: '/dashboard/accounting/reconciliation',
        label: 'Reconciliation',
        icon: FileCheck2,
        permissions: [
          'accounting:reconciliation:read',
          'accounting:reconciliation:manage',
        ],
      },
      {
        href: '/dashboard/accounting/journals',
        label: 'Accounting',
        icon: Calculator,
        permissions: ['accounting:journals:read', 'accounting:read'],
      },
      {
        href: '/dashboard/accounting/cash-bank',
        label: 'Cash & Bank',
        icon: FileCheck2,
        permissions: ['accounting:read', 'accounting:journals:read'],
      },
      {
        href: '/dashboard/accounting/payables',
        label: 'Expenses & Payables',
        icon: BriefcaseBusiness,
        permissions: ['accounting:payables:read'],
      },
      {
        href: '/dashboard/accounting/payroll-handoff',
        label: 'Payroll Handoff',
        icon: Calculator,
        permissions: ['accounting:payroll-handoff:read'],
        activeWhen: [
          '/dashboard/accounting/payroll-handoff',
          '/dashboard/payroll/reports',
          '/dashboard/payroll/readiness',
        ],
      },
      {
        href: '/dashboard/accounting/source-mappings',
        label: 'Module Postings',
        icon: BookOpen,
        permissions: ['accounting:settings:read', 'accounting:settings:update'],
      },
      {
        href: '/dashboard/reports',
        label: 'Reports',
        icon: FileCheck2,
        permissions: ['accounting:reports:read', 'reports:read'],
      },
      {
        href: '/dashboard/accounting/audit',
        label: 'Audit Trail',
        icon: ShieldCheck,
        permissions: ['accounting:audit:read'],
      },
    ],
  },
];

/** Librarian operational shell (persona mapping §5). */
export const librarianNavGroups: NavGroup[] = [
  {
    label: 'Library',
    icon: BookOpen,
    items: [
      {
        href: '/dashboard/library',
        label: 'Library Overview',
        icon: LayoutDashboard,
        permissions: ['library:read', 'library:manage'],
      },
      {
        href: '/dashboard/library/catalog',
        label: 'Catalog',
        icon: BookOpen,
        permissions: ['library:manage', 'library:books:read'],
      },
      {
        href: '/dashboard/library/issues',
        label: 'Issues and Returns',
        icon: ClipboardList,
        permissions: ['library:manage', 'library:issues:read'],
      },
      {
        href: '/dashboard/library/overdue',
        label: 'Overdue',
        icon: CalendarDays,
        permissions: ['library:read', 'library:manage'],
      },
      {
        href: '/dashboard/library/fines',
        label: 'Fines',
        icon: Wallet,
        permissions: ['library:fines:read'],
      },
      {
        href: '/dashboard/library/borrowers',
        label: 'Borrowers',
        icon: Users,
        permissions: ['library:read', 'students:read'],
      },
    ],
  },
  {
    label: 'Account',
    icon: CircleUserRound,
    items: [
      {
        href: '/dashboard/notices',
        label: 'Notices',
        icon: MessageSquare,
        permissions: noticesPermissions,
      },
      {
        href: '/dashboard/my-workspace',
        label: 'My Workspace',
        icon: BriefcaseBusiness,
      },
    ],
  },
];

/** Cashier fees counter shell (persona mapping §5). */
export const cashierNavGroups: NavGroup[] = [
  {
    label: 'Cashier',
    icon: Wallet,
    items: [
      {
        href: '/dashboard/fees/collect',
        label: 'Collect Payment',
        icon: Wallet,
        permissions: ['payments:collect'],
      },
      {
        href: '/dashboard/fees/receipts',
        label: 'Receipts',
        icon: FileCheck2,
        permissions: ['receipts:read'],
      },
      {
        href: '/dashboard/fees/cashier-close',
        label: 'Cashier Close',
        icon: ClipboardList,
        permissions: ['payments:close'],
      },
      {
        href: '/dashboard/fees/invoices',
        label: 'Invoices',
        icon: FileCheck2,
        permissions: ['fees:bill', 'fees:manage', 'ledger:read'],
      },
    ],
  },
];

/** Transport operator shell (persona mapping §5). */
export const transportOperatorNavGroups: NavGroup[] = [
  {
    label: 'Transport',
    icon: Bus,
    items: [
      {
        href: '/dashboard/transport',
        label: 'Transport Overview',
        icon: LayoutDashboard,
        permissions: ['transport:read', 'transport:operate'],
      },
      {
        href: '/dashboard/transport/trips',
        label: 'Trips',
        icon: Bus,
        permissions: ['transport:operate'],
      },
      {
        href: '/dashboard/transport/students',
        label: 'Students',
        icon: Users,
        permissions: ['transport:read', 'transport:operate'],
      },
    ],
  },
];

/** Canteen operator shell (persona mapping §5). */
export const canteenOperatorNavGroups: NavGroup[] = [
  {
    label: 'Canteen',
    icon: Utensils,
    items: [
      {
        href: '/dashboard/canteen',
        label: 'Canteen Overview',
        icon: LayoutDashboard,
        permissions: ['canteen:menu:read', 'canteen:pos:read'],
      },
      {
        href: '/dashboard/canteen/pos',
        label: 'POS',
        icon: Wallet,
        permissions: ['canteen:pos:create', 'canteen:pos:read'],
      },
      {
        href: '/dashboard/canteen/serving',
        label: 'Serving',
        icon: Utensils,
        permissions: ['canteen:serving:create', 'canteen:serving:read'],
      },
      {
        href: '/dashboard/canteen/enrollments',
        label: 'Enrollments',
        icon: Users,
        permissions: ['canteen:enrollments:read'],
      },
    ],
  },
];

/** Picks the persona nav tree before permission/entitlement filtering. */
export function navGroupsForPersona(
  persona: SchoolWebPersona,
  teacherCapabilities: ReadonlySet<TeacherCapability>,
): NavGroup[] {
  switch (persona) {
    case 'teacher':
      return buildTeacherNavGroups(teacherCapabilities);
    case 'principal':
      return principalNavGroups;
    case 'hr':
      return hrNavGroups;
    case 'accountant':
      return accountantNavGroups;
    case 'librarian':
      return librarianNavGroups;
    case 'cashier':
      return cashierNavGroups;
    case 'transport_operator':
      return transportOperatorNavGroups;
    case 'canteen_operator':
      return canteenOperatorNavGroups;
    case 'admin':
    default:
      return adminNavGroups;
  }
}

export const settingsNavItem: NavItem = {
  href: '/dashboard/settings',
  label: 'Settings',
  icon: Settings,
};
