'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../components/session-provider';
import { DashboardShell } from '../../components/layout/dashboard-shell';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, status } = useSession();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(
        `/login?next=${encodeURIComponent(pathname || '/dashboard')}`
      );
    }
  }, [pathname, router, status]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary-100 mb-4">
            <Loader2 size={24} className="text-primary-600 animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Restoring your workspace
          </h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Validating your SchoolOS session and loading permissions...
          </p>
        </div>
      </div>
    );
  }

  // Redirect state (no session)
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-amber-100 mb-4">
            <Loader2 size={24} className="text-amber-600 animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Redirecting to sign in
          </h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Protected pages require an active SchoolOS session.
          </p>
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
