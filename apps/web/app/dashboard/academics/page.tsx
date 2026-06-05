'use client';

import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardList, 
  FileText, 
  CheckCircle2,
  Megaphone,
  Lock,
  Layers,
  ArrowRight,
  Settings,
  GraduationCap,
  AlertCircle,
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
    <div className="space-y-8 pb-20 animate-fade-in">
      <PageHeader
        title="Academics"
        description="Manage exam setup, marks entry, locks, report cards, publishing, and promotion readiness."
        actions={
          <Link
            href="/dashboard/academics/exam-terms"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-academics-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-academics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-academics-border)] focus:ring-offset-2"
          >
            <Settings size={18} />
            Exam Setup
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Active Exam Terms"
          value={activeExamsCount}
          icon={<ClipboardList size={18} />}
          loading={examsQuery.isLoading}
          tone="info"
        />
        <StatCard
          title="Report Cards"
          value={reportCardsGenerated}
          icon={<FileText size={18} />}
          loading={reportsQuery.isLoading}
          tone="neutral"
        />
        <StatCard
          title="Subjects"
          value={totalSubjects}
          icon={<Layers size={18} />}
          loading={subjectsQuery.isLoading}
          tone={totalSubjects > 0 ? 'success' : 'warning'}
        />
      </div>

      {/* Workflow stepper */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {workflowSteps.map((step, idx) => {
          const progress = getStepProgress(step.tasks);

          return (
          <Link key={step.id} href={step.href}>
            <div className="group relative h-full overflow-hidden rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-[var(--color-mod-academics-border)] hover:shadow-sm">
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
                <div className="text-xs font-bold text-slate-400">Step {idx + 1}</div>
              </div>

              <h3 className="mb-2 text-xl font-bold leading-7 text-slate-950">
                {step.label}
              </h3>
              <p className="mb-6 text-sm leading-[22px] text-slate-500">
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
                        "text-xs font-bold",
                        task.done ? "text-emerald-600" : "text-slate-400"
                      )}>
                        {task.label}
                      </span>
                   </div>
                 ))}
              </div>

              <div className="mt-10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-mod-academics-text)] opacity-0 transition-all -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0">
                  Open Workspace
                  <ArrowRight size={14} />
                </div>
                {progress === 100 && (
                  <Badge variant="success" className="h-6 px-3 text-xs font-bold">Complete</Badge>
                )}
              </div>
            </div>
          </Link>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Audit Scope"
          description="Academic actions stay inside their dedicated exam, marks, lock, report-card, and publishing workspaces."
        >
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-100 p-12 text-center text-slate-400">
            <Search className="h-12 w-12 mb-4 opacity-10" />
            <p className="text-sm font-bold text-slate-700">Open a workspace for audit-controlled actions</p>
            <p className="mt-2 max-w-xs text-xs font-medium leading-relaxed">This overview only summarizes readiness from backend data and links to the operational screens.</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Workflow Readiness"
          description="Pre-requisite check for the next step."
        >
          <div className="space-y-4">
             <div className="flex items-center justify-between rounded-xl border border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-soft)] p-6">
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
             
             <div className="flex items-center justify-between rounded-xl border border-warning-100 bg-warning-50/50 p-6 opacity-80 transition-all hover:opacity-100">
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
