'use client';

import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { 
  ClipboardList, 
  FileText, 
  TrendingUp,
  Trophy,
  CheckCircle2,
  Megaphone,
  Lock,
  Layers,
  ArrowRight,
  Settings,
  GraduationCap,
  Loader2,
  AlertCircle,
  Users,
  Search
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AcademicsOverviewPage() {
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const reportsQuery = useQuery({ queryKey: ['report-cards'], queryFn: () => api.listReportCards() });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.listSubjects() });

  const activeExamsCount = examsQuery.data?.filter(e => !e.isLocked).length ?? 0;
  const reportCardsGenerated = reportsQuery.data?.length ?? 0;
  const totalSubjects = subjectsQuery.data?.length ?? 0;

  const workflowSteps = [
    {
      id: 'setup',
      label: 'Setup',
      description: 'Exam terms and subjects',
      icon: Settings,
      href: '/dashboard/academics/exam-terms',
      color: 'bg-indigo-50 text-indigo-600',
      tasks: [
        { label: 'Configure Exam Terms', done: (examsQuery.data?.length ?? 0) > 0 },
        { label: 'Map Subjects', done: totalSubjects > 0 },
      ]
    },
    {
      id: 'entry',
      label: 'Marks/CAS',
      description: 'Recording assessments',
      icon: ClipboardList,
      href: '/dashboard/academics/marks',
      color: 'bg-purple-50 text-purple-600',
      tasks: [
        { label: 'Marks Entry Ready', done: (examsQuery.data?.length ?? 0) > 0 && totalSubjects > 0 },
        { label: 'CAS Entry Ready', done: totalSubjects > 0 },
      ]
    },
    {
      id: 'lock',
      label: 'Lock',
      description: 'Finalize & Secure',
      icon: Lock,
      href: '/dashboard/academics/locks',
      color: 'bg-amber-50 text-amber-600',
      tasks: [
        { label: 'Secure Marks', done: Boolean(examsQuery.data?.some(e => e.isLocked)) },
        { label: 'Audit Review', done: Boolean(examsQuery.data?.some(e => e.isLocked)) },
      ]
    },
    {
      id: 'report-cards',
      label: 'Report Cards',
      description: 'PDF Generation',
      icon: FileText,
      href: '/dashboard/academics/report-cards',
      color: 'bg-rose-50 text-rose-600',
      tasks: [
        { label: 'Batch Generate', done: reportCardsGenerated > 0 },
        { label: 'Generation Results', done: reportCardsGenerated > 0 },
      ]
    },
    {
      id: 'promotion',
      label: 'Promotion',
      description: 'Next-Year Readiness',
      icon: GraduationCap,
      href: '/dashboard/academics/promotion',
      color: 'bg-emerald-50 text-emerald-600',
      tasks: [
        { label: 'Eligibility Review', done: reportCardsGenerated > 0 },
        { label: 'Readiness Only', done: true },
      ]
    },
    {
      id: 'publish',
      label: 'Publish',
      description: 'Parent Notification',
      icon: Megaphone,
      href: '/dashboard/academics/publishing',
      color: 'bg-orange-50 text-orange-600',
      tasks: [
        { label: 'Publish Review', done: reportCardsGenerated > 0 },
        { label: 'Guardian Warning', done: true },
      ]
    }
  ];

  return (
    <div className="space-y-12 pb-20 animate-fade-in">
      {/* Academic workflow header */}
      <section className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-white shadow-2xl">
        <div className="relative z-10 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-primary-500/20 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary-300 backdrop-blur-md border border-primary-500/30">
                Phase 2A Operations
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-7xl italic uppercase">
              Academic <span className="text-primary-400">Workflow</span>
            </h1>
            <p className="mt-4 text-lg font-medium text-slate-300 leading-relaxed">
              Standardized administrative flow for exams, assessment, and student progress reporting.
            </p>
          </div>

          <div className="mt-10 lg:mt-0 flex gap-4">
             <div className="h-24 w-24 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center backdrop-blur-xl">
                <span className="text-2xl font-black text-white tracking-tighter">{activeExamsCount}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Active</span>
             </div>
             <div className="h-24 w-24 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center backdrop-blur-xl">
                <span className="text-2xl font-black text-white tracking-tighter">{reportCardsGenerated}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Cards</span>
             </div>
          </div>
        </div>

        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
      </section>

      {/* Workflow stepper */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {workflowSteps.map((step, idx) => {
          const progress = getStepProgress(step.tasks);

          return (
          <Link key={step.id} href={step.href}>
            <div className="group relative h-full rounded-[2.5rem] border border-slate-200 bg-white p-8 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200 overflow-hidden">
              {/* Progress Indicator */}
              <div className="absolute top-0 right-0 h-1 bg-slate-100 w-full">
                <div 
                  className={cn("h-full transition-all duration-1000", step.color.split(' ')[1].replace('text', 'bg'))}
                  style={{ width: `${progress}%` }} 
                />
              </div>

              <div className="flex items-start justify-between mb-8">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${step.color} transition-transform group-hover:rotate-12`}>
                  <step.icon size={32} />
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Step 0{idx + 1}</div>
              </div>

              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2 italic">
                {step.label}
              </h3>
              <p className="text-sm font-bold text-slate-400 leading-relaxed mb-6">
                {step.description}
              </p>

              <div className="space-y-3">
                 {step.tasks.map((task) => (
                   <div key={task.label} className="flex items-center gap-2">
                      <div className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center border-2 transition-colors",
                        task.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-100 bg-slate-50"
                      )}>
                        {task.done && <CheckCircle2 size={10} />}
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        task.done ? "text-emerald-600" : "text-slate-400"
                      )}>
                        {task.label}
                      </span>
                   </div>
                 ))}
              </div>

              <div className="mt-10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 opacity-0 transition-all -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0">
                  Open Control
                  <ArrowRight size={14} />
                </div>
                {progress === 100 && (
                  <Badge variant="success" className="h-6 px-3 font-black text-[8px] uppercase tracking-widest">Complete</Badge>
                )}
              </div>
            </div>
          </Link>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Audit Timeline"
          description="Latest academic modifications and entries."
          headerAction={
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors">
              <ClipboardList size={14} />
              Full Audit
            </button>
          }
        >
          <div className="p-12 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 text-center">
            <Search className="h-12 w-12 mb-4 opacity-10" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Awaiting Data Flow</p>
            <p className="mt-2 text-[10px] font-bold max-w-xs leading-relaxed">System activity will appear here once you begin the academic workflow for this terminal period.</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Workflow Readiness"
          description="Pre-requisite check for the next step."
        >
          <div className="space-y-4">
             <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Layers size={24} />
                   </div>
                   <div>
                      <p className="text-sm font-black text-indigo-900 tracking-tight">Setup Integrity</p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Assessment Map</p>
                   </div>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-xl font-black text-indigo-600 tracking-tighter">{getStepProgress(workflowSteps[0].tasks)}%</span>
                   <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">{getStepProgress(workflowSteps[0].tasks) === 100 ? 'Ready' : 'Needs setup'}</span>
                </div>
             </div>
             
             <div className="p-6 rounded-[2rem] bg-amber-50/50 border border-amber-100 flex items-center justify-between opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
                      <Lock size={24} />
                   </div>
                   <div>
                      <p className="text-sm font-black text-amber-900 tracking-tight">Lock Readiness</p>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Entry Progress</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <AlertCircle size={16} className="text-amber-400" />
                   <span className="text-[8px] font-black uppercase tracking-widest text-amber-400">{reportCardsGenerated > 0 ? 'Review' : 'Waiting'}</span>
                </div>
             </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function getStepProgress(tasks: Array<{ done: boolean }>) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100);
}

function Badge({ children, variant, className }: { children: React.ReactNode; variant: 'success'; className?: string }) {
  return (
    <span className={cn(
      "rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200",
      className
    )}>
      {children}
    </span>
  );
}
