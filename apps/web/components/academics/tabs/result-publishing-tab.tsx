'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../../lib/api';
import type { ResultPublishingReadiness } from '@schoolos/core';
import { 
  Megaphone, 
  Search, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  Bell,
  Clock,
  Info,
  ShieldCheck,
  Send,
  Lock,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Toast, ToastTone } from '@/components/ui/toast';

type ResultDeliveryNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

type ConfirmAction = 'publish' | 'notify';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  exams: any[];
};

export function ResultPublishingTab({
  academicYears,
  classes,
  allSections,
  exams,
}: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  const [selection, setSelection] = useState({
    academicYearId: currentYear?.id ?? '',
    examTermId: '',
    classId: '',
    sectionId: '',
    status: '',
    search: '',
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [notice, setNotice] = useState<ResultDeliveryNotice | null>(null);

  const publishingQuery = useQuery({
    queryKey: ['result-publishing-readiness', selection.academicYearId, selection.examTermId, selection.classId, selection.sectionId, selection.status],
    queryFn: () => api.listResultPublishingReadiness({
      academicYearId: selection.academicYearId,
      examTermId: selection.examTermId,
      classId: selection.classId || undefined,
      sectionId: selection.sectionId || undefined,
      status: selection.status || undefined,
    }),
    enabled: Boolean(selection.academicYearId && selection.examTermId),
  });

  const records = useMemo(() => {
    const data = publishingQuery.data ?? [];
    if (!selection.search) return data;
    const s = selection.search.toLowerCase();
    return data.filter(r => r.studentName.toLowerCase().includes(s) || r.studentSystemId.toLowerCase().includes(s));
  }, [publishingQuery.data, selection.search]);

  const sectionsForClass = useMemo(() => allSections.filter((s: any) => s.classId === selection.classId), [allSections, selection.classId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['result-publishing-readiness'] });
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
  };

  const publishMut = useMutation({
    mutationFn: api.publishResults,
    onSuccess: (data) => {
      invalidate();
      setNotice({
        title: 'Results published',
        description: `${data.published} results are now visible to student and parent dashboards.`,
        tone: 'success',
      });
      setConfirmAction(null);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not publish results',
        description: error.message || 'Publishing failed.',
        tone: 'danger',
      });
    },
  });

  const unpublishMut = useMutation({
    mutationFn: api.unpublishResults,
    onSuccess: () => {
      invalidate();
      setNotice({
        title: 'Results unpublished',
        description: 'Selected results were removed from dashboards.',
        tone: 'success',
      });
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not unpublish results',
        description: error.message || 'Unpublish failed.',
        tone: 'danger',
      });
    },
  });

  const notifyMut = useMutation({
    mutationFn: api.notifyResults,
    onSuccess: () => {
      setNotice({
        title: 'Guardian notifications queued',
        description: 'Push notifications and emails were queued.',
        tone: 'success',
      });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not queue notifications',
        description: error.message || 'Notification queueing failed.',
        tone: 'danger',
      });
    },
  });

  const handleBatchPublish = () => {
    if (selectedIds.size === 0) return;
    const publishable = records.filter(r => selectedIds.has(r.reportCardId) && r.reportStatus === 'LOCKED' && r.publishStatus !== 'PUBLISHED');
    
    if (publishable.length === 0) {
      setNotice({
        title: 'No publishable results selected',
        description: 'Report cards must be LOCKED before publishing.',
        tone: 'warning',
      });
      return;
    }

    setConfirmAction('publish');
  };

  const confirmBatchPublish = () => {
    const publishable = records.filter(r => selectedIds.has(r.reportCardId) && r.reportStatus === 'LOCKED' && r.publishStatus !== 'PUBLISHED');
    publishMut.mutate({ reportCardIds: publishable.map(r => r.reportCardId) });
  };

  const handleBatchNotify = () => {
    if (selectedIds.size === 0) return;
    const notified = records.filter(r => selectedIds.has(r.reportCardId) && r.publishStatus === 'PUBLISHED');
    
    if (notified.length === 0) {
      setNotice({
        title: 'No published results selected',
        description: 'Only PUBLISHED results can notify guardians.',
        tone: 'warning',
      });
      return;
    }

    setConfirmAction('notify');
  };

  const confirmBatchNotify = () => {
    const notified = records.filter(r => selectedIds.has(r.reportCardId) && r.publishStatus === 'PUBLISHED');
    notifyMut.mutate({ reportCardIds: notified.map(r => r.reportCardId) });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(records.map(r => r.reportCardId)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const publishableCount = records.filter(
    r => selectedIds.has(r.reportCardId) && r.reportStatus === 'LOCKED' && r.publishStatus !== 'PUBLISHED',
  ).length;
  const notifyCount = records.filter(
    r => selectedIds.has(r.reportCardId) && r.publishStatus === 'PUBLISHED',
  ).length;

  return (
    <div className="space-y-10 animate-fade-in">
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      {/* Configuration & High-Level Actions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
           <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Results Delivery</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Dashboard Visibility & Notifications</p>
           </div>
           <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleBatchNotify}
                disabled={selectedIds.size === 0 || notifyMut.isPending}
                className="h-12 px-6 rounded-2xl bg-white border border-slate-200 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-30"
              >
                {notifyMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Bell size={16} />}
                Notify Guardians
              </button>
              <button 
                onClick={handleBatchPublish}
                disabled={selectedIds.size === 0 || publishMut.isPending}
                className="h-12 px-8 rounded-2xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-[var(--color-mod-academics-text)] transition-all active:scale-95 disabled:opacity-30"
              >
                {publishMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                Publish Visibility ({selectedIds.size})
              </button>
           </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Academic Year</label>
              <select value={selection.academicYearId} onChange={(e) => setSelection(c => ({ ...c, academicYearId: e.target.value }))} className="premium-input bg-white">
                {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Term</label>
              <select value={selection.examTermId} onChange={(e) => setSelection(c => ({ ...c, examTermId: e.target.value }))} className="premium-input bg-white">
                <option value="">Select Term</option>
                {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Class</label>
              <select value={selection.classId} onChange={(e) => setSelection(c => ({ ...c, classId: e.target.value, sectionId: '' }))} className="premium-input bg-white">
                <option value="">All Classes</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Section</label>
              <select value={selection.sectionId} onChange={(e) => setSelection(c => ({ ...c, sectionId: e.target.value }))} className="premium-input bg-white">
                <option value="">All Sections</option>
                {sectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Status</label>
              <select value={selection.status} onChange={(e) => setSelection(c => ({ ...c, status: e.target.value }))} className="premium-input bg-white">
                <option value="">All Publish Status</option>
                <option value="PUBLISHED">Published</option>
                <option value="UNPUBLISHED">Unpublished</option>
              </select>
           </div>
        </div>
      </section>

      {/* Roster & Visibility Control */}
      {selection.examTermId ? (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-accent)] flex items-center justify-center">
                   <ShieldCheck size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold tracking-tight text-slate-950">Delivery Hub</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Control visibility to {records.length} students</p>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <div className="relative w-64">
                   <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                    type="text" 
                    placeholder="Search roster..." 
                    value={selection.search} 
                    onChange={(e) => setSelection(f => ({ ...f, search: e.target.value }))}
                    className="premium-input pl-10 h-10 text-[10px]"
                   />
                </div>
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-100">
                   <th className="py-4 px-8 w-12">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.size === records.length && records.length > 0} 
                        onChange={toggleSelectAll}
                        className="h-5 w-5 rounded-lg border-slate-200 text-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-accent)]"
                      />
                   </th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Student Identity</th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Academic Context</th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Score Summary</th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Report Card Status</th>
                   <th className="py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 text-right">Publishing</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {publishingQuery.isLoading ? (
                   <tr>
                      <td colSpan={6} className="py-20 text-center">
                         <Loader2 className="h-10 w-10 animate-spin text-[var(--color-mod-academics-accent)] mx-auto opacity-30" />
                         <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Analyzing Delivery Readiness</p>
                      </td>
                   </tr>
                 ) : records.length === 0 ? (
                   <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-300">
                         <Info className="h-12 w-12 mx-auto mb-4 opacity-10" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No results found for current filters</p>
                      </td>
                   </tr>
                 ) : records.map((r) => {
                   const isPublished = r.publishStatus === 'PUBLISHED';
                   const isLocked = r.reportStatus === 'LOCKED';
                   return (
                     <tr key={r.reportCardId} className={cn(
                       "group transition-all hover:bg-slate-50/50",
                       selectedIds.has(r.reportCardId) && "bg-[var(--color-mod-academics-surface)]"
                     )}>
                       <td className="py-4 px-8">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(r.reportCardId)} 
                            onChange={() => toggleSelect(r.reportCardId)}
                            className="h-5 w-5 rounded-lg border-slate-200 text-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-accent)]"
                          />
                       </td>
                       <td className="py-4 px-6">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-slate-900">{r.studentName}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.studentSystemId}</span>
                          </div>
                       </td>
                       <td className="py-4 px-6">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{r.className} {r.sectionName ? `/ ${r.sectionName}` : ''}</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{r.examTermName}</span>
                          </div>
                       </td>
                       <td className="py-4 px-6 text-center">
                          <div className="inline-flex flex-col items-center">
                             <span className="text-sm font-bold text-slate-900">{r.grade}</span>
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{r.percentage.toFixed(1)}%</span>
                          </div>
                       </td>
                       <td className="py-4 px-6 text-center">
                          <div className={cn(
                             "inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                             isLocked ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                             {isLocked ? <ShieldCheck size={10} className="mr-1" /> : <Clock size={10} className="mr-1" />}
                             {r.reportStatus}
                          </div>
                       </td>
                       <td className="py-4 px-8 text-right">
                          <div className="flex flex-col items-end gap-1">
                             <div className={cn(
                               "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                               isPublished ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-400"
                             )}>
                                {isPublished ? <Eye size={10} /> : <EyeOff size={10} />}
                                {r.publishStatus}
                             </div>
                             {r.publishedAt && (
                               <span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest">Released {new Date(r.publishedAt).toLocaleDateString()}</span>
                             )}
                          </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </div>
          
          <div className="border-t border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-surface)] p-6 flex flex-col gap-4 text-[var(--color-mod-academics-text)] md:flex-row md:items-center md:justify-between">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-[var(--color-mod-academics-accent)]" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-accent)]">Total Published: {records.filter(r => r.publishStatus === 'PUBLISHED').length}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-amber-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Awaiting Lock: {records.filter(r => r.reportStatus !== 'LOCKED').length}</span>
                </div>
             </div>
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                Finalized Results are visible to Parents
             </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
          <div className="h-16 w-16 rounded-2xl bg-[var(--color-mod-academics-surface)] flex items-center justify-center text-[var(--color-mod-academics-accent)] mx-auto mb-8 border border-[var(--color-mod-academics-border)]">
             <Megaphone size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-950 tracking-tight">Delivery Hub</h3>
          <p className="mt-2 text-sm font-bold text-slate-400 max-w-sm mx-auto leading-relaxed">
            Select an exam term to control result visibility and notify guardians of student performance.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Live Dashboard</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Push Notifications</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Audit Logs</div>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction === 'publish' ? 'Publish Result Visibility' : 'Notify Guardians'}
        description={
          confirmAction === 'publish'
            ? `Publish ${publishableCount} locked results to parent and student dashboards?`
            : `Queue result notifications for ${notifyCount} published results?`
        }
        confirmLabel={confirmAction === 'publish' ? 'Publish Results' : 'Notify Guardians'}
        isConfirming={publishMut.isPending || notifyMut.isPending}
        onConfirm={confirmAction === 'publish' ? confirmBatchPublish : confirmBatchNotify}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}
