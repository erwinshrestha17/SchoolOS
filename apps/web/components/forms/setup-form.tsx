'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
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
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <form className="shell-card rounded-[28px] p-6" onSubmit={createAcademicYear}>
          <p className="label mb-4">Academic Year</p>
          <div className="grid gap-3">
            <input
              value={academicYear.name}
              onChange={(event) =>
                setAcademicYear((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="2026-2027"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="date"
                value={academicYear.startsOn}
                onChange={(event) =>
                  setAcademicYear((current) => ({
                    ...current,
                    startsOn: event.target.value,
                  }))
                }
              />
              <input
                type="date"
                value={academicYear.endsOn}
                onChange={(event) =>
                  setAcademicYear((current) => ({
                    ...current,
                    endsOn: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
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
              Mark as current year
            </label>
            <button
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={
                !academicYear.name ||
                !academicYear.startsOn ||
                !academicYear.endsOn ||
                academicYearMutation.isPending
              }
            >
              {academicYearMutation.isPending ? 'Creating...' : 'Create academic year'}
            </button>
          </div>
        </form>

        <form className="shell-card rounded-[28px] p-6" onSubmit={createClass}>
          <p className="label mb-4">Class</p>
          <div className="grid gap-3">
            <input
              value={classroom.name}
              onChange={(event) =>
                setClassroom((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Class 1"
            />
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
            />
            <button
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!classroom.name || classMutation.isPending}
            >
              {classMutation.isPending ? 'Creating...' : 'Create class'}
            </button>
          </div>
        </form>

        <form className="shell-card rounded-[28px] p-6" onSubmit={createSection}>
          <p className="label mb-4">Section</p>
          <div className="grid gap-3">
            <select
              value={section.classId}
              onChange={(event) =>
                setSection((current) => ({ ...current, classId: event.target.value }))
              }
            >
              <option value="">Select class</option>
              {(classesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              value={section.name}
              onChange={(event) =>
                setSection((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Section A"
            />
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
            />
            <button
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!section.classId || !section.name || sectionMutation.isPending}
            >
              {sectionMutation.isPending ? 'Creating...' : 'Create section'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SetupList
          title="Academic Years"
          items={(academicYearsQuery.data ?? []).map((item) => ({
            id: item.id,
            primary: item.name,
            secondary: item.isCurrent ? 'Current year' : 'Available',
          }))}
        />
        <SetupList
          title="Classes"
          items={(classesQuery.data ?? []).map((item) => ({
            id: item.id,
            primary: item.name,
            secondary: `${item.sectionCount ?? 0} sections / ${item.studentCount ?? 0} students`,
          }))}
        />
        <SetupList
          title="Sections"
          items={(sectionsQuery.data ?? []).map((item) => ({
            id: item.id,
            primary: `${item.class?.name ?? 'Class'} / ${item.name}`,
            secondary: `${item.studentCount ?? 0} students${
              item.capacity ? ` / cap ${item.capacity}` : ''
            }`,
          }))}
        />
      </div>

      {[academicYearMutation, classMutation, sectionMutation].map((mutation, index) =>
        mutation.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutation.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}

function SetupList({
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
          items.slice(0, 8).map((item) => (
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
