'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlansRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/platform/settings?tab=plans');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-pulse rounded-full border-4 border-cyan-400" />
    </div>
  );
}
