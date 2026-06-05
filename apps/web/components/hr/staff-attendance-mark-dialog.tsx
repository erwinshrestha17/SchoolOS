'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { X, ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type StaffAttendanceMarkDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type TempRecord = {
  staffId: string;
  fullName: string;
  employeeId: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
  checkInTime: string;
  note: string;
};

export function StaffAttendanceMarkDialog({ isOpen, onClose }: StaffAttendanceMarkDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<TempRecord[]>([]);

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
    enabled: isOpen,
  });

  const activeStaff = useMemo(
    () => (staffQuery.data ?? []).filter((s) => s.status === 'ACTIVE' || !s.status),
    [staffQuery.data]
  );

  // Initialize records when staff list is loaded
  useEffect(() => {
    if (activeStaff.length > 0) {
      const initialRecords = activeStaff.map((s) => ({
        staffId: s.id,
        fullName: `${s.firstName} ${s.lastName}`,
        employeeId: s.employeeId,
        status: 'PRESENT' as const,
        checkInTime: '09:00',
        note: '',
      }));
      setRecords(initialRecords);
    }
  }, [activeStaff, isOpen]);

  const markMutation = useMutation({
    mutationFn: api.submitStaffAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
      onClose();
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to submit staff attendance.');
    },
  });

  const handleStatusChange = (staffId: string, status: TempRecord['status']) => {
    setRecords((prev) =>
      prev.map((r) => (r.staffId === staffId ? { ...r, status } : r))
    );
  };

  const handleTimeChange = (staffId: string, checkInTime: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.staffId === staffId ? { ...r, checkInTime } : r))
    );
  };

  const handleNoteChange = (staffId: string, note: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.staffId === staffId ? { ...r, note } : r))
    );
  };

  const handleBulkMark = (status: TempRecord['status']) => {
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    if (records.length === 0) {
      setToastError('No staff members to mark attendance for.');
      return;
    }

    const payload = {
      attendanceDate: new Date(attendanceDate).toISOString(),
      records: records.map((r) => {
        // Construct checkInAt ISO timestamp
        let checkInAt: string | undefined = undefined;
        if (r.status !== 'ABSENT' && r.checkInTime) {
          checkInAt = new Date(`${attendanceDate}T${r.checkInTime}:00`).toISOString();
        }
        return {
          staffId: r.staffId,
          status: r.status,
          checkInAt,
          note: r.note.trim() || undefined,
        };
      }),
    };

    markMutation.mutate(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] rounded-2xl">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck size={20} className="text-[var(--color-mod-hr-text)]" />
              Mark Daily Attendance
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Submit bulk attendance logs for active staff.</p>
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
            title="Submission Failed"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b pb-4">
            <div className="w-full sm:w-56">
              <FormField label="Attendance Date">
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  required
                />
              </FormField>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleBulkMark('PRESENT')}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleBulkMark('ABSENT')}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Status Select</th>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Check In Time</th>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-6 w-44 bg-slate-100 rounded-full" /></td>
                      <td className="px-5 py-4"><div className="h-8 w-20 bg-slate-100 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-8 w-32 bg-slate-100 rounded" /></td>
                    </tr>
                  ))
                ) : records.length > 0 ? (
                  records.map((row) => (
                    <tr key={row.staffId} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{row.fullName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{row.employeeId}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
                          {(['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(row.staffId, st)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all",
                                row.status === st
                                  ? st === 'PRESENT' ? "bg-emerald-500 text-white shadow-sm" :
                                    st === 'ABSENT' ? "bg-rose-500 text-white shadow-sm" :
                                    "bg-amber-500 text-white shadow-sm"
                                  : "text-slate-500 hover:text-slate-700"
                              )}
                            >
                              {st === 'HALF_DAY' ? 'Half' : st.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Input
                          type="time"
                          value={row.checkInTime}
                          onChange={(e) => handleTimeChange(row.staffId, e.target.value)}
                          disabled={row.status === 'ABSENT'}
                          className="h-9 py-1 text-xs rounded-xl"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <Input
                          type="text"
                          value={row.note}
                          onChange={(e) => handleNoteChange(row.staffId, e.target.value)}
                          placeholder="Note"
                          className="h-9 py-1 text-xs rounded-xl"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400 italic">
                      No active staff members found to mark.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </form>

        <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={records.length === 0 || markMutation.isPending}
            isLoading={markMutation.isPending}
            className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
          >
            Submit Logs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
