'use client';

import { StudentProfileDetail } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatDate = (date: string | Date) => {
  try {
    return new Intl.DateTimeFormat('en-NP', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch {
    return 'History date not recorded';
  }
};

export function HistoryTab({ profile }: { profile: StudentProfileDetail }) {
  const historyItems = [
    ...(profile.student as any).createdAt ? [{
      id: 'update',
      type: 'UPDATE',
      title: 'Profile Activity',
      date: (profile.student as any).createdAt,
      icon: <History size={18} />,
      color: 'border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]'
    }] : []
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
       <SectionCard title="Student History Log" description="Audit trail of student lifecycle events">
          {historyItems.length > 0 ? (
            <div className="space-y-8 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
               {historyItems.map((item) => (
                 <div key={item.id} className="relative pl-12">
                    <div className={`absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm ${item.color}`}>
                       {item.icon}
                    </div>
                    <div>
                       <div className="flex items-center gap-3">
                          <p className="font-bold text-slate-900">{item.title}</p>
                          <Badge variant="info">{item.type}</Badge>
                       </div>
                       <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">{formatDate(item.date)}</p>
                    </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
                <History size={32} />
              </div>
              <p className="text-sm font-bold text-slate-900">No history events recorded</p>
              <p className="mt-1 text-xs text-slate-400">Student lifecycle events will appear after profile changes are recorded.</p>
            </div>
          )}
       </SectionCard>
    </div>
  );
}
