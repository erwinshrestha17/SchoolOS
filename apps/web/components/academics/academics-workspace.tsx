'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SubjectsTab } from './tabs/subjects-tab';
import { ExamTermsTab } from './tabs/exam-terms-tab';
import { MarksEntryTab } from './tabs/marks-entry-tab';
import { MarksLockTab } from './tabs/marks-lock-tab';
import { CasRecordsTab } from './tabs/cas-records-tab';
import { PromotionTab } from './tabs/promotion-tab';
import { ResultPublishingTab } from './tabs/result-publishing-tab';

type WorkflowStep = 'Setup' | 'Entry' | 'Lock' | 'Promotion' | 'Publish';

type AcademicsWorkspaceProps = {
  initialSection?: string;
};

// Each academics/* route already has its own PageHeader and shares the real,
// route-based ModuleTabs (components/academics/academics-tabs.tsx) — this
// component renders only the task content for that one route, permanently.
// It must not add a second header, a second tab switcher, or KPIs of its own.
const sectionMap: Record<string, WorkflowStep> = {
  'Subjects': 'Setup',
  'Exam Terms': 'Setup',
  'Marks Entry': 'Entry',
  'Marks Lock': 'Lock',
  'CAS Records': 'Entry',
  'Promotion': 'Promotion',
  'Result Publishing': 'Publish',
};

export function AcademicsWorkspace({ initialSection }: AcademicsWorkspaceProps) {
  const step = sectionMap[initialSection ?? ''] ?? 'Setup';

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });
  const assignmentsQuery = useQuery({ queryKey: ['teacher-assignments'], queryFn: api.listTeacherAssignments });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });

  if (step === 'Setup') {
    return (
      <div className="space-y-8">
        <SubjectsTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          staff={staffQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
          assignments={assignmentsQuery.data ?? []}
        />
        <div className="h-px bg-slate-100" />
        <ExamTermsTab
          academicYears={academicYearsQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
          exams={examsQuery.data ?? []}
        />
      </div>
    );
  }

  if (step === 'Entry') {
    return (
      <div className="space-y-8">
        <MarksEntryTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          exams={examsQuery.data ?? []}
        />
        <div className="h-px bg-slate-100" />
        <CasRecordsTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
        />
      </div>
    );
  }

  if (step === 'Lock') {
    return <MarksLockTab exams={examsQuery.data ?? []} />;
  }

  if (step === 'Promotion') {
    return (
      <PromotionTab
        academicYears={academicYearsQuery.data ?? []}
        classes={classesQuery.data ?? []}
        allSections={sectionsQuery.data ?? []}
      />
    );
  }

  return (
    <ResultPublishingTab
      academicYears={academicYearsQuery.data ?? []}
      classes={classesQuery.data ?? []}
      allSections={sectionsQuery.data ?? []}
      exams={examsQuery.data ?? []}
    />
  );
}
