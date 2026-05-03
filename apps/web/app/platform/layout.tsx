'use client';

import { useSession } from '../../components/session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PlatformShell } from '../../components/layout/platform-shell';

const PLATFORM_ROLES = [
  'platform_super_admin',
  'platform_support',
  'platform_billing_admin',
];

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session) {
      const isPlatformAdmin = session.user.roles.some((role) =>
        PLATFORM_ROLES.includes(role),
      );

      if (!isPlatformAdmin) {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  const isPlatformAdmin = session.user.roles.some((role) =>
    PLATFORM_ROLES.includes(role),
  );

  if (!isPlatformAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-center text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Platform area
          </p>
          <h1 className="mt-3 text-2xl font-bold">
            Redirecting to school workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Use the school dashboard for tenant-scoped operations.
          </p>
        </div>
      </div>
    );
  }

  return <PlatformShell>{children}</PlatformShell>;
}
