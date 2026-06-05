'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  GraduationCap, 
  FileText, 
  Settings, 
  Lock, 
  Megaphone, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';
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
import { PageHeader } from '../ui/page-header';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const workflowSteps = [
  { id: 'Setup', label: 'Setup', icon: Settings, description: 'Terms & Components' },
  { id: 'Entry', label: 'Marks/CAS', icon: ClipboardList, description: 'Entry & Recording' },
  { id: 'Lock', label: 'Lock', icon: Lock, description: 'Finalize Marks' },
  { id: 'ReportCards', label: 'Report Cards', icon: FileText, description: 'Document Generation' },
  { id: 'Promotion', label: 'Promotion', icon: GraduationCap, description: 'Year-End Readiness' },
  { id: 'Publish', label: 'Publish', icon: Megaphone, description: 'Results Delivery' },
] as const;

type WorkflowStep = (typeof workflowSteps)[number]['id'];

type AcademicsWorkspaceProps = {
  initialSection?: string;
};

// Map old section names to new workflow steps if needed
const sectionMap: Record<string, WorkflowStep> = {
  'Subjects': 'Setup',
  'Exam Terms': 'Setup',
  'Marks Entry': 'Entry',
  'Marks Lock': 'Lock',
  'CAS Records': 'Entry',
  'Report Cards': 'ReportCards',
  'Promotion': 'Promotion',
  'Result Publishing': 'Publish',
};

export function AcademicsWorkspace({ initialSection }: AcademicsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentTab = searchParams.get('tab') || sectionMap[initialSection || ''] || 'Setup';

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => api.listStudents({ limit: 1000 }) });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });
  const assignmentsQuery = useQuery({ queryKey: ['teacher-assignments'], queryFn: api.listTeacherAssignments });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const reportsQuery = useQuery({ queryKey: ['report-cards'], queryFn: () => api.listReportCards() });

  const academicYear = academicYearsQuery.data?.find(y => y.isCurrent);
  const subjectCount = subjectsQuery.data?.length ?? 0;
  const examCount = examsQuery.data?.length ?? 0;
  const reportCardCount = reportsQuery.data?.length ?? 0;

  return (
    <div className="space-y-10 animate-fade-in">
      <PageHeader
        title="Academics Workflow"
        description="Manage exam setup, marks and CAS entry, locks, report cards, promotion readiness, and publishing."
        actions={
          <span className="rounded-lg border border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-bg)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--color-mod-academics-text)]">
            {academicYear?.name ?? 'Academic Year'}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Subjects"
          value={subjectCount}
          icon={<Settings size={18} />}
          tone="neutral"
        />
        <StatCard
          title="Exam Terms"
          value={examCount}
          icon={<ClipboardList size={18} />}
          tone="info"
        />
        <StatCard
          title="Report Cards"
          value={reportCardCount}
          icon={<FileText size={18} />}
          tone="success"
        />
      </div>

      {/* Workflow Stepper */}
      <section className="sticky top-4 z-30">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-xl">
          <Tabs value={currentTab} onValueChange={setTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-transparent p-0 lg:grid-cols-6">
              {workflowSteps.map((step, idx) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className={cn(
                    "group relative flex flex-col items-center gap-1 rounded-xl py-4 transition-all",
                    "data-[state=active]:bg-[var(--color-mod-academics-accent)] data-[state=active]:text-white data-[state=active]:shadow-sm",
                    "text-slate-500 hover:bg-[var(--color-mod-academics-bg)] hover:text-[var(--color-mod-academics-text)]"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    "group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white",
                    "bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-[var(--color-mod-academics-accent)]"
                  )}>
                    <step.icon size={18} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-tighter">{step.label}</span>
                    <span className="hidden text-[8px] font-bold opacity-60 lg:block">{step.description}</span>
                  </div>
                  
                  {idx < workflowSteps.length - 1 && (
                    <div className="absolute -right-1 top-1/2 hidden -translate-y-1/2 text-slate-200 lg:block">
                      <ArrowRight size={14} />
                    </div>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </section>

      <div className="pb-20">
        <Tabs value={currentTab} className="space-y-8">
          <TabsContent value="Setup" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
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
          </TabsContent>

          <TabsContent value="Entry" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-8">
              <MarksEntryTab
                academicYears={academicYearsQuery.data ?? []}
                classes={classesQuery.data ?? []}
                allSections={sectionsQuery.data ?? []}
                students={studentsQuery.data?.items ?? []}
                exams={examsQuery.data ?? []}
              />
              <div className="h-px bg-slate-100" />
              <CasRecordsTab
                academicYears={academicYearsQuery.data ?? []}
                classes={classesQuery.data ?? []}
                allSections={sectionsQuery.data ?? []}
                students={studentsQuery.data?.items ?? []}
                subjects={subjectsQuery.data ?? []}
              />
            </div>
          </TabsContent>

          <TabsContent value="Lock" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <MarksLockTab exams={examsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="ReportCards" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ReportCardsTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              students={studentsQuery.data?.items ?? []}
              exams={examsQuery.data ?? []}
              reports={reportsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Promotion" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <PromotionTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="Publish" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ResultPublishingTab
              academicYears={academicYearsQuery.data ?? []}
              classes={classesQuery.data ?? []}
              allSections={sectionsQuery.data ?? []}
              exams={examsQuery.data ?? []}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
