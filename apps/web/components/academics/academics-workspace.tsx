'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SubjectsTab } from './tabs/subjects-tab';
import { ExamTermsTab } from './tabs/exam-terms-tab';
import { MarksEntryTab } from './tabs/marks-entry-tab';
import { ReportCardsTab } from './tabs/report-cards-tab';
import { CasRecordsTab } from './tabs/cas-records-tab';
import { PromotionTab } from './tabs/promotion-tab';

const sections = [
  'Subjects',
  'Exam Terms',
  'Marks Entry',
  'CAS Records',
  'Report Cards',
  'Promotion',
] as const;

type Section = (typeof sections)[number];

const sectionMeta: Record<Section, { title: string; description: string; badge: string }> = {
  Subjects: {
    title: 'Subjects & Teachers',
    description: 'Define subjects per class, assign teachers, and manage subject-teacher mappings.',
    badge: 'Curriculum',
  },
  'Exam Terms': {
    title: 'Exam Terms & Components',
    description: 'Create exam terms, add assessment components, and configure marks structure.',
    badge: 'Assessment',
  },
  'Marks Entry': {
    title: 'Marks Entry Grid',
    description: 'Select class, subject, and exam to enter marks for all students in one view.',
    badge: 'Grading',
  },
  'CAS Records': {
    title: 'CAS Observations',
    description: 'Track continuous assessment scores for classwork, projects, and participation.',
    badge: 'Observation',
  },
  'Report Cards': {
    title: 'Report Cards',
    description: 'Generate report cards and review final grades for students.',
    badge: 'Results',
  },
  Promotion: {
    title: 'Batch Promotion',
    description: 'Review readiness and batch promote students to the next academic year.',
    badge: 'Transition',
  },
};

export function AcademicsWorkspace() {
  const [activeSection, setActiveSection] = useState<Section>('Subjects');
  const activeMeta = sectionMeta[activeSection];

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: api.listStudents });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });
  const assignmentsQuery = useQuery({ queryKey: ['teacher-assignments'], queryFn: api.listTeacherAssignments });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const reportsQuery = useQuery({ queryKey: ['report-cards'], queryFn: api.listReportCards });

  const subjectCount = subjectsQuery.data?.length ?? 0;
  const examCount = examsQuery.data?.length ?? 0;
  const reportCount = reportsQuery.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-violet-400/20 blur-3xl" />

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

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[480px]">
            <MetricCard label="Subjects" value={String(subjectCount)} tone="info" />
            <MetricCard label="Exam Terms" value={String(examCount)} tone="warning" />
            <MetricCard label="Report Cards" value={String(reportCount)} tone="success" />
          </div>
        </div>
      </section>

      {/* Tab navigation */}
      <section className="sticky top-4 z-20 rounded-[28px] border border-[var(--line)] bg-white/85 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Academics sections">
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
                  <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-violet-400' : 'bg-gray-300 group-hover:bg-gray-500'}`} />
                  {section}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Content */}
      {activeSection === 'Subjects' && (
        <SubjectsTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          staff={staffQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
          assignments={assignmentsQuery.data ?? []}
        />
      )}

      {activeSection === 'Exam Terms' && (
        <ExamTermsTab
          academicYears={academicYearsQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
          exams={examsQuery.data ?? []}
        />
      )}

      {activeSection === 'Marks Entry' && (
        <MarksEntryTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          students={studentsQuery.data ?? []}
          exams={examsQuery.data ?? []}
        />
      )}

      {activeSection === 'CAS Records' && (
        <CasRecordsTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          students={studentsQuery.data ?? []}
          subjects={subjectsQuery.data ?? []}
        />
      )}

      {activeSection === 'Report Cards' && (
        <ReportCardsTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
          students={studentsQuery.data ?? []}
          exams={examsQuery.data ?? []}
          reports={reportsQuery.data ?? []}
        />
      )}

      {activeSection === 'Promotion' && (
        <PromotionTab
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          allSections={sectionsQuery.data ?? []}
        />
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
