'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { AssessmentComponentSummary } from '@schoolos/core';
import { api } from '../../lib/api';
import { academicsApi } from '../../lib/academics-api';

const today = new Date().toISOString().slice(0, 10);

type ComponentFormState = {
  examTermId: string;
  subjectId: string;
  name: string;
  type: 'TERMINAL' | 'CAS' | 'PRACTICAL' | 'PROJECT';
  maxMarks: number;
  weightPercent: number;
  passMarks: number;
};

const defaultComponent: ComponentFormState = {
  examTermId: '',
  subjectId: '',
  name: 'Theory',
  type: 'TERMINAL',
  maxMarks: 100,
  weightPercent: 100,
  passMarks: 35,
};

export function AcademicsForm() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState({
    classId: '',
    code: 'ENG-1',
    name: 'English',
    type: 'CORE',
    theoryMarks: 100,
    passMarks: 35,
  });
  const [assignment, setAssignment] = useState({
    academicYearId: '',
    subjectId: '',
    staffId: '',
    classId: '',
    sectionId: '',
  });
  const [exam, setExam] = useState({
    academicYearId: '',
    name: 'First Terminal',
    startsOn: today,
    endsOn: today,
    weightPercent: 60,
  });
  const [component, setComponent] = useState<ComponentFormState>(defaultComponent);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [blockedComponentDeletes, setBlockedComponentDeletes] = useState<Set<string>>(
    () => new Set(),
  );
  const [mark, setMark] = useState({
    examTermId: '',
    assessmentComponentId: '',
    studentId: '',
    marksObtained: 76,
  });
  const [cas, setCas] = useState({
    academicYearId: '',
    subjectId: '',
    studentId: '',
    classId: '',
    sectionId: '',
    category: 'Classwork',
    score: 18,
    maxScore: 20,
    observedOn: today,
    note: 'Consistent participation',
  });
  const [report, setReport] = useState({
    academicYearId: '',
    examTermId: '',
    studentId: '',
    remarks: 'Ready for next academic milestone',
    lock: true,
  });
  const [promotion, setPromotion] = useState({
    academicYearId: '',
    targetAcademicYearId: '',
    studentId: '',
    toClassId: '',
    toSectionId: '',
    remarks: 'Promoted after locked report card review',
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: api.listStudents });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.listSubjects(),
  });
  const assignmentsQuery = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: api.listTeacherAssignments,
  });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const componentListQuery = useQuery({
    queryKey: ['assessment-components', component.examTermId, component.subjectId || 'all'],
    queryFn: () =>
      academicsApi.listAssessmentComponents(component.examTermId, {
        subjectId: component.subjectId || null,
      }),
    enabled: Boolean(component.examTermId),
  });
  const marksQuery = useQuery({ queryKey: ['marks'], queryFn: () => api.listMarks() });
  const casQuery = useQuery({ queryKey: ['cas-records'], queryFn: api.listCasRecords });
  const reportsQuery = useQuery({ queryKey: ['report-cards'], queryFn: api.listReportCards });
  const promotionsQuery = useQuery({
    queryKey: ['promotion-readiness', report.academicYearId, cas.classId],
    queryFn: () =>
      api.listPromotionReadiness({
        academicYearId: report.academicYearId,
        classId: cas.classId || null,
      }),
    enabled: Boolean(report.academicYearId),
  });

  useEffect(() => {
    const currentYear = academicYearsQuery.data?.find((year) => year.isCurrent);
    const year = currentYear ?? academicYearsQuery.data?.[0];

    if (year) {
      setAssignment((current) =>
        current.academicYearId ? current : { ...current, academicYearId: year.id },
      );
      setExam((current) =>
        current.academicYearId ? current : { ...current, academicYearId: year.id },
      );
      setCas((current) =>
        current.academicYearId ? current : { ...current, academicYearId: year.id },
      );
      setReport((current) =>
        current.academicYearId ? current : { ...current, academicYearId: year.id },
      );
      setPromotion((current) =>
        current.academicYearId ? current : { ...current, academicYearId: year.id },
      );
    }

    const targetYear = academicYearsQuery.data?.find((item) => item.id !== year?.id);

    if (targetYear) {
      setPromotion((current) =>
        current.targetAcademicYearId
          ? current
          : { ...current, targetAcademicYearId: targetYear.id },
      );
    }
  }, [academicYearsQuery.data]);

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setSubject((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setAssignment((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setCas((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setPromotion((current) =>
        current.toClassId ? current : { ...current, toClassId: firstClass.id },
      );
    }
  }, [classesQuery.data]);

  useEffect(() => {
    const firstSubject = subjectsQuery.data?.[0];

    if (firstSubject) {
      setAssignment((current) =>
        current.subjectId
          ? current
          : { ...current, subjectId: firstSubject.id, classId: firstSubject.classId },
      );
      setComponent((current) =>
        current.subjectId ? current : { ...current, subjectId: firstSubject.id },
      );
      setCas((current) =>
        current.subjectId
          ? current
          : { ...current, subjectId: firstSubject.id, classId: firstSubject.classId },
      );
    }
  }, [subjectsQuery.data]);

  useEffect(() => {
    const firstStaff = staffQuery.data?.[0];

    if (firstStaff) {
      setAssignment((current) => (current.staffId ? current : { ...current, staffId: firstStaff.id }));
    }
  }, [staffQuery.data]);

  useEffect(() => {
    const firstExam = examsQuery.data?.[0];
    const firstComponent = firstExam?.components?.[0];

    if (firstExam) {
      setComponent((current) =>
        current.examTermId ? current : { ...current, examTermId: firstExam.id },
      );
      setMark((current) => (current.examTermId ? current : { ...current, examTermId: firstExam.id }));
      setReport((current) => (current.examTermId ? current : { ...current, examTermId: firstExam.id }));
    }

    if (firstComponent) {
      setMark((current) =>
        current.assessmentComponentId
          ? current
          : {
              ...current,
              assessmentComponentId: firstComponent.id,
              examTermId: firstComponent.examTermId,
            },
      );
    }
  }, [examsQuery.data]);

  useEffect(() => {
    const firstStudent = studentsQuery.data?.[0];

    if (firstStudent) {
      setMark((current) => (current.studentId ? current : { ...current, studentId: firstStudent.id }));
      setCas((current) =>
        current.studentId
          ? current
          : {
              ...current,
              studentId: firstStudent.id,
              classId: firstStudent.class?.id ?? current.classId,
            },
      );
      setReport((current) => (current.studentId ? current : { ...current, studentId: firstStudent.id }));
      setPromotion((current) =>
        current.studentId ? current : { ...current, studentId: firstStudent.id },
      );
    }
  }, [studentsQuery.data]);

  const selectedComponents = componentListQuery.data ?? [];
  const availableComponents = selectedComponents.length
    ? selectedComponents
    : (examsQuery.data ?? []).flatMap((item) => item.components ?? []);

  const componentWeight = useMemo(() => {
    const used = selectedComponents.reduce(
      (sum, item) => sum + Number(item.weightPercent ?? 0),
      0,
    );
    return {
      used,
      remaining: Math.max(0, 100 - used),
      tone: used > 100 ? 'danger' : used >= 90 ? 'warning' : 'safe',
    };
  }, [selectedComponents]);

  const invalidateAcademics = () => {
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
    void queryClient.invalidateQueries({ queryKey: ['assessment-components'] });
    void queryClient.invalidateQueries({ queryKey: ['marks'] });
    void queryClient.invalidateQueries({ queryKey: ['cas-records'] });
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
  };

  const resetComponentForm = () => {
    setEditingComponentId(null);
    setComponent((current) => ({
      ...defaultComponent,
      examTermId: current.examTermId,
      subjectId: current.subjectId,
    }));
  };

  const subjectMutation = useMutation({
    mutationFn: api.createSubject,
    onSuccess: invalidateAcademics,
  });
  const assignmentMutation = useMutation({
    mutationFn: api.createTeacherAssignment,
    onSuccess: invalidateAcademics,
  });
  const examMutation = useMutation({
    mutationFn: api.createExamTerm,
    onSuccess: invalidateAcademics,
  });
  const componentMutation = useMutation({
    mutationFn: api.createAssessmentComponent,
    onSuccess: () => {
      invalidateAcademics();
      resetComponentForm();
    },
  });
  const componentUpdateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      academicsApi.updateAssessmentComponent(id, body),
    onSuccess: () => {
      invalidateAcademics();
      resetComponentForm();
    },
  });
  const componentDeleteMutation = useMutation({
    mutationFn: (id: string) => academicsApi.deleteAssessmentComponent(id),
    onError: (_error, id) => {
      setBlockedComponentDeletes((current) => new Set(current).add(id));
    },
    onSuccess: () => {
      invalidateAcademics();
    },
  });
  const markMutation = useMutation({
    mutationFn: api.enterMark,
    onSuccess: invalidateAcademics,
  });
  const casMutation = useMutation({
    mutationFn: api.createCasRecord,
    onSuccess: invalidateAcademics,
  });
  const reportMutation = useMutation({
    mutationFn: api.generateReportCard,
    onSuccess: invalidateAcademics,
  });
  const promotionMutation = useMutation({
    mutationFn: api.promoteStudent,
    onSuccess: invalidateAcademics,
  });

  const sectionsForClass = (sectionsQuery.data ?? []).filter(
    (sectionItem) => sectionItem.classId === assignment.classId || sectionItem.classId === cas.classId,
  );
  const promotionSections = (sectionsQuery.data ?? []).filter(
    (sectionItem) => sectionItem.classId === promotion.toClassId,
  );
  const componentFormPending = componentMutation.isPending || componentUpdateMutation.isPending;

  const startEditComponent = (item: AssessmentComponentSummary) => {
    setEditingComponentId(item.id);
    setComponent({
      examTermId: item.examTermId,
      subjectId: item.subjectId,
      name: item.name,
      type: (item.type as ComponentFormState['type']) ?? 'TERMINAL',
      maxMarks: Number(item.maxMarks),
      weightPercent: Number(item.weightPercent ?? 100),
      passMarks: Number(item.passMarks ?? 0),
    });
  };

  const saveComponent = () => {
    const payload = {
      ...component,
      passMarks: component.passMarks || undefined,
    };

    if (editingComponentId) {
      componentUpdateMutation.mutate({ id: editingComponentId, body: payload });
      return;
    }

    componentMutation.mutate(payload);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Subjects & Teacher Assignment</p>
          <div className="grid gap-3">
            <select
              value={subject.classId}
              onChange={(event) => setSubject((current) => ({ ...current, classId: event.target.value }))}
            >
              <option value="">Class</option>
              {(classesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input value={subject.code} onChange={(event) => setSubject((current) => ({ ...current, code: event.target.value }))} placeholder="Code" />
              <input value={subject.name} onChange={(event) => setSubject((current) => ({ ...current, name: event.target.value }))} placeholder="Subject name" />
              <input value={subject.type} onChange={(event) => setSubject((current) => ({ ...current, type: event.target.value }))} placeholder="CORE" />
            </div>
            <button type="button" className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!subject.classId || !subject.code || subjectMutation.isPending} onClick={() => subjectMutation.mutate(subject)}>
              {subjectMutation.isPending ? 'Creating...' : 'Create subject'}
            </button>

            <div className="grid gap-3 md:grid-cols-2">
              <select value={assignment.academicYearId} onChange={(event) => setAssignment((current) => ({ ...current, academicYearId: event.target.value }))}>
                <option value="">Academic year</option>
                {(academicYearsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={assignment.subjectId} onChange={(event) => {
                const selected = subjectsQuery.data?.find((item) => item.id === event.target.value);
                setAssignment((current) => ({ ...current, subjectId: event.target.value, classId: selected?.classId ?? current.classId }));
              }}>
                <option value="">Subject</option>
                {(subjectsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} / {item.name}</option>)}
              </select>
              <select value={assignment.staffId} onChange={(event) => setAssignment((current) => ({ ...current, staffId: event.target.value }))}>
                <option value="">Teacher/staff</option>
                {(staffQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
              </select>
              <select value={assignment.sectionId} onChange={(event) => setAssignment((current) => ({ ...current, sectionId: event.target.value }))}>
                <option value="">Whole class</option>
                {sectionsForClass.map((item) => <option key={item.id} value={item.id}>{item.class?.name} / {item.name}</option>)}
              </select>
            </div>
            <button type="button" className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!assignment.academicYearId || !assignment.subjectId || !assignment.staffId || assignmentMutation.isPending} onClick={() => assignmentMutation.mutate({ ...assignment, sectionId: assignment.sectionId || null })}>
              {assignmentMutation.isPending ? 'Assigning...' : 'Assign teacher'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Exam Terms</p>
          <div className="grid gap-3">
            <select value={exam.academicYearId} onChange={(event) => setExam((current) => ({ ...current, academicYearId: event.target.value }))}>
              <option value="">Academic year</option>
              {(academicYearsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input value={exam.name} onChange={(event) => setExam((current) => ({ ...current, name: event.target.value }))} placeholder="Exam name" />
              <input type="date" value={exam.startsOn} onChange={(event) => setExam((current) => ({ ...current, startsOn: event.target.value }))} />
              <input type="date" value={exam.endsOn} onChange={(event) => setExam((current) => ({ ...current, endsOn: event.target.value }))} />
            </div>
            <button type="button" className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!exam.academicYearId || !exam.name || examMutation.isPending} onClick={() => examMutation.mutate({ ...exam, startsOn: new Date(exam.startsOn).toISOString(), endsOn: new Date(exam.endsOn).toISOString() })}>
              {examMutation.isPending ? 'Creating...' : 'Create exam term'}
            </button>
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="label">Assessment Components</p>
            <h3 className="text-xl font-semibold">Configure marks structure per exam and subject</h3>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm ${componentWeight.tone === 'danger' ? 'border-red-200 bg-red-50 text-red-700' : componentWeight.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[var(--line)] bg-white/60 text-[var(--muted)]'}`}>
            Used {componentWeight.used}% / Remaining {componentWeight.remaining}%
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.35fr]">
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select value={component.examTermId} onChange={(event) => {
                setEditingComponentId(null);
                setComponent((current) => ({ ...current, examTermId: event.target.value }));
              }}>
                <option value="">Exam term</option>
                {(examsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={component.subjectId} onChange={(event) => {
                setEditingComponentId(null);
                setComponent((current) => ({ ...current, subjectId: event.target.value }));
              }}>
                <option value="">All subjects</option>
                {(subjectsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} / {item.name}</option>)}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input value={component.name} onChange={(event) => setComponent((current) => ({ ...current, name: event.target.value }))} placeholder="Component name" />
              <select value={component.type} onChange={(event) => setComponent((current) => ({ ...current, type: event.target.value as ComponentFormState['type'] }))}>
                <option value="TERMINAL">Terminal</option>
                <option value="PRACTICAL">Practical</option>
                <option value="PROJECT">Project</option>
                <option value="CAS">CAS</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input type="number" min={1} value={component.maxMarks} onChange={(event) => setComponent((current) => ({ ...current, maxMarks: Number(event.target.value) }))} placeholder="Max marks" />
              <input type="number" min={0} value={component.passMarks} onChange={(event) => setComponent((current) => ({ ...current, passMarks: Number(event.target.value) }))} placeholder="Pass marks" />
              <input type="number" min={1} max={100} value={component.weightPercent} onChange={(event) => setComponent((current) => ({ ...current, weightPercent: Number(event.target.value) }))} placeholder="Weight %" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!component.examTermId || !component.subjectId || !component.name || componentFormPending} onClick={saveComponent}>
                {componentFormPending ? 'Saving...' : editingComponentId ? 'Update component' : 'Add component'}
              </button>
              {editingComponentId && (
                <button type="button" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--ink)]" onClick={resetComponentForm}>
                  Cancel edit
                </button>
              )}
            </div>
            {componentWeight.used >= 90 && (
              <p className="text-sm text-amber-700">
                Component weight is {componentWeight.used}%. Keep total weight at 100% or below before marks entry.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-white/50 p-4">
            {componentListQuery.isLoading ? (
              <p className="text-sm text-[var(--muted)]">Loading assessment components...</p>
            ) : componentListQuery.isError ? (
              <p className="text-sm text-[var(--accent-dark)]">{componentListQuery.error.message}</p>
            ) : selectedComponents.length > 0 ? (
              <div className="grid gap-3">
                {selectedComponents.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold">{item.name} · {item.type}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {item.subject?.code} / {item.subject?.name} · Max {Number(item.maxMarks)} · Pass {item.passMarks === null ? 'N/A' : Number(item.passMarks)} · Weight {Number(item.weightPercent)}%
                        </p>
                        {blockedComponentDeletes.has(item.id) && (
                          <p className="mt-2 text-xs text-[var(--accent-dark)]">
                            Delete blocked because this component already has marks or dependent records.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold" onClick={() => startEditComponent(item)}>
                          Edit
                        </button>
                        <button type="button" className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={componentDeleteMutation.isPending || blockedComponentDeletes.has(item.id)} onClick={() => componentDeleteMutation.mutate(item.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Select an exam term and subject, then add the first assessment component.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-4">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Marks Entry</p>
          <div className="grid gap-3">
            <select value={mark.assessmentComponentId} onChange={(event) => {
              const selected = availableComponents.find((item) => item.id === event.target.value);
              setMark((current) => ({ ...current, assessmentComponentId: event.target.value, examTermId: selected?.examTermId ?? current.examTermId }));
            }}>
              <option value="">Component</option>
              {availableComponents.map((item) => <option key={item.id} value={item.id}>{item.examTerm?.name ?? 'Exam'} / {item.name}</option>)}
            </select>
            <select value={mark.studentId} onChange={(event) => setMark((current) => ({ ...current, studentId: event.target.value }))}>
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.studentSystemId} / {item.fullNameEn ?? `${item.firstNameEn} ${item.lastNameEn}`}</option>)}
            </select>
            <input type="number" value={mark.marksObtained} onChange={(event) => setMark((current) => ({ ...current, marksObtained: Number(event.target.value) }))} />
            <button type="button" className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!mark.assessmentComponentId || !mark.studentId || markMutation.isPending} onClick={() => markMutation.mutate(mark)}>
              {markMutation.isPending ? 'Saving...' : 'Save mark'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">CAS Record</p>
          <div className="grid gap-3">
            <select value={cas.studentId} onChange={(event) => setCas((current) => ({ ...current, studentId: event.target.value }))}>
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.studentSystemId} / {item.fullNameEn ?? `${item.firstNameEn} ${item.lastNameEn}`}</option>)}
            </select>
            <input value={cas.category} onChange={(event) => setCas((current) => ({ ...current, category: event.target.value }))} placeholder="CAS category" />
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" value={cas.score} onChange={(event) => setCas((current) => ({ ...current, score: Number(event.target.value) }))} />
              <input type="number" value={cas.maxScore} onChange={(event) => setCas((current) => ({ ...current, maxScore: Number(event.target.value) }))} />
            </div>
            <textarea rows={3} value={cas.note} onChange={(event) => setCas((current) => ({ ...current, note: event.target.value }))} />
            <button type="button" className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!cas.academicYearId || !cas.subjectId || !cas.studentId || casMutation.isPending} onClick={() => casMutation.mutate({ ...cas, sectionId: cas.sectionId || null, observedOn: new Date(cas.observedOn).toISOString() })}>
              {casMutation.isPending ? 'Saving...' : 'Save CAS'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Report Card</p>
          <div className="grid gap-3">
            <select value={report.studentId} onChange={(event) => setReport((current) => ({ ...current, studentId: event.target.value }))}>
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.studentSystemId}</option>)}
            </select>
            <textarea rows={3} value={report.remarks} onChange={(event) => setReport((current) => ({ ...current, remarks: event.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" checked={report.lock} onChange={(event) => setReport((current) => ({ ...current, lock: event.target.checked }))} />
              Lock marks when generated
            </label>
            <button type="button" className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!report.academicYearId || !report.examTermId || !report.studentId || reportMutation.isPending} onClick={() => reportMutation.mutate(report)}>
              {reportMutation.isPending ? 'Generating...' : 'Generate report card'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Promotion</p>
          <div className="grid gap-3">
            <select value={promotion.studentId} onChange={(event) => setPromotion((current) => ({ ...current, studentId: event.target.value }))}>
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.studentSystemId}</option>)}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={promotion.academicYearId} onChange={(event) => setPromotion((current) => ({ ...current, academicYearId: event.target.value }))}>
                <option value="">From year</option>
                {(academicYearsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={promotion.targetAcademicYearId} onChange={(event) => setPromotion((current) => ({ ...current, targetAcademicYearId: event.target.value }))}>
                <option value="">Target year</option>
                {(academicYearsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <select value={promotion.toClassId} onChange={(event) => setPromotion((current) => ({ ...current, toClassId: event.target.value, toSectionId: '' }))}>
              <option value="">Target class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={promotion.toSectionId} onChange={(event) => setPromotion((current) => ({ ...current, toSectionId: event.target.value }))}>
              <option value="">Target whole class</option>
              {promotionSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="button" className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!promotion.studentId || !promotion.academicYearId || !promotion.targetAcademicYearId || !promotion.toClassId || promotionMutation.isPending} onClick={() => promotionMutation.mutate({ ...promotion, toSectionId: promotion.toSectionId || null })}>
              {promotionMutation.isPending ? 'Promoting...' : 'Promote student'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList title="Subjects" items={(subjectsQuery.data ?? []).slice(0, 5).map((item) => ({ id: item.id, primary: `${item.code} / ${item.name}`, secondary: item.class?.name ?? 'Class' }))} />
        <SummaryList title="Components" items={selectedComponents.slice(0, 5).map((item) => ({ id: item.id, primary: `${item.name} / ${Number(item.weightPercent)}%`, secondary: `${item.subject?.code ?? 'Subject'} · Max ${Number(item.maxMarks)}` }))} />
        <SummaryList title="Report Cards" items={(reportsQuery.data ?? []).slice(0, 5).map((item) => ({ id: item.id, primary: `${item.grade} / ${item.percentage}%`, secondary: `${item.status} / GPA ${item.gpa}` }))} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList title="Teacher Assignments" items={(assignmentsQuery.data ?? []).slice(0, 5).map((item) => ({ id: item.id, primary: item.subject?.name ?? 'Subject', secondary: `${item.staff?.firstName ?? 'Teacher'} ${item.staff?.lastName ?? ''}` }))} />
        <SummaryList title="CAS" items={(casQuery.data ?? []).slice(0, 5).map((item) => ({ id: item.id, primary: `${item.category} / ${item.score} of ${item.maxScore}`, secondary: item.note ?? 'No note' }))} />
        <SummaryList title="Promotion Readiness" items={(promotionsQuery.data ?? []).slice(0, 5).map((item) => ({ id: item.reportCardId ?? item.studentId, primary: `${item.studentName} / ${item.status}`, secondary: `${item.grade} / ${item.percentage}%` }))} />
      </div>

      <MutationErrors
        errors={[
          subjectMutation.error,
          assignmentMutation.error,
          examMutation.error,
          componentMutation.error,
          componentUpdateMutation.error,
          componentDeleteMutation.error,
          markMutation.error,
          casMutation.error,
          reportMutation.error,
          promotionMutation.error,
        ]}
      />
    </div>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">{title}</p>
      <div className="grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <p className="font-semibold">{item.primary}</p>
              <p className="text-sm text-[var(--muted)]">{item.secondary}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No records yet.</p>
        )}
      </div>
    </section>
  );
}

function MutationErrors({ errors }: { errors: Array<Error | null> }) {
  const visibleErrors = errors.filter((error): error is Error => Boolean(error));

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      {visibleErrors.map((error, index) => (
        <p key={`${error.message}-${index}`} className="text-sm text-[var(--accent-dark)]">
          {error.message}
        </p>
      ))}
    </div>
  );
}
