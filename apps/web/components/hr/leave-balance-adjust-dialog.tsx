'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input, Select, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, Sliders } from 'lucide-react';

type LeaveBalanceAdjustDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  lockedStaffId?: string;
};

export function LeaveBalanceAdjustDialog({
  isOpen,
  onClose,
  lockedStaffId,
}: LeaveBalanceAdjustDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);

  const [staffId, setStaffId] = useState(lockedStaffId ?? '');
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [year, setYear] = useState(new Date().getFullYear());
  const [adjustment, setAdjustment] = useState<number>(0);
  const [reason, setReason] = useState('');

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
    enabled: isOpen && !lockedStaffId,
  });

  const adjustMutation = useMutation({
    mutationFn: api.adjustLeaveBalance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-leave-balances', lockedStaffId || staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', lockedStaffId || staffId] });
      onClose();
      // Reset form
      setLeaveType('CASUAL');
      setAdjustment(0);
      setReason('');
      if (!lockedStaffId) setStaffId('');
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to adjust leave balance.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    const activeStaffId = lockedStaffId || staffId;

    if (!activeStaffId) {
      setToastError('Please select a staff member.');
      return;
    }
    if (!leaveType) {
      setToastError('Please select a leave type.');
      return;
    }
    if (adjustment === 0) {
      setToastError('Adjustment amount cannot be 0.');
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setToastError('Please provide a reason for this adjustment.');
      return;
    }

    adjustMutation.mutate({
      staffId: activeStaffId,
      leaveType,
      year,
      adjustment,
      reason: trimmedReason,
    });
  };

  const staffList = staffQuery.data ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Sliders size={20} className="text-[var(--color-mod-hr-text)]" />
              Adjust Leave Balance
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Manually credit or debit leave days for staff.</p>
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
            title="Validation Error"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!lockedStaffId ? (
            <FormField label="Staff Member">
              <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Choose staff member...</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.employeeId})
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Leave Type">
              <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                <option value="SICK">Sick Leave</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="EARNED">Earned Leave</option>
                <option value="MATERNITY">Maternity Leave</option>
                <option value="PATERNITY">Paternity Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
                <option value="OTHER">Other Leave</option>
              </Select>
            </FormField>

            <FormField label="Year">
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                required
              />
            </FormField>
          </div>

          <FormField label="Adjustment (Days - Positive or Negative)">
            <Input
              type="number"
              step={0.5}
              value={adjustment}
              onChange={(e) => setAdjustment(Number(e.target.value))}
              placeholder="e.g. 5 for adding, -3 for deducting"
              required
            />
          </FormField>

          <FormField label="Reason for Adjustment (Required)">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for change (e.g. extra work compensation, manual accrual correction)"
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
            disabled={adjustMutation.isPending}
            isLoading={adjustMutation.isPending}
            className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
          >
            Adjust Balance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
