'use client';

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { OperationalSummaryRouteModule } from '@schoolos/core';
import { CommandPalette } from './command-palette';
import { GlobalAside } from './global-aside';
import { TopBar } from './top-bar';
import { useSession } from '../session-provider';
import { LoadingState } from '../ui/loading-state';
import { ErrorBoundary } from '../ui/error-boundary';
import { ModuleOperationalSummary } from '../ui/module-operational-summary';
import { TeacherCapability, useTeacherAccess } from '../../lib/teacher-access';
import { SupportOverrideBanner } from '../platform/SupportOverrideBanner';
import { SchoolBreadcrumbs } from '../schoolos/navigation/school-breadcrumbs';
import { NetworkStatusBanner } from '../ui/network-status-banner';
import { moduleSlugForPath } from '../../lib/module-theme';

// Students, attendance, fees, academics, homework, timetable, notices, and
// messages already
// render their own module-specific, backend-owned KPI grid inside the page
// header. Injecting the generic
// cross-module summary above them duplicated the same signals (sometimes
// with different numbers for the same concept) before the module header
// even appeared. Keep the generic summary only for landing pages that do
// not yet have their own KPI grid.
// Activity now renders its own full operational summary panel directly in
// its overview page (see app/dashboard/activity/page.tsx), matching the
// students/attendance/fees pattern described above — do not also list it
// here or the summary will render twice.
const MODULE_LANDING_SUMMARIES: Record<string, OperationalSummaryRouteModule> =
  {
    '/dashboard/hr': 'hr-payroll',
    '/dashboard/payroll': 'hr-payroll',
    '/dashboard/library': 'library',
    '/dashboard/transport': 'transport',
    '/dashboard/canteen': 'canteen',
    '/dashboard/accounting': 'accounting',
    '/dashboard/learning': 'learning',
  };

/**
 * The administrative capability each module-landing summary is really backed
 * by. A teacher without it cannot read the summary, so it must not be
 * rendered for them at all.
 */
const MODULE_SUMMARY_CAPABILITY: Partial<
  Record<OperationalSummaryRouteModule, TeacherCapability>
> = {
  library: TeacherCapability.LIBRARY_ADMIN,
  'hr-payroll': TeacherCapability.STAFF_ADMIN,
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const { session, status } = useSession();
  const pathname = usePathname();
  // The generic cross-module operational summary is an administrator
  // artifact: it is backed by module *report* permissions a teacher does not
  // hold, so on a teacher's own module landing it rendered nothing but "You
  // do not have permission to view this operational summary" -- stacked above
  // the purpose-built workspace that page already provides. Suppressed for
  // teachers who lack the module's admin capability; they get their own
  // workspace KPIs instead. Administrators are unaffected.
  const { isRestricted } = useTeacherAccess();
  const candidateSummary = MODULE_LANDING_SUMMARIES[pathname];
  const gatingCapability = candidateSummary
    ? MODULE_SUMMARY_CAPABILITY[candidateSummary]
    : undefined;
  const summaryModule =
    gatingCapability && isRestricted(gatingCapability)
      ? undefined
      : candidateSummary;

  function closeMobileNavigation() {
    setMobileOpen(false);
    // Return focus to the trigger that opened the drawer instead of losing
    // it to the (now removed) overlay, matching standard dialog behavior.
    mobileMenuButtonRef.current?.focus();
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--background)]">
        <LoadingState variant="page" label="Syncing workspace..." />
      </div>
    );
  }

  if (!session) {
    return null; // DashboardLayout handles redirect
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to workspace
      </a>
      <GlobalAside
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobileNavigation}
      />
      <CommandPalette />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SupportOverrideBanner />
        <TopBar
          onMobileMenuToggle={() => setMobileOpen(!mobileOpen)}
          mobileMenuButtonRef={mobileMenuButtonRef}
        />
        <NetworkStatusBanner />

        <main
          id="dashboard-main"
          data-module={moduleSlugForPath(pathname)}
          className="flex-1 overflow-y-auto scroll-smooth bg-[var(--background)] focus:outline-none"
          tabIndex={-1}
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-7 xl:px-8">
            <div className="animate-fade-in transition-all duration-300">
              <ErrorBoundary>
                {!pathname.startsWith('/dashboard/settings') ? (
                  <SchoolBreadcrumbs className="mb-4" />
                ) : null}
                {summaryModule ? (
                  <ModuleOperationalSummary module={summaryModule} />
                ) : null}
                {children}
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
