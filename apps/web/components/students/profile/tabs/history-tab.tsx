'use client';

import { useQuery } from '@tanstack/react-query';
import { formatBsDateTime, type StudentProfileDetail } from '@schoolos/core';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { LoadingState } from '@/components/ui/loading-state';
import { 
  History, 
  User, 
  ArrowRightLeft, 
  GraduationCap, 
  Ban, 
  Trash2, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatDate = (date: string | Date) => {
  try {
    return formatBsDateTime(date);
  } catch {
    return 'History date not recorded';
  }
};

export function HistoryTab({ profile }: { profile: StudentProfileDetail }) {
  const studentId = profile.student.id;

  const { data: timeline, isLoading, isError } = useQuery({
    queryKey: ['student-lifecycle-timeline', studentId],
    queryFn: () => api.getStudentLifecycleTimeline(studentId),
    enabled: Boolean(studentId),
  });

  if (isLoading) {
    return <LoadingState label="Loading lifecycle history log..." />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-red-100 bg-red-50/20 p-6">
        <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
        <p className="text-sm font-bold text-slate-900">Failed to load history</p>
        <p className="text-xs text-slate-500 mt-1">An error occurred while fetching the lifecycle timeline.</p>
      </div>
    );
  }

  const getTransitionDetails = (toStatus: string) => {
    switch (toStatus) {
      case 'ACTIVE':
        return {
          title: 'Admission / Re-entry',
          color: 'border-success-200 bg-success-50 text-success-700',
          icon: <User size={18} />,
        };
      case 'TRANSFERRED':
        return {
          title: 'Student Transferred',
          color: 'border-warning-200 bg-warning-50 text-warning-700',
          icon: <ArrowRightLeft size={18} />,
        };
      case 'EXITED':
      case 'WITHDRAWN':
        return {
          title: 'Student Withdrawn',
          color: 'border-slate-200 bg-slate-50 text-slate-700',
          icon: <Ban size={18} />,
        };
      case 'ALUMNI':
      case 'GRADUATED':
        return {
          title: 'Graduated / Alumni',
          color: 'border-info-200 bg-info-50 text-info-700',
          icon: <GraduationCap size={18} />,
        };
      case 'DELETED':
        return {
          title: 'Record Soft Deleted',
          color: 'border-danger-200 bg-danger-50 text-danger-700',
          icon: <Trash2 size={18} />,
        };
      case 'MERGED':
        return {
          title: 'Duplicate Record Merged',
          color: 'border-indigo-200 bg-indigo-50 text-indigo-700',
          icon: <RefreshCw size={18} />,
        };
      default:
        return {
          title: 'Lifecycle Update',
          color: 'border-slate-200 bg-slate-50 text-slate-600',
          icon: <History size={18} />,
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionCard 
        title="Student History Log" 
        description="Chronological audit trail of student lifecycle transitions and events"
      >
        {timeline && timeline.length > 0 ? (
          <div className="space-y-8 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
            {timeline.map((item) => {
              const details = getTransitionDetails(item.toStatus);
              return (
                <div key={item.id} className="relative pl-12">
                  <div className={`absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm ${details.color}`}>
                    {details.icon}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{details.title}</h4>
                      <Badge variant={item.toStatus === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px] uppercase font-extrabold tracking-wider">
                        {item.fromStatus ? `${item.fromStatus} → ` : ''}{item.toStatus}
                      </Badge>
                      {item.feeClearanceWaived && (
                        <Badge variant="warning" className="text-[10px] font-extrabold uppercase">
                          Fee Clearance Waived
                        </Badge>
                      )}
                    </div>
                    {item.reason && (
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2.5 max-w-xl border border-slate-100 font-medium">
                        {item.reason}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                      <span>{formatDate(item.changedAt)}</span>
                      {item.changedByEmail && (
                        <>
                          <span>•</span>
                          <span>By: {item.changedByEmail}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
              <History size={32} />
            </div>
            <p className="text-sm font-bold text-slate-900">No history events recorded</p>
            <p className="mt-1 text-xs text-slate-400">Student lifecycle events (admissions, transfers, deletions) will appear here after updates.</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
