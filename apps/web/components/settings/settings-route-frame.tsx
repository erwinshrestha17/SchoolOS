'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LockKeyhole, Menu, RotateCcw } from 'lucide-react';
import type { SchoolSettingsAccess } from '@schoolos/core';
import { cn } from '../../lib/utils';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { useEntitlements } from '../entitlements-provider';
import { useSession } from '../session-provider';
import { Drawer } from '../ui/drawer';
import { SearchInput } from '../ui/search-input';
import { SettingsControlCenter } from './settings-control-center';
import {
  SETTINGS_NAVIGATION,
  SETTINGS_NAVIGATION_GROUPS,
  settingsDefinitionMatchesPath,
  settingsDefinitionMatchesQuery,
  type SettingsNavigationDefinition,
  type SettingsNavigationGroupId,
} from './settings-navigation.config';

export type ResolvedSettingsNavigationItem = SettingsNavigationDefinition & {
  access?: SchoolSettingsAccess;
};

const MIGRATED_LEGACY_SECTIONS: Record<string, string> = {
  overview: '/dashboard/settings',
  subscription: '/dashboard/settings/school/modules',
  profile: '/dashboard/settings/school/identity',
  branding: '/dashboard/settings/school/branding',
  'school-setup': '/dashboard/settings/school/academic-structure',
  setup: '/dashboard/settings/school/academic-structure',
  'users-access': '/dashboard/settings/access/users',
  users: '/dashboard/settings/access/users',
  'roles-permissions': '/dashboard/settings/access/roles',
  roles: '/dashboard/settings/access/roles',
  academic: '/dashboard/settings/school/academic-year',
  attendance: '/dashboard/settings/policies/attendance',
  communication: '/dashboard/settings/communication',
  notifications: '/dashboard/settings/communication',
  security: '/dashboard/settings/security',
  data: '/dashboard/settings/system/audit-log',
  audit: '/dashboard/settings/system/audit-log',
  fees: '/dashboard/settings/fees',
  fee: '/dashboard/settings/fees',
  payroll: '/dashboard/settings/hr-payroll',
  hr: '/dashboard/settings/hr-payroll',
  accounting: '/dashboard/settings/accounting',
  'fee-setup': '/dashboard/fees',
  'fee-plans': '/dashboard/fees',
};

function canRequestSchoolSettings(permissions: readonly string[]) {
  return permissions.some(
    (permission) =>
      permission.startsWith('settings:') ||
      permission.startsWith('admission_policy:') ||
      permission.startsWith('roles:') ||
      permission.startsWith('users:') ||
      permission.startsWith('attendance:') ||
      permission === 'classes:read' ||
      permission === 'academic_years:read',
  );
}

function groupItems(items: ResolvedSettingsNavigationItem[]) {
  return SETTINGS_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.groupId === group.id),
  })).filter((group) => group.items.length > 0);
}

export function SettingsRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const { hasModule } = useEntitlements();
  const [query, setQuery] = useState('');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const permissions = useMemo(
    () => session?.user.permissions ?? [],
    [session?.user.permissions],
  );
  const mayLoadSchoolSettings = canRequestSchoolSettings(permissions);

  const navigationQuery = useQuery({
    queryKey: ['school-settings', 'navigation'],
    queryFn: schoolSettingsApi.getSchoolSettingsNavigation,
    enabled: mayLoadSchoolSettings,
  });

  const backendItemsById = useMemo(() => {
    const items =
      navigationQuery.data?.groups.flatMap((group) => group.items) ?? [];
    return new Map(items.map((item) => [item.id, item]));
  }, [navigationQuery.data]);

  const visibleItems = useMemo(() => {
    const grantedPermissions = new Set<string>(permissions);
    return SETTINGS_NAVIGATION.flatMap((definition) => {
      if (definition.requiredModule && !hasModule(definition.requiredModule)) {
        return [];
      }
      if (definition.backendItemId) {
        const backendItem = backendItemsById.get(definition.backendItemId);
        return backendItem
          ? [{ ...definition, access: backendItem.access }]
          : [];
      }
      if (
        definition.requiredPermission &&
        !grantedPermissions.has(definition.requiredPermission)
      ) {
        return [];
      }
      return [definition];
    });
  }, [backendItemsById, hasModule, permissions]);

  const filteredItems = useMemo(
    () =>
      visibleItems.filter((item) =>
        settingsDefinitionMatchesQuery(item, query),
      ),
    [query, visibleItems],
  );
  const groups = useMemo(() => groupItems(filteredItems), [filteredItems]);
  const activeItem = visibleItems.find((item) =>
    settingsDefinitionMatchesPath(item, pathname),
  );

  const legacySection = (
    searchParams.get('section') ??
    searchParams.get('tab') ??
    ''
  ).toLowerCase();
  const migratedDestination = useMemo(() => {
    if (pathname !== '/dashboard/settings' || !legacySection) return null;
    const destination =
      MIGRATED_LEGACY_SECTIONS[legacySection] ?? '/dashboard/settings';
    const remaining = new URLSearchParams(searchParams.toString());
    remaining.delete('section');
    remaining.delete('tab');
    const suffix = remaining.toString();
    return suffix ? `${destination}?${suffix}` : destination;
  }, [legacySection, pathname, searchParams]);

  useEffect(() => {
    if (migratedDestination) router.replace(migratedDestination);
  }, [migratedDestination, router]);

  useEffect(() => {
    setNavigationOpen(false);
  }, [pathname]);

  if (migratedDestination) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <RotateCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Opening Settings…
        </div>
      </div>
    );
  }

  const content =
    pathname === '/dashboard/settings' ? (
      <SettingsControlCenter
        items={filteredItems}
        canLoadSchoolOverview={backendItemsById.has('overview')}
        searchQuery={query}
      />
    ) : (
      children
    );

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-slate-50 sm:-mx-6 lg:-mx-7 xl:-mx-8">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-7">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Settings
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Manage your personal preferences and school configuration.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 lg:max-w-md">
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Search settings"
              placeholder="Search settings"
              className="min-w-0 flex-1"
            />
            <button
              ref={browseButtonRef}
              type="button"
              onClick={() => setNavigationOpen(true)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 xl:hidden"
              aria-label="Browse settings"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Browse</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1560px] xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside
          className="sticky top-0 hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-slate-200 bg-white xl:block"
          aria-label="Settings sections"
        >
          <SettingsNavigation
            groups={groups}
            activeItemId={activeItem?.id}
            query={query}
            loading={navigationQuery.isLoading}
            schoolNavigationError={
              mayLoadSchoolSettings && navigationQuery.isError
            }
            onRetry={() => void navigationQuery.refetch()}
          />
        </aside>

        <section className="min-w-0" aria-label="Settings content">
          {pathname !== '/dashboard/settings' ? (
            <div className="border-b border-slate-200 bg-white px-4 py-2.5 xl:hidden">
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
            </div>
          ) : null}
          {content}
        </section>
      </div>

      <Drawer
        isOpen={navigationOpen}
        onClose={() => setNavigationOpen(false)}
        title="Settings"
        description="Choose a personal or school setting."
        width="sm"
        returnFocusRef={browseButtonRef}
      >
        <SettingsNavigation
          groups={groups}
          activeItemId={activeItem?.id}
          query={query}
          loading={navigationQuery.isLoading}
          schoolNavigationError={
            mayLoadSchoolSettings && navigationQuery.isError
          }
          onRetry={() => void navigationQuery.refetch()}
        />
      </Drawer>
    </div>
  );
}

function SettingsNavigation({
  groups,
  activeItemId,
  query,
  loading,
  schoolNavigationError,
  onRetry,
}: {
  groups: Array<{
    id: SettingsNavigationGroupId;
    label: string;
    items: ResolvedSettingsNavigationItem[];
  }>;
  activeItemId?: string;
  query: string;
  loading: boolean;
  schoolNavigationError: boolean;
  onRetry: () => void;
}) {
  return (
    <nav className="space-y-5 p-3" aria-label="Settings navigation">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`settings-group-${group.id}`}>
          <h2
            id={`settings-group-${group.id}`}
            className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400"
          >
            {group.label}
          </h2>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const selected = activeItemId === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200',
                    selected
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.status === 'platform-managed' ? (
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-400"
                      aria-label="Platform managed"
                      title="Platform managed"
                    >
                      <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {loading ? (
        <div className="space-y-2 px-1" aria-label="Loading school settings">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      ) : null}

      {!loading && groups.length === 0 ? (
        <p className="px-3 py-6 text-sm leading-6 text-slate-500">
          {query.trim()
            ? `No settings match “${query}”.`
            : 'No settings are available for this account.'}
        </p>
      ) : null}

      {schoolNavigationError ? (
        <div className="mx-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">School settings unavailable</p>
          <p className="mt-1 leading-5">
            Personal settings remain available. Retry to load school
            configuration.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Retry
          </button>
        </div>
      ) : null}
    </nav>
  );
}
