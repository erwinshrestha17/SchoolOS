'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';

/**
 * Assigned-student projection only (Teacher Persona spec M1 / B12). Every
 * group here is exactly one of the caller's own active Class/Subject Teacher
 * assignments -- no class picker, no search across the whole school. Medical
 * information is a redacted boolean flag, not the underlying record.
 */
export function MyStudentsWorkspace() {
  const query = useQuery({
    queryKey: ['teacher-my-students'],
    queryFn: () => api.getMyStudents(),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return <LoadingState variant="page" label="Loading your assigned students..." />;
  }

  if (query.isError) {
    return (
      <SectionCard title="Unable to load your students">
        <p className="text-sm text-slate-600">
          Something went wrong. Please try again shortly.
        </p>
      </SectionCard>
    );
  }

  const groups = query.data ?? [];

  if (groups.length === 0) {
    return (
      <SectionCard title="No assigned students">
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-sm leading-5 text-slate-600">
            You have no active Class Teacher or Subject Teacher assignment with a
            section for the current academic year yet.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <SectionCard
          key={`${group.classId}:${group.sectionId}`}
          title={group.className}
          description={group.subject}
          headerAction={
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
              {group.students.length} student{group.students.length === 1 ? '' : 's'}
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">
                    Roll
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Name
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Student ID
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Alerts
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.students.map((student) => (
                  <tr key={student.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-700">
                      {student.rollNumber ?? '—'}
                    </td>
                    <td className="py-2 pr-3 font-bold text-slate-900">
                      {student.fullNameEn}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{student.studentSystemId}</td>
                    <td className="py-2 pr-3">
                      {student.hasMedicalAlert ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning-100 bg-warning-50 px-2 py-0.5 text-[0.7rem] font-bold text-warning-700">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Medical
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
