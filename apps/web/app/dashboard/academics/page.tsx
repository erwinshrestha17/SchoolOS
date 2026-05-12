'use client';

import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { 
  BookOpen, 
  CalendarDays, 
  ClipboardList, 
  FileText, 
  CalendarCheck,
  TrendingUp,
  Award,
  Users,
  History,
  CheckCircle2,
  Trophy,
  Megaphone
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function AcademicsOverviewPage() {
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const homeworkQuery = useQuery({ queryKey: ['homework'], queryFn: () => api.listHomework() });

  const activeExamsCount = examsQuery.data?.filter(e => e.status === 'ACTIVE').length ?? 0;
  const assignmentsDueCount = homeworkQuery.data?.filter(h => h.dueDate && new Date(h.dueDate) > new Date()).length ?? 0;

  const academicModules = [
    {
      title: 'Homework',
      description: 'Assign, track, and review student assignments.',
      icon: BookOpen,
      href: '/dashboard/homework',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Timetable',
      description: 'Build and manage class schedules and teacher assignments.',
      icon: CalendarDays,
      href: '/dashboard/timetable',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Exams',
      description: 'Configure exam terms, assessment components, and schedules.',
      icon: ClipboardList,
      href: '/dashboard/exams',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Marks Entry',
      description: 'Record student scores and track academic performance.',
      icon: CheckCircle2,
      href: '/dashboard/marks-entry',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Report Cards',
      description: 'Generate and publish student performance reports.',
      icon: FileText,
      href: '/dashboard/academics/report-cards',
      color: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'Attendance',
      description: 'Track student daily and periodic attendance.',
      icon: CalendarCheck,
      href: '/dashboard/attendance',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Promotions',
      description: 'Manage student year-end promotions and batch transfers.',
      icon: Trophy,
      href: '/dashboard/academics/promotions',
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      title: 'Result Publishing',
      description: 'Review and publish terminal and annual results.',
      icon: Megaphone,
      href: '/dashboard/academics/results',
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <div className="space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-primary-500/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary-300 backdrop-blur-sm border border-primary-500/30">
              Academic Hub
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl italic uppercase">
            School <span className="text-primary-400">Academics</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg font-medium text-slate-300 leading-relaxed">
            Central command for curriculum management, scheduling, and student performance tracking.
          </p>
        </div>

        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px]" />
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {academicModules.map((module) => {
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
                  Open Module
                  <TrendingUp size={14} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Recent Academic Activity"
          description="Latest assignments and exam updates."
        >
          <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center text-slate-400">
            <Award className="h-12 w-12 mb-4 opacity-10" />
            <p className="text-sm font-bold uppercase tracking-widest">No recent activity</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Academic Insights"
          description="Quick metrics from across your school."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center">
              {examsQuery.isLoading ? (
                <div className="h-8 w-8 animate-pulse rounded bg-indigo-200" />
              ) : (
                <span className="text-2xl font-black text-indigo-600">{activeExamsCount}</span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Active Exams</span>
            </div>
            <div className="p-6 rounded-[2rem] bg-emerald-50/50 border border-emerald-100 flex flex-col items-center">
              {homeworkQuery.isLoading ? (
                <div className="h-8 w-8 animate-pulse rounded bg-emerald-200" />
              ) : (
                <span className="text-2xl font-black text-emerald-600">{assignmentsDueCount}</span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Assignments Due</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
