'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BankReconciliationSessionView,
  PrepareBankReconciliation,
} from '@schoolos/core';
import { api } from '@/lib/api';
import { resourceAccess } from '@/lib/resource-authorization';
import { useSession } from '../session-provider';
import { SectionCard } from '../ui/section-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { formatDateTime } from '@/lib/utils';

type Action =
  | 'submit'
  | 'review'
  | 'return'
  | 'finalize'
  | 'cancel'
  | 'amend'
  | 'unmatch';
const labels: Record<Action, string> = {
  submit: 'Submit for review',
  review: 'Complete independent review',
  return: 'Return for correction',
  finalize: 'Finalize reconciliation',
  cancel: 'Cancel preparation',
  amend: 'Correct bank balances',
  unmatch: 'Remove match',
};
const currency = (value: string) =>
  new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR' }).format(
    Number(value),
  );

export function ReconciliationSessionsPanel({
  accountId,
  fiscalYearId,
  onSessionChange,
}: {
  accountId: string;
  fiscalYearId?: string;
  onSessionChange: (session: BankReconciliationSessionView | null) => void;
}) {
  const { session, hasPermissions } = useSession();
  const queryClient = useQueryClient();
  const canRead = hasPermissions(['accounting:reconciliation:read']);
  const canPrepare = hasPermissions(['accounting:reconciliation:manage']);
  const identity = `${session?.tenant.id ?? ''}:${session?.user.id ?? ''}`;
  const queryKey = ['bank-reconciliation-sessions', identity, accountId];
  const sessions = useQuery({
    queryKey,
    queryFn: () => api.listBankReconciliationSessions(accountId),
    enabled: canRead && !!accountId,
  });
  const periods = useQuery({
    queryKey: ['reconciliation-periods', identity, fiscalYearId],
    queryFn: () => api.listFiscalPeriods(fiscalYearId!),
    enabled: canPrepare && !!fiscalYearId,
  });
  const [selectedId, setSelectedId] = useState('');
  const active =
    sessions.data?.find((item) => item.id === selectedId) ??
    sessions.data?.find(
      (item) => !['FINALIZED', 'CANCELLED'].includes(item.status),
    ) ??
    sessions.data?.[0] ??
    null;
  // Phase 3A: session duties come from the canonical server projection.
  const activeAccess = resourceAccess(active?.authorization);
  const [form, setForm] = useState<
    Omit<PrepareBankReconciliation, 'accountId'>
  >({
    fiscalPeriodId: '',
    statementFrom: '',
    statementTo: '',
    openingBankBalance: '',
    closingBankBalance: '',
    statementReference: '',
  });
  const [confirmation, setConfirmation] = useState<{
    action: Action;
    session: BankReconciliationSessionView;
    statementId?: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [balances, setBalances] = useState({
    openingBankBalance: '',
    closingBankBalance: '',
    statementReference: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    onSessionChange(canRead ? active : null);
  }, [active, canRead, onSessionChange]);
  useEffect(() => {
    setSelectedId('');
    setConfirmation(null);
    setReason('');
    setMessage(null);
    setError(null);
  }, [accountId, identity]);
  const update = async (value: BankReconciliationSessionView) => {
    queryClient.setQueryData<BankReconciliationSessionView[]>(
      queryKey,
      (previous) => [
        value,
        ...(previous ?? []).filter((item) => item.id !== value.id),
      ],
    );
    setSelectedId(value.id);
    setConfirmation(null);
    setError(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: ['unreconciled-statements', accountId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['bank-recon-summary', accountId],
      }),
    ]);
  };
  const prepare = useMutation({
    mutationFn: () => api.prepareBankReconciliation({ ...form, accountId }),
    onSuccess: async (value) => {
      await update(value);
      setMessage(
        'Reconciliation preparation saved. Match statement lines before submitting for independent review.',
      );
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const action = useMutation({
    mutationFn: async () => {
      if (!confirmation) throw new Error('Choose a reconciliation action');
      const { action: duty, session: target, statementId } = confirmation;
      if (duty === 'amend')
        return api.amendBankReconciliation(target.id, { ...balances, reason });
      if (duty === 'unmatch')
        return api.unreconcileStatement(target.id, statementId!, reason);
      return api.transitionBankReconciliation(
        target.id,
        duty,
        duty === 'submit' ? undefined : reason,
      );
    },
    onSuccess: async (value) => {
      const label = confirmation
        ? labels[confirmation.action]
        : 'Reconciliation';
      await update(value);
      setMessage(`${label} completed.`);
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const choose = (duty: Action, statementId?: string) => {
    if (!active) return;
    setReason('');
    setError(null);
    setBalances({
      openingBankBalance: active.openingBankBalance,
      closingBankBalance: active.closingBankBalance,
      statementReference: active.statementReference ?? '',
    });
    setConfirmation({ action: duty, session: active, statementId });
  };
  if (!canRead)
    return (
      <SectionCard
        title="Reconciliation sessions"
        description="Reconciliation session access is required for preparing, reviewing or finalizing matches."
      >
        <p className="text-sm text-slate-600">
          Contact your school access administrator for the appropriate
          reconciliation capability.
        </p>
      </SectionCard>
    );
  return (
    <SectionCard
      title="Reconciliation sessions"
      description="Prepare a statement, resolve matching exceptions, obtain independent review, then finalize its evidence."
    >
      <div className="space-y-4">
        {error || sessions.error || periods.error ? (
          <p role="alert" className="text-sm text-rose-700">
            {error ?? sessions.error?.message ?? periods.error?.message}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {sessions.isPending ? (
          <p role="status">Loading reconciliation sessions…</p>
        ) : null}
        {!!sessions.data?.length && (
          <div className="space-y-1">
            <label
              htmlFor="reconciliation-session"
              className="text-sm font-medium"
            >
              Session
            </label>
            <Select
              id="reconciliation-session"
              value={active?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {sessions.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.statementReference ?? 'Historical session'} ·{' '}
                  {item.status.toLowerCase()} ·{' '}
                  {formatDateTime(item.statementFrom)}
                </option>
              ))}
            </Select>
          </div>
        )}
        {active && (
          <div
            className="space-y-4 rounded-xl border border-slate-200 p-4"
            data-testid="reconciliation-session-evidence"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {active.statementReference ?? 'Historical reconciliation'}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                {active.status.toLowerCase()}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {formatDateTime(active.statementFrom)} –{' '}
              {formatDateTime(active.statementTo)}
            </p>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Reported opening bank balance', active.openingBankBalance],
                ['Opening book balance', active.openingBookBalance],
                ['Reported closing bank balance', active.closingBankBalance],
                ['Closing book balance', active.closingBookBalance],
                ['Closing difference', active.difference],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-600">{label}</dt>
                  <dd className="font-semibold">{currency(value)}</dd>
                </div>
              ))}
            </dl>
            <div className="text-sm">
              <p className="font-medium">
                Exceptions at the last preparation or submission
              </p>
              {active.issues.length ? (
                <ul className="list-disc space-y-1 pl-5 text-amber-800">
                  {active.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-700">
                  No recorded matching or balance exceptions.
                </p>
              )}
            </div>
            {active.reviewReason && (
              <p className="text-sm text-slate-600">
                Review note: {active.reviewReason}
              </p>
            )}
            {active.finalizedAt && (
              <p className="text-sm text-slate-600">
                Finalized {formatDateTime(active.finalizedAt)}. This session
                preserves the reviewed evidence.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(['submit', 'review', 'return', 'finalize', 'cancel'] as const)
                .filter((duty) => activeAccess.can(duty.toUpperCase()))
                .map((duty) => (
                  <Button
                    key={duty}
                    type="button"
                    variant={duty === 'cancel' ? 'outline' : 'default'}
                    disabled={action.isPending}
                    onClick={() => choose(duty)}
                  >
                    {labels[duty]}
                  </Button>
                ))}
              {activeAccess.can('MANAGE') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => choose('amend')}
                >
                  Correct reported balances
                </Button>
              )}
            </div>
            {active.matches.some((match) => match.status === 'MATCHED') && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Session matches</p>
                {active.matches
                  .filter((match) => match.status === 'MATCHED')
                  .map((match) => (
                    <div
                      key={match.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm"
                    >
                      <span className="break-all">
                        Statement {match.statementId} ·{' '}
                        {currency(match.bankAmount)}
                      </span>
                      {activeAccess.can('MANAGE') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => choose('unmatch', match.statementId)}
                        >
                          Remove match
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
        {canPrepare &&
          !sessions.isPending &&
          !sessions.error &&
          !sessions.data?.some(
            (item) => !['FINALIZED', 'CANCELLED'].includes(item.status),
          ) && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                prepare.mutate();
              }}
            >
              <p className="font-medium">Prepare a new statement</p>
              <p className="text-sm text-slate-600">
                Enter the balances printed on the bank statement. Book balances
                come from the posted ledger. Dates below use AD.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="reconciliation-period" className="text-sm">
                    Fiscal period
                  </label>
                  <Select
                    id="reconciliation-period"
                    required
                    value={form.fiscalPeriodId}
                    onChange={(event) =>
                      setForm({ ...form, fiscalPeriodId: event.target.value })
                    }
                  >
                    <option value="">Choose open period</option>
                    {periods.data
                      ?.filter((period) => period.status === 'OPEN')
                      .map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.label}
                        </option>
                      ))}
                  </Select>
                </div>
                {(
                  [
                    {
                      key: 'statementFrom',
                      label: 'Statement start (AD)',
                      type: 'date',
                    },
                    {
                      key: 'statementTo',
                      label: 'Statement end (AD)',
                      type: 'date',
                    },
                    {
                      key: 'openingBankBalance',
                      label: 'Reported opening balance (NPR)',
                      type: 'text',
                    },
                    {
                      key: 'closingBankBalance',
                      label: 'Reported closing balance (NPR)',
                      type: 'text',
                    },
                    {
                      key: 'statementReference',
                      label: 'Statement reference',
                      type: 'text',
                    },
                  ] as const
                ).map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label
                      htmlFor={`reconciliation-${field.key}`}
                      className="text-sm"
                    >
                      {field.label}
                    </label>
                    <Input
                      id={`reconciliation-${field.key}`}
                      type={field.type}
                      required
                      value={form[field.key]}
                      inputMode={
                        field.key.includes('Balance') ? 'decimal' : undefined
                      }
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
              <Button
                type="submit"
                isLoading={prepare.isPending}
                disabled={
                  !form.fiscalPeriodId ||
                  !form.statementFrom ||
                  !form.statementTo ||
                  !form.openingBankBalance ||
                  !form.closingBankBalance ||
                  form.statementReference.trim().length < 3
                }
              >
                Save preparation
              </Button>
            </form>
          )}
        <ConfirmDialog
          isOpen={!!confirmation}
          title={confirmation ? labels[confirmation.action] : 'Reconciliation'}
          description={
            confirmation?.action === 'submit'
              ? 'Submit the current statement and matching evidence for review by another authorized user.'
              : 'Confirm the selected reconciliation and record why this action is appropriate.'
          }
          confirmLabel={confirmation ? labels[confirmation.action] : 'Confirm'}
          destructive={
            confirmation?.action === 'cancel' ||
            confirmation?.action === 'unmatch'
          }
          isConfirming={action.isPending}
          preventCloseWhileConfirming
          confirmDisabled={
            confirmation?.action !== 'submit' && reason.trim().length < 10
          }
          onClose={() => setConfirmation(null)}
          onConfirm={() => action.mutate()}
        >
          {confirmation && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {confirmation.session.statementReference ??
                  'Historical reconciliation'}{' '}
                · {confirmation.session.status.toLowerCase()}
              </p>
              <p className="text-sm">
                Reported closing balance{' '}
                {currency(confirmation.session.closingBankBalance)} · Book
                balance {currency(confirmation.session.closingBookBalance)}
              </p>
              {confirmation.action === 'amend' &&
                Object.entries(balances).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label
                      className="text-sm"
                      htmlFor={`reconciliation-amend-${key}`}
                    >
                      {key === 'openingBankBalance'
                        ? 'Reported opening balance (NPR)'
                        : key === 'closingBankBalance'
                          ? 'Reported closing balance (NPR)'
                          : 'Statement reference'}
                    </label>
                    <Input
                      id={`reconciliation-amend-${key}`}
                      value={value}
                      onChange={(event) =>
                        setBalances({ ...balances, [key]: event.target.value })
                      }
                    />
                  </div>
                ))}
              {confirmation.action !== 'submit' && (
                <div className="space-y-1">
                  <label
                    htmlFor="reconciliation-action-reason"
                    className="text-sm"
                  >
                    Reason / review note
                  </label>
                  <textarea
                    id="reconciliation-action-reason"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    minLength={10}
                    maxLength={500}
                    rows={3}
                  />
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-rose-700">
                  {error}
                </p>
              )}
            </div>
          )}
        </ConfirmDialog>
      </div>
    </SectionCard>
  );
}
