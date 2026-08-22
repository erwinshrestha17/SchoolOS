'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';

export default function SchoolOnboardingPage() {
  const checklistQuery = useQuery({
    queryKey: ['school-settings', 'onboarding'],
    queryFn: api.getSchoolOnboardingChecklist,
  });

  if (checklistQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="School setup checklist unavailable"
          message="The school setup checklist could not load. Please try again."
          onRetry={() => void checklistQuery.refetch()}
        />
      </div>
    );
  }

  if (checklistQuery.isLoading || !checklistQuery.data) {
    return (
      <div className="space-y-5 p-6" aria-label="Loading school setup checklist">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const checklist = checklistQuery.data;
  return (
    <div className="space-y-6 p-6">
      <header className="border-b border-slate-200 pb-5">
        <Badge
          variant={checklist.progressPercent === 100 ? 'success' : 'neutral'}
          className="mb-3"
        >
          {checklist.progressPercent}% ready
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Day-1 Onboarding Checklist
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Finish the school setup items that make daily operations reliable for
          real staff, students, and families on the Wave 1 core module boundary.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-700">
            {checklist.completed} of {checklist.total} complete
          </p>
          <div className="h-2 w-48 max-w-[45%] rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${checklist.progressPercent}%` }}
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {checklist.items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="flex items-center gap-3">
                {item.completed ? (
                  <CheckCircle2
                    className="text-emerald-600"
                    size={20}
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="text-slate-300"
                    size={20}
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {item.source === 'manual'
                      ? 'Manually reviewed by authorized school support'
                      : 'Computed from this school’s setup data'}
                  </p>
                </div>
              </div>
              <Link
                href={item.href}
                className="flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Open
                <ExternalLink size={14} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
