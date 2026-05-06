'use client';

import { StudentProfileDetail } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { History, FilePlus, ArrowRightLeft, Archive, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
};

export function HistoryTab({ profile }: { profile: StudentProfileDetail }) {
  // Currently mapping admissions to history items as a basic example
  // Future: Fetch dedicated audit logs for students
  const historyItems = [
    ...(profile.student as any).createdAt ? [{
      id: 'update',
      type: 'UPDATE',
      title: 'Profile Activity',
      date: (profile.student as any).createdAt,
      icon: <History size={18} />,
      color: 'text-primary-500 bg-primary-50'
    }] : []
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
       <SectionCard title="Student History Log" description="Audit trail of student lifecycle events">
          <div className="space-y-8 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
             {historyItems.map((item) => (
               <div key={item.id} className="relative pl-12">
                  <div className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl border border-white shadow-sm z-10 ${item.color}`}>
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
       </SectionCard>
    </div>
  );
}
