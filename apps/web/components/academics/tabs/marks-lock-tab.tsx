'use client';

import { formatBsDateTime, type ExamTermSummary } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, type MarkLockRequestSummary } from '../../../lib/api';
import { useSession } from '../../session-provider';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  MessageSquare,
  History,
  AlertCircle,
  Zap,
  User,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type Props = {
  exams: ExamTermSummary[];
};

type ReviewAction = {
  id: string;
  status: 'APPROVED' | 'REJECTED';
};

function actorLabel(actor?: MarkLockRequestSummary['requestedBy']) {
  return actor?.email || actor?.phone || actor?.id || 'System';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return formatBsDateTime(value);
}

export function MarksLockTab({ exams }: Props) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ examTermId: '', status: '' });
  const [requestForm, setRequestForm] = useState({ examTermId: '', reason: '' });
  const [unlockForm, setUnlockForm] = useState({ examTermId: '', reason: '' });
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['mark-lock-requests', filters],
    queryFn: () => api.listMarkLockRequests({
      examTermId: filters.examTermId || null,
      status: filters.status || null,
    }),
    enabled: status === 'authenticated',
  });

  const selectedRequestExam = useMemo(
    () => exams.find((exam) => exam.id === requestForm.examTermId),
    [exams, requestForm.examTermId],
  );
  const selectedUnlockExam = useMemo(
    () => exams.find((exam) => exam.id === unlockForm.examTermId),
    [exams, unlockForm.examTermId],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['mark-lock-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 5000);
  };

  const createMutation = useMutation({
    mutationFn: api.createMarkLockRequest,
    onSuccess: () => {
      invalidate();
      setRequestForm((current) => ({ ...current, reason: '' }));
      showSuccess('Operational lock request submitted for review.');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: ReviewAction) =>
      api.reviewMarkLockRequest(id, {
        status,
        reviewNote: reviewNote[id]?.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      showSuccess('Security review completed.');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.unlockExamTerm(id, { reason }),
    onSuccess: () => {
      invalidate();
      setUnlockForm((current) => ({ ...current, reason: '' }));
      setShowUnlockConfirm(false);
      showSuccess('Exam term unlocked. Teachers can edit these marks again.');
    },
  });

  const pendingRequests = (requestsQuery.data ?? []).filter(
    (request) => request.status === 'PENDING',
  );

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Security Overview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
           <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">Security &amp; Locks</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Exam data integrity control.</p>
           </div>
           {successMessage && (
             <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-lg shadow-emerald-500/5">
                <CheckCircle2 size={18} />
                <span className="text-xs font-black uppercase tracking-widest">{successMessage}</span>
             </div>
           )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Context</label>
              <select value={filters.examTermId} onChange={(e) => setFilters(c => ({ ...c, examTermId: e.target.value }))} className="premium-input bg-white">
                <option value="">All Exams</option>
                {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} {exam.isLocked ? '(Locked)' : '(Open)'}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Request Status</label>
              <select value={filters.status} onChange={(e) => setFilters(c => ({ ...c, status: e.target.value }))} className="premium-input bg-white">
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="UNLOCKED">Unlocked</option>
              </select>
           </div>
           <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                 <ShieldAlert size={20} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending Reviews</p>
                 <p className="text-xl font-black text-amber-900 tracking-tight">{pendingRequests.length}</p>
              </div>
           </div>
           <div className="p-4 rounded-2xl border border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-surface)] flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center shadow-sm">
                 <Lock size={20} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-[var(--color-mod-academics-accent)] uppercase tracking-widest">Locked Terms</p>
                 <p className="text-xl font-black text-[var(--color-mod-academics-text)] tracking-tight">{exams.filter(e => e.isLocked).length}</p>
              </div>
           </div>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
         {/* Request Review */}
         <section className="group relative rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:border-[var(--color-mod-academics-border)] hover:shadow-sm overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <ShieldCheck size={120} />
            </div>
            <div className="mb-8">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-accent)] mb-4 transition-transform group-hover:rotate-12">
                  <ShieldCheck size={24} />
               </div>
               <h3 className="text-base font-bold text-slate-900">Request Integrity Check</h3>
               <p className="mt-1 text-sm text-slate-500">Submit for administrative review.</p>
            </div>

            <div className="space-y-4">
               <select value={requestForm.examTermId} onChange={(e) => setRequestForm(c => ({ ...c, examTermId: e.target.value }))} className="premium-input bg-slate-50">
                 <option value="">Select Exam</option>
                 {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} {exam.isLocked ? '(Locked)' : '(Open)'}</option>)}
               </select>

               {selectedRequestExam && (
                 <div className={cn(
                   "p-3 rounded-xl border flex items-center gap-3 transition-colors",
                   selectedRequestExam.isLocked ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                 )}>
                    {selectedRequestExam.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">Currently {selectedRequestExam.isLocked ? 'Locked' : 'Open'}</span>
                 </div>
               )}

               <textarea 
                rows={3} 
                value={requestForm.reason} 
                onChange={(e) => setRequestForm(c => ({ ...c, reason: e.target.value }))} 
                placeholder="Reason for lock or correction request..."
                className="premium-input bg-slate-50 py-4 text-xs font-medium min-h-[100px]"
               />

               <button 
                onClick={() => createMutation.mutate(requestForm)}
                disabled={!requestForm.examTermId || !requestForm.reason.trim() || createMutation.isPending}
                className="w-full h-14 rounded-2xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-sm hover:bg-[var(--color-mod-academics-text)] active:scale-95 transition-all disabled:opacity-30"
               >
                 {createMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                 Submit for Audit
               </button>
            </div>
         </section>

         {/* Unlock Bypass */}
         <section className="group relative rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:border-amber-200 hover:shadow-sm overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Unlock size={120} className="text-amber-500" />
            </div>
            <div className="mb-8">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 transition-transform group-hover:-rotate-12">
                  <Unlock size={24} />
               </div>
               <h3 className="text-base font-bold text-slate-900">Unlock Exam Term</h3>
               <p className="mt-1 text-sm text-slate-500">Reopen a locked exam term (authorized only).</p>
            </div>

            <div className="space-y-4">
               <select value={unlockForm.examTermId} onChange={(e) => setUnlockForm(c => ({ ...c, examTermId: e.target.value }))} className="premium-input bg-slate-50">
                 <option value="">Locked Exam Term</option>
                 {exams.filter(e => e.isLocked).map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
               </select>

               <textarea 
                rows={3} 
                value={unlockForm.reason} 
                onChange={(e) => setUnlockForm(c => ({ ...c, reason: e.target.value }))} 
                placeholder="Reason for unlocking (Mandatory)..."
                className="premium-input bg-slate-50 py-4 text-xs font-medium min-h-[100px]"
               />

               <button
                type="button"
                onClick={() => setShowUnlockConfirm(true)}
                disabled={!unlockForm.examTermId || !unlockForm.reason.trim() || unlockMutation.isPending}
                className="w-full h-14 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-sm hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-30"
               >
                 {unlockMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
                 Unlock Exam Term
               </button>
            </div>
         </section>
      </div>

      {/* Audit History */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
         <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
            <div className="h-10 w-10 rounded-2xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center shadow-sm">
               <History size={20} />
            </div>
            <div>
               <h3 className="text-base font-bold text-slate-900">Security Log History</h3>
               <p className="mt-1 text-sm text-slate-500">Audit trail of all lock operations.</p>
            </div>
         </div>

         <div className="p-8 grid gap-6">
            {requestsQuery.isLoading ? (
               <div className="py-20 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[var(--color-mod-academics-accent)] mx-auto opacity-20" />
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Audit Trail</p>
               </div>
            ) : (requestsQuery.data ?? []).length === 0 ? (
               <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No security events recorded</p>
               </div>
            ) : (requestsQuery.data ?? []).map((request) => (
               <article key={request.id} className="group relative rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-[var(--color-mod-academics-border)] hover:shadow-sm">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                     <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                             "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border flex items-center gap-1.5",
                             request.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                             request.status === 'REJECTED' ? "bg-rose-50 text-rose-600 border-rose-100" :
                             request.status === 'UNLOCKED' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                             "bg-amber-50 text-amber-600 border-amber-100"
                           )}>
                              {request.status === 'APPROVED' ? <CheckCircle2 size={10} /> : 
                               request.status === 'REJECTED' ? <XCircle size={10} /> : 
                               request.status === 'UNLOCKED' ? <Unlock size={10} /> : <Clock size={10} />}
                              {request.status}
                           </div>
                           <h4 className="text-sm font-bold text-slate-900">{request.examTerm?.name}</h4>
                        </div>
                        
                        <div className="flex items-start gap-3">
                           <div className="mt-1 h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                              <MessageSquare size={12} />
                           </div>
                           <div>
                              <p className="text-xs font-medium text-slate-600 leading-relaxed italic">&quot;{request.reason}&quot;</p>
                              <div className="flex items-center gap-4 mt-2">
                                 <div className="flex items-center gap-1.5">
                                    <User size={10} className="text-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{actorLabel(request.requestedBy)}</span>
                                 </div>
                                 <div className="flex items-center gap-1.5">
                                    <Clock size={10} className="text-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(request.createdAt)}</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {request.status === 'PENDING' && (
                        <div className="w-full lg:w-[320px] p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                           <textarea 
                            rows={2}
                            value={reviewNote[request.id] ?? ''} 
                            onChange={(e) => setReviewNote(c => ({ ...c, [request.id]: e.target.value }))} 
                            placeholder="Add review note..."
                            className="w-full bg-white rounded-xl border border-slate-100 p-3 text-[10px] font-medium focus:ring-4 focus:ring-[var(--color-mod-academics-border)] transition-all"
                           />
                           <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="flex-1"
                                onClick={() => reviewMutation.mutate({ id: request.id, status: 'APPROVED' })}
                                disabled={reviewMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => reviewMutation.mutate({ id: request.id, status: 'REJECTED' })}
                                disabled={reviewMutation.isPending}
                              >
                                Reject
                              </Button>
                           </div>
                        </div>
                     )}

                     {(request.reviewNote || request.reviewedAt) && (
                        <div className="w-full lg:w-[240px] p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                           <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Review Feedback</p>
                           {request.reviewNote && <p className="text-[10px] font-medium text-slate-600 italic">&quot;{request.reviewNote}&quot;</p>}
                           <div className="mt-2 flex flex-col gap-1">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">By {actorLabel(request.reviewedBy)}</span>
                              <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{formatDate(request.reviewedAt)}</span>
                           </div>
                        </div>
                     )}
                  </div>
               </article>
            ))}
         </div>
      </section>

      <ConfirmDialog
        isOpen={showUnlockConfirm}
        title="Unlock exam term"
        description={`This bypasses the security lock on ${selectedUnlockExam?.name || 'this exam term'} and allows marks to be corrected again. The action is recorded in the audit log.`}
        confirmLabel="Unlock Exam Term"
        variant="destructive"
        isConfirming={unlockMutation.isPending}
        onConfirm={() =>
          unlockMutation.mutate({ id: unlockForm.examTermId, reason: unlockForm.reason || undefined })
        }
        onClose={() => setShowUnlockConfirm(false)}
      />
    </div>
  );
}
