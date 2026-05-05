'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
  };

  const subjectMut = useMutation({ mutationFn: api.createSubject, onSuccess: invalidate });
  const assignMut = useMutation({ mutationFn: api.createTeacherAssignment, onSuccess: invalidate });

  const sectionsForClass = allSections.filter((s: SectionSummary) => s.classId === assign.classId);
  const currentYear = academicYears.find((y: AcademicYearSummary) => y.isCurrent) ?? academicYears[0];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Create Subject */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">New Subject</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Create Subject</h2>
        </div>
        <div className="grid gap-3">
          <select value={subject.classId} onChange={(e) => setSubject((c) => ({ ...c, classId: e.target.value }))}>
            <option value="">Select class</option>
            {classes.map((c: ClassSummary) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={subject.code} onChange={(e) => setSubject((c) => ({ ...c, code: e.target.value }))} placeholder="Code (e.g. ENG-1)" />
            <input value={subject.name} onChange={(e) => setSubject((c) => ({ ...c, name: e.target.value }))} placeholder="Subject name" />
            <select value={subject.type} onChange={(e) => setSubject((c) => ({ ...c, type: e.target.value }))}>
              <option value="CORE">Core</option>
              <option value="ELECTIVE">Elective</option>
              <option value="OPTIONAL">Optional</option>
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input type="number" value={subject.theoryMarks} onChange={(e) => setSubject((c) => ({ ...c, theoryMarks: Number(e.target.value) }))} placeholder="Theory marks" />
            <input type="number" value={subject.passMarks} onChange={(e) => setSubject((c) => ({ ...c, passMarks: Number(e.target.value) }))} placeholder="Pass marks" />
          </div>
          <button type="button" className="rounded-2xl bg-indigo-950 px-5 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50" disabled={!subject.classId || !subject.code || !subject.name || subjectMut.isPending} onClick={() => subjectMut.mutate(subject)}>
            {subjectMut.isPending ? 'Creating…' : 'Create Subject'}
          </button>
          {subjectMut.isError && <p className="text-sm text-red-600">{subjectMut.error.message}</p>}
        </div>
      </section>

      {/* Assign Teacher */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Assignment</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Assign Teacher</h2>
        </div>
        <div className="grid gap-3">
          <select value={assign.academicYearId || currentYear?.id || ''} onChange={(e) => setAssign((c) => ({ ...c, academicYearId: e.target.value }))}>
            <option value="">Academic year</option>
            {academicYears.map((y: AcademicYearSummary) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={assign.subjectId} onChange={(e) => { const s = subjects.find((x: SubjectSummary) => x.id === e.target.value); setAssign((c) => ({ ...c, subjectId: e.target.value, classId: s?.classId ?? c.classId })); }}>
              <option value="">Subject</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            <select value={assign.staffId} onChange={(e) => setAssign((c) => ({ ...c, staffId: e.target.value }))}>
              <option value="">Teacher</option>
              {staff.map((s: StaffSummary) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <select value={assign.sectionId} onChange={(e) => setAssign((c) => ({ ...c, sectionId: e.target.value }))}>
            <option value="">Whole class (no section filter)</option>
            {sectionsForClass.map((s: SectionSummary) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" className="rounded-2xl bg-violet-700 px-5 py-3 font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50" disabled={!assign.subjectId || !assign.staffId || assignMut.isPending} onClick={() => assignMut.mutate({ ...assign, academicYearId: assign.academicYearId || currentYear?.id, sectionId: assign.sectionId || null })}>
            {assignMut.isPending ? 'Assigning…' : 'Assign Teacher'}
          </button>
          {assignMut.isError && <p className="text-sm text-red-600">{assignMut.error.message}</p>}
        </div>
      </section>

      {/* Subject list */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Existing Subjects</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-full">No subjects created yet.</p>
          ) : subjects.map((s: SubjectSummary) => (
            <div key={s.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-950">{s.code} — {s.name}</p>
                  <p className="mt-1 text-sm text-gray-500">{s.class?.name ?? 'Class'} · {s.type}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {s.theoryMarks ?? '—'} marks
                </span>
              </div>
              {(s.teacherAssignments?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.teacherAssignments?.slice(0, 3).map((a: TeacherAssignmentSummary) => (
                    <span key={a.id} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                      {a.staff?.firstName} {a.staff?.lastName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
