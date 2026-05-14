'use client';

import { useSession } from '../../components/session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PlatformShell } from '../../components/layout/platform-shell';
import { PermissionDenied } from '../../components/platform/PermissionDenied';

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
    return <PermissionDenied 
      title="Platform Restricted"
      description="You have attempted to access the platform administration area. This section is restricted to global operators and billing administrators only."
    />;
  }

  return <PlatformShell>{children}</PlatformShell>;
}
