'use client';

import { formatBsDate } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { schoolFacingErrorMessage } from '../../lib/school-facing-error';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FormField, Input, Select } from '../ui/form-field';
import { useSession } from '../session-provider';

/**
 * Phase 7.8: which statutory retirement scheme (SSF or PF) a staff member
 * belongs to, with the member number and effective dates.
 *
 * Rates never appear here: they come from an approved statutory policy version.
 * The server enforces one scheme at a time, protects the identifier under
 * hr:tax:*, and refuses changes underneath an approved payroll run. These
 * controls only hide what the viewer cannot use.
 */
const ERROR_COPY = {
  fallback: 'That change could not be saved. Try again.',
  invalid: 'Check the dates and the member number, then try again.',
  forbidden: 'You do not have permission to change statutory membership.',
  notFound: 'This record no longer exists. Refresh the page.',
  conflict:
    'This overlaps another membership for the same dates, or an approved payroll run already covers them. End the existing membership or choose different dates.',
};

const SCHEME_LABEL = { SSF: 'Social Security Fund', PF: 'Provident Fund' };

function maskIdentifier(value: string | null) {
  if (!value) return '—';
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

const day = (value: string | null) => (value ? formatBsDate(value) : 'Open');

export function StatutoryMembershipPanel({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canRead = hasPermissions(['hr:tax:read']);
  const canWrite = hasPermissions(['hr:tax:write']);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [scheme, setScheme] = useState<'SSF' | 'PF'>('SSF');
  const [identifier, setIdentifier] = useState('');
  const [from, setFrom] = useState('');
  const [endingId, setEndingId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState('');
  const [endReason, setEndReason] = useState('');

  const queryKey = ['staff-statutory-memberships', staffId];
  const memberships = useQuery({
    queryKey,
    queryFn: () => api.listStatutoryMemberships(staffId),
    enabled: canRead,
  });

  const mutation = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: () => {
      setError(null);
      setIdentifier('');
      setFrom('');
      setEndingId(null);
      setEndDate('');
      setEndReason('');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => setError(schoolFacingErrorMessage(e, ERROR_COPY)),
  });

  if (!canRead) return null;

  const submitNew = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(() =>
      api.createStatutoryMembership(staffId, {
        scheme,
        effectiveFrom: from,
        ...(identifier.trim() ? { memberIdentifier: identifier.trim() } : {}),
      }),
    );
  };

  const submitEnd = (event: FormEvent) => {
    event.preventDefault();
    if (!endingId) return;
    mutation.mutate(() =>
      api.endStatutoryMembership(endingId, {
        effectiveTo: endDate,
        reason: endReason.trim(),
      }),
    );
  };

  return (
    <section
      aria-labelledby="statutory-membership-heading"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h3
          id="statutory-membership-heading"
          className="flex items-center gap-2 text-base font-bold"
        >
          <ShieldCheck size={18} aria-hidden="true" />
          Statutory membership
        </h3>
        <p className="text-xs text-slate-500">
          SSF or PF membership and member number. Contribution and tax rates
          come from the approved statutory policy, not from this record.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {memberships.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : memberships.isError ? (
        <p className="text-sm text-slate-600">
          {schoolFacingErrorMessage(memberships.error, {
            fallback: 'Statutory membership could not be loaded.',
            forbidden: 'You do not have access to statutory membership.',
          })}
        </p>
      ) : memberships.data && memberships.data.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {memberships.data.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {SCHEME_LABEL[row.scheme]}{' '}
                  <Badge variant={row.effectiveTo ? 'neutral' : 'success'}>
                    {row.effectiveTo ? 'Ended' : 'Current'}
                  </Badge>
                </p>
                <p className="text-xs text-slate-500">
                  {day(row.effectiveFrom)} to {day(row.effectiveTo)}
                  {row.endReason ? ` · ${row.endReason}` : ''}
                </p>
                <p className="text-xs text-slate-600">
                  Member number:{' '}
                  <span className="tabular-nums">
                    {revealed[row.id]
                      ? (row.memberIdentifier ?? '—')
                      : maskIdentifier(row.memberIdentifier)}
                  </span>
                  {row.memberIdentifier && (
                    <button
                      type="button"
                      className="ml-2 text-xs font-semibold underline"
                      onClick={() =>
                        setRevealed((current) => ({
                          ...current,
                          [row.id]: !current[row.id],
                        }))
                      }
                    >
                      {revealed[row.id] ? 'Hide' : 'Show'}
                    </button>
                  )}
                </p>
              </div>
              {canWrite && !row.effectiveTo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEndingId(row.id)}
                >
                  End membership
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          No statutory membership is recorded. Staff whose salary structure
          enables PF will block payroll until one is added.
        </p>
      )}

      {canWrite && endingId && (
        <form
          onSubmit={submitEnd}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"
        >
          <FormField label="First date it no longer applies">
            <Input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
          <FormField label="Reason">
            <Input
              required
              maxLength={500}
              value={endReason}
              onChange={(e) => setEndReason(e.target.value)}
            />
          </FormField>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              Confirm end
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEndingId(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {canWrite && (
        <form
          onSubmit={submitNew}
          className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-4"
        >
          <FormField label="Scheme">
            <Select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as 'SSF' | 'PF')}
            >
              <option value="SSF">Social Security Fund (SSF)</option>
              <option value="PF">Provident Fund (PF)</option>
            </Select>
          </FormField>
          <FormField label="Member number">
            <Input
              maxLength={64}
              autoComplete="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </FormField>
          <FormField label="Effective from">
            <Input
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" disabled={mutation.isPending}>
              Add membership
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
