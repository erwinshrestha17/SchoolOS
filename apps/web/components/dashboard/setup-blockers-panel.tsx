'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from '../session-provider';
import { api } from '../../lib/api';
import { useHasPermission } from '../../lib/permissions-ui';
import { Surface } from '../schoolos';

/**
 * Admin Home "setup blockers" (Phase 4B): the backend-confirmed school setup
 * items that still need attention (profile, branding, academic year). Shown
 * only to people who may read school settings; the endpoint re-authorizes.
 */
export function SetupBlockersPanel() {
  const { session } = useSession();
  const canReadSettings = useHasPermission('settings:read');
  const overviewQuery = useQuery({
    queryKey: ['school-setup-blockers', session?.tenant.id, session?.user.id],
    queryFn: api.getSchoolSettingsOverview,
    enabled: canReadSettings,
    staleTime: 60_000,
    retry: false,
  });

  if (!canReadSettings) return null;

  const attention = overviewQuery.data?.attention ?? [];

  return (
    <Surface
      title="Setup blockers"
      description="School configuration that must be completed before daily operations are reliable."
    >
      {overviewQuery.isLoading ? (
        <p className="text-sm text-slate-500">Checking school setup…</p>
      ) : overviewQuery.isError ? (
        <p className="text-sm text-slate-600">
          Setup status is temporarily unavailable.
        </p>
      ) : attention.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-success-600"
            aria-hidden="true"
          />
          Core school setup is complete.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attention.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group -mx-2 flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
              >
                <Settings2
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning-700"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">
                    {item.label}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {item.description}
                  </span>
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-[var(--primary)]"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
