'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  BookOpen, 
  GraduationCap, 
  Users, 
  Calendar, 
  Trophy, 
  FileText, 
  Settings, 
  Lock, 
  CheckCircle2, 
  Megaphone, 
  Layers,
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
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

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

  // Completeness Indicators (Mock/Calculated)
  const isSetupComplete = examCount > 0 && subjectCount > 0;
  const isEntryStarted = (reportsQuery.data?.length ?? 0) > 0; // Simple heuristic

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Workflow Header */}
      <section className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-primary-500/20 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary-300 backdrop-blur-md border border-primary-500/30">
                Phase 2A Academics
              </span>
              <div className="h-1 w-1 rounded-full bg-white/30" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {academicYear?.name || 'Academic Year'}
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl italic uppercase">
              Mission <span className="text-primary-400">Control</span>
            </h1>
            <p className="mt-4 text-lg font-medium text-slate-300 leading-relaxed">
              Step-by-step academic management from curriculum setup to result delivery.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <StatBox label="Subjects" value={subjectCount} />
             <StatBox label="Exams" value={examCount} />
          </div>
        </div>

        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
      </section>

      {/* Workflow Stepper */}
      <section className="sticky top-4 z-30">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white/90 p-3 shadow-2xl shadow-slate-200/50 backdrop-blur-xl">
          <Tabs value={currentTab} onValueChange={setTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-transparent p-0 lg:grid-cols-6">
              {workflowSteps.map((step, idx) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className={cn(
                    "group relative flex flex-col items-center gap-1 rounded-2xl py-4 transition-all",
                    "data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-xl",
                    "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    "group-data-[state=active]:bg-primary-500 group-data-[state=active]:text-white",
                    "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
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

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-white/5 p-6 backdrop-blur-xl border border-white/10 shadow-inner min-w-[120px]">
      <span className="text-3xl font-black tracking-tighter text-white">{value}</span>
      <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}
