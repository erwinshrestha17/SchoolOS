'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const today = new Date().toISOString().slice(0, 10);

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
  const [component, setComponent] = useState({
    examTermId: '',
    subjectId: '',
    name: 'Theory',
    type: 'TERMINAL',
    maxMarks: 100,
    weightPercent: 100,
    passMarks: 35,
  });
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
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: api.listStudents,
  });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.listSubjects(),
  });
  const assignmentsQuery = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: api.listTeacherAssignments,
  });
  const examsQuery = useQuery({
    queryKey: ['exam-terms'],
    queryFn: api.listExamTerms,
  });
  const marksQuery = useQuery({ queryKey: ['marks'], queryFn: () => api.listMarks() });
  const casQuery = useQuery({ queryKey: ['cas-records'], queryFn: api.listCasRecords });
  const reportsQuery = useQuery({
    queryKey: ['report-cards'],
    queryFn: api.listReportCards,
  });
  const promotionsQuery = useQuery({
    queryKey: ['promotion-readiness'],
    queryFn: () =>
      api.listPromotionReadiness({
        academicYearId: report.academicYearId || null,
        classId: cas.classId || null,
      }),
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

  const invalidateAcademics = () => {
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
    void queryClient.invalidateQueries({ queryKey: ['marks'] });
    void queryClient.invalidateQueries({ queryKey: ['cas-records'] });
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
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
    onSuccess: invalidateAcademics,
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
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={subject.code}
                onChange={(event) => setSubject((current) => ({ ...current, code: event.target.value }))}
                placeholder="Code"
              />
              <input
                value={subject.name}
                onChange={(event) => setSubject((current) => ({ ...current, name: event.target.value }))}
                placeholder="Subject name"
              />
              <input
                value={subject.type}
                onChange={(event) => setSubject((current) => ({ ...current, type: event.target.value }))}
                placeholder="CORE"
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!subject.classId || !subject.code || subjectMutation.isPending}
              onClick={() => subjectMutation.mutate(subject)}
            >
              {subjectMutation.isPending ? 'Creating...' : 'Create subject'}
            </button>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={assignment.academicYearId}
                onChange={(event) =>
                  setAssignment((current) => ({ ...current, academicYearId: event.target.value }))
                }
              >
                <option value="">Academic year</option>
                {(academicYearsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={assignment.subjectId}
                onChange={(event) => {
                  const selected = subjectsQuery.data?.find((item) => item.id === event.target.value);
                  setAssignment((current) => ({
                    ...current,
                    subjectId: event.target.value,
                    classId: selected?.classId ?? current.classId,
                  }));
                }}
              >
                <option value="">Subject</option>
                {(subjectsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} / {item.name}
                  </option>
                ))}
              </select>
              <select
                value={assignment.staffId}
                onChange={(event) => setAssignment((current) => ({ ...current, staffId: event.target.value }))}
              >
                <option value="">Teacher/staff</option>
                {(staffQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              <select
                value={assignment.sectionId}
                onChange={(event) =>
                  setAssignment((current) => ({ ...current, sectionId: event.target.value }))
                }
              >
                <option value="">Whole class</option>
                {sectionsForClass.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.class?.name} / {item.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={
                !assignment.academicYearId ||
                !assignment.subjectId ||
                !assignment.staffId ||
                assignmentMutation.isPending
              }
              onClick={() =>
                assignmentMutation.mutate({
                  ...assignment,
                  sectionId: assignment.sectionId || null,
                })
              }
            >
              {assignmentMutation.isPending ? 'Assigning...' : 'Assign teacher'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Exam Setup</p>
          <div className="grid gap-3">
            <select
              value={exam.academicYearId}
              onChange={(event) => setExam((current) => ({ ...current, academicYearId: event.target.value }))}
            >
              <option value="">Academic year</option>
              {(academicYearsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={exam.name}
                onChange={(event) => setExam((current) => ({ ...current, name: event.target.value }))}
                placeholder="Exam name"
              />
              <input
                type="date"
                value={exam.startsOn}
                onChange={(event) => setExam((current) => ({ ...current, startsOn: event.target.value }))}
              />
              <input
                type="date"
                value={exam.endsOn}
                onChange={(event) => setExam((current) => ({ ...current, endsOn: event.target.value }))}
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!exam.academicYearId || !exam.name || examMutation.isPending}
              onClick={() =>
                examMutation.mutate({
                  ...exam,
                  startsOn: new Date(exam.startsOn).toISOString(),
                  endsOn: new Date(exam.endsOn).toISOString(),
                })
              }
            >
              {examMutation.isPending ? 'Creating...' : 'Create exam term'}
            </button>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={component.examTermId}
                onChange={(event) =>
                  setComponent((current) => ({ ...current, examTermId: event.target.value }))
                }
              >
                <option value="">Exam term</option>
                {(examsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={component.subjectId}
                onChange={(event) =>
                  setComponent((current) => ({ ...current, subjectId: event.target.value }))
                }
              >
                <option value="">Subject</option>
                {(subjectsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={component.name}
                onChange={(event) => setComponent((current) => ({ ...current, name: event.target.value }))}
                placeholder="Component"
              />
              <input
                type="number"
                value={component.maxMarks}
                onChange={(event) =>
                  setComponent((current) => ({ ...current, maxMarks: Number(event.target.value) }))
                }
                placeholder="Max marks"
              />
              <input
                type="number"
                value={component.passMarks}
                onChange={(event) =>
                  setComponent((current) => ({ ...current, passMarks: Number(event.target.value) }))
                }
                placeholder="Pass marks"
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!component.examTermId || !component.subjectId || componentMutation.isPending}
              onClick={() => componentMutation.mutate(component)}
            >
              {componentMutation.isPending ? 'Saving...' : 'Add assessment component'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Marks Entry</p>
          <div className="grid gap-3">
            <select
              value={mark.assessmentComponentId}
              onChange={(event) => {
                const selected = examsQuery.data
                  ?.flatMap((item) => item.components ?? [])
                  .find((item) => item.id === event.target.value);
                setMark((current) => ({
                  ...current,
                  assessmentComponentId: event.target.value,
                  examTermId: selected?.examTermId ?? current.examTermId,
                }));
              }}
            >
              <option value="">Component</option>
              {(examsQuery.data ?? []).flatMap((examTerm) =>
                (examTerm.components ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {examTerm.name} / {item.name}
                  </option>
                )),
              )}
            </select>
            <select
              value={mark.studentId}
              onChange={(event) => setMark((current) => ({ ...current, studentId: event.target.value }))}
            >
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.studentSystemId} / {item.fullNameEn ?? `${item.firstNameEn} ${item.lastNameEn}`}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={mark.marksObtained}
              onChange={(event) =>
                setMark((current) => ({ ...current, marksObtained: Number(event.target.value) }))
              }
            />
            <button
              type="button"
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!mark.assessmentComponentId || !mark.studentId || markMutation.isPending}
              onClick={() => markMutation.mutate(mark)}
            >
              {markMutation.isPending ? 'Saving...' : 'Save mark'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">CAS Record</p>
          <div className="grid gap-3">
            <select
              value={cas.studentId}
              onChange={(event) => setCas((current) => ({ ...current, studentId: event.target.value }))}
            >
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.studentSystemId} / {item.fullNameEn ?? `${item.firstNameEn} ${item.lastNameEn}`}
                </option>
              ))}
            </select>
            <input
              value={cas.category}
              onChange={(event) => setCas((current) => ({ ...current, category: event.target.value }))}
              placeholder="CAS category"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                value={cas.score}
                onChange={(event) => setCas((current) => ({ ...current, score: Number(event.target.value) }))}
              />
              <input
                type="number"
                value={cas.maxScore}
                onChange={(event) => setCas((current) => ({ ...current, maxScore: Number(event.target.value) }))}
              />
            </div>
            <textarea
              rows={3}
              value={cas.note}
              onChange={(event) => setCas((current) => ({ ...current, note: event.target.value }))}
            />
            <button
              type="button"
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!cas.academicYearId || !cas.subjectId || !cas.studentId || casMutation.isPending}
              onClick={() =>
                casMutation.mutate({
                  ...cas,
                  sectionId: cas.sectionId || null,
                  observedOn: new Date(cas.observedOn).toISOString(),
                })
              }
            >
              {casMutation.isPending ? 'Saving...' : 'Save CAS'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Report Card</p>
          <div className="grid gap-3">
            <select
              value={report.studentId}
              onChange={(event) => setReport((current) => ({ ...current, studentId: event.target.value }))}
            >
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.studentSystemId}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              value={report.remarks}
              onChange={(event) => setReport((current) => ({ ...current, remarks: event.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={report.lock}
                onChange={(event) => setReport((current) => ({ ...current, lock: event.target.checked }))}
              />
              Lock marks when generated
            </label>
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!report.academicYearId || !report.examTermId || !report.studentId || reportMutation.isPending}
              onClick={() => reportMutation.mutate(report)}
            >
              {reportMutation.isPending ? 'Generating...' : 'Generate report card'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Promotion</p>
          <div className="grid gap-3">
            <select
              value={promotion.studentId}
              onChange={(event) =>
                setPromotion((current) => ({ ...current, studentId: event.target.value }))
              }
            >
              <option value="">Student</option>
              {(studentsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.studentSystemId}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={promotion.academicYearId}
                onChange={(event) =>
                  setPromotion((current) => ({ ...current, academicYearId: event.target.value }))
                }
              >
                <option value="">From year</option>
                {(academicYearsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={promotion.targetAcademicYearId}
                onChange={(event) =>
                  setPromotion((current) => ({
                    ...current,
                    targetAcademicYearId: event.target.value,
                  }))
                }
              >
                <option value="">Target year</option>
                {(academicYearsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={promotion.toClassId}
              onChange={(event) =>
                setPromotion((current) => ({
                  ...current,
                  toClassId: event.target.value,
                  toSectionId: '',
                }))
              }
            >
              <option value="">Target class</option>
              {(classesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={promotion.toSectionId}
              onChange={(event) =>
                setPromotion((current) => ({ ...current, toSectionId: event.target.value }))
              }
            >
              <option value="">Target whole class</option>
              {promotionSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={
                !promotion.studentId ||
                !promotion.academicYearId ||
                !promotion.targetAcademicYearId ||
                !promotion.toClassId ||
                promotionMutation.isPending
              }
              onClick={() =>
                promotionMutation.mutate({
                  ...promotion,
                  toSectionId: promotion.toSectionId || null,
                })
              }
            >
              {promotionMutation.isPending ? 'Promoting...' : 'Promote student'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Subjects"
          items={(subjectsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.code} / ${item.name}`,
            secondary: item.class?.name ?? 'Class',
          }))}
        />
        <SummaryList
          title="Marks"
          items={(marksQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.student?.studentSystemId ?? 'Student'} / ${item.marksObtained}`,
            secondary: item.assessmentComponent?.name ?? 'Component',
          }))}
        />
        <SummaryList
          title="Report Cards"
          items={(reportsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.grade} / ${item.percentage}%`,
            secondary: `${item.status} / GPA ${item.gpa}`,
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Teacher Assignments"
          items={(assignmentsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: item.subject?.name ?? 'Subject',
            secondary: `${item.staff?.firstName ?? 'Teacher'} ${item.staff?.lastName ?? ''}`,
          }))}
        />
        <SummaryList
          title="CAS"
          items={(casQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.category} / ${item.score} of ${item.maxScore}`,
            secondary: item.note ?? 'No note',
          }))}
        />
        <SummaryList
          title="Promotion Readiness"
          items={(promotionsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.reportCardId,
            primary: `${item.studentName} / ${item.status}`,
            secondary: `${item.grade} / ${item.percentage}%`,
          }))}
        />
      </div>

      {[
        subjectMutation,
        assignmentMutation,
        examMutation,
        componentMutation,
        markMutation,
        casMutation,
        reportMutation,
        promotionMutation,
      ].map((mutation, index) =>
        mutation.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutation.error.message}
          </p>
        ) : null,
      )}
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
