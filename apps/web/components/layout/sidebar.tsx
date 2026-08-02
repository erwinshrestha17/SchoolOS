'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  School,
  Search,
  X,
} from 'lucide-react';

import { api } from '../../lib/api';
import { useEntitlements } from '../entitlements-provider';
import { useSession } from '../session-provider';
import { getRequiredModuleForHref } from '../../lib/nav-module-map';
import { hasAnyPermission } from '../../lib/session';
import { TeacherCapability, useTeacherAccess } from '../../lib/teacher-access';
import { useSettingsCapabilities } from '../../lib/permissions-ui';
import { useSchoolWebPersona } from '../../lib/school-web-persona';
import { cn } from '../../lib/utils';
import {
  SidebarNavHeading,
  SidebarNavLink,
} from './sidebar-nav-link';
import {
  navGroupsForPersona,
  settingsNavItem,
  shouldShowSettingsHub,
  type NavGroup,
  type NavItem,
} from './sidebar-persona-nav.config';

export type { NavItem, NavGroup } from './sidebar-persona-nav.config';
export {
  adminNavGroups,
  accountantNavGroups,
  buildTeacherNavGroups,
  cashierNavGroups,
  canteenOperatorNavGroups,
  dashboardNavGroups,
  hrNavGroups,
  librarianNavGroups,
  navGroupsForPersona,
  principalNavGroups,
  settingsNavItem,
  shouldShowSettingsHub,
  teacherNavGroups,
  transportOperatorNavGroups,
} from './sidebar-persona-nav.config';

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

  // Class/Subject Teachers get the assignment-scoped nav tree; Principal, HR,
  // Accountant, and operational personas get purpose-limited trees. Admin and
  // school_config_owner keep the full ops tree. Permission + entitlement
  // filters still apply to every item.
  const { isTeacherPersona, capabilities, isRestricted } = useTeacherAccess();
  const schoolWebPersona = useSchoolWebPersona();
  const settingsCaps = useSettingsCapabilities();
  const personalOnly = isRestricted(TeacherCapability.SCHOOL_SETTINGS_ADMIN);

  const groupsToRender = navGroupsForPersona(schoolWebPersona, capabilities)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canDisplayNavItem(item, session, hasModule))
        .map((item) =>
          item.href === '/dashboard/notices' ||
          item.href === '/dashboard/notices/approvals'
            ? {
                ...item,
                badge:
                  item.href === '/dashboard/notices'
                    ? unreadNoticesBadge
                    : item.badge,
              }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);

  // Teachers reach Profile/Preferences/Security from "My Account"; principals
  // use the header profile menu. The institutional Settings hub is for admin,
  // HR, and other configuration personas only.
  const showSettingsHub = shouldShowSettingsHub(
    settingsCaps,
    isTeacherPersona,
    personalOnly,
    schoolWebPersona,
  );
  const visibleSettings =
    showSettingsHub && canDisplayNavItem(settingsNavItem, session, hasModule)
      ? settingsNavItem
      : null;

  const activeHref = useMemo(() => {
    const allItems = groupsToRender.flatMap((group) => group.items);
    if (visibleSettings) allItems.push(visibleSettings);
    return computeActiveHref(allItems, pathname);
  }, [groupsToRender, visibleSettings, pathname]);

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
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        aria-label="School operations navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition focus:outline-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent
          collapsed={false}
          groups={groupsToRender}
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
          groups={groupsToRender}
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
        'sidebar-transition flex h-full flex-col border-r border-[var(--line)] bg-[var(--sidebar-bg)] text-[var(--sidebar-label)]',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      )}
    >
      <header className="border-b border-[var(--line)] px-3 py-3">
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
            <span className="block truncate text-[0.7rem] font-medium text-[var(--sidebar-icon)]">
              School operating desk
            </span>
          </div>
        </div>

        {!collapsed && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--sidebar-hover)] px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--line)]">
              <School size={14} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--ink)]">
                {schoolName}
              </p>
              <p className="mt-0.5 text-[0.68rem] font-medium text-[var(--sidebar-icon)]">
                School workspace
              </p>
            </div>
          </div>
        )}
      </header>

      {!collapsed && (
        <div className="border-b border-[var(--line)] px-3 py-2.5">
          <label className="sr-only" htmlFor="sidebar-nav-search">
            Find a workspace
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sidebar-heading)]"
              aria-hidden="true"
            />
            <input
              id="sidebar-nav-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a workspace..."
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--sidebar-hover)] pl-8 pr-7 text-[0.8rem] font-medium text-[var(--sidebar-label)] outline-none transition-colors placeholder:text-[var(--sidebar-heading)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--sidebar-heading)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-label)]"
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
          <p className="px-2.5 py-6 text-center text-xs font-semibold text-[var(--sidebar-heading)]">
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

      <footer className="border-t border-[var(--line)] px-3 py-3">
        {settingsItem ? (
          <section className="mb-2">
            <SidebarNavHeading collapsed={collapsed}>Settings</SidebarNavHeading>
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
            collapsed ? 'flex-col justify-center' : 'bg-[var(--sidebar-hover)]',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--line)] text-[var(--sidebar-icon)]">
            <CircleUserRound size={18} aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-bold text-[var(--ink)]"
                title={userLabel}
              >
                {userLabel}
              </p>
              <p className="truncate text-[0.68rem] font-medium text-[var(--sidebar-icon)]">
                {roleLabel}
              </p>
            </div>
          )}

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-icon)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 focus:ring-offset-[var(--sidebar-bg)]',
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
      <SidebarNavHeading collapsed={collapsed}>{group.label}</SidebarNavHeading>

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
  return (
    <SidebarNavLink
      href={item.href}
      label={item.label}
      icon={item.icon}
      active={isActiveNavItem(item, activeHref)}
      collapsed={collapsed}
      badge={item.badge}
      onNavigate={onMobileClose}
    />
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
