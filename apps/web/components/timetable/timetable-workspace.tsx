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
import { PageHeader } from '../ui/page-header';
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
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-8">
      <PageHeader
        title={activeMeta.title}
        description={activeMeta.description}
        actions={
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)]">
            <ActiveIcon className="h-5 w-5" />
          </span>
        }
      />

      {!isStudent && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Class Slots"
            value={classId ? slotCount : '—'}
            description={classId ? 'Slots in the selected class timetable.' : 'Select a class to load timetable slots.'}
            icon={<Calendar size={18} />}
            tone="info"
          />
          <StatCard
            title="Total Faculty"
            value={staffCount}
            description="Teachers available for workload and substitution planning."
            icon={<Users size={18} />}
            tone="neutral"
          />
        </div>
      )}

      <Tabs
        value={activeSection}
        onValueChange={(val) => setActiveSection(val as Section)}
        className="space-y-8"
      >
        <TabsList className="inline-flex h-auto rounded-2xl bg-slate-100 p-1.5">
          {sections.map((section) => (
            <TabsTrigger
              key={section}
              value={section}
              className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
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
