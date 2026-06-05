'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SystemHealthRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/platform/settings?tab=health');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-mod-platform-text)]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-mod-platform-border)] border-t-transparent" />
    </div>
  );
}
