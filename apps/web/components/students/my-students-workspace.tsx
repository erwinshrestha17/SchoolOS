'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertTriangle, Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import type { MyStudentsGroupStudent } from '@/lib/api/teacher-students';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { Select } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';

type SortKey = 'roll' | 'name' | 'attendance';

function attendanceTone(student: MyStudentsGroupStudent) {
  if (student.attendancePercent === null) return 'text-slate-400';
  if (student.needsAttendanceFollowUp) return 'text-danger-700';
  if (student.attendancePercent < 90) return 'text-warning-700';
  return 'text-success-700';
}

/**
 * Assigned-student projection only (Teacher Persona spec M1 / B12, P1.3).
 *
 * Every group is one of the caller's own active Class/Subject Teacher
 * assignments -- there is no class picker that could reach the whole school,
 * because the backend resolves the groups from the caller's assignments. The
 * class filter below only narrows what is already authorised.
 *
 * Medical information stays a redacted boolean flag, never the underlying
 * record. Attendance is a 30-day signal the teacher can act on; `null` renders
 * as "No data", never as 0%, so an unmarked roster cannot read as total
 * absence.
 */
export function MyStudentsWorkspace() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('roll');
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);

  const query = useQuery({
    queryKey: ['teacher-my-students'],
    queryFn: () => api.getMyStudents(),
    staleTime: 60_000,
  });

  const groups = useMemo(() => query.data ?? [], [query.data]);

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return groups
      .filter(
        (group) =>
          !groupFilter || `${group.classId}:${group.sectionId}` === groupFilter,
      )
      .map((group) => {
        const students = group.students
          .filter((student) => {
            if (
              onlyNeedsAttention &&
              !student.needsAttendanceFollowUp &&
              !student.hasMedicalAlert
            ) {
              return false;
            }
            if (!needle) return true;
            return (
              student.fullNameEn.toLowerCase().includes(needle) ||
              student.studentSystemId.toLowerCase().includes(needle) ||
              String(student.rollNumber ?? '').includes(needle)
            );
          })
          .sort((a, b) => {
            if (sortKey === 'name') {
              return a.fullNameEn.localeCompare(b.fullNameEn);
            }
            if (sortKey === 'attendance') {
              // Lowest attendance first -- that is the list a teacher acts
              // on. Students with no data sort last, not as 0%.
              const left = a.attendancePercent ?? Number.POSITIVE_INFINITY;
              const right = b.attendancePercent ?? Number.POSITIVE_INFINITY;
              return left - right;
            }
            return (
              (a.rollNumber ?? Number.POSITIVE_INFINITY) -
              (b.rollNumber ?? Number.POSITIVE_INFINITY)
            );
          });
        return { ...group, students };
      })
      .filter((group) => group.students.length > 0);
  }, [groupFilter, groups, onlyNeedsAttention, search, sortKey]);

  const totalMatching = visibleGroups.reduce(
    (sum, group) => sum + group.students.length,
    0,
  );
  const hasFilters = Boolean(search.trim() || groupFilter || onlyNeedsAttention);

  if (query.isLoading) {
    return (
      <LoadingState variant="page" label="Loading your assigned students..." />
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load your students"
        message="Your assigned rosters could not be loaded just now. Please try again."
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (groups.length === 0) {
    return (
      <SectionCard title="No assigned students">
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <Users
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <p className="text-sm leading-5 text-slate-600">
            You have no active Class Teacher or Subject Teacher assignment with a
            section for the current academic year yet. Ask the academic
            coordinator if you expected one.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-[14rem] flex-1">
          <label htmlFor="my-students-search" className="sr-only">
            Search your students by name, roll number, or student ID
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="my-students-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, roll, or student ID"
            className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        <div className="min-w-[12rem]">
          <label
            htmlFor="my-students-group"
            className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Class
          </label>
          <Select
            id="my-students-group"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            {/* Only the caller's own assignments -- never "All Classes". */}
            <option value="">All my classes</option>
            {groups.map((group) => (
              <option
                key={`${group.classId}:${group.sectionId}`}
                value={`${group.classId}:${group.sectionId}`}
              >
                {group.className} · {group.subject}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[11rem]">
          <label
            htmlFor="my-students-sort"
            className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Sort by
          </label>
          <Select
            id="my-students-sort"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            <option value="roll">Roll number</option>
            <option value="name">Name</option>
            <option value="attendance">Lowest attendance</option>
          </Select>
        </div>

        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={onlyNeedsAttention}
            onChange={(event) => setOnlyNeedsAttention(event.target.checked)}
          />
          Needs attention only
        </label>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setGroupFilter('');
              setOnlyNeedsAttention(false);
            }}
            className="h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
          >
            Reset filters
          </button>
        ) : null}
      </div>

      <p className="text-sm text-slate-500" role="status">
        {totalMatching} student{totalMatching === 1 ? '' : 's'}
        {hasFilters ? ' match your filters' : ' across your assignments'}
      </p>

      {visibleGroups.length === 0 ? (
        <SectionCard title="No students match these filters">
          <p className="text-sm text-slate-600">
            Try clearing the search or the &ldquo;needs attention&rdquo; filter.
          </p>
        </SectionCard>
      ) : (
        visibleGroups.map((group) => (
          <SectionCard
            key={`${group.classId}:${group.sectionId}`}
            title={group.className}
            description={group.subject}
            headerAction={
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                {group.students.length} student
                {group.students.length === 1 ? '' : 's'}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {`Students in ${group.className} ${group.subject}, with roll number, attendance over the last 30 days, and alerts`}
                </caption>
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
                      Attendance (30d)
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Alerts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium text-slate-700">
                        {student.rollNumber ?? '—'}
                      </td>
                      <td className="py-2 pr-3 font-bold text-slate-900">
                        {student.fullNameEn}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">
                        {student.studentSystemId}
                      </td>
                      <td
                        className={cn(
                          'py-2 pr-3 font-bold tabular-nums',
                          attendanceTone(student),
                        )}
                      >
                        {student.attendancePercent === null ? (
                          <span className="font-normal text-slate-400">
                            No data
                          </span>
                        ) : (
                          <>
                            {student.attendancePercent}%
                            {student.absencesInWindow > 0 ? (
                              <span className="ml-1.5 font-normal text-slate-500">
                                ({student.absencesInWindow} absent)
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {student.needsAttendanceFollowUp ? (
                            <span className="inline-flex items-center rounded-full border border-danger-100 bg-danger-50 px-2 py-0.5 text-[0.7rem] font-bold text-danger-700">
                              Low attendance
                            </span>
                          ) : null}
                          {student.hasMedicalAlert ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-warning-100 bg-warning-50 px-2 py-0.5 text-[0.7rem] font-bold text-warning-700">
                              <AlertTriangle
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              Medical
                            </span>
                          ) : null}
                          {!student.needsAttendanceFollowUp &&
                          !student.hasMedicalAlert ? (
                            <span className="text-slate-300">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
}
