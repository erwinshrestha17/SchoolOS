'use client';

import { getNepalSchoolDay } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useSession } from '../session-provider';
import { api } from '../../lib/api';
import { useHasPermission } from '../../lib/permissions-ui';
import { Surface } from '../schoolos';

const PREVIEW_LIMIT = 5;

/** Whole Nepal school days between a record's creation and today. */
export function waitingDays(createdAt: string, now: Date = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const from = getNepalSchoolDay(created).gregorianDate;
  const to = getNepalSchoolDay(now).gregorianDate;
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ),
  );
}

function ageLabel(days: number | null) {
  if (days === null) return null;
  if (days === 0) return 'Raised today';
  return days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`;
}

/**
 * Principal Home (Phase 4D): the approvals that are actually the Principal's
 * to decide — the server queue already excludes the Principal's own requests
 * (SoD), other people's steps and delegations — with how long each has waited
 * and whether its deadline has passed.
 */
export function PrincipalDecisionsPanel() {
  const { session } = useSession();
  const canRead = useHasPermission('advanced:approvals:read');
  const queueQuery = useQuery({
    queryKey: [
      'principal-decisions-preview',
      session?.tenant.id,
      session?.user.id,
    ],
    queryFn: () => api.listPrincipalApprovalQueue({ limit: PREVIEW_LIMIT }),
    enabled: canRead,
    staleTime: 20_000,
    retry: false,
  });

  if (!canRead) return null;

  const items = queueQuery.data?.items ?? [];
  const now = new Date();

  return (
    <Surface
      title="Waiting for your decision"
      description="The latest approvals whose current step is yours, with how long each has waited."
      actions={
        <Link
          href="/dashboard/approvals"
          className="text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)]"
        >
          Open approval centre
        </Link>
      }
    >
      {queueQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading approvals…</p>
      ) : queueQuery.isError ? (
        <p className="text-sm text-slate-600">
          Approvals are temporarily unavailable.
        </p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-success-600"
            aria-hidden="true"
          />
          Nothing is waiting for your decision.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {[...items]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((item) => {
              const days = waitingDays(item.createdAt, now);
              const overdue =
                item.deadlineAt !== null &&
                new Date(item.deadlineAt).getTime() < now.getTime();
              return (
                <li key={item.id}>
                  <Link
                    href="/dashboard/approvals"
                    className="group -mx-2 flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
                  >
                    <Clock
                      className={`mt-0.5 h-4 w-4 shrink-0 ${overdue ? 'text-danger-600' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {item.title}
                      </span>
                      <span
                        className={`block text-xs ${overdue ? 'font-bold text-danger-700' : 'text-slate-600'}`}
                      >
                        {overdue ? 'Past deadline · ' : ''}
                        {ageLabel(days)}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-[var(--primary)]"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
      {queueQuery.data?.nextCursor ? (
        <p className="mt-2 text-xs font-medium text-slate-500">
          More approvals are waiting in the approval centre.
        </p>
      ) : null}
    </Surface>
  );
}
