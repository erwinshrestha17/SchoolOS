'use client';

import type { PermissionKey } from '@schoolos/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '../session-provider';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  Images,
  GraduationCap,
  UserCog,
  Calculator,
  BookOpen,
  Bus,
  Megaphone,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Lock,
  School,
  Utensils,
  ClipboardList,
  FileCheck2,
  Trophy,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '../../lib/utils';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: PermissionKey[];
  platformRoles?: string[];
  badge?: number | string;
  disabled?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const academicPermissions: PermissionKey[] = ['academics:read', 'academics:manage'];
const timetablePermissions: PermissionKey[] = ['timetable:read'];
const homeworkPermissions: PermissionKey[] = ['homework:read'];

export const dashboardNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'People',
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
        icon: Users,
        permissions: ['students:read', 'students:create'],
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['attendance:read', 'attendance:mark'],
      },
      {
        href: '/dashboard/academics',
        label: 'Academics',
        icon: GraduationCap,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/exams',
        label: 'Exams',
        icon: ClipboardList,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/marks',
        label: 'Marks Entry',
        icon: FileCheck2,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/report-cards',
        label: 'Report Cards',
        icon: BookOpen,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/promotions',
        label: 'Promotions',
        icon: Trophy,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/results',
        label: 'Result Publishing',
        icon: Megaphone,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/timetable',
        label: 'Timetable',
        icon: CalendarDays,
        permissions: timetablePermissions,
      },
      {
        href: '/dashboard/timetable/builder',
        label: 'Timetable Builder',
        icon: CalendarCheck,
        permissions: timetablePermissions,
      },
      {
        href: '/dashboard/timetable/versions',
        label: 'Timetable Versions',
        icon: Settings,
        permissions: ['timetable:read', 'timetable:manage'],
      },
      {
        href: '/dashboard/timetable/substitutions',
        label: 'Substitutions',
        icon: Users,
        permissions: ['timetable:read', 'timetable:substitute'],
      },
      {
        href: '/dashboard/homework',
        label: 'Homework',
        icon: BookOpen,
        permissions: homeworkPermissions,
      },
      {
        href: '/dashboard/homework/new',
        label: 'Create Homework',
        icon: ClipboardList,
        permissions: ['homework:manage', 'homework:publish'],
      },
      {
        href: '/dashboard/homework/review',
        label: 'Homework Review',
        icon: FileCheck2,
        permissions: ['homework:review', 'homework:manage'],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        href: '/dashboard/finance',
        label: 'Fee Collection',
        icon: Wallet,
        permissions: [
          'fees:manage',
          'fees:bill',
          'payments:collect',
          'receipts:read',
        ],
      },
      {
        href: '/dashboard/accounting',
        label: 'Accounting',
        icon: Calculator,
        permissions: [
          'accounting:read',
          'accounting:accounts:read',
          'accounting:reports:read',
        ],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        href: '/dashboard/notices',
        label: 'Notices',
        icon: Megaphone,
        permissions: [
          'notices:read',
          'notices:create',
          'events:read',
          'events:create',
        ],
      },
      {
        href: '/dashboard/messages',
        label: 'Messages',
        icon: MessageSquare,
        permissions: ['messaging:read'],
      },
      {
        href: '/dashboard/activity',
        label: 'Activity Feed',
        icon: Images,
        permissions: ['activity_feed:read', 'activity_feed:create'],
      },
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
        disabled: true,
        permissions: [
          'transport:read',
          'transport:manage',
          'transport:operate',
          'transport:routes:read',
          'transport:vehicles:read',
          'transport:assignments:read',
          'transport:trips:read',
          'transport:location:read',
        ],
      },
      {
        href: '/dashboard/canteen',
        label: 'Canteen',
        icon: Utensils,
        disabled: true,
        permissions: [
          'canteen:menu:read',
          'canteen:plans:read',
          'canteen:enrollments:read',
          'canteen:serving:read',
          'canteen:wallets:read',
          'canteen:pos:read',
          'canteen:reports:read',
        ],
      },
    ],
  },
  {
    label: 'HR',
    items: [
      {
        href: '/dashboard/hr',
        label: 'HR / Staff',
        icon: UserCog,
        permissions: ['hr:read'],
      },
      {
        href: '/dashboard/payroll',
        label: 'Payroll',
        icon: UserCog,
        permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        href: '/dashboard/settings',
        label: 'Settings',
        icon: Settings,
        permissions: [
          'settings:read',
          'roles:read',
          'classes:read',
          'academic_years:read',
        ],
      },
    ],
  },
];

export const platformNavItems: NavItem[] = [
  {
    href: '/platform/dashboard',
    label: 'Platform Control',
    icon: Lock,
    platformRoles: [
      'platform_super_admin',
      'platform_support',
      'platform_billing_admin',
    ],
  },
  {
    href: '/platform/schools',
    label: 'Managed Schools',
    icon: School,
    platformRoles: ['platform_super_admin', 'platform_support'],
  },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { session } = useSession();

  const filterNavGroups = (groups: NavGroup[]) => {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canSeeNavItem(item, session)),
      }))
      .filter((group) => group.items.length > 0);
  };

  const visibleGroups = filterNavGroups(dashboardNavGroups);
  const visiblePlatformItems = platformNavItems.filter((item) =>
    canSeeNavItem(item, session)
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={onMobileClose}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onMobileClose();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent
          collapsed={false}
          groups={visibleGroups}
          pathname={pathname}
          platformItems={visiblePlatformItems}
          onMobileClose={onMobileClose}
        />
      </aside>

      <aside className="hidden lg:flex h-screen sticky top-0 z-30">
        <SidebarContent
          collapsed={collapsed}
          groups={visibleGroups}
          pathname={pathname}
          platformItems={visiblePlatformItems}
          onMobileClose={onMobileClose}
          onToggle={onToggle}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  collapsed,
  groups,
  pathname,
  platformItems,
  onMobileClose,
  onToggle,
}: {
  collapsed: boolean;
  groups: NavGroup[];
  pathname: string | null;
  platformItems: NavItem[];
  onMobileClose: () => void;
  onToggle?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col bg-sidebar-900 text-white sidebar-transition',
        collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold shadow-lg shadow-primary-600/20">
          S
        </div>

        <div
          className={cn(
            'sidebar-label',
            collapsed ? 'w-0 opacity-0' : 'opacity-100'
          )}
        >
          <span className="block truncate text-sm font-bold text-white tracking-tight">
            SchoolOS
          </span>
          <span className="block truncate text-[0.6rem] font-bold uppercase tracking-[0.2em] text-slate-500">
            Workspace
          </span>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-6 scrollbar-hide"
        aria-label="Dashboard navigation"
      >
        {groups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            {!collapsed && (
              <p className="px-3 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-600">
                {group.label}
              </p>
            )}

            <div className="space-y-1">
              {group.items.map((item) => (
                <NavEntry
                  key={item.href}
                  collapsed={collapsed}
                  item={item}
                  pathname={pathname}
                  onMobileClose={onMobileClose}
                />
              ))}
            </div>
          </div>
        ))}

        {platformItems.length > 0 && (
          <div className="mt-8 border-t border-white/[0.06] pt-6">
            {!collapsed && (
              <p className="px-3 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-600">
                Platform
              </p>
            )}

            <div className="space-y-1">
              {platformItems.map((item) => (
                <NavEntry
                  key={item.href}
                  collapsed={collapsed}
                  item={item}
                  pathname={pathname}
                  onMobileClose={onMobileClose}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {onToggle && (
        <div className="border-t border-white/[0.06] px-3 py-3 lg:block">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={20} className="shrink-0" />
            ) : (
              <>
                <ChevronLeft size={20} className="shrink-0" />
                <span className="sidebar-label font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function NavEntry({
  collapsed,
  item,
  pathname,
  onMobileClose,
}: {
  collapsed: boolean;
  item: NavItem;
  pathname: string | null;
  onMobileClose: () => void;
}) {
  const Icon = item.icon;

  const active =
    (item.href === '/dashboard' && pathname === '/dashboard') ||
    (item.href !== '/dashboard' && pathname?.startsWith(item.href));

  const content = (
    <>
      {active && !item.disabled && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-500" />
      )}

      <Icon
        size={18}
        className={cn(
          'shrink-0 transition-colors',
          active && !item.disabled
            ? 'text-primary-400'
            : 'text-slate-500 group-hover:text-slate-300'
        )}
      />

      <span
        className={cn(
          'sidebar-label font-medium',
          collapsed ? 'w-0 opacity-0' : 'opacity-100'
        )}
      >
        {item.label}
      </span>

      {!collapsed && item.badge && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-[0.65rem] font-bold text-white">
          {item.badge}
        </span>
      )}

      {collapsed && (
        <div className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          {item.label}
        </div>
      )}
    </>
  );

  const className = cn(
    'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
    active && !item.disabled
      ? 'bg-primary-600/10 text-primary-50 shadow-sm'
      : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
    item.disabled &&
      'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400'
  );

  if (item.disabled) {
    return (
      <button
        type="button"
        className={className}
        disabled
        aria-disabled="true"
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href} onClick={onMobileClose} className={className}>
      {content}
    </Link>
  );
}

function canSeeNavItem(
  item: NavItem,
  session: ReturnType<typeof useSession>['session']
) {
  const hasPlatformRole =
    item.platformRoles?.some((role) => session?.user.roles.includes(role)) ??
    false;

  if (hasPlatformRole) {
    return true;
  }

  if (!item.permissions?.length) {
    return true;
  }

  const permissionSet = new Set(session?.user.permissions ?? []);

  return item.permissions.some((permission) => permissionSet.has(permission));
}
