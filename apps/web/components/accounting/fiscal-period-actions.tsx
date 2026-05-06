'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ConfirmDialog } from '../ui/confirm-dialog';

interface FiscalPeriodActionsProps {
  periodId: string;
  status: string;
  label: string;
}

export function FiscalPeriodActions({ periodId, status, label }: FiscalPeriodActionsProps) {
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionType, setActionType] = useState<'lock' | 'close' | 'reopen' | null>(null);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { type: 'lock' | 'close' | 'reopen'; reason: string }) => {
      if (data.type === 'lock') return api.lockFiscalPeriod(periodId, { reason: data.reason });
      if (data.type === 'close') return api.closeFiscalPeriod(periodId, { reason: data.reason });
      return api.reopenFiscalPeriod(periodId, { reason: data.reason });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      setIsConfirmOpen(false);
      setReason('');
    },
  });

  const handleAction = (type: 'lock' | 'close' | 'reopen') => {
    setActionType(type);
    setIsConfirmOpen(true);
  };

  return (
    <>
      <div className="flex gap-1">
        {status === 'OPEN' && (
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
            <button
              onClick={() => handleAction('close')}
              className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
              title="Close Period"
            >
              <CheckCircle2 size={14} />
            </button>
            <button
              onClick={() => handleAction('reopen')}
              className="p-1 text-slate-400 hover:text-primary-600 transition-colors"
              title="Reopen Period"
            >
              <Unlock size={14} />
            </button>
          </>
        )}
        {status === 'CLOSED' && (
          <button
            onClick={() => handleAction('reopen')}
            className="p-1 text-slate-400 hover:text-primary-600 transition-colors"
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
      >
        <div className="mt-4 space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Reason for action</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required for reopening, recommended for others..."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-primary-500 min-h-[80px]"
          />
          {actionType === 'reopen' && !reason && (
            <p className="flex items-center gap-1 text-[10px] text-rose-500 font-bold uppercase">
              <AlertCircle size={10} />
              Reason is mandatory for reopening
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
