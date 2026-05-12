'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { api } from '../../../../lib/api';
import type { PlatformOnboardingChecklist } from '@schoolos/core';
import { Badge } from '@/components/ui/badge';

export default function SchoolOnboardingPage() {
  const [checklist, setChecklist] = useState<PlatformOnboardingChecklist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSchoolOnboardingChecklist()
      .then(setChecklist)
      .catch((err) => setError(err.message ?? 'Failed to load onboarding checklist'));
  }, []);

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  }

  if (!checklist) {
    return <div className="h-40 animate-pulse rounded-lg bg-slate-100" />;
  }

  return (
    <div className="space-y-6 p-6">
      <header className="border-b border-slate-200 pb-5">
        <Badge variant={checklist.progressPercent === 100 ? 'success' : 'neutral'} className="mb-3">
          {checklist.progressPercent}% ready
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Pilot Onboarding Checklist</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Finish the school setup items that make daily operations reliable for real staff, students, and families.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">{checklist.completed} of {checklist.total} complete</p>
          <div className="h-2 w-48 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${checklist.progressPercent}%` }} />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {checklist.items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                {item.completed ? <CheckCircle2 className="text-emerald-600" size={20} /> : <Circle className="text-slate-300" size={20} />}
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.source === 'manual' ? 'Manually reviewed by platform support' : 'Computed from school setup data'}</p>
                </div>
              </div>
              <Link href={item.href} className="flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900">
                Open
                <ExternalLink size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
