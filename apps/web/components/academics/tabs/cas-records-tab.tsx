'use client';

import type {
  AcademicYearSummary,
  CasRecordSummary,
  ClassSummary,
  SectionSummary,
  StudentProfile,
  SubjectSummary,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useSession } from '../../session-provider';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  ClipboardCheck, 
  Info, 
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ChevronRight,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  students: StudentProfile[];
  subjects: SubjectSummary[];
};

type CasFormState = {
  academicYearId: string;
  subjectId: string;
  studentId: string;
  classId: string;
  sectionId: string;
  category: string;
  score: number;
  maxScore: number;
  observedOn: string;
  note: string;
};

type BatchDraft = Record<string, string>;

type StudentRosterRow = Omit<StudentProfile, 'section'> & {
  section?: { id: string; name?: string | null } | string | null;
};

const today = new Date().toISOString().slice(0, 10);

const casTemplates = [
  { category: 'Classwork', maxScore: 20, note: 'Classwork completion and effort' },
  { category: 'Homework', maxScore: 10, note: 'Homework quality and submission consistency' },
  { category: 'Project', maxScore: 25, note: 'Project work, creativity, and presentation' },
  { category: 'Presentation', maxScore: 15, note: 'Speaking confidence and clarity' },
  { category: 'Lab Work', maxScore: 20, note: 'Practical/lab participation and accuracy' },
  { category: 'Participation', maxScore: 10, note: 'Class participation and engagement' },
  { category: 'Discipline', maxScore: 10, note: 'Discipline, cooperation, and classroom behavior' },
  { category: 'Creative Work', maxScore: 20, note: 'Creative task and expression' },
  { category: 'Social Skills', maxScore: 10, note: 'Peer collaboration and social development' },
  { category: 'Other', maxScore: 10, note: '' },
] as const;

function getCurrentYear(academicYears: AcademicYearSummary[]) {
  return academicYears.find((year) => year.isCurrent) ?? academicYears[0];
}

function getStudentName(student: { firstNameEn?: string; lastNameEn?: string; studentSystemId: string }) {
  const fallbackName = `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim();
  return fallbackName || student.studentSystemId;
}

function getStudentSectionId(student: StudentRosterRow) {
  if (!student.section) return null;
  if (typeof student.section === 'string') return student.section;
  return student.section.id;
}

function makeDefaultForm(academicYears: AcademicYearSummary[]): CasFormState {
  return {
    academicYearId: getCurrentYear(academicYears)?.id ?? '',
    subjectId: '',
    studentId: '',
    classId: '',
    sectionId: '',
    category: 'Classwork',
    score: 0,
    maxScore: 20,
    observedOn: today,
    note: '',
  };
}

export function CasRecordsTab({ academicYears, classes, allSections, students, subjects }: Props) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(() => ({
    academicYearId: getCurrentYear(academicYears)?.id ?? '',
    classId: '',
    sectionId: '',
    subjectId: '',
    studentId: '',
  }));
  const [cas, setCas] = useState<CasFormState>(() => makeDefaultForm(academicYears));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [batchDraft, setBatchDraft] = useState<BatchDraft>({});
  const [batchNotes, setBatchNotes] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const sectionsForClass = useMemo(
    () => allSections.filter((section) => section.classId === filters.classId || section.classId === cas.classId),
    [allSections, filters.classId, cas.classId],
  );

  const formSectionsForClass = useMemo(
    () => allSections.filter((section) => section.classId === cas.classId),
    [allSections, cas.classId],
  );

  const subjectsForClass = useMemo(
    () => subjects.filter((subject) => subject.classId === cas.classId),
    [subjects, cas.classId],
  );

  const filterSubjectsForClass = useMemo(
    () => subjects.filter((subject) => !filters.classId || subject.classId === filters.classId),
    [subjects, filters.classId],
  );

  const formStudentsForClass = useMemo(() => {
    return (students as StudentRosterRow[])
      .filter((student) => {
        const matchesClass = student.class?.id === cas.classId;
        const matchesSection = !cas.sectionId || getStudentSectionId(student) === cas.sectionId;
        return matchesClass && matchesSection;
      })
      .sort((a, b) => (a.rollNumber ?? 9999) - (b.rollNumber ?? 9999));
  }, [students, cas.classId, cas.sectionId]);

  const filterStudentsForClass = useMemo(() => {
    return (students as StudentRosterRow[]).filter((student) => {
      const matchesClass = !filters.classId || student.class?.id === filters.classId;
      const matchesSection = !filters.sectionId || getStudentSectionId(student) === filters.sectionId;
      return matchesClass && matchesSection;
    });
  }, [students, filters.classId, filters.sectionId]);

  const casRecordsQuery = useQuery({
    queryKey: ['cas-records', filters],
    queryFn: () => api.listCasRecords(filters),
    enabled: status === 'authenticated',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cas-records'] });
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
  };

  const createMutation = useMutation({
    mutationFn: api.createCasRecord,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Observation recorded successfully.');
      setCas((current) => ({ ...current, studentId: '', score: 0, note: '' }));
      window.setTimeout(() => setSuccessMessage(''), 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.updateCasRecord(id, body),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setSuccessMessage('Observation updated successfully.');
      window.setTimeout(() => setSuccessMessage(''), 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCasRecord(id),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Observation deleted successfully.');
      window.setTimeout(() => setSuccessMessage(''), 5000);
    },
  });

  const batchMutation = useMutation({
    mutationFn: api.batchCreateCasRecords,
    onSuccess: (data) => {
      invalidate();
      setBatchDraft({});
      setBatchNotes({});
      setSuccessMessage(`Saved ${data.count} observations successfully.`);
      window.setTimeout(() => setSuccessMessage(''), 5000);
    },
  });

  const invalidSingleScore = cas.score < 0 || cas.score > cas.maxScore || cas.maxScore <= 0;
  const batchEntries = useMemo(() => {
    return formStudentsForClass
      .map((student) => {
        const value = batchDraft[student.id];
        if (value === undefined || value.trim() === '') return null;
        const score = Number(value);
        if (Number.isNaN(score)) return null;
        return {
          studentId: student.id,
          score,
          remarks: batchNotes[student.id]?.trim() || undefined,
        };
      })
      .filter((entry): entry is { studentId: string; score: number; remarks: string | undefined } => !!entry);
  }, [formStudentsForClass, batchDraft, batchNotes]);
  const invalidBatchEntries = batchEntries.filter((entry) => entry.score < 0 || entry.score > cas.maxScore);

  const applyTemplate = (category: string) => {
    const template = casTemplates.find((item) => item.category === category);
    setCas((current) => ({
      ...current,
      category,
      maxScore: template?.maxScore ?? current.maxScore,
      note: template?.note ?? current.note,
    }));
  };

  const saveSingle = () => {
    const payload = {
      ...cas,
      sectionId: cas.sectionId || null,
      observedOn: new Date(cas.observedOn).toISOString(),
      note: cas.note || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, body: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const saveBatch = () => {
    if (batchEntries.length === 0 || invalidBatchEntries.length > 0) return;

    batchMutation.mutate({
      academicYearId: cas.academicYearId,
      classId: cas.classId,
      sectionId: cas.sectionId || null,
      subjectId: cas.subjectId,
      category: cas.category,
      maxScore: cas.maxScore,
      observedOn: new Date(cas.observedOn).toISOString(),
      entries: batchEntries,
    });
  };

  const records = casRecordsQuery.data ?? [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, row: number, col: number) => {
    const { key, shiftKey } = e;
    
    let nextRow = row;
    let nextCol = col;

    if (key === 'ArrowDown' || (key === 'Enter' && !shiftKey)) {
      nextRow++;
      e.preventDefault();
    } else if (key === 'ArrowUp' || (key === 'Enter' && shiftKey)) {
      nextRow--;
      e.preventDefault();
    } else if (key === 'ArrowRight' && (e.currentTarget as any).selectionEnd === (e.currentTarget as any).value?.length) {
      nextCol++;
    } else if (key === 'ArrowLeft' && (e.currentTarget as any).selectionStart === 0) {
      nextCol--;
    } else if (key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
      return;
    } else {
      return;
    }

    const nextTarget = document.querySelector(
      `[data-cas-row="${nextRow}"][data-cas-col="${nextCol}"]`
    ) as HTMLElement;

    if (nextTarget) {
      nextTarget.focus();
      if (nextTarget instanceof HTMLInputElement) {
        nextTarget.select();
      }
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Search & Feedback */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
           <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">Continuous Assessment</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Behavioral & Formative Observations</p>
           </div>
           {successMessage && (
             <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-lg shadow-emerald-500/5 animate-in slide-in-from-right-4">
                <CheckCircle2 size={18} />
                <span className="text-xs font-black uppercase tracking-widest">{successMessage}</span>
             </div>
           )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Academic Year</label>
              <select value={filters.academicYearId} onChange={(e) => setFilters(c => ({ ...c, academicYearId: e.target.value }))} className="premium-input bg-white">
                <option value="">All Years</option>
                {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Class</label>
              <select value={filters.classId} onChange={(e) => setFilters(c => ({ ...c, classId: e.target.value, sectionId: '', subjectId: '', studentId: '' }))} className="premium-input bg-white">
                <option value="">All Classes</option>
                {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Section</label>
              <select value={filters.sectionId} onChange={(e) => setFilters(c => ({ ...c, sectionId: e.target.value, studentId: '' }))} className="premium-input bg-white">
                <option value="">All Sections</option>
                {sectionsForClass.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Subject</label>
              <select value={filters.subjectId} onChange={(e) => setFilters(c => ({ ...c, subjectId: e.target.value }))} className="premium-input bg-white">
                <option value="">All Subjects</option>
                {filterSubjectsForClass.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Student</label>
              <select value={filters.studentId} onChange={(e) => setFilters(c => ({ ...c, studentId: e.target.value }))} className="premium-input bg-white">
                <option value="">All Students</option>
                {filterStudentsForClass.map((student) => <option key={student.id} value={student.id}>{student.rollNumber ? `#${student.rollNumber} ` : ''}{getStudentName(student)}</option>)}
              </select>
           </div>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-12">
         {/* Entry Area */}
         <div className="lg:col-span-4 space-y-8">
            <section className="group relative rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:border-[var(--color-mod-academics-border)] hover:shadow-sm">
               <div className="mb-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-accent)] mb-4 transition-transform group-hover:rotate-12">
                     <Edit3 size={24} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic">{editingId ? 'Modify Record' : 'Single Entry'}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Individual observation recording</p>
               </div>

               <div className="space-y-4">
                  <select value={cas.classId} onChange={(e) => setCas(c => ({ ...c, classId: e.target.value, sectionId: '', subjectId: '', studentId: '' }))} className="premium-input bg-slate-50">
                    <option value="">Select Class</option>
                    {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
                  </select>
                  
                  <select value={cas.studentId} onChange={(e) => setCas(c => ({ ...c, studentId: e.target.value }))} className="premium-input bg-slate-50">
                    <option value="">Select Student</option>
                    {formStudentsForClass.map((student) => <option key={student.id} value={student.id}>{student.rollNumber ? `#${student.rollNumber} ` : ''}{getStudentName(student)}</option>)}
                  </select>

                  <select value={cas.subjectId} onChange={(e) => setCas(c => ({ ...c, subjectId: e.target.value }))} className="premium-input bg-slate-50">
                    <option value="">Select Subject</option>
                    {subjectsForClass.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name}</option>)}
                  </select>

                  <div className="h-px bg-slate-100 my-4" />

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Observation Category</label>
                    <select value={cas.category} onChange={(e) => applyTemplate(e.target.value)} className="premium-input border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-text)] shadow-sm">
                      {casTemplates.map((template) => <option key={template.category} value={template.category}>{template.category}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Score</label>
                        <input type="number" value={cas.score} onChange={(e) => setCas(c => ({ ...c, score: Number(e.target.value) }))} className="premium-input bg-slate-50 font-black tracking-tighter" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Max</label>
                        <input type="number" value={cas.maxScore} onChange={(e) => setCas(c => ({ ...c, maxScore: Number(e.target.value) }))} className="premium-input bg-slate-50 font-black tracking-tighter" />
                     </div>
                  </div>

                  <textarea 
                    value={cas.note} 
                    onChange={(e) => setCas(c => ({ ...c, note: e.target.value }))} 
                    placeholder="Observations and remarks..."
                    className="premium-input bg-slate-50 min-h-[100px] py-4 text-xs font-medium"
                  />

                  <button 
                    onClick={saveSingle}
                    disabled={!cas.studentId || !cas.subjectId || invalidSingleScore || createMutation.isPending || updateMutation.isPending}
                    className="w-full h-14 rounded-2xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-sm hover:bg-[var(--color-mod-academics-text)] active:scale-95 transition-all disabled:opacity-30"
                  >
                    {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                    {editingId ? 'Update Record' : 'Record Now'}
                  </button>
                  
                  {editingId && (
                    <button 
                      onClick={() => { setEditingId(null); setCas(makeDefaultForm(academicYears)); }}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
               </div>
            </section>
         </div>

         {/* Batch Area */}
         <div className="lg:col-span-8 space-y-8">
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic">Batch Roster</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Multi-student entry for {cas.category}</p>
                  </div>
                  <button 
                    onClick={saveBatch}
                    disabled={batchEntries.length === 0 || invalidBatchEntries.length > 0 || batchMutation.isPending}
                    className={cn(
                      "h-12 px-6 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95",
                      batchEntries.length > 0 ? "bg-[var(--color-mod-academics-accent)] text-white shadow-sm hover:bg-[var(--color-mod-academics-text)]" : "bg-slate-100 text-slate-300 pointer-events-none"
                    )}
                  >
                    {batchMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                    {batchMutation.isPending ? 'Syncing' : `Sync ${batchEntries.length} Records`}
                  </button>
               </div>

               <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400">Student Info</th>
                        <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-32 text-center">Score / {cas.maxScore}</th>
                        <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {formStudentsForClass.length === 0 ? (
                         <tr>
                           <td colSpan={3} className="py-20 text-center text-slate-300">
                              <Users className="h-12 w-12 mx-auto mb-4 opacity-10" />
                              <p className="text-[10px] font-black uppercase tracking-widest">Select class to load batch roster</p>
                           </td>
                         </tr>
                       ) : formStudentsForClass.map((student, rowIndex) => (
                         <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors">
                           <td className="py-4 px-8">
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{getStudentName(student)}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roll #{student.rollNumber ?? '—'} · {student.studentSystemId}</span>
                              </div>
                           </td>
                           <td className="py-4 px-6">
                              <input 
                                type="number" 
                                min={0} 
                                max={cas.maxScore} 
                                value={batchDraft[student.id] ?? ''} 
                                placeholder="0.0"
                                onChange={(e) => setBatchDraft(c => ({ ...c, [student.id]: e.target.value }))}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                                data-cas-row={rowIndex}
                                data-cas-col={0}
                                className="w-full h-12 rounded-xl border border-slate-100 bg-slate-50 text-center font-black tracking-tighter focus:bg-white focus:border-[var(--color-mod-academics-accent)] focus:ring-4 focus:ring-[var(--color-mod-academics-border)] transition-all outline-none"
                              />
                           </td>
                           <td className="py-4 px-6">
                              <input 
                                type="text" 
                                value={batchNotes[student.id] ?? ''} 
                                placeholder="Add remark..."
                                onChange={(e) => setBatchNotes(c => ({ ...c, [student.id]: e.target.value }))}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                                data-cas-row={rowIndex}
                                data-cas-col={1}
                                className="w-full h-12 rounded-xl border border-slate-100 bg-slate-50 px-4 text-xs font-medium focus:bg-white focus:border-[var(--color-mod-academics-accent)] focus:ring-4 focus:ring-[var(--color-mod-academics-border)] transition-all outline-none"
                              />
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
               </div>
            </section>
         </div>
      </div>

      {/* History */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
         <div className="p-8 border-b border-slate-100 flex items-center gap-4">
            <div className="h-10 w-10 rounded-2xl bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-accent)] flex items-center justify-center">
               <Clock size={20} />
            </div>
            <div>
               <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic">Operational Logs</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Audit trail of assessments</p>
            </div>
            <div className="h-px flex-1 bg-slate-100 mx-4" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{records.length} Records found</span>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400">Student</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Subject / Category</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Outcome</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Timeline</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((record) => (
                  <tr key={record.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="py-4 px-8">
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{record.student?.firstNameEn} {record.student?.lastNameEn}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.class?.name} / {record.section?.name ?? 'Main'}</span>
                       </div>
                    </td>
                    <td className="py-4 px-6">
                       <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">{record.subject?.code}</span>
                          <span className="px-2 py-1 rounded-lg bg-teal-50 text-[10px] font-black text-teal-600 uppercase tracking-widest border border-teal-100">{record.category}</span>
                       </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                       <div className="inline-flex flex-col items-center px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-white transition-colors">
                          <span className="text-sm font-black text-slate-900 tracking-tighter">{Number(record.score)} / {Number(record.maxScore)}</span>
                          <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-[var(--color-mod-academics-accent)]" style={{ width: `${(Number(record.score) / Number(record.maxScore)) * 100}%` }} />
                          </div>
                       </div>
                    </td>
                    <td className="py-4 px-6">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(record.observedOn).toLocaleDateString()}</span>
                          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">{record.note?.slice(0, 20) || 'No Note'}...</span>
                       </div>
                    </td>
                    <td className="py-4 px-8 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setEditingId(record.id); startEdit(record); }}
                            className="h-8 w-8 rounded-xl flex items-center justify-center bg-[var(--color-mod-academics-surface)] text-[var(--color-mod-academics-accent)] hover:bg-[var(--color-mod-academics-accent)] hover:text-white transition-all active:scale-90"
                          >
                             <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => deleteMutation.mutate(record.id)}
                            className="h-8 w-8 rounded-xl flex items-center justify-center bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                          >
                             <Trash2 size={14} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      </section>
    </div>
  );

  function startEdit(record: CasRecordSummary) {
    setCas({
      academicYearId: record.academicYearId,
      subjectId: record.subjectId,
      studentId: record.studentId,
      classId: record.classId,
      sectionId: record.sectionId ?? '',
      category: record.category,
      score: Number(record.score),
      maxScore: Number(record.maxScore),
      observedOn: new Date(record.observedOn).toISOString().slice(0, 10),
      note: record.note ?? '',
    });
  }
}
