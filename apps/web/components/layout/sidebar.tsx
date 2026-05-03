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
  Settings,
  ChevronLeft,
  ChevronRight,
  Lock,
  School,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: PermissionKey[];
  badge?: number;
  phase: 'phase1' | 'future';
  disabled?: boolean;
};

export const dashboardNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    phase: 'phase1',
  },
  {
    href: '/dashboard/admissions',
    label: 'Students / Admissions',
    icon: Users,
    permissions: ['students:read', 'students:create'],
    phase: 'phase1',
  },
  {
    href: '/dashboard/attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    permissions: ['attendance:read', 'attendance:mark'],
    phase: 'phase1',
  },
  {
    href: '/dashboard/finance',
    label: 'Fee Collection',
    icon: Wallet,
    permissions: ['fees:manage', 'fees:bill', 'payments:collect', 'receipts:read'],
    phase: 'phase1',
  },
  {
    href: '/dashboard/activity',
    label: 'Activity Feed',
    icon: Images,
    permissions: ['activity_feed:read', 'activity_feed:create'],
    phase: 'phase1',
  },
  {
    href: '/dashboard/notices',
    label: 'Notices',
    icon: Megaphone,
    permissions: ['notices:read', 'notices:create', 'events:read', 'events:create'],
    phase: 'phase1',
  },
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
    phase: 'phase1',
  },
  {
    href: '/dashboard/academics',
    label: 'Academics',
    icon: GraduationCap,
    permissions: ['academics:read', 'academics:manage'],
    phase: 'future',
    disabled: true,
  },
  {
    href: '/dashboard/payroll',
    label: 'Staff & HR',
    icon: UserCog,
    permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
    phase: 'future',
    disabled: true,
  },
  {
    href: '/dashboard/accounting',
    label: 'Accounting',
    icon: Calculator,
    permissions: ['accounting:read'],
    phase: 'future',
    disabled: true,
  },
  {
    href: '#library-coming-soon',
    label: 'Library',
    icon: BookOpen,
    permissions: ['library:read', 'library:manage'],
    phase: 'future',
    disabled: true,
  },
  {
    href: '#transport-coming-soon',
    label: 'Transport',
    icon: Bus,
    permissions: ['transport:read', 'transport:manage', 'transport:operate'],
    phase: 'future',
    disabled: true,
  },
];

export const platformNavItems: NavItem[] = [
  {
    href: '/platform/dashboard',
    label: 'Platform Overview',
    icon: LayoutDashboard,
    phase: 'phase1',
    permissions: ['platform:read'],
  },
  {
    href: '/platform/schools',
    label: 'Manage Schools',
    icon: School,
    phase: 'phase1',
    permissions: ['platform:manage'],
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

  const visiblePrimaryItems = dashboardNavItems.filter(
    (item) => item.phase === 'phase1' && canSeeNavItem(item, session),
  );
  const visiblePlatformItems = platformNavItems.filter((item) =>
    canSeeNavItem(item, session),
  );
  const futureItems = dashboardNavItems.filter((item) => item.phase === 'future');

  const sidebarContent = (
    <SidebarContent
      collapsed={collapsed}
      futureItems={futureItems}
      pathname={pathname}
      primaryItems={visiblePrimaryItems}
      platformItems={visiblePlatformItems}
      onMobileClose={onMobileClose}
      onToggle={onToggle}
    />
  );

  return (
    <>
      {/* Mobile overlay */}
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

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          collapsed={false}
          futureItems={futureItems}
          pathname={pathname}
          primaryItems={visiblePrimaryItems}
          platformItems={visiblePlatformItems}
          onMobileClose={onMobileClose}
        />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}

function SidebarContent({
  collapsed,
  futureItems,
  pathname,
  primaryItems,
  platformItems,
  onMobileClose,
  onToggle,
}: {
  collapsed: boolean;
  futureItems: NavItem[];
  pathname: string | null;
  primaryItems: NavItem[];
  platformItems: NavItem[];
  onMobileClose: () => void;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`flex h-full flex-col bg-sidebar-900 text-white sidebar-transition ${
        collapsed ? 'w-[72px]' : 'w-[280px]'
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold">
          S
        </div>
        <div
          className={`sidebar-label ${collapsed ? 'w-0 opacity-0' : 'opacity-100'}`}
        >
          <span className="block truncate text-sm font-semibold text-white">
            SchoolOS
          </span>
          <span className="block truncate text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-slate-500">
            Pilot workspace
          </span>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Dashboard navigation"
      >
        <NavSection
          collapsed={collapsed}
          items={primaryItems}
          label="Phase 1 Core"
          pathname={pathname}
          onMobileClose={onMobileClose}
        />

        <NavSection
          collapsed={collapsed}
          items={platformItems}
          label="Platform Control"
          pathname={pathname}
          onMobileClose={onMobileClose}
        />

        <NavSection
          collapsed={collapsed}
          items={futureItems}
          label="Later Modules"
          pathname={pathname}
          onMobileClose={onMobileClose}
        />
      </nav>

      {onToggle && (
        <div className="hidden border-t border-white/[0.06] px-3 py-3 lg:block">
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
                <span className="sidebar-label">Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function NavSection({
  collapsed,
  items,
  label,
  pathname,
  onMobileClose,
}: {
  collapsed: boolean;
  items: NavItem[];
  label: string;
  pathname: string | null;
  onMobileClose: () => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-5 space-y-1">
      {!collapsed && (
        <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
      )}

      {items.map((item) => (
        <NavEntry
          key={item.href}
          collapsed={collapsed}
          item={item}
          pathname={pathname}
          onMobileClose={onMobileClose}
        />
      ))}
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
        <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-500" />
      )}

      <Icon
        size={20}
        className={`shrink-0 ${
          active && !item.disabled
            ? 'text-primary-300'
            : 'text-slate-500 group-hover:text-slate-300'
        }`}
      />

      <span
        className={`sidebar-label ${collapsed ? 'w-0 opacity-0' : 'opacity-100'}`}
      >
        {item.label}
      </span>

      {item.disabled && !collapsed && (
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/[0.08] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
          <Lock size={10} />
          Later
        </span>
      )}

      {item.badge && !collapsed && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger-500 px-1.5 text-[0.6875rem] font-semibold text-white">
          {item.badge}
        </span>
      )}

      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {item.label}
          {item.disabled ? ' · Later' : ''}
        </span>
      )}
    </>
  );

  const className = `group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
    active && !item.disabled
      ? 'bg-primary-600/15 text-primary-50'
      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
  } ${item.disabled ? 'cursor-not-allowed opacity-55 hover:bg-transparent hover:text-slate-400' : ''}`;

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
  session: ReturnType<typeof useSession>['session'],
) {
  if (!item.permissions?.length) {
    return true;
  }

  const permissionSet = new Set(session?.user.permissions ?? []);
  return item.permissions.some((permission) => permissionSet.has(permission));
}
