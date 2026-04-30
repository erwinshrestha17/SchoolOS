'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../lib/api';

const currentYear = new Date().getFullYear();

export function SetupForm() {
  const queryClient = useQueryClient();
  const [academicYear, setAcademicYear] = useState({
    name: `${currentYear}-${currentYear + 1}`,
    startsOn: `${currentYear}-04-01`,
    endsOn: `${currentYear + 1}-03-31`,
    isCurrent: true,
  });
  const [classroom, setClassroom] = useState({
    name: 'Class 1',
    level: 3,
  });
  const [section, setSection] = useState({
    classId: '',
    name: 'A',
    capacity: 32,
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setSection((current) =>
        current.classId ? current : { ...current, classId: firstClass.id },
      );
    }
  }, [classesQuery.data]);

  const academicYearMutation = useMutation({
    mutationFn: api.createAcademicYear,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  });
  const classMutation = useMutation({
    mutationFn: api.createClass,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });
  const sectionMutation = useMutation({
    mutationFn: api.createSection,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sections'] }),
  });

  const academicYears = academicYearsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];

  const totalStudents = useMemo(
    () => classes.reduce((sum, item) => sum + Number(item.studentCount ?? 0), 0),
    [classes],
  );
  const totalCapacity = useMemo(
    () => sections.reduce((sum, item) => sum + Number(item.capacity ?? 0), 0),
    [sections],
  );
  const currentAcademicYear = academicYears.find((item) => item.isCurrent);
  const isAnyLoading =
    academicYearsQuery.isLoading || classesQuery.isLoading || sectionsQuery.isLoading;

  function createAcademicYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    academicYearMutation.mutate({
      ...academicYear,
      startsOn: new Date(academicYear.startsOn).toISOString(),
      endsOn: new Date(academicYear.endsOn).toISOString(),
    });
  }

  function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    classMutation.mutate(classroom);
  }

  function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sectionMutation.mutate({
      classId: section.classId,
      name: section.name,
      capacity: section.capacity || null,
    });
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/15">
              School Setup
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Academic structure setup
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Configure academic years, classes, and sections before admissions, attendance,
              exams, and fee billing workflows begin.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[640px] xl:grid-cols-4">
            <SetupMetricCard label="Academic Years" value={String(academicYears.length)} />
            <SetupMetricCard label="Classes" value={String(classes.length)} tone="success" />
            <SetupMetricCard label="Sections" value={String(sections.length)} tone="warning" />
            <SetupMetricCard label="Students" value={String(totalStudents)} tone="accent" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[28px] border border-[var(--line)] bg-white/85 p-4 shadow-sm backdrop-blur-xl lg:grid-cols-3">
        <SetupStatusCard
          title="Current academic year"
          value={currentAcademicYear?.name ?? 'Not selected'}
          description={
            currentAcademicYear
              ? 'This year will be used as the default context for school operations.'
              : 'Create or mark an academic year as current to unlock clean defaults.'
          }
        />
        <SetupStatusCard
          title="Seat capacity"
          value={totalCapacity > 0 ? String(totalCapacity) : 'Not set'}
          description="Total capacity configured across all sections. Useful for admission planning."
        />
        <SetupStatusCard
          title="Setup health"
          value={classes.length > 0 && sections.length > 0 ? 'Ready' : 'Needs data'}
          description="Create at least one class and one section before assigning students."
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <SetupFormCard
          title="Academic Year"
          subtitle="Define the school year used across admissions, exams, fees, and reports."
          badge="Step 01"
          onSubmit={createAcademicYear}
        >
          <div className="grid gap-3">
            <Field label="Academic year name">
              <input
                value={academicYear.name}
                onChange={(event) =>
                  setAcademicYear((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="2026-2027"
                className="min-h-11"
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Starts on">
                <input
                  type="date"
                  value={academicYear.startsOn}
                  onChange={(event) =>
                    setAcademicYear((current) => ({
                      ...current,
                      startsOn: event.target.value,
                    }))
                  }
                  className="min-h-11"
                />
              </Field>
              <Field label="Ends on">
                <input
                  type="date"
                  value={academicYear.endsOn}
                  onChange={(event) =>
                    setAcademicYear((current) => ({
                      ...current,
                      endsOn: event.target.value,
                    }))
                  }
                  className="min-h-11"
                />
              </Field>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-4 text-sm text-[var(--muted)] transition hover:border-gray-300 hover:bg-white">
              <input
                type="checkbox"
                checked={academicYear.isCurrent}
                onChange={(event) =>
                  setAcademicYear((current) => ({
                    ...current,
                    isCurrent: event.target.checked,
                  }))
                }
              />
              <span>Mark as current year</span>
            </label>
            <ActionButton
              tone="dark"
              disabled={
                !academicYear.name ||
                !academicYear.startsOn ||
                !academicYear.endsOn ||
                academicYearMutation.isPending
              }
            >
              {academicYearMutation.isPending ? 'Creating...' : 'Create academic year'}
            </ActionButton>
            <MutationMessage mutation={academicYearMutation} successText="Academic year saved." />
          </div>
        </SetupFormCard>

        <SetupFormCard
          title="Class"
          subtitle="Create class levels in the correct order for reports and promotions."
          badge="Step 02"
          onSubmit={createClass}
        >
          <div className="grid gap-3">
            <Field label="Class name">
              <input
                value={classroom.name}
                onChange={(event) =>
                  setClassroom((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Class 1"
                className="min-h-11"
              />
            </Field>
            <Field label="Sort level">
              <input
                type="number"
                min={0}
                value={classroom.level}
                onChange={(event) =>
                  setClassroom((current) => ({
                    ...current,
                    level: Number(event.target.value),
                  }))
                }
                placeholder="Sort level"
                className="min-h-11"
              />
            </Field>
            <p className="rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-[var(--muted)]">
              Use lower sort levels for lower classes. This keeps lists, report cards, and
              promotion flows ordered correctly.
            </p>
            <ActionButton tone="teal" disabled={!classroom.name || classMutation.isPending}>
              {classMutation.isPending ? 'Creating...' : 'Create class'}
            </ActionButton>
            <MutationMessage mutation={classMutation} successText="Class saved." />
          </div>
        </SetupFormCard>

        <SetupFormCard
          title="Section"
          subtitle="Create sections under each class with optional capacity planning."
          badge="Step 03"
          onSubmit={createSection}
        >
          <div className="grid gap-3">
            <Field label="Parent class">
              <select
                value={section.classId}
                onChange={(event) =>
                  setSection((current) => ({ ...current, classId: event.target.value }))
                }
                className="min-h-11"
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Section name">
              <input
                value={section.name}
                onChange={(event) =>
                  setSection((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Section A"
                className="min-h-11"
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                min={1}
                value={section.capacity}
                onChange={(event) =>
                  setSection((current) => ({
                    ...current,
                    capacity: Number(event.target.value),
                  }))
                }
                placeholder="Capacity"
                className="min-h-11"
              />
            </Field>
            <ActionButton
              tone="accent"
              disabled={!section.classId || !section.name || sectionMutation.isPending}
            >
              {sectionMutation.isPending ? 'Creating...' : 'Create section'}
            </ActionButton>
            <MutationMessage mutation={sectionMutation} successText="Section saved." />
          </div>
        </SetupFormCard>
      </div>

      {isAnyLoading ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <SetupListSkeleton />
          <SetupListSkeleton />
          <SetupListSkeleton />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <SetupList
            title="Academic Years"
            description="Recently configured academic sessions."
            items={academicYears.map((item) => ({
              id: item.id,
              primary: item.name,
              secondary: item.isCurrent ? 'Current year' : 'Available',
              badge: item.isCurrent ? 'Current' : undefined,
            }))}
          />
          <SetupList
            title="Classes"
            description="Class levels with section and student counts."
            items={classes.map((item) => ({
              id: item.id,
              primary: item.name,
              secondary: `${item.sectionCount ?? 0} sections / ${item.studentCount ?? 0} students`,
              badge: `Level ${item.level ?? '-'}`,
            }))}
          />
          <SetupList
            title="Sections"
            description="Sections mapped to their parent classes."
            items={sections.map((item) => ({
              id: item.id,
              primary: `${item.class?.name ?? 'Class'} / ${item.name}`,
              secondary: `${item.studentCount ?? 0} students${
                item.capacity ? ` / cap ${item.capacity}` : ''
              }`,
              badge: item.capacity ? `${item.capacity} seats` : undefined,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function SetupFormCard({
  badge,
  children,
  onSubmit,
  subtitle,
  title,
}: {
  badge: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  subtitle: string;
  title: string;
}) {
  return (
    <form
      className="group relative overflow-hidden rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
      onSubmit={onSubmit}
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-gray-100 opacity-80 blur-2xl transition group-hover:bg-emerald-100" />
      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="label">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
          </div>
          <span className="shrink-0 rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        </div>
        {children}
      </div>
    </form>
  );
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function ActionButton({
  children,
  disabled,
  tone,
}: {
  children: ReactNode;
  disabled?: boolean;
  tone: 'dark' | 'teal' | 'accent';
}) {
  const toneClass = {
    dark: 'from-gray-950 to-gray-800',
    teal: 'from-emerald-600 to-teal-600',
    accent: 'from-orange-500 to-rose-500',
  }[tone];

  return (
    <button
      className={`min-h-12 rounded-2xl bg-gradient-to-r ${toneClass} px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function SetupMetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'accent';
}) {
  const toneClass = {
    neutral: 'bg-white/10 text-white ring-white/15',
    success: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/20',
    warning: 'bg-amber-400/15 text-amber-100 ring-amber-300/20',
    accent: 'bg-sky-400/15 text-sky-100 ring-sky-300/20',
  }[tone];

  return (
    <div className={`rounded-2xl p-4 ring-1 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function SetupStatusCard({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <p className="label">{title}</p>
      <h3 className="mt-2 text-xl font-bold text-gray-950">{value}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </article>
  );
}

function SetupList({
  description,
  items,
  title,
}: {
  description: string;
  title: string;
  items: Array<{ id: string; primary: string; secondary: string; badge?: string }>;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="label">{title}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
          {items.length}
        </span>
      </div>
      <div className="grid gap-3">
        {items.length > 0 ? (
          items.slice(0, 8).map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-[var(--line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-950">{item.primary}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.secondary}</p>
                </div>
                {item.badge ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {item.badge}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EmptySetupState title={`No ${title.toLowerCase()} yet`} />
        )}
      </div>
    </section>
  );
}

function EmptySetupState({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--line)] bg-gray-50/80 p-6 text-center">
      <p className="font-semibold text-gray-950">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        New records will appear here immediately after creation.
      </p>
    </div>
  );
}

function SetupListSkeleton() {
  return (
    <section className="rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm">
      <div className="h-4 w-32 animate-pulse rounded-full bg-gray-200" />
      <div className="mt-5 grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-[var(--line)] bg-white p-4">
            <div className="h-4 w-40 animate-pulse rounded-full bg-gray-200" />
            <div className="mt-3 h-3 w-28 animate-pulse rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

function MutationMessage({
  mutation,
  successText,
}: {
  mutation: { isError: boolean; isSuccess: boolean; error: Error | null };
  successText: string;
}) {
  if (mutation.isError) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
        {mutation.error?.message ?? 'Something went wrong.'}
      </p>
    );
  }

  if (mutation.isSuccess) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
        {successText}
      </p>
    );
  }

  return null;
}
