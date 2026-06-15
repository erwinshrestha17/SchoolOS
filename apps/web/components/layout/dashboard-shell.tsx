'use client';

import { ReactNode, useState } from 'react';
import { GlobalAside } from './global-aside';
import { TopBar } from './top-bar';
import { Breadcrumbs } from './breadcrumbs';
import { useSession } from '../session-provider';
import { cn } from '../../lib/utils';
import { LoadingState } from '../ui/loading-state';
import { ErrorBoundary } from '../ui/error-boundary';
import { SupportOverrideBanner } from '../platform/SupportOverrideBanner';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, status } = useSession();

  function closeMobileNavigation() {
    setMobileOpen(false);
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SupportOverrideBanner />
        <TopBar onMobileMenuToggle={() => setMobileOpen(!mobileOpen)} />

        <main
          id="dashboard-main"
          className="flex-1 overflow-y-auto scroll-smooth bg-[var(--background)] focus:outline-none"
          tabIndex={-1}
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
            <div className="mb-5">
              <Breadcrumbs />
            </div>
            <div className="animate-fade-in transition-all duration-300">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
