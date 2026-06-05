'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/platform/settings?tab=audit');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-mod-platform-text)]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-mod-platform-border)] border-t-transparent" />
    </div>
  );
}
