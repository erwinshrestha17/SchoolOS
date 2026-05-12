'use client';

import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { 
  BookOpen, 
  ClipboardList, 
  FileText, 
  CalendarCheck,
  TrendingUp,
  Award,
  CheckCircle2,
  Trophy,
  Megaphone,
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AcademicsOverviewPage() {
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const reportsQuery = useQuery({ queryKey: ['report-cards'], queryFn: () => api.listReportCards() });

  const activeExamsCount = examsQuery.data?.filter(e => !e.isLocked).length ?? 0;
  const reportCardsGenerated = reportsQuery.data?.length ?? 0;

  const workflowGroups = [
    {
      label: 'Setup',
      items: [
        {
          title: 'Exam Terms',
          description: 'Configure terminal and periodic exam boundaries.',
          icon: ClipboardList,
          href: '/dashboard/academics/exam-terms',
          color: 'bg-indigo-50 text-indigo-600',
        },
        {
          title: 'Assessment Components',
          description: 'Define weights and subjects for each exam.',
          icon: Layers,
          href: '/dashboard/academics/assessment-components',
          color: 'bg-blue-50 text-blue-600',
        },
      ]
    },
    {
      label: 'Marks & CAS',
      items: [
        {
          title: 'Marks Entry',
          description: 'Record subject scores optimized for staff entry.',
          icon: CheckCircle2,
          href: '/dashboard/academics/marks',
          color: 'bg-purple-50 text-purple-600',
        },
        {
          title: 'CAS Records',
          description: 'Track behavioral and non-exam assessments.',
          icon: Award,
          href: '/dashboard/academics/cas',
          color: 'bg-pink-50 text-pink-600',
        },
      ]
    },
    {
      label: 'Lock & Review',
      items: [
        {
          title: 'Marks Lock',
          description: 'Secure marks to prevent changes before results.',
          icon: Lock,
          href: '/dashboard/academics/locks',
          color: 'bg-amber-50 text-amber-600',
        },
        {
          title: 'Result Preview',
          description: 'Preview grades and GPA calculations.',
          icon: TrendingUp,
          href: '/dashboard/academics/results',
          color: 'bg-cyan-50 text-cyan-600',
        },
      ]
    },
    {
      label: 'Output',
      items: [
        {
          title: 'Report Cards',
          description: 'Generate batch or student report card PDFs.',
          icon: FileText,
          href: '/dashboard/academics/report-cards',
          color: 'bg-rose-50 text-rose-600',
        },
        {
          title: 'Promotion',
          description: 'Review readiness and move students to next year.',
          icon: Trophy,
          href: '/dashboard/academics/promotion',
          color: 'bg-emerald-50 text-emerald-600',
        },
      ]
    },
    {
      label: 'Finalize',
      items: [
        {
          title: 'Publish Results',
          description: 'Make results visible and notify guardians.',
          icon: Megaphone,
          href: '/dashboard/academics/publishing',
          color: 'bg-orange-50 text-orange-600',
        },
      ]
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      <section className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-primary-500/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary-300 backdrop-blur-sm border border-primary-500/30">
              Academic Control Center
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl italic uppercase">
            Academic <span className="text-primary-400">Workflow</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg font-medium text-slate-300 leading-relaxed">
            Central command for setup, assessment, and results management.
          </p>
        </div>

        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
      </section>

      <div className="space-y-16">
        {workflowGroups.map((group, idx) => (
          <div key={group.label} className="relative">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-black text-sm">
                0{idx + 1}
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">
                {group.label}
              </h2>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {group.items.map((module) => {
                const Icon = module.icon;
                return (
                  <Link key={module.title} href={module.href}>
                    <div className="group relative h-full rounded-[2.5rem] border border-slate-200 bg-white p-8 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200">
                      <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${module.color} transition-transform group-hover:rotate-12`}>
                        <Icon size={28} />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2 italic">
                        {module.title}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed">
                        {module.description}
                      </p>
                      <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Continue Workflow
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {idx < workflowGroups.length - 1 && (
              <div className="absolute -bottom-10 left-5 h-10 w-px bg-slate-100" />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Recent Academic Activity"
          description="Latest assignments and exam updates."
        >
          <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400">
            <Award className="h-12 w-12 mb-4 opacity-10" />
            <p className="text-sm font-bold uppercase tracking-widest">No recent activity</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Workflow Insights"
          description="Quick metrics from the current academic year."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="p-8 rounded-[2.5rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center">
              {examsQuery.isLoading ? (
                <div className="h-8 w-8 animate-pulse rounded bg-indigo-200" />
              ) : (
                <span className="text-3xl font-black text-indigo-600 tracking-tighter">{activeExamsCount}</span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mt-2">Active Exams</span>
            </div>
            <div className="p-8 rounded-[2.5rem] bg-rose-50/50 border border-rose-100 flex flex-col items-center">
              {reportsQuery.isLoading ? (
                <div className="h-8 w-8 animate-pulse rounded bg-rose-200" />
              ) : (
                <span className="text-3xl font-black text-rose-600 tracking-tighter">{reportCardsGenerated}</span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 mt-2">Cards Generated</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
