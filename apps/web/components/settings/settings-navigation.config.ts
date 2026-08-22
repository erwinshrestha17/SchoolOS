import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  FileClock,
  ImagePlay,
  LayoutGrid,
  Link2,
  Palette,
  ReceiptText,
  School,
  ShieldCheck,
  UserCog,
  UserPlus,
  UserRound,
  UsersRound,
  Wallet,
  WalletCards,
} from 'lucide-react';

export type SettingsNavigationGroupId =
  | 'personal'
  | 'school'
  | 'policies'
  | 'administration'
  | 'access'
  | 'system';

export type SettingsScope = 'personal' | 'school' | 'platform';

export type SettingsNavigationDefinition = {
  id: string;
  groupId: SettingsNavigationGroupId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  scope: SettingsScope;
  searchKeywords: string[];
  /** Backend school-settings navigation item used as the visibility authority. */
  backendItemId?: string;
  /** Personal capability that must be present in the authenticated session. */
  requiredPermission?: string;
  requiredModule?: string;
  /** Routes retained as compatibility aliases for active-state matching. */
  legacyHrefs?: string[];
  status?: 'platform-managed';
};

export const SETTINGS_NAVIGATION_GROUPS: Array<{
  id: SettingsNavigationGroupId;
  label: string;
}> = [
  { id: 'personal', label: 'Personal' },
  { id: 'school', label: 'School' },
  { id: 'policies', label: 'Academic & student policy' },
  { id: 'administration', label: 'Finance & administration' },
  { id: 'access', label: 'People & access' },
  { id: 'system', label: 'System' },
];

/**
 * Backend navigation items that intentionally do not get their own Settings
 * destination in this catalog. Keeping these dispositions explicit prevents a
 * hidden-but-reachable drift between backend navigation and the web IA.
 */
export const SETTINGS_BACKEND_ITEM_DISPOSITIONS = {
  overview: 'rendered-by-control-center',
  'documents-templates': 'consolidated-into-school-branding',
  'library-settings': 'module-owned-workspace',
  'transport-settings': 'module-owned-workspace',
  'canteen-settings': 'module-owned-workspace',
  'learning-settings': 'frozen-hidden',
} as const;

/**
 * Presentation metadata only. School-setting visibility and access remain
 * backend-authoritative through `backendItemId`; personal visibility is
 * derived from the authenticated session and module entitlement.
 */
export const SETTINGS_NAVIGATION: SettingsNavigationDefinition[] = [
  {
    id: 'personal-profile',
    groupId: 'personal',
    label: 'Profile',
    description: 'Your signed-in identity and current school context.',
    href: '/dashboard/settings/personal/profile',
    icon: UserRound,
    scope: 'personal',
    searchKeywords: ['account', 'name', 'email', 'role', 'school'],
  },
  {
    id: 'personal-security',
    groupId: 'personal',
    label: 'Account & security',
    description: 'Password and session revocation preferences.',
    href: '/dashboard/settings/personal/security',
    icon: ShieldCheck,
    scope: 'personal',
    searchKeywords: ['password', 'security', 'devices', 'sessions'],
    legacyHrefs: ['/dashboard/account-security'],
  },
  {
    id: 'personal-notifications',
    groupId: 'personal',
    label: 'Notifications',
    description: 'Your allowed notification categories and channels.',
    href: '/dashboard/settings/personal/notifications',
    icon: BellRing,
    scope: 'personal',
    requiredPermission: 'notifications:view_own',
    requiredModule: 'notifications',
    searchKeywords: ['alerts', 'messages', 'quiet hours', 'email', 'sms'],
    legacyHrefs: ['/dashboard/notifications/preferences'],
  },
  {
    id: 'school-onboarding',
    groupId: 'school',
    label: 'Day-1 onboarding',
    description: 'Core setup checklist before the first school day.',
    href: '/dashboard/settings/onboarding',
    icon: ClipboardList,
    scope: 'school',
    backendItemId: 'school-profile',
    searchKeywords: ['checklist', 'onboarding', 'day 1', 'setup', 'go-live'],
  },
  {
    id: 'school-identity',
    groupId: 'school',
    label: 'Identity & general',
    description: 'Official school identity, contacts, and registration.',
    href: '/dashboard/settings/school/identity',
    icon: Building2,
    scope: 'school',
    backendItemId: 'school-profile',
    searchKeywords: ['general', 'profile', 'contact', 'registration', 'iemis'],
    legacyHrefs: [
      '/dashboard/settings/school-profile',
      '/dashboard/settings/profile',
    ],
  },
  {
    id: 'school-branding',
    groupId: 'school',
    label: 'Branding',
    description: 'Protected logo, colours, and document presentation.',
    href: '/dashboard/settings/school/branding',
    icon: Palette,
    scope: 'school',
    backendItemId: 'branding-documents',
    searchKeywords: ['logo', 'colour', 'color', 'documents', 'letterhead'],
    legacyHrefs: [
      '/dashboard/settings/branding-documents',
      '/dashboard/settings/documents-templates',
    ],
  },
  {
    id: 'school-academic-year',
    groupId: 'school',
    label: 'Academic year & calendar',
    description: 'Bikram Sambat years, school days, and holidays.',
    href: '/dashboard/settings/school/academic-year',
    icon: CalendarDays,
    scope: 'school',
    backendItemId: 'academic-calendar',
    searchKeywords: ['calendar', 'holiday', 'academic year', 'bs'],
    legacyHrefs: [
      '/dashboard/settings/academic-calendar',
      '/dashboard/settings/academic',
    ],
  },
  {
    id: 'school-academic-structure',
    groupId: 'school',
    label: 'Classes & sections',
    description: 'Foundational class and section structure for this school.',
    href: '/dashboard/settings/school/academic-structure',
    icon: School,
    scope: 'school',
    backendItemId: 'academic-structure',
    requiredModule: 'students',
    searchKeywords: ['classes', 'sections', 'grades', 'structure'],
    legacyHrefs: [
      '/dashboard/settings/academic-structure',
      '/dashboard/settings/classes-sections',
    ],
  },
  {
    id: 'school-modules',
    groupId: 'school',
    label: 'School modules',
    description: 'Enabled SchoolOS modules for the current school.',
    href: '/dashboard/settings/school/modules',
    icon: LayoutGrid,
    scope: 'platform',
    backendItemId: 'modules',
    searchKeywords: ['plan', 'subscription', 'entitlements', 'features'],
    legacyHrefs: [
      '/dashboard/settings/modules',
      '/dashboard/settings/billing',
      '/dashboard/settings/plans',
    ],
    status: 'platform-managed',
  },
  {
    id: 'policy-admissions',
    groupId: 'policies',
    label: 'Admissions',
    description: 'Admission requirements, documents, and approval policies.',
    href: '/dashboard/settings/admissions',
    icon: UserPlus,
    scope: 'school',
    backendItemId: 'admissions',
    requiredModule: 'students',
    searchKeywords: ['admission', 'documents', 'approval', 'applicant'],
  },
  {
    id: 'policy-attendance',
    groupId: 'policies',
    label: 'Attendance',
    description: 'Attendance lock, correction, and visibility rules.',
    href: '/dashboard/settings/policies/attendance',
    icon: CalendarCheck2,
    scope: 'school',
    backendItemId: 'attendance',
    requiredModule: 'attendance',
    searchKeywords: ['late', 'correction', 'lock', 'attendance'],
    legacyHrefs: ['/dashboard/settings/attendance'],
  },
  {
    id: 'policy-exams',
    groupId: 'policies',
    label: 'Exams & report cards',
    description: 'School-wide grading, promotion, and result policy.',
    href: '/dashboard/settings/policies/exams',
    icon: ClipboardList,
    scope: 'school',
    backendItemId: 'exams-report-cards',
    requiredModule: 'exams',
    searchKeywords: ['grading', 'results', 'promotion', 'report cards', 'cas'],
    legacyHrefs: ['/dashboard/settings/exams-report-cards'],
  },
  {
    id: 'policy-homework',
    groupId: 'policies',
    label: 'Homework',
    description: 'Homework workflows and the current configuration boundary.',
    href: '/dashboard/settings/policies/homework',
    icon: BookOpenCheck,
    scope: 'school',
    backendItemId: 'homework-timetable',
    requiredModule: 'homework',
    searchKeywords: ['assignments', 'publishing', 'reminders', 'timetable'],
    legacyHrefs: ['/dashboard/settings/homework-timetable-learning'],
  },
  {
    id: 'policy-activity-consent',
    groupId: 'policies',
    label: 'Activity, media & consent',
    description: 'Effective media-consent protection for student activity.',
    href: '/dashboard/settings/policies/activity-consent',
    icon: ImagePlay,
    scope: 'platform',
    backendItemId: 'activity-consent',
    requiredModule: 'activity',
    searchKeywords: ['photos', 'videos', 'guardian', 'media', 'consent'],
    legacyHrefs: ['/dashboard/settings/activity-consent'],
    status: 'platform-managed',
  },
  {
    id: 'policy-communication',
    groupId: 'policies',
    label: 'Notices & notifications',
    description:
      'Notice delivery defaults, family notifications, and quiet hours.',
    href: '/dashboard/settings/communication',
    icon: BellRing,
    scope: 'school',
    backendItemId: 'communication',
    searchKeywords: [
      'notices',
      'notifications',
      'announcements',
      'quiet hours',
      'email',
      'sms',
    ],
    legacyHrefs: ['/dashboard/settings/notifications'],
  },
  {
    id: 'administration-fees',
    groupId: 'administration',
    label: 'Fees & receipts',
    description: 'Receipt numbering, approvals, cashier close, and methods.',
    href: '/dashboard/settings/fees',
    icon: ReceiptText,
    scope: 'school',
    backendItemId: 'fees',
    requiredModule: 'fees',
    searchKeywords: ['fees', 'receipt', 'cashier', 'payment', 'discount', 'waiver'],
  },
  {
    id: 'administration-accounting',
    groupId: 'administration',
    label: 'Accounting & fiscal policy',
    description: 'Fiscal defaults, account labels, and numbering prefixes.',
    href: '/dashboard/settings/accounting',
    icon: WalletCards,
    scope: 'school',
    backendItemId: 'accounting',
    requiredModule: 'accounting',
    searchKeywords: ['accounting', 'fiscal', 'journal', 'voucher', 'account'],
  },
  {
    id: 'administration-hr-payroll',
    groupId: 'administration',
    label: 'HR & payroll',
    description: 'Leave approval and payroll policy defaults.',
    href: '/dashboard/settings/hr-payroll',
    icon: Wallet,
    scope: 'school',
    backendItemId: 'hr-payroll',
    requiredModule: 'hr',
    searchKeywords: ['hr', 'payroll', 'leave', 'pf', 'tds', 'salary'],
  },
  {
    id: 'access-roles',
    groupId: 'access',
    label: 'Roles & permissions',
    description: 'Role coverage and permission boundaries for this school.',
    href: '/dashboard/settings/access/roles',
    icon: UserCog,
    scope: 'school',
    backendItemId: 'roles-permissions',
    searchKeywords: ['rbac', 'roles', 'permissions', 'access'],
    legacyHrefs: [
      '/dashboard/settings/roles-permissions',
      '/dashboard/settings/users-roles',
    ],
  },
  {
    id: 'access-users',
    groupId: 'access',
    label: 'Users & access',
    description: 'School user accounts, activation, and security actions.',
    href: '/dashboard/settings/access/users',
    icon: UsersRound,
    scope: 'school',
    backendItemId: 'users-access',
    searchKeywords: ['staff', 'accounts', 'users', 'activate', 'suspend'],
    legacyHrefs: ['/dashboard/settings/users-access'],
  },
  {
    id: 'system-security',
    groupId: 'system',
    label: 'Security & privacy',
    description: 'Session, masking, reveal-reason, and export policy.',
    href: '/dashboard/settings/security',
    icon: ShieldCheck,
    scope: 'school',
    backendItemId: 'security',
    searchKeywords: ['session', 'privacy', 'masking', 'export', 'security'],
  },
  {
    id: 'system-integrations',
    groupId: 'system',
    label: 'Integrations',
    description: 'Safe connection status without provider credentials.',
    href: '/dashboard/settings/system/integrations',
    icon: Link2,
    scope: 'platform',
    backendItemId: 'integrations',
    searchKeywords: ['providers', 'connections', 'sms', 'email', 'storage'],
    legacyHrefs: ['/dashboard/settings/integrations'],
    status: 'platform-managed',
  },
  {
    id: 'system-audit-log',
    groupId: 'system',
    label: 'Audit log',
    description: 'Tenant-scoped setting history and protected exports.',
    href: '/dashboard/settings/system/audit-log',
    icon: FileClock,
    scope: 'school',
    backendItemId: 'audit-export',
    searchKeywords: ['history', 'changes', 'audit', 'exports'],
    legacyHrefs: [
      '/dashboard/settings/audit-export',
      '/dashboard/settings/audit-log',
      '/dashboard/settings/security-audit',
    ],
  },
];

export function settingsDefinitionMatchesPath(
  definition: SettingsNavigationDefinition,
  pathname: string,
) {
  const candidates = [definition.href, ...(definition.legacyHrefs ?? [])];
  return candidates.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function settingsDefinitionMatchesQuery(
  definition: SettingsNavigationDefinition,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    definition.label,
    definition.description,
    ...definition.searchKeywords,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}
