'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Users, Calendar, Trophy, FileText, Settings } from 'lucide-react';
import { api } from '../../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { SubjectsTab } from './tabs/subjects-tab';
import { ExamTermsTab } from './tabs/exam-terms-tab';
import { MarksEntryTab } from './tabs/marks-entry-tab';
import { MarksLockTab } from './tabs/marks-lock-tab';
import { ReportCardsTab } from './tabs/report-cards-tab';
import { CasRecordsTab } from './tabs/cas-records-tab';
import { PromotionTab } from './tabs/promotion-tab';
import { ResultPublishingTab } from './tabs/result-publishing-tab';
import { StatCard } from '../ui/stat-card';

const sections = [
  { id: 'Subjects', icon: BookOpen },
  { id: 'Exam Terms', icon: Calendar },
  { id: 'Marks Entry', icon: Trophy },
  { id: 'Marks Lock', icon: Settings },
  { id: 'CAS Records', icon: Users },
  { id: 'Report Cards', icon: FileText },
  { id: 'Promotion', icon: GraduationCap },
  { id: 'Result Publishing', icon: FileText },
] as const;

export function AcademicsWorkspace() {
  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: api.listStudents });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });
  const assignmentsQuery = useQuery({ queryKey: ['teacher-assignments'], queryFn: api.listTeacherAssignments });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const reportsQuery = useQuery({ queryKey: ['report-cards'], queryFn: api.listReportCards });

  const academicYear = academicYearsQuery.data?.find(y => y.isCurrent);

  const subjectCount = subjectsQuery.data?.length ?? 0;
  const examCount = examsQuery.data?.length ?? 0;

  return (
    <div className="space-y-10">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-primary-500/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary-300 backdrop-blur-sm">
                Academic Management
              </span>
              <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-slate-300 backdrop-blur-sm">
                {academicYear?.name || 'Loading Year...'}
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              School <span className="text-primary-400">Academics</span>
            </h1>
            <p className="mt-3 max-w-md text-lg font-medium text-slate-300">
              Manage curriculum, track student progress, and organize school schedules.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
            <StatCard title="Subjects" value={subjectCount} className="bg-white/5 border-white/10 text-white" />
            <StatCard title="Exam Terms" value={examCount} className="bg-white/5 border-white/10 text-white" />
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </section>

      <Tabs defaultValue="Subjects" className="space-y-8">
        {/* Navigation Bar */}
        <section className="sticky top-4 z-20 rounded-[28px] border border-slate-200 bg-white/85 p-3 shadow-sm backdrop-blur-xl">
          <TabsList className="flex h-auto gap-2 overflow-x-auto pb-1 bg-transparent rounded-none p-0 w-full justify-start border-none">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold transition-all data-[state=active]:bg-primary-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary-600/20 text-slate-600 hover:bg-slate-100"
                >
                  <Icon size={18} />
                  {section.id}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </section>

        {/* Dynamic Content Sections */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TabsContent value="Subjects" className="mt-0">
            <SubjectsTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              staff={staffQuery.data ?? []}
              subjects={subjectsQuery.data ?? []}
              assignments={assignmentsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Exam Terms" className="mt-0">
            <ExamTermsTab
              academicYears={academicYearsQuery.data ?? []}
              subjects={subjectsQuery.data ?? []}
              exams={examsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Marks Entry" className="mt-0">
            <MarksEntryTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              students={studentsQuery.data ?? []}
              exams={examsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Marks Lock" className="mt-0">
            <MarksLockTab exams={examsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="CAS Records" className="mt-0">
            <CasRecordsTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              students={studentsQuery.data ?? []}
              subjects={subjectsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Report Cards" className="mt-0">
            <ReportCardsTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              students={studentsQuery.data ?? []}
              exams={examsQuery.data ?? []}
              reports={reportsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Promotion" className="mt-0">
            <PromotionTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Result Publishing" className="mt-0">
            <ResultPublishingTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              exams={examsQuery.data ?? []}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
