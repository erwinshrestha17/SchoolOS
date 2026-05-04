'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  students: any[];
  exams: any[];
};

export function MarksEntryTab({ classes, allSections, students, exams }: Props) {
  const queryClient = useQueryClient();
  const [examTermId, setExamTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [saveMsg, setSaveMsg] = useState('');

  const sectionsForClass = allSections.filter((s: any) => s.classId === classId);
  const studentsForClass = students.filter((s: any) => s.class?.id === classId && (!sectionId || s.section?.id === sectionId));

  const componentsQuery = useQuery({
    queryKey: ['components', examTermId, subjectId],
    queryFn: () => api.listComponentsByExamTerm(examTermId, { subjectId: subjectId || null }),
    enabled: Boolean(examTermId),
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects-by-class', classId],
    queryFn: () => api.listSubjects({ classId: classId || null }),
    enabled: Boolean(classId),
  });

  const existingMarksQuery = useQuery({
    queryKey: ['marks-grid', examTermId, componentId, classId, sectionId],
    queryFn: () => api.listMarks({ examTermId, assessmentComponentId: componentId, classId, sectionId: sectionId || null }),
    enabled: Boolean(examTermId && componentId && classId),
  });

  const selectedComponent = (componentsQuery.data ?? []).find((c: any) => c.id === componentId);
  const maxMarks = selectedComponent ? Number(selectedComponent.maxMarks) : 100;

  // Merge existing marks into local state when loaded
  const existingMap = new Map((existingMarksQuery.data ?? []).map((m: any) => [m.studentId, Number(m.marksObtained)]));

  const batchMut = useMutation({
    mutationFn: api.batchEnterMarks,
    onSuccess: (data: any) => {
      setSaveMsg(`Saved ${data.saved} marks successfully`);
      void queryClient.invalidateQueries({ queryKey: ['marks-grid'] });
      void queryClient.invalidateQueries({ queryKey: ['marks'] });
      setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  function handleSave() {
    const entries = Object.entries(marks)
      .filter(([, v]) => v >= 0)
      .map(([studentId, marksObtained]) => ({ studentId, marksObtained }));

    if (entries.length === 0) return;

    batchMut.mutate({ examTermId, assessmentComponentId: componentId, entries });
  }

  const ready = examTermId && classId && componentId;
  const selectedExam = exams.find((e: any) => e.id === examTermId);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Filter</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Select Exam, Class & Subject</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={examTermId} onChange={(e) => { setExamTermId(e.target.value); setComponentId(''); }}>
            <option value="">Exam term</option>
            {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.isLocked ? ' 🔒' : ''}</option>)}
          </select>
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); setSubjectId(''); }}>
            <option value="">Class</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">All sections</option>
            {sectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setComponentId(''); }}>
            <option value="">Subject</option>
            {(subjectsQuery.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <select value={componentId} onChange={(e) => setComponentId(e.target.value)}>
            <option value="">Component</option>
            {(componentsQuery.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({Number(c.maxMarks)})</option>)}
          </select>
        </div>
      </section>

      {/* Marks grid */}
      {ready ? (
        <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Grid</p>
              <h2 className="mt-1 text-lg font-bold text-gray-950">
                {selectedExam?.name} · {selectedComponent?.subject?.name ?? 'Subject'} · {selectedComponent?.name}
              </h2>
              <p className="text-sm text-gray-500">Max marks: {maxMarks} · {studentsForClass.length} students</p>
            </div>
            <div className="flex items-center gap-3">
              {saveMsg && <span className="text-sm font-medium text-emerald-600">{saveMsg}</span>}
              <button type="button" className="rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50" disabled={Object.keys(marks).length === 0 || batchMut.isPending || selectedExam?.isLocked} onClick={handleSave}>
                {batchMut.isPending ? 'Saving…' : `Save ${Object.keys(marks).length} marks`}
              </button>
            </div>
          </div>

          {selectedExam?.isLocked && (
            <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              This exam term is locked. Marks cannot be edited.
            </div>
          )}

          {batchMut.isError && <p className="mb-4 text-sm text-red-600">{batchMut.error.message}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-3 text-left font-semibold text-gray-500 w-16">#</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                  <th className="py-3 text-left font-semibold text-gray-500 w-20">Roll</th>
                  <th className="py-3 text-left font-semibold text-gray-500 w-32">Existing</th>
                  <th className="py-3 text-left font-semibold text-gray-500 w-40">Marks</th>
                </tr>
              </thead>
              <tbody>
                {studentsForClass.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No students found for this class/section.</td></tr>
                ) : studentsForClass.map((student: any, idx: number) => {
                  const existing = existingMap.get(student.id);
                  const currentValue = marks[student.id] ?? existing ?? '';
                  return (
                    <tr key={student.id} className="border-b border-[var(--line)] hover:bg-indigo-50/30 transition">
                      <td className="py-2 text-gray-400">{idx + 1}</td>
                      <td className="py-2">
                        <span className="font-medium text-gray-950">{student.firstNameEn} {student.lastNameEn}</span>
                        <span className="ml-2 text-xs text-gray-400">{student.studentSystemId}</span>
                      </td>
                      <td className="py-2 text-gray-500">{student.rollNumber ?? '—'}</td>
                      <td className="py-2">
                        {existing !== undefined ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${existing >= (selectedComponent?.passMarks ? Number(selectedComponent.passMarks) : 35) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {existing}/{maxMarks}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0}
                          max={maxMarks}
                          value={currentValue}
                          disabled={selectedExam?.isLocked}
                          className="w-28 rounded-xl border border-[var(--line)] px-3 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:opacity-50"
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setMarks((prev) => {
                              if (val === undefined) { const { [student.id]: _, ...rest } = prev; return rest; }
                              return { ...prev, [student.id]: val };
                            });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-[var(--line)] bg-gray-50/50 p-12 text-center">
          <p className="text-lg font-semibold text-gray-400">Select exam term, class, subject, and component to begin entering marks</p>
          <p className="mt-2 text-sm text-gray-300">The marks grid will appear here once all filters are selected.</p>
        </section>
      )}
    </div>
  );
}
