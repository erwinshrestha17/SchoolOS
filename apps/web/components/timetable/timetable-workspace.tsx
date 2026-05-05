'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';
import { TimetableBuilderTab } from './tabs/timetable-builder-tab';
import { TeacherWorkloadTab } from './tabs/teacher-workload-tab';
import { HomeworkTab } from './tabs/homework-tab';
import { StudentHomeworkTab } from './tabs/student-homework-tab';
import { StudentTimetableTab } from './tabs/student-timetable-tab';

const adminSections = [
  'Timetable Builder',
  'Teacher Workload',
  'Homework',
] as const;

const studentSections = [
  'My Homework',
  'My Timetable',
] as const;

type Section = (typeof adminSections)[number] | (typeof studentSections)[number];

const sectionMeta: Record<Section, { title: string; description: string; badge: string }> = {
  'Timetable Builder': {
    title: 'Weekly Timetable Builder',
    description: 'Select a class to view and build the weekly class schedule. Checks conflicts automatically.',
    badge: 'Scheduling',
  },
  'Teacher Workload': {
    title: 'Faculty Workload',
    description: 'Monitor teaching hours, slot assignments, and homework counts across all faculty.',
    badge: 'Analytics',
  },
  Homework: {
    title: 'Homework & Assignments',
    description: 'Assign, track, and grade homework for your students across classes and subjects.',
    badge: 'Academics',
  },
  'My Homework': {
    title: 'My Homework Portal',
    description: 'View your assigned homework, submit your work, and check teacher feedback and scores.',
    badge: 'Student',
  },
  'My Timetable': {
    title: 'My Weekly Schedule',
    description: 'View your personalized weekly class schedule, subjects, and teachers.',
    badge: 'Student',
  },
};

export function TimetableWorkspace() {
  const { session } = useSession();
  const isStudent = session?.user.roles.includes('student');
  const sections = isStudent ? studentSections : adminSections;
  
  const [activeSection, setActiveSection] = useState<Section>(sections[0]);
  const [classId, setClassId] = useState('');
  const activeMeta = sectionMeta[activeSection];

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });

  const workloadQuery = useQuery({
    queryKey: ['teacher-workload'],
    queryFn: api.listTeacherWorkload,
    enabled: !isStudent,
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', classId],
    queryFn: () => api.listTimetable({ classId }),
    enabled: Boolean(classId) && !isStudent,
  });

  const slotCount = timetableQuery.data?.length ?? 0;
  const staffCount = staffQuery.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-gradient-to-br from-indigo-950 via-indigo-900 to-amber-800 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/15">
              {activeMeta.badge}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {activeMeta.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              {activeMeta.description}
            </p>
          </div>

          {!isStudent && (
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
              <MetricCard label="Class Slots" value={classId ? String(slotCount) : '—'} tone="warning" />
              <MetricCard label="Total Faculty" value={String(staffCount)} tone="info" />
            </div>
          )}
        </div>
      </section>

      {/* Tab navigation */}
      <section className="sticky top-4 z-20 rounded-[28px] border border-[var(--line)] bg-white/85 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Timetable sections">
          {sections.map((section) => {
            const isActive = activeSection === section;
            return (
              <button
                key={section}
                type="button"
                className={`group relative min-h-12 whitespace-nowrap rounded-2xl border px-4 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'border-indigo-950 bg-indigo-950 text-white shadow-md shadow-indigo-900/20'
                    : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-950'
                }`}
                onClick={() => setActiveSection(section)}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-amber-400' : 'bg-gray-300 group-hover:bg-gray-500'}`} />
                  {section}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Content */}
      {activeSection === 'Timetable Builder' && (
        <TimetableBuilderTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
          staff={staffQuery.data ?? []}
          timetable={timetableQuery.data ?? []}
          isLoadingTimetable={timetableQuery.isLoading && Boolean(classId)}
          classId={classId}
          setClassId={setClassId}
        />
      )}

      {activeSection === 'Teacher Workload' && (
        <TeacherWorkloadTab
          workload={workloadQuery.data ?? []}
          isLoading={workloadQuery.isLoading}
        />
      )}

      {activeSection === 'Homework' && (
        <HomeworkTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
          staff={staffQuery.data ?? []}
          classId={classId}
          setClassId={setClassId}
        />
      )}

      {activeSection === 'My Homework' && (
        <StudentHomeworkTab />
      )}

      {activeSection === 'My Timetable' && (
        <StudentTimetableTab />
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'info' | 'warning' | 'success' }) {
  const bg = tone === 'success' ? 'bg-emerald-500/15' : tone === 'warning' ? 'bg-amber-500/15' : 'bg-violet-500/15';
  const text = tone === 'success' ? 'text-emerald-200' : tone === 'warning' ? 'text-amber-200' : 'text-violet-200';
  return (
    <div className={`rounded-2xl ${bg} px-4 py-3 backdrop-blur-sm`}>
      <p className="text-xs font-medium text-white/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${text}`}>{value}</p>
    </div>
  );
}
