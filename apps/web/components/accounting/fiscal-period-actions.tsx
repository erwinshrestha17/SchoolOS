'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { useSession } from '../session-provider';

interface FiscalPeriodActionsProps {
  periodId: string;
  status: string;
  label: string;
}

export function FiscalPeriodActions({ periodId, status, label }: FiscalPeriodActionsProps) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(['accounting:fiscal:manage']);
  const canReopen = hasPermissions(['accounting:fiscal:reopen']);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionType, setActionType] = useState<'lock' | 'unlock' | 'close' | 'reopen' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const readinessQuery = useQuery({
    queryKey: ['fiscal-period-close-readiness', periodId],
    queryFn: () => api.getFiscalPeriodCloseReadiness(periodId),
    enabled: isConfirmOpen && actionType === 'close',
  });

  const mutation = useMutation({
    mutationFn: (data: { type: 'lock' | 'unlock' | 'close' | 'reopen'; reason: string }) => {
      if (data.type === 'lock') return api.lockFiscalPeriod(periodId, { reason: data.reason });
      if (data.type === 'unlock') return api.unlockFiscalPeriod(periodId, { reason: data.reason });
      if (data.type === 'close') return api.closeFiscalPeriod(periodId, { reason: data.reason });
      return api.reopenFiscalPeriod(periodId, { reason: data.reason });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      setIsConfirmOpen(false);
      setReason('');
      setError(null);
    },
    onError: (mutationError: Error) =>
      setError(
        mutationError.message ||
          'The fiscal period action could not be completed.',
      ),
  });

  const handleAction = (type: 'lock' | 'unlock' | 'close' | 'reopen') => {
    setActionType(type);
    setError(null);
    setIsConfirmOpen(true);
  };

  return (
    <>
      <div className="flex gap-1">
        {status === 'OPEN' && canManage && (
          <button
            onClick={() => handleAction('lock')}
            className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
            title="Lock Period"
          >
            <Lock size={14} />
          </button>
        )}
        {status === 'LOCKED' && (
          <>
            {canManage && <button
              onClick={() => handleAction('close')}
              className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
              title="Close Period"
            >
              <CheckCircle2 size={14} />
            </button>}
            {canManage && <button
              onClick={() => handleAction('unlock')}
              className="p-1 text-slate-400 hover:text-[var(--color-mod-accounting-accent)] transition-colors"
              title="Unlock Period"
            >
              <Unlock size={14} />
            </button>}
          </>
        )}
        {status === 'CLOSED' && canReopen && (
          <button
            onClick={() => handleAction('reopen')}
            className="p-1 text-slate-400 hover:text-[var(--color-mod-accounting-accent)] transition-colors"
            title="Reopen Period"
          >
            <Unlock size={14} />
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => mutation.mutate({ type: actionType!, reason })}
        title={`${actionType?.toUpperCase()} Period ${label}`}
        description={`Are you sure you want to ${actionType} this fiscal period? This action is audited.`}
        confirmLabel={mutation.isPending ? 'Processing...' : 'Confirm'}
        variant={actionType === 'reopen' ? 'default' : 'warning'}
        confirmDisabled={
          reason.trim().length < 5 ||
          (actionType === 'close' &&
            (readinessQuery.isPending ||
              readinessQuery.isError ||
              !readinessQuery.data?.readyToClose))
        }
      >
        <div className="mt-4 space-y-2">
          {actionType === 'close' && readinessQuery.isPending && (
            <p className="text-xs font-semibold text-slate-500">
              Running backend close-readiness checks...
            </p>
          )}
          {actionType === 'close' && readinessQuery.data && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-bold text-slate-800">
                {readinessQuery.data.readyToClose
                  ? 'Backend checks are ready to close'
                  : `${readinessQuery.data.blockers.length} backend blocker(s) must be resolved`}
              </p>
              {readinessQuery.data.blockers.map((blocker) => (
                <p key={blocker.code} className="mt-1 text-rose-700">
                  {blocker.safeMessage} ({blocker.count})
                </p>
              ))}
              <p className="mt-2 text-amber-700">
                Posting-failure and required-snapshot policy checks remain explicitly unavailable.
              </p>
            </div>
          )}
          {(error || readinessQuery.isError) && (
            <p className="text-xs font-semibold text-rose-700">
              {error || readinessQuery.error?.message || 'Readiness checks failed.'}
            </p>
          )}
          <label htmlFor={`fiscal-period-reason-${periodId}`} className="text-xs font-bold text-slate-500 uppercase">Reason for action</label>
          <textarea
            id={`fiscal-period-reason-${periodId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required for reopening, recommended for others..."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[var(--color-mod-accounting-accent)] min-h-[80px]"
          />
          {reason.trim().length > 0 && reason.trim().length < 5 && (
            <p className="flex items-center gap-1 text-[10px] text-rose-500 font-bold uppercase">
              <AlertCircle size={10} />
              Enter at least 5 characters
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
