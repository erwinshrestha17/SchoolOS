'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';
import { 
  Trophy, 
  Search, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Info, 
  ChevronRight,
  ArrowDown,
  ArrowUp,
  User,
  MoreVertical,
  XCircle,
  FileText,
  Lock,
  Zap,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../../ui/badge';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  students: any[];
  exams: any[];
};

export function MarksEntryTab({ academicYears, classes, allSections, students, exams }: Props) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ examTermId: '', classId: '', sectionId: '', subjectId: '', assessmentComponentId: '' });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<number | null>(null);

  const subjectsQuery = useQuery({ 
    queryKey: ['subjects', filters.classId], 
    queryFn: () => api.listSubjects(),
    enabled: true
  });

  const componentsQuery = useQuery({
    queryKey: ['assessment-components', filters.examTermId, filters.subjectId],
    queryFn: () => api.listComponentsByExamTerm(filters.examTermId, { subjectId: filters.subjectId }),
    enabled: Boolean(filters.examTermId && filters.subjectId),
  });

  const existingMarksQuery = useQuery({
    queryKey: ['marks', filters],
    queryFn: () => api.listMarks(filters),
    enabled: Boolean(filters.examTermId && filters.classId && filters.assessmentComponentId),
  });

  const batchMut = useMutation({
    mutationFn: (payload: any) => api.batchEnterMarks(payload),
    onSuccess: (data) => {
      setSaveSuccess(data.updated);
      void queryClient.invalidateQueries({ queryKey: ['marks', filters] });
      setMarks({});
      setStatuses({});
      setRemarks({});
      setTimeout(() => setSaveSuccess(null), 5000);
    },
  });

  const selectedExam = exams.find((e) => e.id === filters.examTermId);
  const isLocked = selectedExam?.isLocked;
  const selectedComponent = componentsQuery.data?.find((c: any) => c.id === filters.assessmentComponentId);
  const maxMarks = selectedComponent ? Number(selectedComponent.maxMarks) : 100;
  const passMarks = selectedComponent ? Number(selectedComponent.passMarks) : null;

  const studentsForClass = useMemo(() => {
    return students.filter((s: any) => {
      const matchesClass = s.classId === filters.classId || s.class?.id === filters.classId;
      const matchesSection = !filters.sectionId || s.sectionId === filters.sectionId || s.section?.id === filters.sectionId;
      return matchesClass && matchesSection;
    });
  }, [students, filters.classId, filters.sectionId]);

  const changedEntries = useMemo(() => {
    const studentIds = new Set([...Object.keys(marks), ...Object.keys(statuses), ...Object.keys(remarks)]);
    return Array.from(studentIds).map(studentId => ({
      studentId,
      marksObtained: marks[studentId] ? Number(marks[studentId]) : undefined,
      isAbsent: statuses[studentId] === 'ABSENT' || statuses[studentId] === 'EXCUSED',
      isWithheld: statuses[studentId] === 'WITHHELD',
      remarks: remarks[studentId] || undefined,
    }));
  }, [marks, statuses, remarks]);

  const canSave = changedEntries.length > 0 && !batchMut.isPending && !isLocked;

  const handleSave = () => {
    if (!canSave) return;
    batchMut.mutate({
      examTermId: filters.examTermId,
      assessmentComponentId: filters.assessmentComponentId,
      classId: filters.classId,
      sectionId: filters.sectionId || undefined,
      subjectId: filters.subjectId,
      entries: changedEntries,
    });
  };

  const getExistingMark = (existing: any[] | undefined, studentId: string) => {
    return existing?.find((m: any) => m.studentId === studentId);
  };

  const statusOptions = [
    { value: 'PRESENT', label: 'P', color: 'text-emerald-600 bg-emerald-50' },
    { value: 'ABSENT', label: 'A', color: 'text-rose-600 bg-rose-50' },
    { value: 'WITHHELD', label: 'W', color: 'text-amber-600 bg-amber-50' },
    { value: 'EXCUSED', label: 'E', color: 'text-blue-600 bg-blue-50' },
  ];

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Quick Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Term</label>
            <select 
              data-testid="filter-exam-term"
              value={filters.examTermId} 
              onChange={(e) => setFilters(c => ({ ...c, examTermId: e.target.value, assessmentComponentId: '' }))}
              className="premium-input bg-white"
            >
              <option value="">Select Exam</option>
              {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.isLocked ? ' 🔒' : ''}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Class</label>
            <select 
              data-testid="filter-class"
              value={filters.classId} 
              onChange={(e) => setFilters(c => ({ ...c, classId: e.target.value, sectionId: '' }))}
              className="premium-input bg-white"
            >
              <option value="">Select Class</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Subject</label>
            <select 
              data-testid="filter-subject"
              value={filters.subjectId} 
              onChange={(e) => setFilters(c => ({ ...c, subjectId: e.target.value, assessmentComponentId: '' }))}
              className="premium-input bg-white"
            >
              <option value="">Select Subject</option>
              {subjectsQuery.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Component</label>
            <select 
              data-testid="filter-component"
              value={filters.assessmentComponentId} 
              onChange={(e) => setFilters(c => ({ ...c, assessmentComponentId: e.target.value }))}
              className="premium-input bg-white"
            >
              <option value="">Select Component</option>
              {componentsQuery.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.maxMarks})</option>)}
            </select>
          </div>
          <div className="flex gap-2">
             <button 
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mod-academics-accent)] text-white shadow-sm transition-colors hover:bg-[var(--color-mod-academics-text)]"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['marks', filters] })}
             >
                <Search size={20} />
             </button>
             <button 
              className={cn(
                "flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-all active:scale-95",
                canSave ? "bg-[var(--color-mod-academics-accent)] text-white shadow-sm hover:bg-[var(--color-mod-academics-text)]" : "bg-slate-100 text-slate-300 pointer-events-none"
              )}
              onClick={handleSave}
             >
                {batchMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {batchMut.isPending ? 'Saving' : `Save ${changedEntries.length > 0 ? changedEntries.length : ''}`}
             </button>
          </div>
        </div>
      </section>

      {saveSuccess !== null && (
        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center justify-between shadow-lg shadow-emerald-500/5 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                 <CheckCircle2 size={24} />
              </div>
              <div>
                 <p className="text-sm font-black text-emerald-900 tracking-tight">Sync Complete</p>
                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Successfully saved {saveSuccess} entries.</p>
              </div>
           </div>
           <button 
            onClick={() => setSaveSuccess(null)}
            className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-600 transition-colors"
           >
              Dismiss
           </button>
        </div>
      )}

      {isLocked && (
        <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-center gap-4 text-amber-800 animate-in fade-in duration-500">
          <Lock size={24} className="text-amber-500" />
          <div>
            <p className="text-sm font-black tracking-tight uppercase">Operational Lock Active</p>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">Contact the academic coordinator to request an unlock for this exam term.</p>
          </div>
        </div>
      )}

      {filters.assessmentComponentId ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-16">#</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Student Info</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-24 text-center">Roll</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-32 text-center">Status</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-32 text-center">Existing</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-48">Score Entry</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {existingMarksQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                       <Loader2 className="h-10 w-10 animate-spin text-primary-500 mx-auto opacity-20" />
                       <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fetching Student Roster</p>
                    </td>
                  </tr>
                ) : studentsForClass.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400">
                       <Users className="h-12 w-12 mx-auto mb-4 opacity-10" />
                       <p className="text-xs font-black uppercase tracking-widest">No Students Found</p>
                    </td>
                  </tr>
                ) : (
                  studentsForClass.map((student, index) => {
                    const existing = getExistingMark(existingMarksQuery.data, student.id);
                    const currentValue = marks[student.id] ?? '';
                    const currentStatus = statuses[student.id] || existing?.status || 'SUBMITTED';
                    const numericValue = currentValue.trim() === '' ? null : Number(currentValue);
                    const isInvalid = numericValue !== null && (numericValue < 0 || numericValue > maxMarks);
                    const passed = passMarks === null || (existing && Number(existing.marksObtained) >= passMarks);

                    return (
                      <tr key={student.id} className={cn(
                        "group transition-all hover:bg-slate-50/50",
                        isLocked && "opacity-60 pointer-events-none"
                      )}>
                        <td className="py-4 px-6 text-[10px] font-black text-slate-300">{index + 1}</td>
                        <td className="py-4 px-6">
                           <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                                 <User size={18} />
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-900 italic uppercase tracking-tight">{student.fullNameEn || student.fullName}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.studentSystemId}</span>
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center text-xs font-black text-slate-700 tracking-tighter">{student.rollNumber ?? '—'}</td>
                        <td className="py-4 px-6">
                           <div className="flex items-center justify-center gap-1">
                              {statusOptions.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setStatuses(c => ({ ...c, [student.id]: opt.value }))}
                                  className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all active:scale-90",
                                    currentStatus === opt.value ? opt.color : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                                  )}
                                  title={opt.value}
                                >
                                  {opt.label}
                                </button>
                              ))}
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                           {existing ? (
                             <div className="flex flex-col items-center">
                                <span className={cn(
                                  "text-sm font-black tracking-tighter",
                                  passed ? "text-emerald-600" : "text-rose-600"
                                )}>
                                   {Number(existing.marksObtained)}
                                </span>
                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Saved Score</span>
                             </div>
                           ) : (
                             <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Pending</span>
                           )}
                        </td>
                        <td className="py-4 px-6">
                           <div className="relative">
                              <input
                                id={`mark-input-${index}`}
                                type="number"
                                min={0}
                                max={maxMarks}
                                value={currentValue}
                                disabled={isLocked || currentStatus === 'ABSENT'}
                                placeholder={existing ? String(Number(existing.marksObtained)) : '0.0'}
                                className={cn(
                                  "w-full rounded-2xl border px-4 py-3 text-sm font-black transition-all focus:ring-4 text-center tracking-tighter",
                                  isInvalid 
                                    ? "border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-100" 
                                    : "border-slate-100 bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-primary-100",
                                  currentStatus === 'ABSENT' && "bg-slate-100 border-transparent text-slate-300 cursor-not-allowed"
                                )}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMarks(c => ({ ...c, [student.id]: val }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    document.getElementById(`mark-input-${index + 1}`)?.focus();
                                  }
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    document.getElementById(`mark-input-${index - 1}`)?.focus();
                                  }
                                }}
                              />
                              {isInvalid && (
                                <AlertCircle size={14} className="absolute -right-6 top-1/2 -translate-y-1/2 text-rose-500" />
                              )}
                           </div>
                        </td>
                        <td className="py-4 px-6">
                           <input
                            type="text"
                            value={remarks[student.id] ?? existing?.remarks ?? ''}
                            disabled={isLocked}
                            placeholder="Add observation..."
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-medium focus:bg-white focus:border-primary-400 transition-all"
                            onChange={(e) => setRemarks(c => ({ ...c, [student.id]: e.target.value }))}
                           />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 p-4">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-[var(--color-mod-academics-accent)]" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Roster: {studentsForClass.length}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Draft Entries: {changedEntries.length}</span>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mod-academics-border)] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-text)]">
                   <Zap size={14} className="text-[var(--color-mod-academics-accent)]" />
                   Keyboard Mode Active
                </div>
             </div>
          </div>
        </div>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-300">
             <Trophy size={40} />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Roster Ready</h3>
          <p className="mt-2 text-sm font-bold text-slate-400 max-w-sm mx-auto leading-relaxed">
            Select context to begin. Choose an exam term, class, and assessment component above to load the mark entry grid.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Fast Entry</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Auto-Sync</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Operational Logs</div>
          </div>
        </section>
      )}
    </div>
  );
}
