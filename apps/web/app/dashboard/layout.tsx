'use client';

import type { PermissionKey } from '@schoolos/core';
import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '../../components/session-provider';
import { useEntitlements } from '../../components/entitlements-provider';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { UpgradePrompt } from '../../components/layout/upgrade-prompt';
import { PermissionDenied } from '../../components/ui/permission-denied';

type RouteGate = {
  prefix: string;
  label: string;
  permissions: PermissionKey[];
};

const dashboardRouteGates: RouteGate[] = [
  {
    prefix: '/dashboard/students',
    label: 'Students',
    permissions: ['students:read', 'students:create'],
  },
  {
    prefix: '/dashboard/admissions',
    label: 'Admissions',
    permissions: ['students:read', 'students:create'],
  },
  {
    prefix: '/dashboard/attendance',
    label: 'Attendance',
    permissions: ['attendance:read', 'attendance:mark'],
  },
  {
    prefix: '/dashboard/academics',
    label: 'Academics',
    permissions: ['academics:read', 'academics:manage'],
  },
  {
    prefix: '/dashboard/homework',
    label: 'Homework',
    permissions: ['homework:read'],
  },
  {
    prefix: '/dashboard/learning',
    label: 'Learning',
    permissions: [
      'learning:read',
      'learning:create',
      'learning:update',
      'learning:launch',
      'learning:progress',
    ],
  },
  {
    prefix: '/dashboard/timetable',
    label: 'Timetable',
    permissions: ['timetable:read'],
  },
  {
    prefix: '/dashboard/fees',
    label: 'Fees',
    permissions: [
      'fees:manage',
      'fees:bill',
      'payments:collect',
      'receipts:read',
    ],
  },
  {
    prefix: '/dashboard/finance',
    label: 'Finance',
    permissions: [
      'fees:manage',
      'fees:bill',
      'payments:collect',
      'receipts:read',
    ],
  },
  {
    prefix: '/dashboard/activity',
    label: 'Activity Feed',
    permissions: ['activity_feed:read', 'activity_feed:create'],
  },
  {
    prefix: '/dashboard/notices',
    label: 'Notices',
    permissions: ['notices:read', 'notices:create'],
  },
  {
    prefix: '/dashboard/messages',
    label: 'Messages',
    permissions: ['notices:read', 'messaging:create'],
  },
  {
    prefix: '/dashboard/messaging',
    label: 'Messaging',
    permissions: ['notices:read', 'messaging:create'],
  },
  {
    prefix: '/dashboard/hr',
    label: 'HR',
    permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
  },
  {
    prefix: '/dashboard/payroll',
    label: 'Payroll',
    permissions: ['payroll:read', 'payroll:manage'],
  },
  {
    prefix: '/dashboard/accounting',
    label: 'Accounting',
    permissions: [
      'accounting:read',
      'accounting:accounts:read',
      'accounting:reports:read',
    ],
  },
  {
    prefix: '/dashboard/library',
    label: 'Library',
    permissions: ['library:read', 'library:manage'],
  },
  {
    prefix: '/dashboard/transport',
    label: 'Transport',
    permissions: [
      'transport:read',
      'transport:manage',
      'transport:operate',
    ],
  },
  {
    prefix: '/dashboard/canteen',
    label: 'Canteen',
    permissions: [
      'canteen:menu:read',
      'canteen:plans:read',
      'canteen:enrollments:read',
    ],
  },
  {
    prefix: '/dashboard/reports',
    label: 'Reports',
    permissions: ['accounting:reports:read', 'library:reports:read'],
  },
  {
    prefix: '/dashboard/settings',
    label: 'Settings',
    permissions: [
      'settings:read',
      'roles:read',
      'classes:read',
      'academic_years:read',
    ],
  },
];

function getRequiredModuleForHref(href: string): string | null {
  if (href.startsWith('/dashboard/students')) return 'students';
  if (href.startsWith('/dashboard/admissions')) return 'students';
  if (href.startsWith('/dashboard/attendance')) return 'attendance';
  if (href.startsWith('/dashboard/academics')) return 'exams';
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

function getRouteGateForHref(href: string): RouteGate | null {
  return (
    dashboardRouteGates.find((gate) => href.startsWith(gate.prefix)) ?? null
  );
}

function hasAnyPermission(
  grantedPermissions: PermissionKey[],
  requiredPermissions: PermissionKey[],
) {
  if (requiredPermissions.length === 0) {
    return true;
  }

  const granted = new Set(grantedPermissions);
  return requiredPermissions.some((permission) => granted.has(permission));
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, status, refreshSession } = useSession();
  const [showSlowSessionHelp, setShowSlowSessionHelp] = useState(false);
  const { entitlements, hasModule, loading: entitlementsLoading } = useEntitlements();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(
        `/login?next=${encodeURIComponent(pathname || '/dashboard')}`
      );
    }
  }, [pathname, router, status]);

  useEffect(() => {
    if (status !== 'loading') {
      setShowSlowSessionHelp(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSlowSessionHelp(true);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-primary-100" />
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded-full bg-gray-200" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-gray-100" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
            <div className="h-3 w-5/6 animate-pulse rounded-full bg-gray-100" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-gray-50" />
          </div>
          <p className="mt-5 text-sm text-gray-500">
            Validating your SchoolOS session and loading permissions...
          </p>
          {showSlowSessionHelp && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">
                Session check is taking longer than usual
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Retry cookie validation, or return to sign in if this browser
                session has expired.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800"
                  onClick={() => void refreshSession()}
                >
                  Retry session
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                  onClick={() =>
                    router.replace(
                      `/login?next=${encodeURIComponent(pathname || '/dashboard')}`,
                    )
                  }
                >
                  Sign in again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-100 bg-white p-6 text-center shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            Redirecting to sign in
          </h2>
          <p className="text-sm text-gray-500">
            Protected pages require an active SchoolOS session.
          </p>
        </div>
      </div>
    );
  }

  // Enforce frontend entitlement gating on direct URL access
  const requiredModule = getRequiredModuleForHref(pathname || '');
  if (requiredModule && entitlementsLoading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Checking module access
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Loading your school&apos;s enabled modules before opening this workspace.
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }
  if (requiredModule && !entitlementsLoading && !hasModule(requiredModule)) {
    return (
      <DashboardShell>
        <UpgradePrompt
          moduleName={requiredModule}
          currentTier={entitlements?.tier}
        />
      </DashboardShell>
    );
  }

  const PLATFORM_ROLES = [
    'platform_super_admin',
    'platform_support',
    'platform_billing_admin',
  ];
  const isPlatformUser = session.user.roles.some((role) =>
    PLATFORM_ROLES.includes(role),
  );

  if (isPlatformUser && !session.user.isSupportOverride) {
    return (
      <DashboardShell>
        <PermissionDenied
          title="Access Restricted"
          description="Platform administrator accounts cannot access school operations directly. Please use the Support Override console to access a school workspace."
          resource="School Operations"
          action="support_override"
        />
      </DashboardShell>
    );
  }

  const routeGate = getRouteGateForHref(pathname || '');
  if (
    routeGate &&
    !hasAnyPermission(session.user.permissions, routeGate.permissions)
  ) {
    return (
      <DashboardShell>
        <PermissionDenied
          title={`${routeGate.label} Access Restricted`}
          description="Your current role cannot open this workspace. Ask a school administrator to add the required permission, or switch to an account with the correct access."
          resource={routeGate.label}
          action={routeGate.permissions.join(' or ')}
        />
      </DashboardShell>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
