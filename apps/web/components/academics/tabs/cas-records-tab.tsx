'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  students: any[];
  subjects: any[];
};

const today = new Date().toISOString().slice(0, 10);

const casCategories = [
  'Classwork',
  'Homework',
  'Project',
  'Presentation',
  'Lab Work',
  'Participation',
  'Discipline',
  'Creative Work',
  'Social Skills',
  'Other',
] as const;

export function CasRecordsTab({ academicYears, classes, allSections, students, subjects }: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [cas, setCas] = useState({
    academicYearId: currentYear?.id ?? '',
    subjectId: '',
    studentId: '',
    classId: '',
    sectionId: '',
    category: 'Classwork' as string,
    score: 0,
    maxScore: 20,
    observedOn: today,
    note: '',
  });

  const casRecordsQuery = useQuery({
    queryKey: ['cas-records'],
    queryFn: api.listCasRecords,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cas-records'] });
  };

  const casMut = useMutation({
    mutationFn: api.createCasRecord,
    onSuccess: () => {
      invalidate();
      setCas((c) => ({ ...c, studentId: '', score: 0, note: '' }));
    },
  });

  const sectionsForClass = allSections.filter((s: any) => s.classId === classId);
  const studentsForClass = students.filter(
    (s: any) => s.class?.id === classId && (!sectionId || s.section?.id === sectionId),
  );
  const subjectsForClass = subjects.filter((s: any) => s.classId === classId);
  const casRecords = casRecordsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Entry form */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Record</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Add CAS Observation</h2>
          <p className="mt-1 text-sm text-gray-500">
            Continuous Assessment System records track student competencies across classwork, projects, and participation.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={cas.academicYearId} onChange={(e) => setCas((c) => ({ ...c, academicYearId: e.target.value }))}>
            <option value="">Academic year</option>
            {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select
            value={classId}
            onChange={(e) => {
              const id = e.target.value;
              setClassId(id);
              setSectionId('');
              setCas((c) => ({ ...c, classId: id, sectionId: '', subjectId: '', studentId: '' }));
            }}
          >
            <option value="">Class</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setCas((c) => ({ ...c, sectionId: e.target.value, studentId: '' }));
            }}
          >
            <option value="">All sections</option>
            {sectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={cas.subjectId} onChange={(e) => setCas((c) => ({ ...c, subjectId: e.target.value }))}>
            <option value="">Subject</option>
            {subjectsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={cas.studentId} onChange={(e) => setCas((c) => ({ ...c, studentId: e.target.value }))}>
            <option value="">Student</option>
            {studentsForClass.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.rollNumber ? `#${s.rollNumber} ` : ''}{s.firstNameEn} {s.lastNameEn}
              </option>
            ))}
          </select>
          <select value={cas.category} onChange={(e) => setCas((c) => ({ ...c, category: e.target.value }))}>
            {casCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} value={cas.score} onChange={(e) => setCas((c) => ({ ...c, score: Number(e.target.value) }))} placeholder="Score" />
            <input type="number" min={1} value={cas.maxScore} onChange={(e) => setCas((c) => ({ ...c, maxScore: Number(e.target.value) }))} placeholder="Max" />
          </div>
          <input type="date" value={cas.observedOn} onChange={(e) => setCas((c) => ({ ...c, observedOn: e.target.value }))} />
        </div>

        <textarea
          rows={2}
          className="mt-3 w-full"
          value={cas.note}
          onChange={(e) => setCas((c) => ({ ...c, note: e.target.value }))}
          placeholder="Observation notes or remarks (optional)"
        />

        {cas.score > cas.maxScore && (
          <p className="mt-2 text-sm text-amber-600">Score cannot exceed max score ({cas.maxScore}).</p>
        )}

        <button
          type="button"
          className="mt-3 rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50"
          disabled={
            !cas.academicYearId || !cas.classId || !cas.subjectId || !cas.studentId ||
            cas.score > cas.maxScore || cas.score < 0 || casMut.isPending
          }
          onClick={() =>
            casMut.mutate({
              ...cas,
              sectionId: cas.sectionId || null,
              observedOn: new Date(cas.observedOn).toISOString(),
            })
          }
        >
          {casMut.isPending ? 'Saving…' : 'Save CAS Record'}
        </button>

        {casMut.isError && <p className="mt-2 text-sm text-red-600">{casMut.error.message}</p>}
        {casMut.isSuccess && <p className="mt-2 text-sm text-emerald-600">CAS record saved successfully.</p>}
      </section>

      {/* CAS records table */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          CAS Records · {casRecords.length} total
        </p>
        {casRecordsQuery.isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            <p className="mt-2 text-sm text-gray-400">Loading records…</p>
          </div>
        ) : casRecords.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No CAS records yet. Add your first observation above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Subject</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Class</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Category</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Score</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Date</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Note</th>
                </tr>
              </thead>
              <tbody>
                {casRecords.slice(0, 50).map((r: any) => {
                  const pct = r.maxScore > 0 ? (Number(r.score) / Number(r.maxScore)) * 100 : 0;
                  return (
                    <tr key={r.id} className="border-b border-[var(--line)] hover:bg-indigo-50/30 transition">
                      <td className="py-2 font-medium text-gray-950">
                        {r.student?.firstNameEn ?? ''} {r.student?.lastNameEn ?? ''}
                      </td>
                      <td className="py-2 text-gray-600">{r.subject?.code ?? '—'}</td>
                      <td className="py-2 text-gray-600">
                        {r.class?.name ?? '—'}{r.section?.name ? ` / ${r.section.name}` : ''}
                      </td>
                      <td className="py-2">
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                          {r.category}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pct >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {Number(r.score)}/{Number(r.maxScore)}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">{new Date(r.observedOn).toLocaleDateString()}</td>
                      <td className="py-2 text-gray-500 max-w-[200px] truncate">{r.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
