'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input, Select, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, ClipboardCheck, AlertTriangle } from 'lucide-react';

type StaffAttendanceCorrectionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  record: {
    id: string;
    attendanceDate: string;
    status: string;
    checkIn?: string | null;
    note?: string | null;
    leaveType?: string | null;
  };
  fullName: string;
};

export function StaffAttendanceCorrectionDialog({
  isOpen,
  onClose,
  staffId,
  record,
  fullName,
}: StaffAttendanceCorrectionDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);

  const [status, setStatus] = useState(record.status);
  const [reason, setReason] = useState('');
  const [checkInTime, setCheckInTime] = useState(
    record.checkIn ? new Date(record.checkIn).toISOString().slice(11, 16) : ''
  );
  const [leaveType, setLeaveType] = useState(record.leaveType ?? '');
  const [note, setNote] = useState(record.note ?? '');

  const correctMutation = useMutation({
    mutationFn: (payload: any) => api.correctStaffAttendance(record.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff-attendance', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
      onClose();
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to correct attendance record.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setToastError('Please provide a reason for this correction.');
      return;
    }

    // Build ISO check-in date if time is provided
    let checkInAt: string | undefined = undefined;
    if (checkInTime) {
      const datePart = record.attendanceDate.slice(0, 10);
      checkInAt = new Date(`${datePart}T${checkInTime}:00`).toISOString();
    }

    correctMutation.mutate({
      status,
      reason: trimmedReason,
      checkInAt,
      leaveType: status === 'LEAVE' && leaveType ? leaveType : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck size={20} className="text-[var(--color-mod-hr-text)]" />
              Correct Attendance Record
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Correcting entry for {fullName} on {new Date(record.attendanceDate).toLocaleDateString()}
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
            title="Correction Failed"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex gap-3 text-xs text-amber-800 leading-relaxed">
            <AlertTriangle className="shrink-0 text-amber-600" size={18} />
            <div>
              <strong>Recalculation Alert:</strong> Correcting historical attendance records may trigger salary deductions or recalculations on active/pending payroll runs.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave (On Leave)</option>
                <option value="HALF_DAY">Half Day</option>
              </Select>
            </FormField>

            <FormField label="Check In Time">
              <Input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </FormField>
          </div>

          {status === 'LEAVE' && (
            <FormField label="Leave Type">
              <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                <option value="">Choose leave type...</option>
                <option value="SICK">Sick Leave</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="EARNED">Earned Leave</option>
                <option value="MATERNITY">Maternity Leave</option>
                <option value="PATERNITY">Paternity Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
                <option value="OTHER">Other Leave</option>
              </Select>
            </FormField>
          )}

          <FormField label="Remarks / Note">
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal remarks"
            />
          </FormField>

          <FormField label="Audit Reason (Required)">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for changing record (e.g. forgot to check in, late log correction)"
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
            isLoading={correctMutation.isPending}
            disabled={correctMutation.isPending}
            className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
          >
            Save Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
