'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Calendar, Settings, FileWarning, Users, LayoutGrid, ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHero } from '@/components/dashboard/module-hero';
import { StatCard } from '@/components/dashboard/stat-card';
import { FilterBar } from '@/components/dashboard/filter-bar';
import { ModuleTabs } from '@/components/dashboard/module-tabs';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { TimetableGrid } from '@/components/timetable/timetable-grid';
import { TimetableVersionsList } from '@/components/timetable/versions-list';
import { WeeklyRequirementsList } from '@/components/timetable/weekly-requirements-list';
import { ConflictsList } from '@/components/timetable/conflicts-list';
import { SubstitutionsList } from '@/components/timetable/substitutions-list';

export default function TimetablePage() {
  const [activeTab, setActiveTab] = useState('grid');
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
  const validationQuery = useQuery({
    queryKey: ['timetable-validation-summary', activeVersion?.id],
    queryFn: () => api.validateTimetableVersion(activeVersion!.id),
    enabled: Boolean(activeVersion?.id),
  });
  const substitutionStatsQuery = useQuery({
    queryKey: [
      'timetable-substitutions-summary',
      filters.classId,
      filters.sectionId,
      filters.teacherId,
      filters.status,
    ],
    queryFn: () =>
      api.listSubstitutions({
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        teacherId: filters.teacherId || undefined,
        status: filters.status || undefined,
        limit: 200,
      }),
  });
  const conflictCount = validationQuery.data
    ? validationQuery.data.errors.length + validationQuery.data.warnings.length
    : activeVersion
      ? '—'
      : '—';

  const stats = [
    {
      title: 'Active Version',
      value: activeVersion?.versionName || 'None',
      icon: <Calendar className="h-5 w-5" />,
      loading: versionsQuery.isLoading,
    },
    {
      title: 'Draft Versions',
      value: draftVersions?.length ?? 0,
      icon: <Settings className="h-5 w-5" />,
      loading: versionsQuery.isLoading,
    },
    {
      title: 'Conflicts',
      value: conflictCount,
      icon: <FileWarning className="h-5 w-5" />,
      loading: validationQuery.isLoading,
    },
    {
      title: 'Substitutions',
      value: substitutionStatsQuery.data?.length ?? 0,
      icon: <Users className="h-5 w-5" />,
      loading: substitutionStatsQuery.isLoading,
    },
  ];

  const tabItems = [
    { value: 'grid', label: 'Weekly Grid', icon: LayoutGrid },
    { value: 'versions', label: 'Versions', icon: Settings },
    { value: 'requirements', label: 'Requirements', icon: ClipboardList },
    { value: 'conflicts', label: 'Conflicts', icon: FileWarning },
    { value: 'substitutions', label: 'Substitutions', icon: Users },
  ];

  const headerActions = (
    <Link href="/dashboard/timetable/builder">
      <Button className="rounded-2xl font-bold shadow-lg bg-slate-900 text-white hover:bg-slate-800">
        <Plus className="mr-2 h-5 w-5" />
        New Timetable Version
      </Button>
    </Link>
  );

  return (
    <DashboardPageShell>
      <ModuleHero
        title="Timetable Manager"
        subtitle="Build, validate, publish, and manage class schedules and teacher assignments."
        badge="Timetable"
        category="School Operations"
        icon={<Calendar size={32} className="text-indigo-400" />}
        accentColor="indigo"
        variant="dark"
        actions={headerActions}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            loading={stat.loading}
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

      <div className="space-y-6">
        <ModuleTabs
          items={tabItems}
          activeValue={activeTab}
          onValueChange={setActiveTab}
          accentColor="indigo"
          variant="light"
        />

        <div className="min-h-[400px]">
          {activeTab === 'grid' && (
            <div className="animate-in fade-in duration-300">
              <TimetableGrid filters={filters} activeVersionId={activeVersion?.id} />
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="animate-in fade-in duration-300">
              <TimetableVersionsList academicYearId={filters.academicYearId} />
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="animate-in fade-in duration-300">
              <WeeklyRequirementsList filters={filters} />
            </div>
          )}

          {activeTab === 'conflicts' && (
            <div className="animate-in fade-in duration-300">
              <ConflictsList activeVersionId={activeVersion?.id} />
            </div>
          )}

          {activeTab === 'substitutions' && (
            <div className="animate-in fade-in duration-300">
              <SubstitutionsList filters={filters} />
            </div>
          )}
        </div>
      </div>
    </DashboardPageShell>
  );
}
