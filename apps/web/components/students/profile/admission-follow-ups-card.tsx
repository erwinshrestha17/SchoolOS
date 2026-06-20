'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, IdCard, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { admissionCasesApi } from '../../../lib/api/admission-cases';

export function AdmissionFollowUpsCard({ studentId }: { studentId: string }) {
  const query = useQuery({
    queryKey: ['student-admission-follow-ups', studentId],
    queryFn: () => admissionCasesApi.getStudentFollowUps(studentId),
    enabled: Boolean(studentId),
  });

  if (query.isLoading) {
    return <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading admission follow-ups…</div>;
  }
  if (query.isError || !query.data?.items.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">New admission follow-ups</p>
          <p className="mt-1 text-sm text-slate-600">These items do not block the student’s active record.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{query.data.items.length} to review</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {query.data.items.map((item) => {
          const Icon = item.code === 'DOCUMENTS_PENDING' ? FileText : item.code === 'IEMIS_INFORMATION_INCOMPLETE' ? IdCard : ShieldCheck;
          const href = item.code === 'DOCUMENTS_PENDING'
            ? `/dashboard/students/${studentId}?tab=Documents`
            : item.code === 'IEMIS_INFORMATION_INCOMPLETE'
              ? `/dashboard/students/${studentId}?tab=Profile`
              : `/dashboard/students/${studentId}?tab=Guardians`;
          return (
            <Link key={item.code} href={href} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50">
              <Icon className="h-5 w-5 text-[var(--color-mod-admissions-accent)]" />
              <p className="mt-2 text-sm font-bold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Open follow-up</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
