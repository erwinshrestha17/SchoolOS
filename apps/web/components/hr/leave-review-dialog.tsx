'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, TextArea } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

type LeaveReviewDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview?: (
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNote?: string,
  ) => Promise<unknown>;
  leaveRequest: {
    id: string;
    leaveType: string;
    startsOn: string;
    endsOn: string;
    days: number;
    reason: string;
    staff?: {
      firstName: string;
      lastName: string;
      employeeId: string;
    };
  };
};

export function LeaveReviewDialog({
  isOpen,
  onClose,
  onSubmitReview,
  leaveRequest,
}: LeaveReviewDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [anomalies, setAnomalies] = useState<any[]>([]);

  const reviewMutation = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') => {
      const trimmedReviewNote = reviewNote.trim() || undefined;
      return onSubmitReview
        ? onSubmitReview(leaveRequest.id, status, trimmedReviewNote)
        : api.reviewLeaveRequest(leaveRequest.id, {
            status,
            reviewNote: trimmedReviewNote,
          });
    },
    onSuccess: (data: any) => {
      // Check if backend returned overlap anomalies
      if (data && data.overlapAnomalies && data.overlapAnomalies.length > 0) {
        setAnomalies(data.overlapAnomalies);
        setToastError('Review succeeded but overlap anomalies were detected. Attendance conflict logs have been updated.');
      } else {
        void queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
        void queryClient.invalidateQueries({ queryKey: ['staff-leave-balances'] });
        void queryClient.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
        void queryClient.invalidateQueries({ queryKey: ['staff-detail'] });
        void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
        handleClose();
      }
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to review leave request.');
    },
  });

  const handleClose = () => {
    setToastError(null);
    setReviewNote('');
    setAnomalies([]);
    onClose();
  };

  const handleAction = (status: 'APPROVED' | 'REJECTED') => {
    setToastError(null);
    if (status === 'REJECTED' && !reviewNote.trim()) {
      setToastError('Please specify a rejection reason in the review notes.');
      return;
    }
    reviewMutation.mutate(status);
  };

  const staffName = leaveRequest.staff
    ? `${leaveRequest.staff.firstName} ${leaveRequest.staff.lastName}`
    : 'Staff Member';

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle>Review Leave Request</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Review leave details for {staffName}.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </DialogHeader>

        {toastError && (
          <Toast
            title={anomalies.length > 0 ? 'Overlap Detected' : 'Review Error'}
            description={toastError}
            tone={anomalies.length > 0 ? 'warning' : 'danger'}
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border bg-slate-50/50 p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-slate-400 font-bold uppercase">Leave Type</p>
                <p className="font-bold text-slate-900 mt-1 uppercase tracking-tight">{leaveRequest.leaveType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase">Duration</p>
                <p className="font-bold text-slate-900 mt-1">{leaveRequest.days} Day{leaveRequest.days !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase">Dates</p>
              <p className="font-bold text-slate-900 mt-1">
                {new Date(leaveRequest.startsOn).toLocaleDateString()} - {new Date(leaveRequest.endsOn).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase">Reason</p>
              <p className="font-medium text-slate-600 italic mt-1 leading-relaxed">&ldquo;{leaveRequest.reason}&rdquo;</p>
            </div>
          </div>

          {anomalies.length > 0 && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 space-y-2 text-xs text-rose-800">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert size={14} className="text-rose-600" /> Overlap Conflicts Detected:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {anomalies.map((anom, idx) => (
                  <li key={idx}>
                    {new Date(anom.attendanceDate).toLocaleDateString()}: Proposed {anom.proposedStatus} overlaps with existing {anom.existingStatus}.
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
                  void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
                  void queryClient.invalidateQueries({ queryKey: ['staff-leave-balances'] });
                  void queryClient.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
                  void queryClient.invalidateQueries({ queryKey: ['staff-detail'] });
                  handleClose();
                }}
                className="mt-2"
              >
                Close & Invalidate Records
              </Button>
            </div>
          )}

          {anomalies.length === 0 && (
            <FormField label="Review Remarks / Audit Notes">
              <TextArea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Remarks (Required for rejection)"
                rows={3}
              />
            </FormField>
          )}
        </div>

        {anomalies.length === 0 && (
          <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleAction('REJECTED')}
              disabled={reviewMutation.isPending}
              isLoading={reviewMutation.isPending && reviewMutation.variables === 'REJECTED'}
            >
              <XCircle size={16} className="mr-2" />
              Reject Request
            </Button>
            <Button
              type="button"
              onClick={() => handleAction('APPROVED')}
              disabled={reviewMutation.isPending}
              isLoading={reviewMutation.isPending && reviewMutation.variables === 'APPROVED'}
            >
              <CheckCircle size={16} className="mr-2" />
              Approve Request
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
