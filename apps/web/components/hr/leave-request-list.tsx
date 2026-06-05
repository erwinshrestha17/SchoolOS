'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CalendarDays, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { cn } from '../../lib/utils';
import { LeaveReviewDialog } from './leave-review-dialog';

type LeaveRequest = Awaited<ReturnType<typeof api.listLeaveRequests>>[number];

export function LeaveRequestList() {
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const leaveRequestsQuery = useQuery({
    queryKey: ['staff-leave-requests'],
    queryFn: api.listLeaveRequests,
  });

  const filteredRequests = (leaveRequestsQuery.data ?? []).filter(
    (req) => filterStatus === 'ALL' || req.status === filterStatus
  );

  const submitReview = (id: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) =>
    status === 'APPROVED'
      ? api.approveLeaveRequest(id, { reviewNote })
      : api.rejectLeaveRequest(id, { reviewNote });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all",
              filterStatus === status
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {leaveRequestsQuery.isLoading ? (
          <div className="col-span-full">
            <LoadingState variant="spinner" label="Loading leave requests..." />
          </div>
        ) : filteredRequests.length > 0 ? (
          filteredRequests.map((request) => (
            <div key={request.id} className="shell-card group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[var(--color-mod-hr-border)] hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:bg-[var(--color-mod-hr-soft)] group-hover:text-[var(--color-mod-hr-text)] transition-colors">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 leading-none">
                      {request.staff?.firstName} {request.staff?.lastName}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
                      {request.leaveType.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  request.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-200/50" :
                  request.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-200/50" :
                  "bg-rose-50 text-rose-600 border-rose-200/50"
                )}>
                  {request.status}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Starts</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">{new Date(request.startsOn).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ends</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">{new Date(request.endsOn).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2 pt-3 border-t border-slate-100 mt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</p>
                  <p className="text-sm font-black text-[var(--color-mod-hr-text)] mt-1">{request.days} Day{request.days !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="mt-5 px-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</p>
                <p className="mt-2 text-sm font-medium text-slate-600 leading-relaxed line-clamp-2 italic">&ldquo;{request.reason}&rdquo;</p>
              </div>

              {request.status === 'PENDING' && (
                <div className="mt-6 flex pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(request)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-mod-hr-accent)] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--color-mod-hr-text)] active:scale-[0.98]"
                  >
                    <ShieldCheck size={18} />
                    Review Request
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full">
            <EmptyState 
              title="No leave requests" 
              description={`There are currently no ${filterStatus !== 'ALL' ? filterStatus.toLowerCase() : ''} leave requests to display.`}
            />
          </div>
        )}
      </div>

      {selectedRequest && (
        <LeaveReviewDialog
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          leaveRequest={selectedRequest}
          onSubmitReview={submitReview}
        />
      )}
    </div>
  );
}
