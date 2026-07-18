'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatBsDate, moodLogFormSchema, type StudentProfile } from '@schoolos/core';
import { api } from '../../../../lib/api';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { EmptyState } from '../../../../components/ui/empty-state';
import { FormField, Input, Select, TextArea } from '../../../../components/ui/form-field';

const today = new Date().toISOString().slice(0, 10);
const moods = ['CALM', 'ENGAGED', 'EXCITED', 'UNSETTLED', 'TIRED'] as const;

type SectionSummaryForUi = { id: string; name: string; classId?: string | null; class?: { id: string } | null };
type ObservationState = {
  classId: string;
  sectionId: string;
  studentId: string;
  mood: (typeof moods)[number];
  note: string;
  logDate: string;
};

export default function ActivityObservationsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ObservationState>({
    classId: '',
    sectionId: '',
    studentId: '',
    mood: 'ENGAGED',
    note: '',
    logDate: today,
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({
    queryKey: ['students-for-observations'],
    queryFn: () => api.listStudents({ limit: 1000 }),
  });
  const logsQuery = useQuery({ queryKey: ['mood-logs'], queryFn: api.listMoodLogs });

  const mutation = useMutation({
    mutationFn: api.createMoodLog,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mood-logs'] });
      setForm((current) => ({ ...current, note: '' }));
    },
  });

  const classes = classesQuery.data ?? [];
  const sections = (sectionsQuery.data ?? []) as SectionSummaryForUi[];
  const students: StudentProfile[] = studentsQuery.data?.items ?? [];
  const filteredSections = sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !form.classId || sectionClassId === form.classId;
  });
  const filteredStudents = students.filter(
    (student) => !form.classId || student.class?.id === form.classId,
  );
  const logs = logsQuery.data ?? [];

  function save() {
    const result = moodLogFormSchema.safeParse({
      classId: form.classId,
      sectionId: form.sectionId || null,
      studentId: form.studentId || null,
      mood: form.mood,
      note: form.note || null,
      logDate: form.logDate,
    });

    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Check the observation fields.');
      return;
    }

    setValidationError(null);
    mutation.mutate({
      classId: form.classId,
      sectionId: form.sectionId || null,
      studentId: form.studentId || null,
      mood: form.mood,
      note: form.note || null,
      logDate: new Date(form.logDate).toISOString(),
    });
  }

  return (
    <DashboardPageShell>
      <PageHeader
        title="Observations"
        description="Record whole-class mood with optional student-specific exceptions. Lower-grade classes use this for daily emotional context."
      />

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-lg font-black text-slate-950">New observation</h2>
            <p className="mt-1 text-sm text-slate-500">
              Leave the student field on &ldquo;Whole-class&rdquo; unless recording one child&rsquo;s
              exception.
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Class">
                <Select
                  value={form.classId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      classId: event.target.value,
                      sectionId: '',
                      studentId: '',
                    }))
                  }
                >
                  <option value="">Select class</option>
                  {classes.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Section">
                <Select
                  value={form.sectionId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sectionId: event.target.value,
                      studentId: '',
                    }))
                  }
                >
                  <option value="">Whole class</option>
                  {filteredSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Student (optional exception)">
              <Select
                value={form.studentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, studentId: event.target.value }))
                }
              >
                <option value="">Whole-class mood</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {studentDisplayName(student)}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Mood">
                <Select
                  value={form.mood}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      mood: event.target.value as ObservationState['mood'],
                    }))
                  }
                >
                  {moods.map((mood) => (
                    <option key={mood} value={mood}>
                      {formatEnumLabel(mood)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Date">
                <Input
                  type="date"
                  value={form.logDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, logDate: event.target.value }))
                  }
                />
              </FormField>
            </div>

            <FormField label="Observation note">
              <TextArea
                rows={4}
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="Optional teacher observation..."
              />
            </FormField>

            <div className="space-y-3">
              {validationError ? (
                <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
                  {validationError}
                </p>
              ) : null}
              {mutation.isError ? (
                <p className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
                  {mutation.error.message}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!form.classId || mutation.isPending}
                onClick={save}
                className="h-14 w-full rounded-2xl bg-[var(--color-mod-activity-accent)] text-xs font-black uppercase tracking-[0.2em] text-white shadow-sm transition-all hover:bg-[var(--color-mod-activity-text)] disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving...' : 'Save observation'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-inner">
          <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-slate-400">
            Observation history
          </h3>
          {logs.length > 0 ? (
            <div className="grid gap-4">
              {logs.slice(0, 12).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-tight text-slate-900">
                      {formatEnumLabel(log.mood)}
                      <span className="ml-2 font-bold text-slate-400">/</span>
                      <span className="ml-2 text-slate-600">
                        {log.student
                          ? `${log.student.firstNameEn} ${log.student.lastNameEn}`
                          : 'Whole class'}
                      </span>
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {formatBsDate(log.logDate)}
                      {log.note && ` · ${log.note}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No observations yet"
              description="Observation history will appear here once recorded."
              className="bg-white"
            />
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
