'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CalendarDays, Check, X, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function LeaveRequestList() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');

  const leaveRequestsQuery = useQuery({
    queryKey: ['staff-leave-requests'],
    queryFn: api.listLeaveRequests,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string, status: 'APPROVED' | 'REJECTED', note?: string }) => 
      api.reviewLeaveRequest(id, { status, reviewNote: note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
    },
  });

  const filteredRequests = (leaveRequestsQuery.data ?? []).filter(
    (req) => filterStatus === 'ALL' || req.status === filterStatus
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              filterStatus === status
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {leaveRequestsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shell-card animate-pulse h-48 rounded-2xl border border-gray-100 bg-white" />
          ))
        ) : filteredRequests.length > 0 ? (
          filteredRequests.map((request) => (
            <div key={request.id} className="shell-card group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-primary-200 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">
                      {request.staff?.firstName} {request.staff?.lastName}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {request.leaveType.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                  request.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                  request.status === 'APPROVED' ? 'bg-success-100 text-success-700' :
                  'bg-danger-100 text-danger-700'
                }`}>
                  {request.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-gray-50/50 p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-gray-400">Starts</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(request.startsOn).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-gray-400">Ends</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(request.endsOn).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase text-gray-400">Duration</p>
                  <p className="text-sm font-medium text-gray-700">{request.days} Day{request.days !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Reason</p>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{request.reason}</p>
              </div>

              {request.status === 'PENDING' && (
                <div className="mt-5 flex gap-2 pt-4 border-t border-gray-100">
                  <button 
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: request.id, status: 'REJECTED' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-danger-600 hover:bg-danger-50 transition-colors border border-transparent hover:border-danger-100"
                  >
                    <X size={16} />
                    Reject
                  </button>
                  <button 
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: request.id, status: 'APPROVED' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-success-600 hover:bg-success-700 transition-colors shadow-sm shadow-success-500/20"
                  >
                    <Check size={16} />
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center gap-2">
            <AlertCircle size={32} className="text-gray-300" />
            <p>No leave requests found for the selected status.</p>
          </div>
        )}
      </div>
    </div>
  );
}
