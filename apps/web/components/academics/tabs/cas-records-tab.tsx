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
import { casApi } from '../../../lib/cas-api';

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

type StudentRosterRow = StudentProfile & {
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

function getStudentName(student: StudentProfile) {
  return (
    student.fullNameEn ??
    `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() ||
    student.studentSystemId
  );
}

function getStudentSectionId(student: StudentRosterRow) {
  if (!student.section) return null;
  if (typeof student.section === 'string') return student.section;
  return student.section.id;
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString();
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
    queryFn: () => casApi.listCasRecords(filters),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cas-records'] });
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
  };

  const createMutation = useMutation({
    mutationFn: api.createCasRecord,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('CAS record saved successfully.');
      setCas((current) => ({ ...current, studentId: '', score: 0, note: '' }));
      window.setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      casApi.updateCasRecord(id, body),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setSuccessMessage('CAS record updated successfully.');
      window.setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => casApi.deleteCasRecord(id),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('CAS record deleted successfully.');
      window.setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const batchMutation = useMutation({
    mutationFn: casApi.batchCreateCasRecords,
    onSuccess: (data) => {
      invalidate();
      setBatchDraft({});
      setBatchNotes({});
      setSuccessMessage(`Saved ${data.created} CAS records successfully.`);
      window.setTimeout(() => setSuccessMessage(''), 3000);
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
          note: batchNotes[student.id]?.trim() || undefined,
        };
      })
      .filter((entry): entry is { studentId: string; score: number; note?: string } => Boolean(entry));
  }, [formStudentsForClass, batchDraft, batchNotes]);
  const invalidBatchEntries = batchEntries.filter((entry) => entry.score < 0 || entry.score > cas.maxScore);

  const resetEdit = () => {
    setEditingId(null);
    setCas(makeDefaultForm(academicYears));
  };

  const startEdit = (record: CasRecordSummary) => {
    setEditingId(record.id);
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
  };

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

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Filters</p>
            <h2 className="mt-1 text-lg font-bold text-gray-950">CAS Records</h2>
            <p className="mt-1 text-sm text-gray-500">Filter observations by academic year, class, section, subject, or student.</p>
          </div>
          {successMessage && <p className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{successMessage}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={filters.academicYearId} onChange={(event) => setFilters((current) => ({ ...current, academicYearId: event.target.value }))}>
            <option value="">All years</option>
            {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
          <select value={filters.classId} onChange={(event) => setFilters((current) => ({ ...current, classId: event.target.value, sectionId: '', subjectId: '', studentId: '' }))}>
            <option value="">All classes</option>
            {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
          </select>
          <select value={filters.sectionId} onChange={(event) => setFilters((current) => ({ ...current, sectionId: event.target.value, studentId: '' }))}>
            <option value="">All sections</option>
            {sectionsForClass.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
          <select value={filters.subjectId} onChange={(event) => setFilters((current) => ({ ...current, subjectId: event.target.value }))}>
            <option value="">All subjects</option>
            {filterSubjectsForClass.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name}</option>)}
          </select>
          <select value={filters.studentId} onChange={(event) => setFilters((current) => ({ ...current, studentId: event.target.value }))}>
            <option value="">All students</option>
            {filterStudentsForClass.map((student) => <option key={student.id} value={student.id}>{student.rollNumber ? `#${student.rollNumber} ` : ''}{getStudentName(student)}</option>)}
          </select>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Record</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">{editingId ? 'Edit CAS Observation' : 'Add CAS Observation'}</h2>
          <p className="mt-1 text-sm text-gray-500">Use category templates for common Montessori/classroom observation patterns.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={cas.academicYearId} onChange={(event) => setCas((current) => ({ ...current, academicYearId: event.target.value }))}>
            <option value="">Academic year</option>
            {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
          <select value={cas.classId} onChange={(event) => setCas((current) => ({ ...current, classId: event.target.value, sectionId: '', subjectId: '', studentId: '' }))}>
            <option value="">Class</option>
            {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
          </select>
          <select value={cas.sectionId} onChange={(event) => setCas((current) => ({ ...current, sectionId: event.target.value, studentId: '' }))}>
            <option value="">All sections</option>
            {formSectionsForClass.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
          <select value={cas.subjectId} onChange={(event) => setCas((current) => ({ ...current, subjectId: event.target.value }))}>
            <option value="">Subject</option>
            {subjectsForClass.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name}</option>)}
          </select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={cas.studentId} onChange={(event) => setCas((current) => ({ ...current, studentId: event.target.value }))}>
            <option value="">Student</option>
            {formStudentsForClass.map((student) => <option key={student.id} value={student.id}>{student.rollNumber ? `#${student.rollNumber} ` : ''}{getStudentName(student)}</option>)}
          </select>
          <select value={cas.category} onChange={(event) => applyTemplate(event.target.value)}>
            {casTemplates.map((template) => <option key={template.category} value={template.category}>{template.category}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} value={cas.score} onChange={(event) => setCas((current) => ({ ...current, score: Number(event.target.value) }))} placeholder="Score" />
            <input type="number" min={1} value={cas.maxScore} onChange={(event) => setCas((current) => ({ ...current, maxScore: Number(event.target.value) }))} placeholder="Max" />
          </div>
          <input type="date" value={cas.observedOn} onChange={(event) => setCas((current) => ({ ...current, observedOn: event.target.value }))} />
        </div>

        <textarea rows={2} className="mt-3 w-full" value={cas.note} onChange={(event) => setCas((current) => ({ ...current, note: event.target.value }))} placeholder="Observation notes or remarks (optional)" />

        {invalidSingleScore && <p className="mt-2 text-sm text-amber-600">Score must be between 0 and max score ({cas.maxScore}).</p>}

        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50" disabled={!cas.academicYearId || !cas.classId || !cas.subjectId || !cas.studentId || invalidSingleScore || createMutation.isPending || updateMutation.isPending} onClick={saveSingle}>
            {createMutation.isPending || updateMutation.isPending ? 'Saving…' : editingId ? 'Update CAS Record' : 'Save CAS Record'}
          </button>
          {editingId && <button type="button" className="rounded-2xl border border-[var(--line)] px-6 py-3 font-semibold text-gray-700" onClick={resetEdit}>Cancel edit</button>}
        </div>

        {(createMutation.isError || updateMutation.isError) && <p className="mt-2 text-sm text-red-600">{createMutation.error?.message ?? updateMutation.error?.message}</p>}
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Batch roster</p>
            <h2 className="mt-1 text-lg font-bold text-gray-950">Batch CAS Entry</h2>
            <p className="mt-1 text-sm text-gray-500">Use the selected form scope to enter one CAS category for a full class/section roster.</p>
          </div>
          <button type="button" className="rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50" disabled={!cas.academicYearId || !cas.classId || !cas.subjectId || batchEntries.length === 0 || invalidBatchEntries.length > 0 || batchMutation.isPending} onClick={saveBatch}>
            {batchMutation.isPending ? 'Saving…' : `Save ${batchEntries.length} CAS rows`}
          </button>
        </div>
        {invalidBatchEntries.length > 0 && <p className="mb-3 text-sm text-red-600">{invalidBatchEntries.length} batch row(s) exceed max score {cas.maxScore}.</p>}
        {batchMutation.isError && <p className="mb-3 text-sm text-red-600">{batchMutation.error.message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                <th className="py-3 text-left font-semibold text-gray-500">Roll</th>
                <th className="py-3 text-left font-semibold text-gray-500">Score / {cas.maxScore}</th>
                <th className="py-3 text-left font-semibold text-gray-500">Note</th>
              </tr>
            </thead>
            <tbody>
              {formStudentsForClass.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">Select class/section to load roster.</td></tr>
              ) : formStudentsForClass.map((student) => {
                const value = batchDraft[student.id] ?? '';
                const numericValue = value.trim() === '' ? null : Number(value);
                const invalid = numericValue !== null && (Number.isNaN(numericValue) || numericValue < 0 || numericValue > cas.maxScore);
                return (
                  <tr key={student.id} className="border-b border-[var(--line)] hover:bg-indigo-50/30">
                    <td className="py-2 font-medium text-gray-950">{getStudentName(student)} <span className="text-xs text-gray-400">{student.studentSystemId}</span></td>
                    <td className="py-2 text-gray-500">{student.rollNumber ?? '—'}</td>
                    <td className="py-2"><input className={`w-28 rounded-xl border px-3 py-1.5 ${invalid ? 'border-red-500 bg-red-50' : 'border-[var(--line)]'}`} type="number" min={0} max={cas.maxScore} value={value} onChange={(event) => setBatchDraft((current) => ({ ...current, [student.id]: event.target.value }))} /></td>
                    <td className="py-2"><input className="w-full rounded-xl border border-[var(--line)] px-3 py-1.5" value={batchNotes[student.id] ?? ''} placeholder="Optional" onChange={(event) => setBatchNotes((current) => ({ ...current, [student.id]: event.target.value }))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">CAS Records · {records.length} shown</p>
        {casRecordsQuery.isLoading ? (
          <div className="py-8 text-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /><p className="mt-2 text-sm text-gray-400">Loading records…</p></div>
        ) : casRecordsQuery.isError ? (
          <p className="py-8 text-center text-sm text-red-600">{casRecordsQuery.error.message}</p>
        ) : records.length === 0 ? (
          <div className="py-8 text-center"><p className="text-sm text-gray-400">No CAS records match the current filters.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Subject</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Class</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Category</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Score</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Date</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Note</th>
                  <th className="py-3 text-right font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const pct = Number(record.maxScore) > 0 ? (Number(record.score) / Number(record.maxScore)) * 100 : 0;
                  return (
                    <tr key={record.id} className="border-b border-[var(--line)] transition hover:bg-indigo-50/30">
                      <td className="py-2 font-medium text-gray-950">{record.student?.firstNameEn ?? ''} {record.student?.lastNameEn ?? ''}</td>
                      <td className="py-2 text-gray-600">{record.subject?.code ?? '—'}</td>
                      <td className="py-2 text-gray-600">{record.class?.name ?? '—'}{record.section?.name ? ` / ${record.section.name}` : ''}</td>
                      <td className="py-2"><span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">{record.category}</span></td>
                      <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pct >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{Number(record.score)}/{Number(record.maxScore)}</span></td>
                      <td className="py-2 text-gray-500">{formatDate(record.observedOn)}</td>
                      <td className="max-w-[220px] truncate py-2 text-gray-500">{record.note || '—'}</td>
                      <td className="py-2 text-right">
                        <button type="button" className="mr-2 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold" onClick={() => startEdit(record)}>Edit</button>
                        <button type="button" className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(record.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {deleteMutation.isError && <p className="mt-3 text-sm text-red-600">{deleteMutation.error.message}</p>}
      </section>
    </div>
  );
}
