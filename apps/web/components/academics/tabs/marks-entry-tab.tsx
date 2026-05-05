'use client';

import type {
  AcademicYearSummary,
  AssessmentComponentSummary,
  ClassSummary,
  ExamTermSummary,
  MarkEntrySummary,
  SectionSummary,
  StudentProfile,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  students: StudentProfile[];
  exams: ExamTermSummary[];
};

type MarksDraft = Record<string, string>;

type StudentRosterRow = Omit<StudentProfile, 'section'> & {
  section?: { id: string; name?: string | null } | string | null;
  rollNumber?: number | null;
};

function getStudentName(student: { firstNameEn?: string; lastNameEn?: string; studentSystemId: string }) {
  const fallbackName = `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim();
  return fallbackName || student.studentSystemId;
}

function getStudentSectionId(student: StudentRosterRow) {
  if (!student.section) {
    return null;
  }

  if (typeof student.section === 'string') {
    return student.section;
  }

  return student.section.id;
}

function getExistingMark(
  marks: MarkEntrySummary[] | undefined,
  studentId: string,
) {
  return marks?.find((mark) => mark.studentId === studentId);
}

export function MarksEntryTab({ classes, allSections, students, exams }: Props) {
  const queryClient = useQueryClient();
  const [examTermId, setExamTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [marks, setMarks] = useState<MarksDraft>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saveMsg, setSaveMsg] = useState('');

  const sectionsForClass = useMemo(
    () => allSections.filter((section) => section.classId === classId),
    [allSections, classId],
  );

  const studentsForClass = useMemo(() => {
    return (students as StudentRosterRow[])
      .filter((student) => {
        const matchesClass = student.class?.id === classId;
        const matchesSection = !sectionId || getStudentSectionId(student) === sectionId;
        return matchesClass && matchesSection;
      })
      .sort((a, b) => {
        const rollA = a.rollNumber ?? Number.MAX_SAFE_INTEGER;
        const rollB = b.rollNumber ?? Number.MAX_SAFE_INTEGER;
        if (rollA !== rollB) return rollA - rollB;
        return getStudentName(a).localeCompare(getStudentName(b));
      });
  }, [students, classId, sectionId]);

  const subjectsQuery = useQuery({
    queryKey: ['subjects-by-class', classId],
    queryFn: () => api.listSubjects({ classId: classId || null }),
    enabled: Boolean(classId),
  });

  const componentsQuery = useQuery({
    queryKey: ['components', examTermId, subjectId],
    queryFn: () => api.listComponentsByExamTerm(examTermId, { subjectId: subjectId || null }),
    enabled: Boolean(examTermId && subjectId),
  });

  const existingMarksQuery = useQuery({
    queryKey: ['marks-grid', examTermId, componentId, classId, sectionId, subjectId],
    queryFn: () =>
      api.listMarks({
        examTermId,
        assessmentComponentId: componentId,
        classId,
        sectionId: sectionId || null,
        subjectId: subjectId || null,
      }),
    enabled: Boolean(examTermId && componentId && classId),
  });

  const selectedExam = exams.find((exam) => exam.id === examTermId);
  const selectedComponent = (componentsQuery.data ?? []).find(
    (component) => component.id === componentId,
  ) as AssessmentComponentSummary | undefined;
  const maxMarks = selectedComponent ? Number(selectedComponent.maxMarks) : 100;
  const passMarks = selectedComponent?.passMarks
    ? Number(selectedComponent.passMarks)
    : null;

  useEffect(() => {
    setComponentId('');
    setMarks({});
    setRemarks({});
  }, [examTermId, subjectId]);

  useEffect(() => {
    setMarks({});
    setRemarks({});
  }, [classId, sectionId, componentId]);

  useEffect(() => {
    if (!existingMarksQuery.data) {
      return;
    }

    const nextMarks: MarksDraft = {};
    const nextRemarks: Record<string, string> = {};

    for (const mark of existingMarksQuery.data) {
      nextMarks[mark.studentId] = String(Number(mark.marksObtained));
      if (mark.remarks) {
        nextRemarks[mark.studentId] = mark.remarks;
      }
    }

    setMarks(nextMarks);
    setRemarks(nextRemarks);
  }, [existingMarksQuery.data]);

  const invalidEntries = useMemo(() => {
    return Object.entries(marks).filter(([, value]) => {
      if (value.trim() === '') return false;
      const numericValue = Number(value);
      return Number.isNaN(numericValue) || numericValue < 0 || numericValue > maxMarks;
    });
  }, [marks, maxMarks]);

  const changedEntries = useMemo(() => {
    return studentsForClass
      .map((student) => {
        const value = marks[student.id];
        if (value === undefined || value.trim() === '') {
          return null;
        }

        const marksObtained = Number(value);
        if (Number.isNaN(marksObtained)) {
          return null;
        }

        return {
          studentId: student.id,
          marksObtained,
          remarks: remarks[student.id]?.trim() || undefined,
        };
      })
      .filter((entry): entry is { studentId: string; marksObtained: number; remarks: string | undefined } => !!entry);
  }, [studentsForClass, marks, remarks]);

  const batchMut = useMutation({
    mutationFn: api.batchEnterMarks,
    onSuccess: (data) => {
      setSaveMsg(`Saved ${data.saved} marks successfully.`);
      void queryClient.invalidateQueries({ queryKey: ['marks-grid'] });
      void queryClient.invalidateQueries({ queryKey: ['marks'] });
      void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      window.setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  function handleSave() {
    if (!examTermId || !componentId || changedEntries.length === 0 || invalidEntries.length > 0) {
      return;
    }

    batchMut.mutate({
      examTermId,
      assessmentComponentId: componentId,
      entries: changedEntries,
    });
  }

  const ready = Boolean(examTermId && classId && subjectId && componentId);
  const isLocked = Boolean(selectedExam?.isLocked);
  const canSave =
    ready &&
    !isLocked &&
    changedEntries.length > 0 &&
    invalidEntries.length === 0 &&
    !batchMut.isPending;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Roster marks</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Select exam, class, subject, and component</h2>
          <p className="mt-1 text-sm text-gray-500">
            Load a class roster, prefill existing marks, and save all edited rows in one batch.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={examTermId}
            onChange={(event) => setExamTermId(event.target.value)}
          >
            <option value="">Exam term</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}{exam.isLocked ? ' 🔒' : ''}
              </option>
            ))}
          </select>

          <select
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setSectionId('');
              setSubjectId('');
            }}
          >
            <option value="">Class</option>
            {classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
              </option>
            ))}
          </select>

          <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value="">All sections</option>
            {sectionsForClass.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>

          <select
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            disabled={!classId || subjectsQuery.isLoading}
          >
            <option value="">Subject</option>
            {(subjectsQuery.data ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} — {subject.name}
              </option>
            ))}
          </select>

          <select
            value={componentId}
            onChange={(event) => setComponentId(event.target.value)}
            disabled={!examTermId || !subjectId || componentsQuery.isLoading}
          >
            <option value="">Component</option>
            {(componentsQuery.data ?? []).map((component) => (
              <option key={component.id} value={component.id}>
                {component.name} ({Number(component.maxMarks)})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-gray-500 md:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            Students: <span className="font-semibold text-gray-900">{studentsForClass.length}</span>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            Max marks: <span className="font-semibold text-gray-900">{maxMarks}</span>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            Pass marks:{' '}
            <span className="font-semibold text-gray-900">{passMarks ?? 'Not set'}</span>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            Edited rows: <span className="font-semibold text-gray-900">{changedEntries.length}</span>
          </div>
        </div>
      </section>

      {ready ? (
        <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Marks grid</p>
              <h2 className="mt-1 text-lg font-bold text-gray-950">
                {selectedExam?.name} · {selectedComponent?.subject?.name ?? 'Subject'} · {selectedComponent?.name}
              </h2>
              <p className="text-sm text-gray-500">
                Use Enter/ArrowDown to move to the next student. Existing marks are shown and can be corrected before lock.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {saveMsg && <span className="text-sm font-medium text-emerald-600">{saveMsg}</span>}
              <button
                type="button"
                className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isLocked || studentsForClass.length === 0}
                onClick={() => {
                  const nextMarks: MarksDraft = {};
                  studentsForClass.forEach((student) => {
                    nextMarks[student.id] = '0';
                  });
                  setMarks((current) => ({ ...current, ...nextMarks }));
                }}
              >
                Set all 0
              </button>
              <button
                type="button"
                className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isLocked || studentsForClass.length === 0}
                onClick={() => {
                  const nextMarks: MarksDraft = {};
                  studentsForClass.forEach((student) => {
                    nextMarks[student.id] = String(maxMarks);
                  });
                  setMarks((current) => ({ ...current, ...nextMarks }));
                }}
              >
                Set all max
              </button>
              <button
                type="button"
                className="rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50"
                disabled={!canSave}
                onClick={handleSave}
              >
                {batchMut.isPending ? 'Saving…' : `Save ${changedEntries.length} rows`}
              </button>
            </div>
          </div>

          {isLocked && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This exam term is locked. Marks cannot be edited until an authorized unlock is completed.
            </div>
          )}

          {componentsQuery.isError && (
            <p className="mb-4 text-sm text-red-600">{componentsQuery.error.message}</p>
          )}
          {existingMarksQuery.isError && (
            <p className="mb-4 text-sm text-red-600">{existingMarksQuery.error.message}</p>
          )}
          {batchMut.isError && <p className="mb-4 text-sm text-red-600">{batchMut.error.message}</p>}
          {invalidEntries.length > 0 && (
            <p className="mb-4 text-sm text-red-600">
              {invalidEntries.length} row(s) have invalid marks. Marks must be between 0 and {maxMarks}.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="w-16 py-3 text-left font-semibold text-gray-500">#</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                  <th className="w-24 py-3 text-left font-semibold text-gray-500">Roll</th>
                  <th className="w-32 py-3 text-left font-semibold text-gray-500">Existing</th>
                  <th className="w-40 py-3 text-left font-semibold text-gray-500">Marks</th>
                  <th className="w-64 py-3 text-left font-semibold text-gray-500">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {existingMarksQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      Loading existing marks...
                    </td>
                  </tr>
                ) : studentsForClass.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No students found for this class/section.
                    </td>
                  </tr>
                ) : (
                  studentsForClass.map((student, index) => {
                    const existing = getExistingMark(existingMarksQuery.data, student.id);
                    const currentValue = marks[student.id] ?? '';
                    const numericValue = currentValue.trim() === '' ? null : Number(currentValue);
                    const isInvalid =
                      numericValue !== null &&
                      (Number.isNaN(numericValue) || numericValue < 0 || numericValue > maxMarks);
                    const passed = passMarks === null || (existing && Number(existing.marksObtained) >= passMarks);

                    return (
                      <tr key={student.id} className="border-b border-[var(--line)] transition hover:bg-indigo-50/30">
                        <td className="py-2 text-gray-400">{index + 1}</td>
                        <td className="py-2">
                          <span className="font-medium text-gray-950">{getStudentName(student)}</span>
                          <span className="ml-2 text-xs text-gray-400">{student.studentSystemId}</span>
                        </td>
                        <td className="py-2 text-gray-500">{student.rollNumber ?? '—'}</td>
                        <td className="py-2">
                          {existing ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {Number(existing.marksObtained)}/{maxMarks}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">Not entered</span>
                          )}
                        </td>
                        <td className="py-2">
                          <input
                            id={`mark-input-${index}`}
                            type="number"
                            min={0}
                            max={maxMarks}
                            value={currentValue}
                            disabled={isLocked}
                            className={`w-28 rounded-xl border px-3 py-1.5 text-sm transition-colors focus:ring-1 disabled:opacity-50 ${
                              isInvalid
                                ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-200'
                                : 'border-[var(--line)] focus:border-indigo-400 focus:ring-indigo-200'
                            }`}
                            onChange={(event) => {
                              const value = event.target.value;
                              setMarks((current) => {
                                if (value === '') {
                                  const { [student.id]: _removed, ...rest } = current;
                                  return rest;
                                }
                                return { ...current, [student.id]: value };
                              });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === 'ArrowDown') {
                                event.preventDefault();
                                document.getElementById(`mark-input-${index + 1}`)?.focus();
                              }
                              if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                document.getElementById(`mark-input-${index - 1}`)?.focus();
                              }
                            }}
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="text"
                            value={remarks[student.id] ?? ''}
                            disabled={isLocked}
                            placeholder="Optional"
                            className="w-full rounded-xl border border-[var(--line)] px-3 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:opacity-50"
                            onChange={(event) =>
                              setRemarks((current) => ({ ...current, [student.id]: event.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-[var(--line)] bg-gray-50/50 p-12 text-center">
          <p className="text-lg font-semibold text-gray-400">
            Select exam term, class, subject, and component to begin entering marks.
          </p>
          <p className="mt-2 text-sm text-gray-300">
            The roster grid will appear here once all filters are selected.
          </p>
        </section>
      )}
    </div>
  );
}
