'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, FileWarning, Plus } from 'lucide-react';

import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SectionCard } from '@/components/ui/section-card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ConflictsList } from '@/components/timetable/conflicts-list';

export default function TimetableConflictsPage() {
  const [academicYearId, setAcademicYearId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const versionsQuery = useQuery({
    queryKey: ['timetable-versions', academicYearId],
    queryFn: () =>
      api.listTimetableVersions({
        academicYearId: academicYearId || undefined,
      }),
  });

  const versions = versionsQuery.data?.items ?? [];
  const activeVersion = versions.find((version) => version.status === 'PUBLISHED');
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ??
    activeVersion ??
    versions[0];

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Link href="/dashboard/timetable">
        <Button variant="outline" className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Timetable
        </Button>
      </Link>
      <Link href="/dashboard/timetable/builder">
        <Button className="rounded-xl bg-info-600 text-white hover:bg-info-700">
          <Plus className="mr-2 h-4 w-4" />
          Builder
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable Conflicts"
        description="Run backend validation for published or draft timetable versions before operators publish, lock, or rely on the schedule."
        actions={headerActions}
      />

      <SectionCard
        title="Validation scope"
        description="Choose the academic year and timetable version to validate. Published versions are selected by default when available."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Academic year
            </span>
            <Select
              value={academicYearId}
              onChange={(event) => {
                setAcademicYearId(event.target.value);
                setSelectedVersionId('');
              }}
            >
              <option value="">All Years</option>
              {academicYearsQuery.data?.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Timetable version
            </span>
            <Select
              value={selectedVersion?.id ?? ''}
              onChange={(event) => setSelectedVersionId(event.target.value)}
              disabled={versionsQuery.isLoading || versions.length === 0}
            >
              {versions.length === 0 ? (
                <option value="">No versions available</option>
              ) : (
                versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.versionName} · {version.status}
                  </option>
                ))
              )}
            </Select>
          </label>
        </div>
      </SectionCard>

      {versionsQuery.isLoading ? (
        <LoadingState label="Loading timetable versions..." />
      ) : selectedVersion ? (
        <ConflictsList activeVersionId={selectedVersion.id} />
      ) : (
        <EmptyState
          title="No timetable version available"
          description="Create a timetable version before running conflict validation."
          icon={<FileWarning className="h-8 w-8" />}
          action={
            <Link href="/dashboard/timetable/builder">
              <Button variant="outline" className="rounded-xl">
                Open Builder
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
