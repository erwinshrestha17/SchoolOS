'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';
import { TimetableBuilderTab } from './tabs/timetable-builder-tab';
import { TeacherWorkloadTab } from './tabs/teacher-workload-tab';
import { SubstitutionsTab } from './tabs/substitutions-tab';
import { StudentTimetableTab } from './tabs/student-timetable-tab';

const adminSections = [
  'Timetable Builder',
  'Teacher Workload',
  'Substitutions',
] as const;

const studentSections = [
  'My Timetable',
] as const;

type AdminSection = (typeof adminSections)[number];
type StudentSection = (typeof studentSections)[number];
type Section = AdminSection | StudentSection;

type TimetableWorkspaceProps = {
  initialSection?: Section;
};

// Each timetable/homework route already has its own PageHeader — this
// component renders only the task content for that one route, permanently.
// It must not add a second header, a second tab switcher, or KPIs of its own
// (per the M6 KPI design rule: never on the builder, substitutions, or
// homework composer/review screens).
export function TimetableWorkspace({ initialSection }: TimetableWorkspaceProps = {}) {
  const { session } = useSession();
  const isStudent = session?.user.roles.includes('student');
  const sections = isStudent ? studentSections : adminSections;
  const section = sections.includes(initialSection as never)
    ? (initialSection as Section)
    : sections[0];

  const [classId, setClassId] = useState('');
  const [workloadPage, setWorkloadPage] = useState(1);
  const WORKLOAD_PAGE_SIZE = 25;

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });

  const workloadQuery = useQuery({
    queryKey: ['teacher-workload', workloadPage],
    queryFn: () => api.listTeacherWorkload({ page: workloadPage, limit: WORKLOAD_PAGE_SIZE }),
    enabled: !isStudent && section === 'Teacher Workload',
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', classId],
    queryFn: () => api.listTimetable({ classId }),
    enabled: Boolean(classId) && !isStudent && section === 'Timetable Builder',
  });

  if (section === 'Timetable Builder') {
    return (
      <TimetableBuilderTab
        academicYears={academicYearsQuery.data ?? []}
        classes={classesQuery.data ?? []}
        allSections={sectionsQuery.data ?? []}
        subjects={subjectsQuery.data ?? []}
        staff={staffQuery.data ?? []}
        timetable={timetableQuery.data?.items ?? []}
        isLoadingTimetable={timetableQuery.isLoading && Boolean(classId)}
        classId={classId}
        setClassId={setClassId}
      />
    );
  }

  if (section === 'Teacher Workload') {
    return (
      <TeacherWorkloadTab
        workload={workloadQuery.data?.items ?? []}
        summary={workloadQuery.data?.summary}
        isLoading={workloadQuery.isLoading}
        isError={workloadQuery.isError}
        onRetry={() => void workloadQuery.refetch()}
        page={workloadPage}
        pageSize={WORKLOAD_PAGE_SIZE}
        totalItems={workloadQuery.data?.meta.total ?? 0}
        onPageChange={setWorkloadPage}
      />
    );
  }

  if (section === 'Substitutions') {
    return <SubstitutionsTab />;
  }

  return <StudentTimetableTab />;
}
