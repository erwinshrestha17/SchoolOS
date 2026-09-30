'use client';

import { Surface } from '@/components/schoolos';
import { Mail, Phone, Star } from 'lucide-react';
import type { GuardianContactProfile } from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Read-only guardian contacts for actors granted only the `guardianContacts`
 * section (e.g. an assigned teacher). The server already limited the list to
 * active, verified relationships and removed capabilities, consent,
 * verification and restriction data; this view never asks for more.
 */
export function GuardianContactsTab({
  guardians,
}: {
  guardians: readonly GuardianContactProfile[];
}) {
  return (
    <Surface
      title="Guardian contacts"
      description="Active, verified guardians for this student. Relationship administration is managed by authorized school staff."
    >
      {guardians.length === 0 ? (
        <EmptyState
          title="No verified guardian contacts"
          description="There is no active, verified guardian contact you can view for this student."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {guardians.map((guardian) => (
            <li
              key={guardian.id}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {guardian.fullName}
                  </p>
                  <p className="text-xs font-medium capitalize text-slate-500">
                    {guardian.relation}
                  </p>
                </div>
                {guardian.isPrimary ? (
                  <Badge variant="info">
                    <Star size={12} aria-hidden="true" /> Primary
                  </Badge>
                ) : null}
              </div>
              <dl className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <dt>
                    <Phone size={14} aria-hidden="true" />
                    <span className="sr-only">Phone</span>
                  </dt>
                  <dd>
                    <a
                      className="font-semibold text-slate-900 underline-offset-2 hover:underline focus-visible:underline"
                      href={`tel:${guardian.primaryPhone}`}
                    >
                      {guardian.primaryPhone}
                    </a>
                    {guardian.secondaryPhone ? (
                      <span className="text-slate-500">
                        {' '}
                        · {guardian.secondaryPhone}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt>
                    <Mail size={14} aria-hidden="true" />
                    <span className="sr-only">Email</span>
                  </dt>
                  <dd className="truncate">
                    {guardian.email || 'Email not recorded'}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
