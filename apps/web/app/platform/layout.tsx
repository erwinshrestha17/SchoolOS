'use client';

import { useSession } from '../../components/session-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardShell } from '../../components/layout/dashboard-shell';

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
      const isPlatformAdmin = roles.includes('platform_super_admin') || 
                             roles.includes('platform_support') || 
                             roles.includes('platform_billing_admin');
      
      if (!isPlatformAdmin) {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
