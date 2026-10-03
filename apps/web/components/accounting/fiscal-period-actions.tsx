'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Button } from '../ui/button';
import { useSession } from '../session-provider';
import { resourceAccess } from '../../lib/resource-authorization';
import {
  allWarningsAcknowledged,
  closeRequestFromPreview,
  FiscalClosePreviewPanel,
} from './fiscal-close-preview-panel';

interface FiscalPeriodActionsProps {
  periodId: string;
  status: string;
  fiscalYearStatus: string;
  label: string;
}

export function FiscalPeriodActions({
  periodId,
  status,
  fiscalYearStatus,
  label,
}: FiscalPeriodActionsProps) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(['accounting:fiscal:manage']);
  const canReopen = hasPermissions(['accounting:fiscal:reopen']);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionType, setActionType] = useState<
    'lock' | 'unlock' | 'close' | 'reopen' | null
  >(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reopenRequestId, setReopenRequestId] = useState<string | null>(null);

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  // Phase 7.11d: the close is bound to this preview's fingerprint.
  const previewQuery = useQuery({
    queryKey: ['fiscal-period-close-preview', periodId],
    queryFn: () => api.getFiscalPeriodClosePreview(periodId),
    enabled: isConfirmOpen && actionType === 'close',
  });
  const preview = previewQuery.data;

  const mutation = useMutation({
    mutationFn: async (data: {
      type: 'lock' | 'unlock' | 'close' | 'reopen';
      reason: string;
    }) => {
      if (data.type === 'lock')
        return {
          type: 'other' as const,
          result: await api.lockFiscalPeriod(periodId, { reason: data.reason }),
        };
      if (data.type === 'unlock')
        return {
          type: 'other' as const,
          result: await api.unlockFiscalPeriod(periodId, {
            reason: data.reason,
          }),
        };
      if (data.type === 'close') {
        if (!preview) throw new Error('Open the close preview first.');
        return {
          type: 'other' as const,
          result: await api.closeFiscalPeriod(
            periodId,
            closeRequestFromPreview(preview, data.reason, acknowledged),
          ),
        };
      }
      return {
        type: 'reopen' as const,
        result: await api.reopenFiscalPeriod(periodId, { reason: data.reason }),
      };
    },
    onSuccess: (result) => {
      if (result.type === 'reopen') {
        setReopenRequestId(result.result.id);
        void queryClient.invalidateQueries({
          queryKey: ['principal-approval-centre'],
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      }
      setIsConfirmOpen(false);
      setReason('');
      setError(null);
      setAcknowledged(new Set());
    },
    onError: (mutationError: Error) => {
      setError(
        mutationError.message ||
          'The fiscal period action could not be completed.',
      );
      // A stale or changed preview must be reviewed again.
      if (actionType === 'close') {
        setAcknowledged(new Set());
        void previewQuery.refetch();
      }
    },
  });

  const handleAction = (type: 'lock' | 'unlock' | 'close' | 'reopen') => {
    setActionType(type);
    setError(null);
    setAcknowledged(new Set());
    setIsConfirmOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          {status === 'OPEN' && canManage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleAction('lock')}
              className="h-7 w-7 text-slate-400 hover:text-amber-600"
              title="Lock Period"
              aria-label="Lock Period"
            >
              <Lock size={14} />
            </Button>
          )}
          {status === 'LOCKED' && (
            <>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAction('close')}
                  className="h-7 w-7 text-slate-400 hover:text-emerald-600"
                  title="Close Period"
                  aria-label="Close Period"
                >
                  <CheckCircle2 size={14} />
                </Button>
              )}
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAction('unlock')}
                  className="h-7 w-7 text-slate-400 hover:text-[var(--color-mod-accounting-accent)]"
                  title="Unlock Period"
                  aria-label="Unlock Period"
                >
                  <Unlock size={14} />
                </Button>
              )}
            </>
          )}
          {status === 'CLOSED' && fiscalYearStatus === 'OPEN' && canReopen && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleAction('reopen')}
              className="h-7 w-7 text-slate-400 hover:text-[var(--color-mod-accounting-accent)]"
              title="Request Period Reopen"
              aria-label="Request Period Reopen"
            >
              <Unlock size={14} />
            </Button>
          )}
        </div>
        {reopenRequestId && status === 'CLOSED' && (
          <span
            role="status"
            className="text-[10px] font-semibold text-amber-700"
            aria-label={`Reopen request pending for ${label}`}
          >
            Reopen requested
          </span>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => mutation.mutate({ type: actionType!, reason })}
        title={
          actionType === 'reopen'
            ? `Request Reopen for Period ${label}`
            : `${actionType?.toUpperCase()} Period ${label}`
        }
        description={
          actionType === 'reopen'
            ? 'Submit a reasoned request. The period remains closed until an independent approver applies it.'
            : `Are you sure you want to ${actionType} this fiscal period? This action is audited.`
        }
        confirmLabel={actionType === 'reopen' ? 'Submit Request' : 'Confirm'}
        isConfirming={mutation.isPending}
        variant={actionType === 'reopen' ? 'default' : 'warning'}
        confirmDisabled={
          reason.trim().length < (actionType === 'reopen' ? 10 : 5) ||
          (actionType === 'close' &&
            (previewQuery.isPending ||
              previewQuery.isError ||
              !resourceAccess<'close', 'inventory'>(preview?.authorization).can(
                'close',
              ) ||
              !allWarningsAcknowledged(preview, acknowledged)))
        }
      >
        <div className="mt-4 space-y-2">
          {actionType === 'close' && (
            <FiscalClosePreviewPanel
              preview={preview}
              isLoading={previewQuery.isPending}
              isError={previewQuery.isError}
              isFetching={previewQuery.isFetching}
              acknowledged={acknowledged}
              onAcknowledge={(code, checked) =>
                setAcknowledged((current) => {
                  const next = new Set(current);
                  if (checked) next.add(code);
                  else next.delete(code);
                  return next;
                })
              }
              onRecompute={() => {
                setAcknowledged(new Set());
                void previewQuery.refetch();
              }}
            />
          )}
          {error && (
            <p className="text-xs font-semibold text-rose-700">{error}</p>
          )}
          <label
            htmlFor={`fiscal-period-reason-${periodId}`}
            className="text-xs font-bold text-slate-500 uppercase"
          >
            Reason for action
          </label>
          <textarea
            id={`fiscal-period-reason-${periodId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required for reopening, recommended for others..."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[var(--color-mod-accounting-accent)] min-h-[80px]"
          />
          {reason.trim().length > 0 &&
            reason.trim().length < (actionType === 'reopen' ? 10 : 5) && (
              <p className="flex items-center gap-1 text-[10px] text-rose-500 font-bold uppercase">
                <AlertCircle size={10} />
                Enter at least {actionType === 'reopen' ? 10 : 5} characters
              </p>
            )}
        </div>
      </ConfirmDialog>
    </>
  );
}
