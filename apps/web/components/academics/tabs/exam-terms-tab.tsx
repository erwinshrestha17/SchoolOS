'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

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

  const examMut = useMutation({ mutationFn: api.createExamTerm, onSuccess: invalidate });
  const compMut = useMutation({ mutationFn: api.createAssessmentComponent, onSuccess: invalidate });
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Create Exam Term */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Setup</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Create Exam Term</h2>
        </div>
        <div className="grid gap-3">
          <select value={exam.academicYearId || currentYear?.id || ''} onChange={(e) => setExam((c) => ({ ...c, academicYearId: e.target.value }))}>
            <option value="">Academic year</option>
            {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <input value={exam.name} onChange={(e) => setExam((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. First Terminal, Mid-Term" />
          <div className="grid gap-3 md:grid-cols-3">
            <input type="date" value={exam.startsOn} onChange={(e) => setExam((c) => ({ ...c, startsOn: e.target.value }))} />
            <input type="date" value={exam.endsOn} onChange={(e) => setExam((c) => ({ ...c, endsOn: e.target.value }))} />
            <input type="number" value={exam.weightPercent} onChange={(e) => setExam((c) => ({ ...c, weightPercent: Number(e.target.value) }))} placeholder="Weight %" />
          </div>
          <button type="button" className="rounded-2xl bg-indigo-950 px-5 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50" disabled={!exam.name || examMut.isPending} onClick={() => examMut.mutate({ ...exam, academicYearId: exam.academicYearId || currentYear?.id, startsOn: new Date(exam.startsOn).toISOString(), endsOn: new Date(exam.endsOn).toISOString() })}>
            {examMut.isPending ? 'Creating…' : 'Create Exam Term'}
          </button>
          {examMut.isError && <p className="text-sm text-red-600">{examMut.error.message}</p>}
        </div>
      </section>

      {/* Add Assessment Component */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Component</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Add Assessment Component</h2>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <select value={comp.examTermId} onChange={(e) => setComp((c) => ({ ...c, examTermId: e.target.value }))}>
              <option value="">Exam term</option>
              {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.isLocked ? ' 🔒' : ''}</option>)}
            </select>
            <select value={comp.subjectId} onChange={(e) => setComp((c) => ({ ...c, subjectId: e.target.value }))}>
              <option value="">Subject</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={comp.name} onChange={(e) => setComp((c) => ({ ...c, name: e.target.value }))} placeholder="Component name" />
            <input type="number" value={comp.maxMarks} onChange={(e) => setComp((c) => ({ ...c, maxMarks: Number(e.target.value) }))} placeholder="Max marks" />
            <input type="number" value={comp.passMarks} onChange={(e) => setComp((c) => ({ ...c, passMarks: Number(e.target.value) }))} placeholder="Pass marks" />
          </div>
          <button type="button" className="rounded-2xl bg-violet-700 px-5 py-3 font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50" disabled={!comp.examTermId || !comp.subjectId || !comp.name || compMut.isPending} onClick={() => compMut.mutate(comp)}>
            {compMut.isPending ? 'Adding…' : 'Add Component'}
          </button>
          {compMut.isError && <p className="text-sm text-red-600">{compMut.error.message}</p>}
        </div>
      </section>

      {/* Exam Terms list */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Existing Exam Terms</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.length === 0 ? (
            <p className="text-sm text-gray-400 col-span-full">No exam terms created yet.</p>
          ) : exams.map((e: any) => (
            <div key={e.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-950">{e.name}</p>
                  <p className="mt-1 text-sm text-gray-500">{e.academicYear?.name ?? 'Year'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(e.startsOn).toLocaleDateString()} — {new Date(e.endsOn).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.isLocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {e.isLocked ? 'Locked' : 'Open'}
                </span>
              </div>
              {(e.components?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1">
                  {e.components.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-1.5 text-xs">
                      <span className="font-medium text-gray-700">{c.subject?.code ?? 'Subject'} · {c.name}</span>
                      <span className="text-gray-500">{Number(c.maxMarks)} marks</span>
                    </div>
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
