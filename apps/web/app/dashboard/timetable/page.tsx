'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Calendar, Settings, FileWarning, Users, LayoutGrid, ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { FilterBar } from '@/components/ui/filter-bar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { TimetableGrid } from '@/components/timetable/timetable-grid';
import { TimetableVersionsList } from '@/components/timetable/versions-list';
import { WeeklyRequirementsList } from '@/components/timetable/weekly-requirements-list';
import { ConflictsList } from '@/components/timetable/conflicts-list';
import { SubstitutionsList } from '@/components/timetable/substitutions-list';

export default function TimetablePage() {
  const [filters, setFilters] = useState({
    academicYearId: '',
    classId: '',
    sectionId: '',
    teacherId: '',
    roomId: '',
    status: '',
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: api.listRooms,
  });

  const versionsQuery = useQuery({
    queryKey: ['timetable-versions', filters.academicYearId],
    queryFn: () => api.listTimetableVersions({ academicYearId: filters.academicYearId }),
  });

  const activeVersion = versionsQuery.data?.find(v => v.status === 'PUBLISHED');
  const draftVersions = versionsQuery.data?.filter(v => v.status === 'DRAFT');

  const stats = [
    {
      title: 'Active Version',
      value: activeVersion?.versionName || 'None',
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: 'Draft Versions',
      value: draftVersions?.length ?? 0,
      icon: <Settings className="h-5 w-5" />,
    },
    {
      title: 'Conflicts',
      value: 0, // Should come from a dedicated API
      icon: <FileWarning className="h-5 w-5" />,
    },
    {
      title: 'Substitutions',
      value: 0, // Should come from a dedicated API
      icon: <Users className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Timetable"
        description="Build, validate, publish, and manage class schedules and teacher assignments."
        actions={
          <Link href="/dashboard/timetable/new">
            <Button size="lg" className="rounded-2xl font-bold shadow-lg shadow-primary-500/20">
              <Plus className="mr-2 h-5 w-5" />
              New Timetable Version
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            loading={versionsQuery.isLoading}
          />
        ))}
      </div>

      <FilterBar>
        <div className="flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={filters.academicYearId}
            onChange={(e) => setFilters(prev => ({ ...prev, academicYearId: e.target.value }))}
          >
            <option value="">All Years</option>
            {academicYearsQuery.data?.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </Select>

          <Select
            value={filters.classId}
            onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))}
          >
            <option value="">All Classes</option>
            {classesQuery.data?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select
            value={filters.teacherId}
            onChange={(e) => setFilters(prev => ({ ...prev, teacherId: e.target.value }))}
          >
            <option value="">All Teachers</option>
            {staffQuery.data?.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </Select>

          <Select
            value={filters.roomId}
            onChange={(e) => setFilters(prev => ({ ...prev, roomId: e.target.value }))}
          >
            <option value="">All Rooms</option>
            {roomsQuery.data?.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
      </FilterBar>

      <Tabs defaultValue="grid" className="space-y-8">
        <TabsList className="bg-slate-100 p-1.5 rounded-[1.5rem] inline-flex h-auto flex-wrap">
          <TabsTrigger value="grid" className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]">
            <LayoutGrid className="mr-2 h-3 w-3" />
            Weekly Grid
          </TabsTrigger>
          <TabsTrigger value="versions" className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]">
            <Settings className="mr-2 h-3 w-3" />
            Versions
          </TabsTrigger>
          <TabsTrigger value="requirements" className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]">
            <ClipboardList className="mr-2 h-3 w-3" />
            Requirements
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]">
            <FileWarning className="mr-2 h-3 w-3" />
            Conflicts
          </TabsTrigger>
          <TabsTrigger value="substitutions" className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]">
            <Users className="mr-2 h-3 w-3" />
            Substitutions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-0">
          <TimetableGrid filters={filters} activeVersionId={activeVersion?.id} />
        </TabsContent>

        <TabsContent value="versions" className="mt-0">
          <TimetableVersionsList academicYearId={filters.academicYearId} />
        </TabsContent>

        <TabsContent value="requirements" className="mt-0">
          <WeeklyRequirementsList filters={filters} />
        </TabsContent>

        <TabsContent value="conflicts" className="mt-0">
          <ConflictsList activeVersionId={activeVersion?.id} />
        </TabsContent>

        <TabsContent value="substitutions" className="mt-0">
          <SubstitutionsList filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
