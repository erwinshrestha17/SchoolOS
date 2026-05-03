'use client';

import { useSession } from '../../components/session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PlatformShell } from '../../components/layout/platform-shell';

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
      const roles = session.user.roles;
      const permissions = session.user.permissions;
      const isPlatformAdmin =
        roles.includes('platform_super_admin') ||
        roles.includes('platform_support') ||
        roles.includes('platform_billing_admin') ||
        permissions.includes('platform:read') ||
        permissions.includes('platform:manage');

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

  return <PlatformShell>{children}</PlatformShell>;
}
