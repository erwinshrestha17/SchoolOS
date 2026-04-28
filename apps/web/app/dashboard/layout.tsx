'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../components/session-provider';
import { DashboardShell } from '../../components/layout/dashboard-shell';

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

  return <DashboardShell>{children}</DashboardShell>;
}
