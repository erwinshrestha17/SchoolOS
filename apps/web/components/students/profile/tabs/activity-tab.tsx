'use client';

import { ActivityPost } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Images } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ActivityTabProps = {
  posts: ActivityPost[];
};

const formatDate = (date: string | Date) => {
  try {
    return new Intl.DateTimeFormat('en-NP', {
      dateStyle: 'medium',
    }).format(new Date(date));
  } catch {
    return 'Publish date not recorded';
  }
};

export function ActivityTab({ posts }: ActivityTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
       <SectionCard title="School Activity Feed" description="Timeline of school updates and student involvement">
          {posts.length > 0 ? (
            <div className="space-y-8 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
               {posts.map((post) => (
                 <div key={post.id} className="relative pl-12">
                    <div className="absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
                       <Images size={18} />
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-white hover:shadow-md">
                       <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-slate-900">{post.title}</p>
                          <p className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-widest">
                            {formatDate(post.publishedAt || '')}
                          </p>
                       </div>
                       <p className="text-sm text-slate-600 leading-relaxed">
                         {post.body || post.caption || 'No content'}
                       </p>
                       <div className="mt-4 flex items-center gap-3">
                          <Badge variant="info">{post.category}</Badge>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
                <Images size={32} />
              </div>
              <p className="text-sm font-bold text-slate-900">No activity yet</p>
              <p className="mt-1 text-xs text-slate-400">Posts involving the student will appear here.</p>
            </div>
          )}
       </SectionCard>
    </div>
  );
}
