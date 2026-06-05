'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FileWarning, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';

export function ConflictsList({ activeVersionId }: { activeVersionId?: string }) {
  const validateQuery = useQuery({
    queryKey: ['timetable-validation', activeVersionId],
    queryFn: () => api.validateTimetableVersion(activeVersionId!),
    enabled: Boolean(activeVersionId),
  });

  if (!activeVersionId) {
    return <EmptyState title="No active version" description="Select or create a timetable version to run conflict validation." />;
  }

  if (validateQuery.isLoading) return <LoadingState label="Running conflict validation..." />;

  const result = validateQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Conflict Report</h2>
          <p className="text-sm text-slate-500 font-medium">Real-time validation against teacher availability, room capacity, and workload limits.</p>
        </div>
        <Button
          className="rounded-xl bg-[var(--color-mod-homework-accent)] font-bold text-white shadow-sm hover:bg-[var(--color-mod-homework-text)]"
          onClick={() => validateQuery.refetch()}
          disabled={validateQuery.isFetching}
        >
          <Zap className="mr-2 h-4 w-4" />
          {validateQuery.isFetching ? 'Validating...' : 'Run Validation'}
        </Button>
      </div>

      {!result || (result.errors.length === 0 && result.warnings.length === 0) ? (
        <EmptyState 
          title="No conflicts detected" 
          description="Your timetable is currently clean. All constraints are satisfied."
          icon={<Zap className="h-10 w-10 opacity-20" />}
        />
      ) : (
        <div className="grid gap-6">
          {result.errors.map((error, index) => (
            <SectionCard 
              key={`error-${index}`}
              title={error.type || 'Blocking Conflict'}
              className="border-red-100 bg-red-50/30"
              headerAction={<Badge variant="destructive">Error</Badge>}
            >
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-red-900">{error.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {error.conflictingSlotId && (
                      <Badge variant="outline" className="bg-white border-red-200 text-red-600 text-[10px] font-bold">
                        Slot ID: {error.conflictingSlotId}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          ))}

          {result.warnings.map((warning, index) => (
            <SectionCard 
              key={`warning-${index}`}
              title={warning.type || 'Soft Warning'}
              className="border-amber-100 bg-amber-50/30"
              headerAction={<Badge variant="secondary" className="bg-amber-100 text-amber-700">Warning</Badge>}
            >
              <div className="flex items-start gap-4">
                <FileWarning className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-amber-900">{warning.message}</p>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
