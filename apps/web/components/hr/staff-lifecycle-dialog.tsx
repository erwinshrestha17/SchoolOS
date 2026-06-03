'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input, Select, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, AlertTriangle } from 'lucide-react';

type StaffLifecycleDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  currentStatus: string;
  fullName: string;
};

export function StaffLifecycleDialog({
  isOpen,
  onClose,
  staffId,
  currentStatus,
  fullName,
}: StaffLifecycleDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);

  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'TERMINATED'>('ACTIVE');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  const transitionMutation = useMutation({
    mutationFn: (payload: { status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED'; reason: string; effectiveDate?: string }) => {
      if (payload.status === 'TERMINATED') {
        return api.terminateStaff(staffId, { reason: payload.reason, effectiveDate: payload.effectiveDate });
      } else if (payload.status === 'INACTIVE') {
        return api.archiveStaff(staffId, payload.reason);
      } else {
        return api.updateStaffLifecycle(staffId, { status: payload.status, reason: payload.reason });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff-history', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to update lifecycle status.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    if (!reason) {
      setToastError('Please provide a reason for this lifecycle transition.');
      return;
    }

    transitionMutation.mutate({
      status,
      reason,
      effectiveDate: status === 'TERMINATED' ? effectiveDate : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[2.5rem]">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle>Update Lifecycle Status</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Modify access and employment status for {fullName}.</p>
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
            title="Update Failed"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex gap-3 text-xs text-amber-800 leading-relaxed">
            <AlertTriangle className="shrink-0 text-amber-600" size={18} />
            <div>
              <strong>Security Warning:</strong> Changing a user status to INACTIVE or TERMINATED immediately suspends active system logins and disables access to all SchoolOS workspaces.
            </div>
          </div>

          <FormField label="Target Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ACTIVE">ACTIVE (Re-activate/Employ)</option>
              <option value="INACTIVE">INACTIVE (Archive/Suspend)</option>
              <option value="TERMINATED">TERMINATED (Layoff/Fired)</option>
            </Select>
          </FormField>

          {status === 'TERMINATED' && (
            <FormField label="Effective Date">
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </FormField>
          )}

          <FormField label="Reason (Required for audit trails)">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Resigned voluntarily, contract expired, probation terminated, etc."
              rows={3}
              required
            />
          </FormField>
        </form>

        <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            variant={status === 'ACTIVE' ? 'default' : 'destructive'}
            isLoading={transitionMutation.isPending}
            disabled={transitionMutation.isPending}
          >
            Confirm Status Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
