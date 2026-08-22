import type { PermissionKey, SchoolWebPersona } from '@schoolos/core';
import { TeacherCapability } from '@schoolos/core';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarCheck,
  FileCheck2,
  GraduationCap,
  Images,
  LayoutDashboard,
  MessageSquare,
  School,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  accountantNavGroups,
  adminNavGroups,
  buildTeacherNavGroups,
  canteenOperatorNavGroups,
  cashierNavGroups,
  hrNavGroups,
  librarianNavGroups,
  transportOperatorNavGroups,
  type NavGroup,
} from './sidebar-persona-nav.base';

export * from './sidebar-persona-nav.base';

const principalStudentRead: PermissionKey[] = ['students:read'];
const principalAttendanceRead: PermissionKey[] = ['attendance:read'];
const principalAcademicRead: PermissionKey[] = ['academics:read'];
const principalStaffRead: PermissionKey[] = ['hr:read', 'staff:read'];
const principalFinanceRead: PermissionKey[] = [
  'finance:principal:read',
  'accounting:read',
];
const principalCommunicationRead: PermissionKey[] = [
  'notices:read',
  'communications:read_deliveries',
];

/**
 * Principal navigation is leadership-shaped rather than operator-shaped.
 * Permission and entitlement filtering remains UX-only; backend guards are
 * still authoritative for every destination and request.
 *
 * Entitlement ownership stays in nav-module-map.ts. Only the cross-module
 * Operations Overview declares moduleKeys because it intentionally appears
 * when any of Library, Transport, or Canteen is enabled.
 */
export const principalNavGroups: NavGroup[] = [
  {
    label: 'Leadership',
    icon: LayoutDashboard,
    items: [
      {
        href: '/dashboard',
        label: 'Principal Home',
        icon: LayoutDashboard,
      },
      {
        href: '/dashboard/attention',
        label: 'Attention Centre',
        icon: AlertTriangle,
      },
      {
        href: '/dashboard/approvals',
        label: 'Approval Centre',
        icon: ShieldCheck,
        permissions: ['advanced:approvals:read'],
      },
    ],
  },
  {
    label: 'Students & Admissions',
    icon: Users,
    items: [
      {
        href: '/dashboard/students/overview',
        label: 'Enrollment Overview',
        icon: Users,
        permissions: principalStudentRead,
      },
      {
        href: '/dashboard/admissions/overview',
        label: 'Admissions Overview',
        icon: UserPlus,
        permissions: principalStudentRead,
      },
    ],
  },
  {
    label: 'School Readiness',
    icon: School,
    items: [
      {
        href: '/dashboard/attendance/overview',
        label: 'Attendance Oversight',
        icon: CalendarCheck,
        permissions: principalAttendanceRead,
      },
      {
        href: '/dashboard/academics/readiness',
        label: 'Academic Readiness',
        icon: GraduationCap,
        permissions: principalAcademicRead,
      },
      {
        href: '/dashboard/hr/overview',
        label: 'Staff Overview',
        icon: BriefcaseBusiness,
        permissions: principalStaffRead,
      },
      {
        href: '/dashboard/finance-overview',
        label: 'Finance Overview',
        icon: Wallet,
        permissions: principalFinanceRead,
      },
      {
        href: '/dashboard/operations/overview',
        label: 'Operations Overview',
        icon: School,
        permissions: ['reports:read'],
        moduleKeys: ['library', 'transport', 'canteen'],
      },
    ],
  },
  {
    label: 'Communication',
    icon: MessageSquare,
    items: [
      {
        href: '/dashboard/communications/oversight',
        label: 'Communication Oversight',
        icon: MessageSquare,
        permissions: principalCommunicationRead,
      },
      {
        href: '/dashboard/notices',
        label: 'Notices',
        icon: MessageSquare,
        permissions: ['notices:read'],
      },
      {
        href: '/dashboard/activity/oversight',
        label: 'Activity Oversight',
        icon: Images,
        permissions: ['activity_feed:read'],
      },
    ],
  },
  {
    label: 'Reports & Audit',
    icon: FileCheck2,
    items: [
      {
        href: '/dashboard/reports',
        label: 'Reports',
        icon: FileCheck2,
        permissions: ['reports:read'],
      },
      {
        href: '/dashboard/audit',
        label: 'Leadership Audit',
        icon: ShieldCheck,
        permissions: ['settings:audit:read'],
      },
    ],
  },
];

/**
 * Institutional Settings is capability-driven for operational personas, but a
 * Principal-only shell intentionally stays leadership-focused. When the same
 * user also holds School Configuration Owner/Admin authority, persona
 * resolution promotes that session to the admin/configuration shell and this
 * function can expose Settings there. Backend settings authorization remains
 * authoritative for every destination and mutation.
 */
export function shouldShowSettingsHub(
  settingsCaps: {
    institutionalNavEnabled: boolean;
    canAccessInstitutionalSettings: boolean;
  },
  isTeacherPersona: boolean,
  personalOnly: boolean,
  persona: SchoolWebPersona,
): boolean {
  const principalLeadershipOnly = ['principal'].includes(persona);
  if (isTeacherPersona || personalOnly || principalLeadershipOnly) return false;
  return (
    settingsCaps.institutionalNavEnabled &&
    settingsCaps.canAccessInstitutionalSettings
  );
}

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
