'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SectionCard } from '@/components/ui/section-card';
import { TimetableVersionsList } from '@/components/timetable/versions-list';

export default function TimetableVersionsPage() {
  const [academicYearId, setAcademicYearId] = useState('');

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const currentYear = academicYearsQuery.data?.find((year) => year.isCurrent);
  const selectedAcademicYearId = academicYearId || currentYear?.id || '';

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
        title="Timetable Versions"
        description="Create, validate, publish, lock, and archive class timetable versions."
        actions={headerActions}
      />

      <SectionCard
        title="Academic year scope"
        description="Choose the academic year whose timetable versions you want to manage."
      >
        <label className="block max-w-xs">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Academic year
          </span>
          <Select
            value={selectedAcademicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
          >
            <option value="">All Years</option>
            {academicYearsQuery.data?.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </label>
      </SectionCard>

      <TimetableVersionsList academicYearId={selectedAcademicYearId || undefined} />
    </div>
  );
}
