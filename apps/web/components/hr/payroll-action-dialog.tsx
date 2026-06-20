'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, ShieldAlert, Landmark, ShieldCheck, Ban } from 'lucide-react';

export type PayrollActionType = 'SUBMIT_REVIEW' | 'APPROVE' | 'REJECT' | 'POST';

interface PayrollActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  runId: string;
  periodText: string;
  actionType: PayrollActionType;
}

export function PayrollActionDialog({
  isOpen,
  onClose,
  runId,
  periodText,
  actionType,
}: PayrollActionDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const actionMutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = reason.trim();

      switch (actionType) {
        case 'SUBMIT_REVIEW':
          return api.submitPayrollRunReview(runId);
        case 'APPROVE':
          return api.approvePayrollRun(runId);
        case 'REJECT':
          return api.rejectPayrollRun(runId, { reason: trimmedReason });
        case 'POST':
          return api.postPayrollRun(runId);
        default:
          throw new Error('Unsupported payroll action');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      onClose();
      setReason('');
    },
    onError: (error: any) => {
      setToastError(error.message || `Failed to perform ${actionType.toLowerCase()} action.`);
    },
  });

  const getActionConfig = () => {
    switch (actionType) {
      case 'SUBMIT_REVIEW':
        return {
          title: 'Submit for Review',
          description: 'Submit this payroll run for administrative review.',
          icon: <ShieldAlert size={20} className="text-[var(--color-mod-hr-text)]" />,
          warning: 'This will lock the draft and alert reviewers. No direct edits are allowed during review.',
          requiresReason: false,
          confirmText: 'Submit Review',
          confirmVariant: 'default' as const,
        };
      case 'APPROVE':
        return {
          title: 'Approve Payroll',
          description: 'Approve this payroll run, finalising all earnings, deductions, and net payouts.',
          icon: <ShieldCheck size={20} className="text-emerald-500" />,
          warning: 'Approve locks the calculations. Approved runs are ready for M11 posting and payslip downloads. This action is irreversible.',
          requiresReason: false,
          confirmText: 'Approve',
          confirmVariant: 'default' as const,
        };
      case 'REJECT':
        return {
          title: 'Reject Payroll',
          description: 'Reject this payroll run and return it to generated draft state.',
          icon: <Ban size={20} className="text-red-500" />,
          warning: 'Rejection returns the run to generated/draft state for recalculation or modifications.',
          requiresReason: true,
          confirmText: 'Reject Run',
          confirmVariant: 'destructive' as const,
        };
      case 'POST':
        return {
          title: 'Post to Accounting',
          description: 'Post this approved payroll run to M11 General Ledger.',
          icon: <Landmark size={20} className="text-purple-500" />,
          warning: 'Posting generates the M11 payroll accrual journal entries. This action locks the run against deletions or changes.',
          requiresReason: false,
          confirmText: 'Post to M11',
          confirmVariant: 'default' as const,
        };
    }
  };

  const config = getActionConfig();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    if (config.requiresReason && !reason.trim()) {
      setToastError('Please provide a reason or remarks for this action.');
      return;
    }
    actionMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle className="flex items-center gap-2">
              {config.icon}
              {config.title}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Run Period: <span className="font-semibold text-slate-800">{periodText}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </DialogHeader>

        {toastError && (
          <Toast
            title="Action Error"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-xs text-amber-800 leading-relaxed">
            <strong>Warning:</strong> {config.warning}
          </div>

          {config.requiresReason && (
            <FormField label="Reason / Remarks">
              <TextArea
                placeholder={`Provide reason for this ${config.title.toLowerCase()}...`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
              />
            </FormField>
          )}
        </form>

        <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            variant={config.confirmVariant}
            disabled={actionMutation.isPending}
            isLoading={actionMutation.isPending}
          >
            {config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
