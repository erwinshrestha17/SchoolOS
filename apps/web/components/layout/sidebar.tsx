'use client';

import type { PermissionKey } from '@schoolos/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '../session-provider';
import { useEntitlements } from '../entitlements-provider';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CalendarCheck,
  Wallet,
  Images,
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
  CalendarDays,
  GraduationCap,
  FileText,
  MonitorPlay,
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
const learningPermissions: PermissionKey[] = [
  'learning:read',
  'learning:create',
  'learning:update',
  'learning:launch',
  'learning:progress',
];

function getRequiredModuleForHref(href: string): string | null {
  if (href.startsWith('/dashboard/communications')) return 'notices';
  if (href.startsWith('/dashboard/operations')) return null;
  if (href.startsWith('/dashboard/students')) return 'students';
  if (href.startsWith('/dashboard/admissions')) return 'students';
  if (href.startsWith('/dashboard/attendance')) return 'attendance';
  if (href.startsWith('/dashboard/academics')) return 'exams';
  if (href.startsWith('/dashboard/timetable')) return 'timetable';
  if (href.startsWith('/dashboard/homework')) return 'homework';
  if (href.startsWith('/dashboard/learning')) return 'learning';
  if (href.startsWith('/dashboard/fees')) return 'fees';
  if (href.startsWith('/dashboard/accounting')) return 'accounting';
  if (href.startsWith('/dashboard/hr')) return 'hr';
  if (href.startsWith('/dashboard/payroll')) return 'hr';
  if (href.startsWith('/dashboard/library')) return 'library';
  if (href.startsWith('/dashboard/transport')) return 'transport';
  if (href.startsWith('/dashboard/canteen')) return 'canteen';
  if (href.startsWith('/dashboard/notices')) return 'notices';
  if (href.startsWith('/dashboard/activity')) return 'activity';
  if (href.startsWith('/dashboard/messages')) return 'notices';
  if (href.startsWith('/dashboard/reports')) return 'reports';
  return null;
}

export const dashboardNavGroups: NavGroup[] = [
  {
    label: 'Home',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Students',
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
    label: 'Daily Operations',
    items: [
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['attendance:read', 'attendance:mark'],
      },
      {
        href: '/dashboard/communications',
        label: 'Communication',
        icon: MessageSquare,
        permissions: [
          'notices:read',
          'notices:create',
          'messaging:create',
          'messaging:manage',
        ],
      },
      {
        href: '/dashboard/homework',
        label: 'Homework',
        icon: BookOpen,
        permissions: homeworkPermissions,
      },
      {
        href: '/dashboard/learning',
        label: 'Learning',
        icon: MonitorPlay,
        permissions: learningPermissions,
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        href: '/dashboard/academics',
        label: 'Academics',
        icon: GraduationCap,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/exams',
        label: 'Exams',
        icon: FileCheck2,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/cas',
        label: 'CAS Records',
        icon: ClipboardList,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/academics/report-cards',
        label: 'Report Cards',
        icon: FileText,
        permissions: academicPermissions,
      },
      {
        href: '/dashboard/timetable',
        label: 'Timetable',
        icon: CalendarDays,
        permissions: timetablePermissions,
      },
    ],
  },
  {
    label: 'School Operations',
    items: [
      {
        href: '/dashboard/operations',
        label: 'Operations Hub',
        icon: School,
        permissions: [
          'library:read',
          'library:manage',
          'transport:read',
          'transport:manage',
          'transport:operate',
          'canteen:menu:read',
          'canteen:plans:read',
          'canteen:enrollments:read',
        ],
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
      {
        href: '/dashboard/notices',
        label: 'Notices',
        icon: Megaphone,
        permissions: ['notices:read', 'notices:create'],
      },
      {
        href: '/dashboard/activity',
        label: 'Activity Feed',
        icon: Images,
        permissions: ['activity_feed:read', 'activity_feed:create'],
      },
      {
        href: '/dashboard/messages',
        label: 'Messages',
        icon: MessageSquare,
      },
    ],
  },
  {
    label: 'Staff & Finance',
    items: [
      {
        href: '/dashboard/fees',
        label: 'Fees',
        icon: Wallet,
        permissions: [
          'fees:manage',
          'fees:bill',
          'payments:collect',
          'receipts:read',
        ],
      },
      {
        href: '/dashboard/hr',
        label: 'HR / Staff',
        icon: UserCog,
        permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
      },
      {
        href: '/dashboard/payroll',
        label: 'Payroll',
        icon: CalendarDays,
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
    label: 'Reports',
    items: [
      {
        href: '/dashboard/reports',
        label: 'Reports',
        icon: ClipboardList,
        permissions: ['accounting:reports:read', 'library:reports:read'],
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

export type SidebarProps = {
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
  const { hasModule } = useEntitlements();

  const visibleGroups = dashboardNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const canSee = canSeeNavItem(item, session);
        if (!canSee) return false;

        const requiredModule = getRequiredModuleForHref(item.href);
        if (requiredModule && !hasModule(requiredModule)) {
          return false;
        }

        if (
          item.href === '/dashboard/operations' &&
          !['library', 'transport', 'canteen'].some((module) => hasModule(module))
        ) {
          return false;
        }

        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const visiblePlatformItems = platformNavItems.filter((item) =>
    canSeeNavItem(item, session),
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
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
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

      <aside className="hidden h-screen sticky top-0 z-30 lg:flex">
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
        'sidebar-transition flex h-full flex-col border-r border-slate-200 bg-white text-slate-700',
        collapsed ? 'w-[72px]' : 'w-[232px]',
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-white shadow-sm">
          <School size={18} aria-hidden="true" />
        </div>

        <div
          className={cn(
            'sidebar-label',
            collapsed ? 'w-0 opacity-0' : 'opacity-100',
          )}
        >
          <span className="block truncate text-lg font-extrabold tracking-tight text-[var(--primary)]">
            School<span className="font-semibold">OS</span>
          </span>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2.5 py-4 scrollbar-hide"
        aria-label="Dashboard navigation"
      >
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-2.5 pb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-slate-500">
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
          <div className="mt-6 border-t border-slate-200 pt-4">
            {!collapsed && (
              <p className="px-2.5 pb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-slate-500">
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
        <div className="border-t border-slate-200 px-2.5 py-2.5 lg:block">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={20} className="shrink-0" />
            ) : (
              <>
                <ChevronLeft size={20} className="shrink-0" />
                <span className="sidebar-label font-semibold">Collapse</span>
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
    (item.href === '/dashboard/academics' && pathname === '/dashboard/academics') ||
    (item.href !== '/dashboard' &&
      item.href !== '/dashboard/academics' &&
      pathname?.startsWith(item.href));

  const content = (
    <>
      {active && !item.disabled && (
        <span className="absolute -left-2.5 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--primary)]" />
      )}

      <Icon
        size={18}
        className={cn(
          'shrink-0 transition-colors',
          active && !item.disabled
            ? 'text-[var(--primary)]'
            : 'text-slate-500 group-hover:text-slate-800',
        )}
      />

      <span
        className={cn(
          'sidebar-label font-semibold',
          collapsed ? 'w-0 opacity-0' : 'opacity-100',
        )}
      >
        {item.label}
      </span>

      {!collapsed && item.badge && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[0.65rem] font-bold text-white">
          {item.badge}
        </span>
      )}

      {collapsed && (
        <div className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {item.label}
        </div>
      )}
    </>
  );

  const className = cn(
    'group relative flex min-h-9 items-center gap-3 rounded-lg px-2.5 py-2 text-[0.78rem] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 focus:ring-offset-white',
    active && !item.disabled
      ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary-dark)]'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
    item.disabled &&
      'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-500',
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
    <Link
      href={item.href}
      onClick={onMobileClose}
      className={className}
      aria-current={active ? 'page' : undefined}
    >
      {content}
    </Link>
  );
}

function canSeeNavItem(
  item: NavItem,
  session: ReturnType<typeof useSession>['session'],
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
