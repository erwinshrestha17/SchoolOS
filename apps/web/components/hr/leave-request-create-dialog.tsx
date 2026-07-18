'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDateForInput,
  parseBsDateInput,
  toGregorianDateFromBs,
} from '@schoolos/core';
import { api } from '../../lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { BsDateField } from '../ui/bs-date-field';
import { FormField, Select, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, Calendar } from 'lucide-react';
import { useSession } from '../session-provider';

type LeaveRequestCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  lockedStaffId?: string; // Optional: If passed, locks request to this staff ID
  selfService?: boolean;
};

export function LeaveRequestCreateDialog({
  isOpen,
  onClose,
  lockedStaffId,
  selfService = false,
}: LeaveRequestCreateDialogProps) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManageLeave = hasPermissions(['hr:leave:request']);

  const [toastError, setToastError] = useState<string | null>(null);

  const [staffId, setStaffId] = useState(lockedStaffId ?? '');
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startsOnBs, setStartsOnBs] = useState(() =>
    formatBsDateForInput(new Date()),
  );
  const [endsOnBs, setEndsOnBs] = useState(() =>
    formatBsDateForInput(new Date()),
  );
  const [reason, setReason] = useState('');

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
    enabled: isOpen && !selfService && !lockedStaffId && canManageLeave,
  });

  const requestMutation = useMutation<
    unknown,
    unknown,
    {
      staffId?: string;
      leaveType: string;
      startsOn: string;
      endsOn: string;
      reason: string;
    }
  >({
    mutationFn: (payload: {
      staffId?: string;
      leaveType: string;
      startsOn: string;
      endsOn: string;
      reason: string;
    }) =>
      selfService
        ? api.createMyLeaveRequest({
            leaveType: payload.leaveType,
            startsOn: payload.startsOn,
            endsOn: payload.endsOn,
            reason: payload.reason,
          })
        : api.createLeaveRequest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['staff-leave-requests'],
      });
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
      void queryClient.invalidateQueries({
        queryKey: ['staff-leave-balances', lockedStaffId || staffId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['staff-detail', lockedStaffId || staffId],
      });
      onClose();
      // Reset form
      setLeaveType('CASUAL');
      setStartsOnBs(formatBsDateForInput(new Date()));
      setEndsOnBs(formatBsDateForInput(new Date()));
      setReason('');
      if (!lockedStaffId) setStaffId('');
    },
    onError: () => {
      setToastError(
        'The leave request could not be submitted. Review the details and try again.',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    const activeStaffId = selfService ? undefined : lockedStaffId || staffId;

    if (!selfService && !activeStaffId) {
      setToastError('Please select a staff member.');
      return;
    }
    if (!leaveType) {
      setToastError('Please select a leave type.');
      return;
    }
    if (!startsOnBs || !endsOnBs) {
      setToastError('Please select start and end dates.');
      return;
    }

    let startsOn: string;
    let endsOn: string;
    try {
      startsOn = gregorianDateString(startsOnBs);
      endsOn = gregorianDateString(endsOnBs);
    } catch {
      setToastError('Enter valid Bikram Sambat dates in YYYY-MM-DD format.');
      return;
    }

    if (endsOn < startsOn) {
      setToastError('Leave end date cannot precede the start date.');
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setToastError('Please provide a reason for the leave.');
      return;
    }

    requestMutation.mutate({
      ...(activeStaffId ? { staffId: activeStaffId } : {}),
      leaveType,
      startsOn,
      endsOn,
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
              <Calendar size={20} className="text-[var(--color-mod-hr-text)]" />
              Request Leave
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Submit a leave request for processing.
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
            title="Validation Error"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!selfService && !lockedStaffId && canManageLeave ? (
            <FormField label="Staff Member">
              <Select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              >
                <option value="">Choose staff member...</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.employeeId})
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <FormField label="Leave Type">
            <Select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
            >
              <option value="SICK">Sick Leave</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="EARNED">Earned Leave</option>
              <option value="MATERNITY">Maternity Leave</option>
              <option value="PATERNITY">Paternity Leave</option>
              <option value="UNPAID">Unpaid Leave</option>
              <option value="OTHER">Other Leave</option>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <BsDateField
              label="Start date (BS)"
              value={startsOnBs}
              onChange={setStartsOnBs}
              required
            />
            <BsDateField
              label="End date (BS)"
              value={endsOnBs}
              onChange={setEndsOnBs}
              required
            />
          </div>

          <FormField label="Reason for Leave">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Family emergency, medical appointment, vacation, etc."
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
            disabled={requestMutation.isPending}
            isLoading={requestMutation.isPending}
            className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
}
