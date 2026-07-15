'use client';

import type { PermissionKey } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bus,
  Calculator,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Images,
  LayoutDashboard,
  MessageSquare,
  School,
  Search,
  Settings,
  UserCog,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

import { api } from '../../lib/api';
import { useEntitlements } from '../entitlements-provider';
import { useSession } from '../session-provider';
import { hasAnyPermission } from '../../lib/session';
import { cn } from '../../lib/utils';

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

const academicPermissions: PermissionKey[] = [
  'academics:read',
  'academics:manage',
];
const homeworkAndTimetablePermissions: PermissionKey[] = [
  'homework:read',
  'timetable:read',
];
const learningPermissions: PermissionKey[] = [
  'learning:read',
  'learning:create',
  'learning:update',
  'learning:launch',
  'learning:progress',
];
const noticesPermissions: PermissionKey[] = ['notices:read', 'notices:create'];
const settingsPermissions: PermissionKey[] = [
  'settings:read',
  'roles:read',
  'classes:read',
  'academic_years:read',
];

/**
 * This map mirrors the module entitlement gates in the dashboard layout.
 * It is only used to avoid showing unavailable workspaces; direct routes are
 * still protected by the route layout and the backend.
 */
function getRequiredModuleForHref(href: string): string | null {
  if (href.startsWith('/dashboard/communications')) return 'notices';
  if (href.startsWith('/dashboard/students')) return 'students';
  if (href.startsWith('/dashboard/admissions')) return 'students';
  if (href.startsWith('/dashboard/attendance')) return 'attendance';
  if (href.startsWith('/dashboard/academics')) return 'exams';
  if (href.startsWith('/dashboard/timetable')) return 'timetable';
  if (href.startsWith('/dashboard/homework')) return 'homework';
  if (href.startsWith('/dashboard/learning')) return 'learning';
  if (href.startsWith('/dashboard/fees')) return 'fees';
  // '/dashboard/finance' is a legacy alias route for Fees & Receipts (see
  // activeWhen on the Fees nav item below); direct navigation there must
  // still gate on the same module entitlement as '/dashboard/fees'.
  if (href.startsWith('/dashboard/finance')) return 'fees';
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

/**
 * School operations only. Platform navigation deliberately lives in the
 * separate /platform shell and must never be rendered under /dashboard.
 */
export const dashboardNavGroups: NavGroup[] = [
  {
    label: 'Home',
    icon: LayoutDashboard,
    items: [{ href: '/dashboard', label: 'Home', icon: LayoutDashboard }],
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
    label: 'Daily Operations',
    icon: CalendarCheck,
    items: [
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: CalendarCheck,
        permissions: ['attendance:read', 'attendance:mark'],
      },
      {
        href: '/dashboard/fees',
        label: 'Fees & Receipts',
        icon: Wallet,
        permissions: [
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
        ],
        activeWhen: ['/dashboard/fees', '/dashboard/finance'],
      },
      {
        href: '/dashboard/homework',
        label: 'Homework & Timetable',
        icon: CalendarDays,
        permissions: homeworkAndTimetablePermissions,
        moduleKeys: ['homework', 'timetable'],
        activeWhen: ['/dashboard/homework', '/dashboard/timetable'],
      },
      {
        href: '/dashboard/activity',
        label: 'Activity Feed',
        icon: Images,
        permissions: ['activity_feed:read', 'activity_feed:create'],
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
    label: 'Staff & Finance',
    icon: UserCog,
    items: [
      {
        href: '/dashboard/hr',
        label: 'HR / Staff',
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
        permissions: [
          'accounting:read',
          'accounting:accounts:read',
          'accounting:reports:read',
        ],
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
        // Historical communication URLs remain compatibility redirects to
        // the canonical M15 notices workspace. Chat routes are intentionally
        // excluded from active navigation.
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
        permissions: ['accounting:reports:read', 'library:reports:read'],
      },
    ],
  },
];

export const settingsNavItem: NavItem = {
  href: '/dashboard/settings',
  label: 'Settings',
  icon: Settings,
  permissions: settingsPermissions,
};

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

  // A real, permission-gated unread count for the Notices nav badge — reuses
  // the same query key as the topbar's NotificationBell, so TanStack Query
  // dedupes the fetch instead of issuing a second network request. Badge
  // failure/loading must not block navigation, so it silently falls back to
  // "no badge" rather than surfacing an error state.
  const canReadNotifications = hasAnyPermission(session, ['notices:read']);
  const notificationCenterQuery = useQuery({
    queryKey: ['notification-center'],
    queryFn: api.getNotificationCenter,
    enabled: canReadNotifications,
    refetchInterval: 60_000,
  });
  const unreadNoticesBadge = formatBadgeCount(
    notificationCenterQuery.data?.unreadCount ?? 0,
  );

  const visibleGroups = dashboardNavGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canDisplayNavItem(item, session, hasModule))
        .map((item) =>
          item.href === '/dashboard/notices'
            ? { ...item, badge: unreadNoticesBadge }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);

  const visibleSettings = canDisplayNavItem(settingsNavItem, session, hasModule)
    ? settingsNavItem
    : null;

  const activeHref = useMemo(() => {
    const allItems = visibleGroups.flatMap((group) => group.items);
    if (visibleSettings) allItems.push(visibleSettings);
    return computeActiveHref(allItems, pathname);
  }, [visibleGroups, visibleSettings, pathname]);

  const schoolName = session?.tenant.name ?? 'School workspace';
  const roleLabel = formatRole(session?.user.roles[0] ?? 'school_user');
  const userLabel = session?.user.email ?? 'Signed-in school user';

  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Escape-to-close must work regardless of which element inside the drawer
  // currently has focus, and opening the drawer should move focus into it
  // (dashboard-shell.tsx returns focus to the menu trigger on close).
  useEffect(() => {
    if (!mobileOpen) return;
    mobilePanelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onMobileClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={onMobileClose}
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        ref={mobilePanelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="School operations navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition focus:outline-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent
          collapsed={false}
          groups={visibleGroups}
          activeHref={activeHref}
          schoolName={schoolName}
          roleLabel={roleLabel}
          settingsItem={visibleSettings}
          userLabel={userLabel}
          onMobileClose={onMobileClose}
        />
      </aside>

      <aside className="sticky top-0 z-30 hidden h-screen lg:flex">
        <SidebarContent
          collapsed={collapsed}
          groups={visibleGroups}
          activeHref={activeHref}
          schoolName={schoolName}
          roleLabel={roleLabel}
          settingsItem={visibleSettings}
          userLabel={userLabel}
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
  activeHref,
  schoolName,
  roleLabel,
  settingsItem,
  userLabel,
  onMobileClose,
  onToggle,
}: {
  collapsed: boolean;
  groups: NavGroup[];
  activeHref: string | null;
  schoolName: string;
  roleLabel: string;
  settingsItem: NavItem | null;
  userLabel: string;
  onMobileClose: () => void;
  onToggle?: () => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const visibleGroups = useMemo(() => {
    if (!isSearching) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, isSearching, normalizedQuery]);

  return (
    <div
      className={cn(
        'sidebar-transition flex h-full flex-col border-r border-slate-200 bg-white text-slate-700',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      )}
    >
      <header className="border-b border-slate-200 px-3 py-3">
        <div className="flex h-10 items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
            <School size={18} aria-hidden="true" />
          </div>
          <div
            className={cn(
              'min-w-0 transition-all duration-200',
              collapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100',
            )}
          >
            <span className="block truncate text-base font-extrabold tracking-tight text-[var(--primary)]">
              School<span className="font-semibold">OS</span>
            </span>
            <span className="block truncate text-[0.7rem] font-medium text-slate-500">
              School operating desk
            </span>
          </div>
        </div>

        {!collapsed && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm ring-1 ring-slate-200">
              <School size={14} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">
                {schoolName}
              </p>
              <p className="mt-0.5 text-[0.68rem] font-medium text-slate-500">
                School workspace
              </p>
            </div>
          </div>
        )}
      </header>

      {!collapsed && (
        <div className="border-b border-slate-200 px-3 py-2.5">
          <label className="sr-only" htmlFor="sidebar-nav-search">
            Find a workspace
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="sidebar-nav-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a workspace..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 text-[0.8rem] font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--primary)] focus:bg-white focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      <nav
        className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide"
        aria-label="School operations navigation"
      >
        {isSearching && visibleGroups.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-xs font-semibold text-slate-400">
            No workspace matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : null}

        {visibleGroups.map((group) =>
          group.items.length === 1 ? (
            <div key={group.label} className="mb-1 last:mb-0">
              <NavEntry
                collapsed={collapsed}
                item={group.items[0]}
                activeHref={activeHref}
                onMobileClose={onMobileClose}
              />
            </div>
          ) : (
            <NavGroupSection
              key={group.label}
              collapsed={collapsed}
              group={group}
              activeHref={activeHref}
              onMobileClose={onMobileClose}
            />
          ),
        )}
      </nav>

      <footer className="border-t border-slate-200 px-3 py-3">
        {settingsItem ? (
          <section className="mb-2">
            <p
              className={cn(
                'px-2.5 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-500',
                collapsed && 'sr-only',
              )}
            >
              Settings
            </p>
            <NavEntry
              collapsed={collapsed}
              item={settingsItem}
              activeHref={activeHref}
              onMobileClose={onMobileClose}
            />
          </section>
        ) : null}

        <div
          className={cn(
            'mt-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2',
            collapsed ? 'flex-col justify-center' : 'bg-slate-50',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            <CircleUserRound size={18} aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-bold text-slate-800"
                title={userLabel}
              >
                {userLabel}
              </p>
              <p className="truncate text-[0.68rem] font-medium text-slate-500">
                {roleLabel}
              </p>
            </div>
          )}

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 focus:ring-offset-white',
                collapsed && 'mt-1',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight
                  size={18}
                  className="shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <ChevronLeft
                  size={18}
                  className="shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function NavGroupSection({
  collapsed,
  group,
  activeHref,
  onMobileClose,
}: {
  collapsed: boolean;
  group: NavGroup;
  activeHref: string | null;
  onMobileClose: () => void;
}) {
  return (
    <section className="mb-1 last:mb-0">
      {!collapsed ? (
        <p className="truncate px-2.5 pb-1.5 pt-3 text-left text-[0.68rem] font-extrabold uppercase tracking-[0.06em] text-slate-500 first:pt-0">
          {group.label}
        </p>
      ) : null}

      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavEntry
            key={item.href}
            collapsed={collapsed}
            item={item}
            activeHref={activeHref}
            onMobileClose={onMobileClose}
          />
        ))}
      </div>
    </section>
  );
}

function NavEntry({
  collapsed,
  item,
  activeHref,
  onMobileClose,
}: {
  collapsed: boolean;
  item: NavItem;
  activeHref: string | null;
  onMobileClose: () => void;
}) {
  const Icon = item.icon;
  const active = isActiveNavItem(item, activeHref);
  const content = (
    <>
      {active && (
        <span
          className="absolute -left-3 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--primary)]"
          aria-hidden="true"
        />
      )}
      <Icon
        size={18}
        className={cn(
          'shrink-0 transition-colors',
          active
            ? 'text-[var(--primary)]'
            : 'text-slate-500 group-hover:text-slate-800',
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-semibold transition-all duration-200',
          collapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100',
        )}
      >
        {item.label}
      </span>
      {!collapsed && item.badge ? (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[0.65rem] font-bold text-white">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  return (
    <Link
      href={item.href}
      onClick={onMobileClose}
      className={cn(
        'group relative flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-[0.8rem] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 focus:ring-offset-white',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-[var(--primary-soft)] text-[var(--primary-dark)]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
    >
      {content}
    </Link>
  );
}

export function canDisplayNavItem(
  item: NavItem,
  session: ReturnType<typeof useSession>['session'],
  hasModule: (module: string) => boolean,
) {
  if (
    item.permissions?.length &&
    !hasAnyPermission(session, item.permissions)
  ) {
    return false;
  }

  const moduleKeys =
    item.moduleKeys ??
    (() => {
      const requiredModule = getRequiredModuleForHref(item.href);
      return requiredModule ? [requiredModule] : [];
    })();

  return (
    moduleKeys.length === 0 || moduleKeys.some((module) => hasModule(module))
  );
}

/**
 * Resolves the single most specific navigation match for the current route.
 * Exact matches always beat prefix matches, and longer/more specific
 * candidates beat shorter ones, so exactly one item is ever highlighted even
 * when several items' routes overlap (e.g. a parent module route and one of
 * its more specific sub-routes).
 */
function computeActiveHref(
  items: NavItem[],
  pathname: string | null,
): string | null {
  if (!pathname) return null;

  let bestHref: string | null = null;
  let bestScore = -1;

  for (const item of items) {
    const candidates = item.activeWhen?.length ? item.activeWhen : [item.href];
    for (const candidate of candidates) {
      let score = -1;
      if (pathname === candidate) {
        score = candidate.length + 10_000;
      } else if (
        candidate !== '/dashboard' &&
        pathname.startsWith(`${candidate}/`)
      ) {
        score = candidate.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestHref = item.href;
      }
    }
  }

  return bestHref;
}

function isActiveNavItem(item: NavItem, activeHref: string | null) {
  return item.href === activeHref;
}

function formatBadgeCount(count: number): number | string | undefined {
  if (!count || count <= 0) return undefined;
  return count > 99 ? '99+' : count;
}

function formatRole(role: string) {
  return role
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
