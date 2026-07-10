'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatBsDate, type StudentProfile } from '@schoolos/core';
import { api } from '../../../../lib/api';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { EmptyState } from '../../../../components/ui/empty-state';
import { LoadingState } from '../../../../components/ui/loading-state';
import { FormField, Input, Select, TextArea } from '../../../../components/ui/form-field';
import { Badge } from '../../../../components/ui/badge';

const today = new Date().toISOString().slice(0, 10);
const statuses = ['EMERGING', 'PROGRESSING', 'ACHIEVED', 'NEEDS_SUPPORT'] as const;

function newClientSubmissionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `csid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ActivityMilestonesPage() {
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientSubmissionId, setClientSubmissionId] = useState(newClientSubmissionId);

  const studentsQuery = useQuery({
    queryKey: ['students-for-milestones'],
    queryFn: () => api.listStudents({ limit: 1000 }),
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const templatesQuery = useQuery({
    queryKey: ['milestone-templates'],
    queryFn: () => api.listMilestoneTemplates(),
  });
  const milestonesQuery = useQuery({
    queryKey: ['developmental-milestones', selectedStudentId, monthFilter],
    queryFn: () =>
      api.listDevelopmentalMilestones({
        studentId: selectedStudentId || null,
        month: monthFilter || null,
      }),
    enabled: Boolean(selectedStudentId),
  });

  const students: StudentProfile[] = studentsQuery.data?.items ?? [];
  const filteredStudents = students.filter((student) =>
    studentDisplayName(student).toLowerCase().includes(studentSearch.toLowerCase()),
  );
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const templates = templatesQuery.data ?? [];

  const milestones = (milestonesQuery.data ?? []).filter((item) => {
    const matchesDomain =
      !domainFilter || item.domain.toLowerCase().includes(domainFilter.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesDomain && matchesStatus;
  });

  const [form, setForm] = useState({
    domain: '',
    milestone: '',
    status: 'PROGRESSING' as (typeof statuses)[number],
    observationNote: '',
    observedAt: today,
  });

  const mutation = useMutation({
    mutationFn: api.createDevelopmentalMilestone,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['developmental-milestones'] });
      setForm({
        domain: '',
        milestone: '',
        status: 'PROGRESSING',
        observationNote: '',
        observedAt: today,
      });
      setClientSubmissionId(newClientSubmissionId());
    },
  });

  const selectedStudentClass = useMemo(
    () => classes.find((classroom) => classroom.id === selectedStudent?.class?.id) ?? null,
    [classes, selectedStudent],
  );

  function save() {
    if (!selectedStudentId || !selectedStudentClass) return;
    mutation.mutate({
      clientSubmissionId,
      classId: selectedStudentClass.id,
      studentId: selectedStudentId,
      domain: form.domain.trim(),
      milestone: form.milestone.trim(),
      status: form.status,
      observationNote: form.observationNote || null,
      observedAt: new Date(form.observedAt).toISOString(),
    });
  }

  return (
    <DashboardPageShell>
      <PageHeader
        title="Milestones"
        description="Student-first developmental and social milestones. Language stays supportive and non-comparative between children."
      />

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Input
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            placeholder="Search students..."
          />
          <div className="max-h-[32rem] space-y-1 overflow-y-auto">
            {studentsQuery.isLoading ? (
              <LoadingState />
            ) : filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                    selectedStudentId === student.id
                      ? 'bg-[var(--color-mod-activity-accent)] text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {studentDisplayName(student)}
                </button>
              ))
            ) : (
              <EmptyState title="No students" description="No students match this search." />
            )}
          </div>
        </aside>

        <div className="space-y-6">
          {!selectedStudentId ? (
            <EmptyState
              title="Select a student"
              description="Choose a student from the list to view and log milestones."
            />
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-950">
                    {studentDisplayName(selectedStudent!)}
                  </h2>
                  <Badge variant="secondary">{milestones.length} recorded</Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Input
                    type="month"
                    value={monthFilter}
                    onChange={(event) => setMonthFilter(event.target.value)}
                  />
                  <Input
                    value={domainFilter}
                    onChange={(event) => setDomainFilter(event.target.value)}
                    placeholder="Filter by domain"
                  />
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {formatEnumLabel(status)}
                      </option>
                    ))}
                  </Select>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-400">
                  Timeline
                </h3>
                {milestonesQuery.isLoading ? (
                  <LoadingState />
                ) : milestones.length > 0 ? (
                  <div className="space-y-4">
                    {milestones.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-black uppercase tracking-tight text-slate-900">
                            {item.milestone}
                          </h4>
                          <Badge variant="outline">{formatEnumLabel(item.status)}</Badge>
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {item.domain} · {formatBsDate(item.observedAt)}
                        </p>
                        {item.observationNote ? (
                          <p className="mt-2 border-l-2 border-slate-200 py-1 pl-4 text-xs italic leading-relaxed text-slate-600">
                            {item.observationNote}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No milestones logged"
                    description="No developmental observations found for these filters."
                  />
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-400">
                  Log a milestone
                </h3>

                {templates.length > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            domain: template.domain,
                            milestone: template.milestone,
                            status: template.suggestedStatus as (typeof statuses)[number],
                            observationNote: template.observationPrompt,
                          }))
                        }
                        className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-slate-300"
                      >
                        {template.domain}: {template.milestone}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Domain">
                    <Input
                      value={form.domain}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, domain: event.target.value }))
                      }
                      placeholder="e.g. Motor skills"
                    />
                  </FormField>
                  <FormField label="Status">
                    <Select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as (typeof statuses)[number],
                        }))
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {formatEnumLabel(status)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <FormField label="Milestone description" className="mt-4">
                  <Input
                    value={form.milestone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, milestone: event.target.value }))
                    }
                    placeholder="e.g. Uses classroom materials independently"
                  />
                </FormField>
                <FormField label="Observation note" className="mt-4">
                  <TextArea
                    rows={3}
                    value={form.observationNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        observationNote: event.target.value,
                      }))
                    }
                    placeholder="Supportive, specific observation..."
                  />
                </FormField>
                <FormField label="Observed at" className="mt-4">
                  <Input
                    type="date"
                    value={form.observedAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, observedAt: event.target.value }))
                    }
                  />
                </FormField>

                {mutation.isError ? (
                  <p className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
                    {mutation.error.message}
                  </p>
                ) : null}
                {!selectedStudentClass ? (
                  <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                    This student has no active class assignment on record; milestone logging is
                    unavailable.
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={
                    !form.domain.trim() ||
                    !form.milestone.trim() ||
                    !selectedStudentClass ||
                    mutation.isPending
                  }
                  onClick={save}
                  className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-mod-activity-accent)] text-xs font-black uppercase tracking-[0.2em] text-white shadow-sm transition-all hover:bg-[var(--color-mod-activity-text)] disabled:opacity-50"
                >
                  {mutation.isPending ? 'Saving...' : 'Save milestone'}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </DashboardPageShell>
  );
}

function studentDisplayName(student: StudentProfile) {
  return (
    student.fullNameEn ??
    `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() ??
    student.studentSystemId
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
