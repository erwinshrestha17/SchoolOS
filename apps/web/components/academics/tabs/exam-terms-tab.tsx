'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { 
  Calendar, 
  Layers, 
  Plus, 
  Trash2, 
  CalendarCheck, 
  Trophy, 
  Info,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/ui/section-card';

type Props = {
  academicYears: any[];
  subjects: any[];
  exams: any[];
};

const today = new Date().toISOString().slice(0, 10);

export function ExamTermsTab({ academicYears, subjects, exams }: Props) {
  const queryClient = useQueryClient();
  const [exam, setExam] = useState({ academicYearId: '', name: '', startsOn: today, endsOn: today, weightPercent: 100 });
  const [comp, setComp] = useState({ examTermId: '', subjectId: '', name: 'Theory', type: 'TERMINAL', maxMarks: 100, weightPercent: 100, passMarks: 35 });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
  };

  const examMut = useMutation({ 
    mutationFn: api.createExamTerm, 
    onSuccess: () => {
      invalidate();
      setExam({ academicYearId: '', name: '', startsOn: today, endsOn: today, weightPercent: 100 });
    } 
  });
  
  const compMut = useMutation({ 
    mutationFn: api.createAssessmentComponent, 
    onSuccess: () => {
      invalidate();
      setComp({ examTermId: '', subjectId: '', name: 'Theory', type: 'TERMINAL', maxMarks: 100, weightPercent: 100, passMarks: 35 });
    } 
  });

  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create Exam Term */}
        <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[var(--color-mod-academics-border)]">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-mod-academics-bg)] text-[var(--color-mod-academics-accent)]">
              <Calendar size={24} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Create Exam Term</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Set up terminal boundaries.</p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Academic Year</label>
              <select 
                value={exam.academicYearId || currentYear?.id || ''} 
                onChange={(e) => setExam((c) => ({ ...c, academicYearId: e.target.value }))}
                className="premium-input bg-slate-50 border-slate-100"
              >
                <option value="">Select year</option>
                {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Title</label>
              <input 
                value={exam.name} 
                onChange={(e) => setExam((c) => ({ ...c, name: e.target.value }))} 
                placeholder="e.g. First Terminal, Mid-Term" 
                className="premium-input bg-slate-50 border-slate-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Starts On</label>
                <input 
                  type="date" 
                  value={exam.startsOn} 
                  onChange={(e) => setExam((c) => ({ ...c, startsOn: e.target.value }))} 
                  className="premium-input bg-slate-50 border-slate-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ends On</label>
                <input 
                  type="date" 
                  value={exam.endsOn} 
                  onChange={(e) => setExam((c) => ({ ...c, endsOn: e.target.value }))} 
                  className="premium-input bg-slate-50 border-slate-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Weight %</label>
                <input 
                  type="number" 
                  value={exam.weightPercent} 
                  onChange={(e) => setExam((c) => ({ ...c, weightPercent: Number(e.target.value) }))} 
                  placeholder="100" 
                  className="premium-input bg-slate-50 border-slate-100 font-black tracking-tighter"
                />
              </div>
            </div>

            <button 
              type="button" 
              className="mt-4 flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[var(--color-mod-academics-accent)] px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-[var(--color-mod-academics-text)] disabled:opacity-50"
              disabled={!exam.name || examMut.isPending} 
              onClick={() => examMut.mutate({ ...exam, academicYearId: exam.academicYearId || currentYear?.id, startsOn: new Date(exam.startsOn).toISOString(), endsOn: new Date(exam.endsOn).toISOString() })}
            >
              {examMut.isPending ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              Initialize Exam Term
            </button>
            {examMut.isError && <p className="text-xs font-bold text-red-600 mt-2 flex items-center gap-1"><AlertCircle size={12} /> {examMut.error.message}</p>}
          </div>
        </div>

        {/* Add Assessment Component */}
        <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[var(--color-mod-academics-border)]">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-mod-academics-bg)] text-[var(--color-mod-academics-accent)]">
              <Layers size={24} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Add Component</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Define evaluation metrics.</p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Term</label>
                <select 
                  value={comp.examTermId} 
                  onChange={(e) => setComp((c) => ({ ...c, examTermId: e.target.value }))}
                  className="premium-input bg-slate-50 border-slate-100"
                >
                  <option value="">Select term</option>
                  {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.isLocked ? ' 🔒' : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Subject</label>
                <select 
                  value={comp.subjectId} 
                  onChange={(e) => setComp((c) => ({ ...c, subjectId: e.target.value }))}
                  className="premium-input bg-slate-50 border-slate-100"
                >
                  <option value="">Select subject</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Component Label</label>
              <input 
                value={comp.name} 
                onChange={(e) => setComp((c) => ({ ...c, name: e.target.value }))} 
                placeholder="e.g. Theory, Practical, Viva" 
                className="premium-input bg-slate-50 border-slate-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Max Marks</label>
                <input 
                  type="number" 
                  value={comp.maxMarks} 
                  onChange={(e) => setComp((c) => ({ ...c, maxMarks: Number(e.target.value) }))} 
                  placeholder="100" 
                  className="premium-input bg-slate-50 border-slate-100 font-black tracking-tighter"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Pass Marks</label>
                <input 
                  type="number" 
                  value={comp.passMarks} 
                  onChange={(e) => setComp((c) => ({ ...c, passMarks: Number(e.target.value) }))} 
                  placeholder="35" 
                  className="premium-input bg-slate-50 border-slate-100 font-black tracking-tighter"
                />
              </div>
            </div>

            <button 
              type="button" 
              className="mt-4 flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[var(--color-mod-academics-accent)] px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-[var(--color-mod-academics-text)] disabled:opacity-50"
              disabled={!comp.examTermId || !comp.subjectId || !comp.name || compMut.isPending} 
              onClick={() => compMut.mutate(comp)}
            >
              {compMut.isPending ? <Loader2 className="animate-spin" size={20} /> : <Layers size={20} />}
              Add Assessment Map
            </button>
            {compMut.isError && <p className="text-xs font-bold text-red-600 mt-2 flex items-center gap-1"><AlertCircle size={12} /> {compMut.error.message}</p>}
          </div>
        </div>
      </div>

      {/* Exam Terms list */}
      <section>
        <div className="flex items-center gap-4 mb-8">
           <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <CalendarCheck size={20} />
           </div>
           <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic">Operational Registry</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Existing Exam Definitions</p>
           </div>
           <div className="h-px flex-1 bg-slate-100" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {exams.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 py-20 text-slate-400">
               <Info className="h-12 w-12 mb-4 opacity-10" />
               <p className="text-xs font-black uppercase tracking-widest">No Exam Terms Found</p>
               <p className="mt-2 text-[10px] font-bold">Initialize your first exam term above to begin.</p>
            </div>
          ) : exams.map((e: any) => (
            <div key={e.id} className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[var(--color-mod-academics-border)]">
              <div className="flex items-start justify-between mb-6">
                <div className="space-y-1">
                  <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 italic leading-none">{e.name}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.academicYear?.name ?? 'Year'}</p>
                </div>
                <div className={cn(
                  "h-8 px-3 rounded-full flex items-center justify-center text-[8px] font-black uppercase tracking-widest border",
                  e.isLocked ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}>
                  {e.isLocked ? 'Locked' : 'Open'}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                 <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <Clock size={12} />
                    {new Date(e.startsOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                 </div>
                 <div className="h-px w-3 bg-slate-200" />
                 <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {new Date(e.endsOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                 </div>
                 <div className="ml-auto text-sm font-black text-indigo-600 tracking-tighter">
                   {e.weightPercent}%
                 </div>
              </div>

              {(e.components?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300 ml-1">Assessment Components</p>
                  <div className="grid gap-2">
                    {e.components.map((c: any) => (
                      <div key={c.id} className="group/item flex items-center justify-between rounded-2xl bg-slate-50/50 border border-transparent p-4 transition-all hover:bg-white hover:border-slate-100 hover:shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover/item:text-violet-500 transition-colors">
                              <Trophy size={14} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{c.subject?.name ?? 'Subject'}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{c.name}</span>
                           </div>
                        </div>
                        <div className="text-right">
                           <span className="text-xs font-black text-slate-700 tracking-tighter">{Number(c.maxMarks)}</span>
                           <span className="text-[8px] font-black text-slate-300 uppercase block">Max</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 rounded-2xl bg-slate-50/50 border border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                   <Plus size={20} className="mb-2 opacity-20" />
                   <p className="text-[8px] font-black uppercase tracking-[0.2em]">Map Components</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Loader2({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      className={cn("animate-spin", className)} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
