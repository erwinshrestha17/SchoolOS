'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../../lib/api';
import { 
  BookOpen, 
  UserPlus, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Users, 
  Layers,
  GraduationCap,
  Award,
  Zap,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { 
  AcademicYearSummary, 
  ClassSummary, 
  SectionSummary, 
  StaffSummary, 
  SubjectSummary, 
  TeacherAssignmentSummary 
} from '@schoolos/core';

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  staff: StaffSummary[];
  subjects: SubjectSummary[];
  assignments: TeacherAssignmentSummary[];
};

export function SubjectsTab({ academicYears, classes, allSections, staff, subjects, assignments }: Props) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState({ classId: '', code: '', name: '', type: 'CORE', theoryMarks: 100, passMarks: 35 });
  const [assign, setAssign] = useState({ academicYearId: '', subjectId: '', staffId: '', classId: '', sectionId: '' });
  const [successMessage, setSuccessMessage] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const subjectMut = useMutation({ 
    mutationFn: api.createSubject, 
    onSuccess: () => {
      invalidate();
      setSubject({ classId: '', code: '', name: '', type: 'CORE', theoryMarks: 100, passMarks: 35 });
      showSuccess('Subject created successfully.');
    } 
  });
  
  const assignMut = useMutation({ 
    mutationFn: api.createTeacherAssignment, 
    onSuccess: () => {
      invalidate();
      showSuccess('Teacher assigned successfully.');
    } 
  });

  const sectionsForClass = useMemo(() => allSections.filter((s: SectionSummary) => s.classId === assign.classId), [allSections, assign.classId]);
  const currentYear = academicYears.find((y: AcademicYearSummary) => y.isCurrent) ?? academicYears[0];

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header & Feedback */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
         <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">Academic Catalog</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Subjects & Instructional Assignments</p>
         </div>
         {successMessage && (
           <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-lg shadow-emerald-500/5 animate-in slide-in-from-right-4">
              <CheckCircle2 size={18} />
              <span className="text-xs font-black uppercase tracking-widest">{successMessage}</span>
           </div>
         )}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
         {/* Define Subject */}
         <section className="group relative rounded-[2.5rem] border border-slate-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className="mb-8">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 transition-transform group-hover:rotate-12">
                  <BookOpen size={24} />
               </div>
               <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic">New Subject</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Add to the master curriculum</p>
            </div>

            <div className="space-y-4">
               <select value={subject.classId} onChange={(e) => setSubject(c => ({ ...c, classId: e.target.value }))} className="premium-input bg-slate-50">
                  <option value="">Select Grade Level</option>
                  {classes.map((c: ClassSummary) => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>

               <div className="grid gap-4 md:grid-cols-2">
                  <input value={subject.code} onChange={(e) => setSubject(c => ({ ...c, code: e.target.value }))} placeholder="Code (e.g. ENG-101)" className="premium-input bg-slate-50 uppercase font-black" />
                  <input value={subject.name} onChange={(e) => setSubject(c => ({ ...c, name: e.target.value }))} placeholder="Subject Name" className="premium-input bg-slate-50 font-black italic" />
               </div>

               <div className="grid gap-4 md:grid-cols-3">
                  <select value={subject.type} onChange={(e) => setSubject(c => ({ ...c, type: e.target.value }))} className="premium-input bg-slate-50">
                    <option value="CORE">Core</option>
                    <option value="ELECTIVE">Elective</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                  <input type="number" value={subject.theoryMarks} onChange={(e) => setSubject(c => ({ ...c, theoryMarks: Number(e.target.value) }))} placeholder="Theory Marks" className="premium-input bg-slate-50" />
                  <input type="number" value={subject.passMarks} onChange={(e) => setSubject(c => ({ ...c, passMarks: Number(e.target.value) }))} placeholder="Pass Marks" className="premium-input bg-slate-50" />
               </div>

               <button 
                onClick={() => subjectMut.mutate(subject)}
                disabled={!subject.classId || !subject.code || !subject.name || subjectMut.isPending}
                className="w-full h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/10 active:scale-95 transition-all disabled:opacity-30"
               >
                 {subjectMut.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                 Register Subject
               </button>
            </div>
         </section>

         {/* Assign Teacher */}
         <section className="group relative rounded-[2.5rem] border border-slate-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className="mb-8">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 mb-4 transition-transform group-hover:-rotate-12">
                  <UserPlus size={24} />
               </div>
               <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic">Faculty Assignment</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Delegate instructional responsibility</p>
            </div>

            <div className="space-y-4">
               <select value={assign.academicYearId || currentYear?.id || ''} onChange={(e) => setAssign(c => ({ ...c, academicYearId: e.target.value }))} className="premium-input bg-slate-50">
                 {academicYears.map((y: AcademicYearSummary) => <option key={y.id} value={y.id}>{y.name}</option>)}
               </select>

               <div className="grid gap-4 md:grid-cols-2">
                  <select value={assign.subjectId} onChange={(e) => { const s = subjects.find(x => x.id === e.target.value); setAssign(c => ({ ...c, subjectId: e.target.value, classId: s?.classId ?? c.classId })); }} className="premium-input bg-slate-50">
                    <option value="">Subject</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                  <select value={assign.staffId} onChange={(e) => setAssign(c => ({ ...c, staffId: e.target.value }))} className="premium-input bg-slate-50">
                    <option value="">Select Faculty</option>
                    {staff.map((s: StaffSummary) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                  </select>
               </div>

               <select value={assign.sectionId} onChange={(e) => setAssign(c => ({ ...c, sectionId: e.target.value }))} className="premium-input bg-slate-50">
                  <option value="">Entire Grade Level</option>
                  {sectionsForClass.map((s: SectionSummary) => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>

               <button 
                onClick={() => assignMut.mutate({ ...assign, academicYearId: assign.academicYearId || currentYear?.id, sectionId: assign.sectionId || null })}
                disabled={!assign.subjectId || !assign.staffId || assignMut.isPending}
                className="w-full h-14 rounded-2xl bg-violet-700 text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-xl shadow-violet-700/10 active:scale-95 transition-all disabled:opacity-30"
               >
                 {assignMut.isPending ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                 Activate Assignment
               </button>
            </div>
         </section>
      </div>

      {/* Catalog Grid */}
      <section className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-2xl shadow-slate-200/20">
         <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
               <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic text-[18px]">Curriculum Roster</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{subjects.length} Subjects Registered</p>
            </div>
         </div>

         <div className="p-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.length === 0 ? (
               <div className="col-span-full py-20 text-center text-slate-300">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Master catalog is empty</p>
               </div>
            ) : subjects.map((s: SubjectSummary) => (
               <div key={s.id} className="group relative rounded-[2rem] border border-slate-100 bg-white p-6 transition-all hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5">
                  <div className="flex items-start justify-between mb-4">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.class?.name ?? 'General'}</span>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{s.code} — {s.name}</h4>
                     </div>
                     <div className="h-8 px-2 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <span className="text-[10px] font-black text-indigo-600">{s.theoryMarks}</span>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                     <span className={cn(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border",
                        s.type === 'CORE' ? "bg-primary-50 text-primary-600 border-primary-100" : "bg-slate-50 text-slate-500 border-slate-100"
                     )}>
                        {s.type}
                     </span>
                     {s.passMarks && (
                        <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                           Pass: {s.passMarks}
                        </span>
                     )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-50">
                     <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Faculty Assignments</p>
                     <div className="flex flex-wrap gap-1.5">
                        {(s.teacherAssignments?.length ?? 0) > 0 ? (
                           s.teacherAssignments?.map((a: TeacherAssignmentSummary) => (
                              <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                 <div className="h-4 w-4 rounded-full bg-slate-200 flex items-center justify-center">
                                    <Users size={8} className="text-slate-500" />
                                 </div>
                                 <span className="text-[9px] font-bold text-slate-600">{a.staff?.firstName}</span>
                              </div>
                           ))
                        ) : (
                           <span className="text-[9px] font-medium text-slate-300 italic">No faculty assigned</span>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </section>
    </div>
  );
}
