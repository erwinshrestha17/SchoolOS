'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export function TimetableHomeworkForm() {
  const queryClient = useQueryClient();
  const [slot, setSlot] = useState({
    academicYearId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    staffId: '',
    dayOfWeek: 1,
    startsAt: '09:00',
    endsAt: '09:45',
    room: 'Room 1',
  });
  const [homework, setHomework] = useState({
    academicYearId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    assignedByStaffId: '',
    title: 'Reading practice',
    instructions: 'Read the assigned page and bring two questions tomorrow.',
    dueAt: `${tomorrow}T17:00`,
    maxScore: 10,
  });
  const [review, setReview] = useState({
    submissionId: '',
    status: 'REVIEWED',
    score: 8,
    feedback: 'Good effort',
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: api.listSubjects });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const timetableQuery = useQuery({
    queryKey: ['timetable'],
    queryFn: api.listTimetable,
  });
  const homeworkQuery = useQuery({
    queryKey: ['homework'],
    queryFn: api.listHomework,
  });
  const submissionsQuery = useQuery({
    queryKey: ['homework-submissions'],
    queryFn: api.listHomeworkSubmissions,
  });

  useEffect(() => {
    const currentYear = academicYearsQuery.data?.find((year) => year.isCurrent);
    const year = currentYear ?? academicYearsQuery.data?.[0];

    if (year) {
      setSlot((current) => (current.academicYearId ? current : { ...current, academicYearId: year.id }));
      setHomework((current) =>
        current.academicYearId ? current : { ...current, academicYearId: year.id },
      );
    }
  }, [academicYearsQuery.data]);

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setSlot((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setHomework((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
    }
  }, [classesQuery.data]);

  useEffect(() => {
    const firstSubject = subjectsQuery.data?.[0];

    if (firstSubject) {
      setSlot((current) =>
        current.subjectId
          ? current
          : { ...current, subjectId: firstSubject.id, classId: firstSubject.classId },
      );
      setHomework((current) =>
        current.subjectId
          ? current
          : { ...current, subjectId: firstSubject.id, classId: firstSubject.classId },
      );
    }
  }, [subjectsQuery.data]);

  useEffect(() => {
    const firstStaff = staffQuery.data?.[0];

    if (firstStaff) {
      setSlot((current) => (current.staffId ? current : { ...current, staffId: firstStaff.id }));
      setHomework((current) =>
        current.assignedByStaffId ? current : { ...current, assignedByStaffId: firstStaff.id },
      );
    }
  }, [staffQuery.data]);

  useEffect(() => {
    const firstSubmission = submissionsQuery.data?.[0];

    if (firstSubmission) {
      setReview((current) =>
        current.submissionId ? current : { ...current, submissionId: firstSubmission.id },
      );
    }
  }, [submissionsQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['timetable'] });
    void queryClient.invalidateQueries({ queryKey: ['homework'] });
    void queryClient.invalidateQueries({ queryKey: ['homework-submissions'] });
    void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };
  const slotMutation = useMutation({
    mutationFn: api.createTimetableSlot,
    onSuccess: invalidate,
  });
  const homeworkMutation = useMutation({
    mutationFn: api.createHomework,
    onSuccess: invalidate,
  });
  const reviewMutation = useMutation({
    mutationFn: api.reviewHomeworkSubmission,
    onSuccess: invalidate,
  });

  const sectionsForSlotClass = (sectionsQuery.data ?? []).filter(
    (item) => item.classId === slot.classId,
  );
  const sectionsForHomeworkClass = (sectionsQuery.data ?? []).filter(
    (item) => item.classId === homework.classId,
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Weekly Timetable Slot</p>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <SelectAcademicYear
                value={slot.academicYearId}
                years={academicYearsQuery.data ?? []}
                onChange={(value) => setSlot((current) => ({ ...current, academicYearId: value }))}
              />
              <select
                value={slot.classId}
                onChange={(event) => setSlot((current) => ({ ...current, classId: event.target.value }))}
              >
                <option value="">Class</option>
                {(classesQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={slot.sectionId}
                onChange={(event) => setSlot((current) => ({ ...current, sectionId: event.target.value }))}
              >
                <option value="">Whole class</option>
                {sectionsForSlotClass.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={slot.subjectId}
                onChange={(event) => setSlot((current) => ({ ...current, subjectId: event.target.value }))}
              >
                <option value="">Subject</option>
                {(subjectsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} / {item.name}
                  </option>
                ))}
              </select>
              <select
                value={slot.staffId}
                onChange={(event) => setSlot((current) => ({ ...current, staffId: event.target.value }))}
              >
                <option value="">Teacher</option>
                {(staffQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              <select
                value={slot.dayOfWeek}
                onChange={(event) => setSlot((current) => ({ ...current, dayOfWeek: Number(event.target.value) }))}
              >
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                  <option key={day} value={index + 1}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="time"
                value={slot.startsAt}
                onChange={(event) => setSlot((current) => ({ ...current, startsAt: event.target.value }))}
              />
              <input
                type="time"
                value={slot.endsAt}
                onChange={(event) => setSlot((current) => ({ ...current, endsAt: event.target.value }))}
              />
              <input
                value={slot.room}
                onChange={(event) => setSlot((current) => ({ ...current, room: event.target.value }))}
                placeholder="Room"
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!slot.academicYearId || !slot.classId || !slot.subjectId || !slot.staffId || slotMutation.isPending}
              onClick={() => slotMutation.mutate({ ...slot, sectionId: slot.sectionId || null })}
            >
              {slotMutation.isPending ? 'Scheduling...' : 'Create timetable slot'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Homework Publisher</p>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <SelectAcademicYear
                value={homework.academicYearId}
                years={academicYearsQuery.data ?? []}
                onChange={(value) =>
                  setHomework((current) => ({ ...current, academicYearId: value }))
                }
              />
              <select
                value={homework.classId}
                onChange={(event) => setHomework((current) => ({ ...current, classId: event.target.value }))}
              >
                <option value="">Class</option>
                {(classesQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={homework.sectionId}
                onChange={(event) =>
                  setHomework((current) => ({ ...current, sectionId: event.target.value }))
                }
              >
                <option value="">Whole class</option>
                {sectionsForHomeworkClass.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={homework.subjectId}
                onChange={(event) =>
                  setHomework((current) => ({ ...current, subjectId: event.target.value }))
                }
              >
                <option value="">Subject</option>
                {(subjectsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} / {item.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={homework.title}
              onChange={(event) => setHomework((current) => ({ ...current, title: event.target.value }))}
              placeholder="Homework title"
            />
            <textarea
              rows={4}
              value={homework.instructions}
              onChange={(event) =>
                setHomework((current) => ({ ...current, instructions: event.target.value }))
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="datetime-local"
                value={homework.dueAt}
                onChange={(event) => setHomework((current) => ({ ...current, dueAt: event.target.value }))}
              />
              <input
                type="number"
                value={homework.maxScore}
                onChange={(event) =>
                  setHomework((current) => ({ ...current, maxScore: Number(event.target.value) }))
                }
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!homework.academicYearId || !homework.classId || !homework.subjectId || homeworkMutation.isPending}
              onClick={() =>
                homeworkMutation.mutate({
                  ...homework,
                  sectionId: homework.sectionId || null,
                  assignedByStaffId: homework.assignedByStaffId || null,
                  dueAt: new Date(homework.dueAt).toISOString(),
                })
              }
            >
              {homeworkMutation.isPending ? 'Publishing...' : 'Publish homework'}
            </button>
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Submission Review</p>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={review.submissionId}
            onChange={(event) => setReview((current) => ({ ...current, submissionId: event.target.value }))}
          >
            <option value="">Submission</option>
            {(submissionsQuery.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.student?.studentSystemId ?? 'Student'} / {item.status}
              </option>
            ))}
          </select>
          <select
            value={review.status}
            onChange={(event) => setReview((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="SUBMITTED">Submitted</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="LATE">Late</option>
          </select>
          <input
            type="number"
            value={review.score}
            onChange={(event) => setReview((current) => ({ ...current, score: Number(event.target.value) }))}
          />
          <button
            type="button"
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
            disabled={!review.submissionId || reviewMutation.isPending}
            onClick={() => reviewMutation.mutate(review)}
          >
            {reviewMutation.isPending ? 'Reviewing...' : 'Review submission'}
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Timetable"
          items={(timetableQuery.data ?? []).slice(0, 6).map((item) => ({
            id: item.id,
            primary: `Day ${item.dayOfWeek} / ${item.startsAt}-${item.endsAt}`,
            secondary: `${item.subject?.name ?? 'Subject'} / ${item.staff?.firstName ?? 'Teacher'}`,
          }))}
        />
        <SummaryList
          title="Homework"
          items={(homeworkQuery.data ?? []).slice(0, 6).map((item) => ({
            id: item.id,
            primary: item.title,
            secondary: `${item.submissions?.length ?? 0} submissions / due ${new Date(item.dueAt).toLocaleString()}`,
          }))}
        />
        <SummaryList
          title="Submissions"
          items={(submissionsQuery.data ?? []).slice(0, 6).map((item) => ({
            id: item.id,
            primary: `${item.student?.studentSystemId ?? 'Student'} / ${item.status}`,
            secondary: item.feedback ?? 'Awaiting feedback',
          }))}
        />
      </div>

      {[slotMutation, homeworkMutation, reviewMutation].map((mutation, index) =>
        mutation.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutation.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}

function SelectAcademicYear({
  value,
  years,
  onChange,
}: {
  value: string;
  years: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Academic year</option>
      {years.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
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
