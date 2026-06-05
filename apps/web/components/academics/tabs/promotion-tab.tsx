'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../../lib/api';
import type { PromotionReadiness } from '@schoolos/core';
import { 
  GraduationCap, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  ShieldCheck, 
  Info,
  Calendar,
  Layers,
  Zap,
  Users,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Toast, ToastTone } from '@/components/ui/toast';

type PromotionNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
};

export function PromotionTab({ academicYears, classes, allSections }: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];
  const nextYear = academicYears.find(
    (y: any) => y.id !== currentYear?.id && new Date(y.startsAt) > new Date(currentYear?.startsAt)
  ) ?? academicYears[1];

  const [promo, setPromo] = useState({
    academicYearId: currentYear?.id ?? '',
    targetAcademicYearId: nextYear?.id ?? '',
    fromClassId: '',
    toClassId: '',
    toSectionId: '',
    remarks: 'Promoted to next class',
  });

  const [filters, setFilters] = useState({ sectionId: '', status: '', search: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<PromotionNotice | null>(null);

  const readinessQuery = useQuery({
    queryKey: ['promotion-readiness', promo.academicYearId, promo.fromClassId, filters.sectionId, filters.status],
    queryFn: () => api.listPromotionReadiness({
      academicYearId: promo.academicYearId,
      classId: promo.fromClassId,
      sectionId: filters.sectionId || undefined,
      status: (filters.status as any) || undefined,
    }),
    enabled: Boolean(promo.academicYearId && promo.fromClassId),
  });

  const students = useMemo(() => {
    const data = readinessQuery.data ?? [];
    if (!filters.search) return data;
    const s = filters.search.toLowerCase();
    return data.filter(st => st.studentName.toLowerCase().includes(s) || st.studentSystemId.toLowerCase().includes(s));
  }, [readinessQuery.data, filters.search]);

  const fromSections = useMemo(() => allSections.filter((s: any) => s.classId === promo.fromClassId), [allSections, promo.fromClassId]);
  const toSectionsForClass = useMemo(() => allSections.filter((s: any) => s.classId === promo.toClassId), [allSections, promo.toClassId]);

  const batchPromoteMut = useMutation({
    mutationFn: api.batchPromote,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      setNotice({
        title: 'Promotion complete',
        description: `${data.summary.promoted} promoted, ${data.summary.skipped} skipped.`,
        tone: 'success',
      });
      setConfirmOpen(false);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not complete promotion',
        description: error.message || 'Promotion failed.',
        tone: 'danger',
      });
    },
  });

  const handleBatchPromote = () => {
    if (selectedIds.size === 0) return;
    const readyCount = students.filter(s => selectedIds.has(s.studentId) && s.status === 'READY').length;
    
    if (readyCount === 0) {
      setNotice({
        title: 'No eligible students selected',
        description: 'Fix missing marks or dues before promotion.',
        tone: 'warning',
      });
      return;
    }

    setConfirmOpen(true);
  };

  const confirmBatchPromote = () => {
    batchPromoteMut.mutate({
      academicYearId: promo.academicYearId,
      targetAcademicYearId: promo.targetAcademicYearId,
      remarks: promo.remarks,
      classMappings: [{
        fromClassId: promo.fromClassId,
        toClassId: promo.toClassId,
        toSectionId: promo.toSectionId || undefined,
        studentIds: Array.from(selectedIds),
      }],
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map(s => s.studentId)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

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

      {/* Promotion Config */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
           <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">Year-End Promotion</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Batch Student Lifecycle Transition</p>
           </div>
           <button 
            onClick={handleBatchPromote}
            disabled={selectedIds.size === 0 || batchPromoteMut.isPending}
            className="h-12 px-8 rounded-2xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-[var(--color-mod-academics-text)] transition-all active:scale-95 disabled:opacity-30"
           >
              {batchPromoteMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              Execute Promotion ({selectedIds.size})
           </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
           <div className="space-y-6 p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                    <Users size={14} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source Configuration</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">From Year</label>
                    <select value={promo.academicYearId} onChange={(e) => setPromo(c => ({ ...c, academicYearId: e.target.value }))} className="premium-input bg-slate-50 border-slate-100">
                      {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">From Class</label>
                    <select value={promo.fromClassId} onChange={(e) => setPromo(c => ({ ...c, fromClassId: e.target.value, toClassId: '' }))} className="premium-input bg-slate-50 border-slate-100">
                      <option value="">Select Class</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
              </div>
           </div>

           <div className="space-y-6 p-8 rounded-2xl bg-[var(--color-mod-academics-surface)] border border-[var(--color-mod-academics-border)] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <div className="h-6 w-6 rounded-lg bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center shadow-sm">
                    <ArrowRight size={14} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-accent)]">Destination Target</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">To Year</label>
                    <select value={promo.targetAcademicYearId} onChange={(e) => setPromo(c => ({ ...c, targetAcademicYearId: e.target.value }))} className="premium-input bg-white">
                      {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">To Class</label>
                    <select value={promo.toClassId} onChange={(e) => setPromo(c => ({ ...c, toClassId: e.target.value, toSectionId: '' }))} className="premium-input bg-white">
                      <option value="">Target Class</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">Section</label>
                    <select value={promo.toSectionId} onChange={(e) => setPromo(c => ({ ...c, toSectionId: e.target.value }))} className="premium-input bg-white">
                      <option value="">Auto-Assign</option>
                      {toSectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Readiness Roster */}
      {promo.fromClassId ? (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-accent)] flex items-center justify-center">
                   <ShieldCheck size={20} />
                </div>
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic text-[18px]">Readiness Registry</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Pre-promotion validation checks</p>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <div className="relative w-64">
                   <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                    type="text" 
                    placeholder="Filter roster..." 
                    value={filters.search} 
                    onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                    className="premium-input pl-10 h-10 text-[10px]"
                   />
                </div>
                <select 
                  value={filters.status} 
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                  className="premium-input h-10 w-40 text-[10px] bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="READY">Ready</option>
                  <option value="REVIEW">Review</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-100">
                   <th className="py-4 px-8 w-12">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.size === students.length && students.length > 0} 
                        onChange={toggleSelectAll}
                        className="h-5 w-5 rounded-lg border-slate-200 text-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-accent)]"
                      />
                   </th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Student Identity</th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Academic Standing</th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Finance Map</th>
                   <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Readiness Status</th>
                   <th className="py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 text-right">Checks</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {readinessQuery.isLoading ? (
                   <tr>
                      <td colSpan={6} className="py-20 text-center">
                         <Loader2 className="h-10 w-10 animate-spin text-primary-500 mx-auto opacity-20" />
                         <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Validating Readiness Map</p>
                      </td>
                   </tr>
                 ) : students.length === 0 ? (
                   <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-300">
                         <Info className="h-12 w-12 mx-auto mb-4 opacity-10" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No students match current scope</p>
                      </td>
                   </tr>
                 ) : students.map((s) => {
                   const isReady = s.status === 'READY';
                   return (
                     <tr key={s.studentId} className={cn(
                       "group transition-all hover:bg-slate-50/50",
                       selectedIds.has(s.studentId) && "bg-[var(--color-mod-academics-surface)]"
                     )}>
                       <td className="py-4 px-8">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(s.studentId)} 
                            onChange={() => toggleSelect(s.studentId)}
                            className="h-5 w-5 rounded-lg border-slate-200 text-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-accent)]"
                          />
                       </td>
                       <td className="py-4 px-6">
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{s.studentName}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.studentSystemId}</span>
                          </div>
                       </td>
                       <td className="py-4 px-6 text-center">
                          <div className="inline-flex flex-col items-center">
                             <span className="text-sm font-black text-slate-900 tracking-tighter italic">{s.grade}</span>
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">GPA {s.gpa.toFixed(2)}</span>
                          </div>
                       </td>
                       <td className="py-4 px-6 text-center">
                          {s.outstandingBalance > 0 ? (
                             <div className="inline-flex flex-col items-center">
                                <span className="text-xs font-black text-rose-600 tracking-tight">Rs {s.outstandingBalance.toLocaleString()}</span>
                                <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Uncleared Dues</span>
                             </div>
                          ) : (
                             <div className="inline-flex flex-col items-center">
                                <span className="text-xs font-black text-emerald-600 tracking-tight">Cleared</span>
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Audit Passed</span>
                             </div>
                          )}
                       </td>
                       <td className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                             <div className={cn(
                               "inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                               s.status === 'READY' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                               s.status === 'REVIEW' ? "bg-amber-50 text-amber-600 border-amber-100" :
                               "bg-rose-50 text-rose-600 border-rose-100"
                             )}>
                                {s.status === 'READY' ? <CheckCircle2 size={10} /> : s.status === 'REVIEW' ? <AlertCircle size={10} /> : <XCircle size={10} />}
                                {s.status}
                             </div>
                             {s.reasons.length > 0 && (
                               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-none ml-1">{s.reasons[0]}</p>
                             )}
                          </div>
                       </td>
                       <td className="py-4 px-8 text-right">
                          <div className="flex items-center justify-end gap-2">
                             {!isReady && (
                               <div className="h-8 w-8 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center" title="Pre-checks failed">
                                  <Lock size={14} />
                               </div>
                             )}
                             <button 
                              className="h-8 px-4 rounded-xl bg-[var(--color-mod-academics-surface)] text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-accent)] hover:bg-[var(--color-mod-academics-accent)] hover:text-white transition-all active:scale-95"
                              onClick={() => {
                                // Scroll to marks/results if review needed
                              }}
                             >
                                Details
                             </button>
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
                   <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-accent)]">Total Eligible: {students.filter(s => s.status === 'READY').length}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-rose-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Blocked: {students.filter(s => s.status === 'BLOCKED').length}</span>
                </div>
             </div>
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                Final Year-End Review Required
             </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
          <div className="h-16 w-16 rounded-2xl bg-[var(--color-mod-academics-surface)] flex items-center justify-center text-[var(--color-mod-academics-accent)] mx-auto mb-8 border border-[var(--color-mod-academics-border)]">
             <GraduationCap size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 italic uppercase tracking-tight">Readiness Map</h3>
          <p className="mt-2 text-sm font-bold text-slate-400 max-w-sm mx-auto leading-relaxed">
            Select a class above to analyze student eligibility for promotion to the next academic year.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Auto-Check Dues</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Grade Validation</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Safety Guardrails</div>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Execute Promotion"
        description={`Promote ${students.filter(s => selectedIds.has(s.studentId) && s.status === 'READY').length} READY students? Any non-ready selections will be skipped by the backend workflow.`}
        confirmLabel="Promote Students"
        isConfirming={batchPromoteMut.isPending}
        onConfirm={confirmBatchPromote}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
