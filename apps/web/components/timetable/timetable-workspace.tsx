'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';
import { TimetableBuilderTab } from './tabs/timetable-builder-tab';
import { TeacherWorkloadTab } from './tabs/teacher-workload-tab';
import { SubstitutionsTab } from './tabs/substitutions-tab';
import { HomeworkTab } from './tabs/homework-tab';
import { StudentHomeworkTab } from './tabs/student-homework-tab';
import { StudentTimetableTab } from './tabs/student-timetable-tab';
import { StatCard } from '../ui/stat-card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs';
import {
  Calendar,
  Users,
  BookOpen,
  GraduationCap,
  Clock,
} from 'lucide-react';

const adminSections = [
  'Timetable Builder',
  'Teacher Workload',
  'Substitutions',
  'Homework',
] as const;

const studentSections = [
  'My Homework',
  'My Timetable',
] as const;

type AdminSection = (typeof adminSections)[number];
type StudentSection = (typeof studentSections)[number];
type Section = AdminSection | StudentSection;

type TimetableWorkspaceProps = {
  initialSection?: Section;
};

const sectionMeta: Record<Section, { title: string; description: string; icon: any }> = {
  'Timetable Builder': {
    title: 'Weekly Timetable Builder',
    description: 'Select a class to view and build the weekly class schedule. Checks conflicts automatically.',
    icon: Calendar,
  },
  'Teacher Workload': {
    title: 'Faculty Workload',
    description: 'Monitor teaching hours, slot assignments, and homework counts across all faculty.',
    icon: Users,
  },
  Homework: {
    title: 'Homework & Assignments',
    description: 'Assign, track, and grade homework for your students across classes and subjects.',
    icon: BookOpen,
  },
  'My Homework': {
    title: 'My Homework Portal',
    description: 'View your assigned homework, submit your work, and check teacher feedback and scores.',
    icon: GraduationCap,
  },
  'My Timetable': {
    title: 'My Weekly Schedule',
    description: 'View your personalized weekly class schedule, subjects, and teachers.',
    icon: Clock,
  },
  Substitutions: {
    title: 'Faculty Coverage',
    description: 'Track teacher absences and manage class substitutions to ensure academic continuity.',
    icon: Users,
  },
};

export function TimetableWorkspace({ initialSection }: TimetableWorkspaceProps = {}) {
  const { session } = useSession();
  const isStudent = session?.user.roles.includes('student');
  const sections = isStudent ? studentSections : adminSections;
  const defaultSection = sections.includes(initialSection as never)
    ? (initialSection as Section)
    : sections[0];

  const [activeSection, setActiveSection] = useState<Section>(defaultSection);
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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-900 p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20">
                <activeMeta.icon className="h-6 w-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl uppercase italic">
                {activeMeta.title}
              </h1>
            </div>
            <p className="mt-4 text-lg font-medium leading-relaxed text-slate-300">
              {activeMeta.description}
            </p>
          </div>

          {!isStudent && (
            <div className="grid gap-4 sm:grid-cols-2 lg:w-[400px]">
              <StatCard
                title="Class Slots"
                value={classId ? slotCount : '—'}
                className="bg-white/5 border-white/10"
              />
              <StatCard
                title="Total Faculty"
                value={staffCount}
                className="bg-white/5 border-white/10"
              />
            </div>
          )}
        </div>
      </section>

      <Tabs
        value={activeSection}
        onValueChange={(val) => setActiveSection(val as Section)}
        className="space-y-8"
      >
        <TabsList className="bg-slate-100 p-1.5 rounded-[1.5rem] inline-flex h-auto">
          {sections.map((section) => (
            <TabsTrigger
              key={section}
              value={section}
              className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
            >
              {section}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Timetable Builder">
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
        </TabsContent>

        <TabsContent value="Teacher Workload">
          <TeacherWorkloadTab
            workload={workloadQuery.data ?? []}
            isLoading={workloadQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="Substitutions">
          <SubstitutionsTab />
        </TabsContent>

        <TabsContent value="Homework">
          <HomeworkTab
            academicYears={academicYearsQuery.data ?? []}
            classes={classesQuery.data ?? []}
            allSections={sectionsQuery.data ?? []}
            subjects={subjectsQuery.data ?? []}
            staff={staffQuery.data ?? []}
            classId={classId}
            setClassId={setClassId}
          />
        </TabsContent>

        <TabsContent value="My Homework">
          <StudentHomeworkTab />
        </TabsContent>

        <TabsContent value="My Timetable">
          <StudentTimetableTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
