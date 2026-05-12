'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Megaphone, Lock, Send, RefreshCw, Search } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { SectionCard } from '@/components/ui/section-card';

export function ResultsPublishingWorkspace() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState('');
  const [examTermId, setExamTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [publishStatus, setPublishStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });

  const currentYear = academicYearsQuery.data?.find(y => y.isCurrent);
  
  // Set default academic year
  useMemo(() => {
    if (!academicYearId && currentYear) setAcademicYearId(currentYear.id);
  }, [currentYear, academicYearId]);

  const readinessQuery = useQuery({
    queryKey: ['publishing-readiness', academicYearId, examTermId, classId, sectionId, publishStatus],
    queryFn: () => api.listResultPublishingReadiness({
      academicYearId,
      examTermId,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      status: publishStatus || undefined,
    }),
    enabled: !!academicYearId && !!examTermId,
  });

  const publishMutation = useMutation({
    mutationFn: api.publishResults,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['publishing-readiness'] });
      alert(`Published ${data.published} results`);
      setSelectedIds(new Set());
    },
    onError: (error: any) => alert(error.message || 'Failed to publish results'),
  });

  const notifyMutation = useMutation({
    mutationFn: api.notifyResults,
    onSuccess: () => alert('Notifications sent to guardians'),
    onError: (error: any) => alert(error.message || 'Failed to send notifications'),
  });

  const handlePublish = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to publish results for ${selectedIds.size} students? This will make the results visible to parents and students.`)) {
      publishMutation.mutate({ reportCardIds: Array.from(selectedIds) });
    }
  };

  const handleNotify = () => {
    if (selectedIds.size === 0) return;
    notifyMutation.mutate({ reportCardIds: Array.from(selectedIds) });
  };

  const columns = [
    {
      header: 'Student',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.studentName}</span>
          <span className="text-[10px] text-slate-400">{row.studentSystemId}</span>
        </div>
      ),
    },
    {
      header: 'Class',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-700">{row.className}</span>
          <span className="text-[10px] text-slate-500">{row.sectionName}</span>
        </div>
      ),
    },
    {
      header: 'Result',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-900">{row.grade}</span>
          <span className="text-[10px] font-bold text-slate-400">({row.percentage.toFixed(1)}%)</span>
        </div>
      ),
    },
    {
      header: 'Readiness',
      cell: (row: any) => (
        <StatusBadge
          status={row.reportStatus}
        />
      ),
    },
    {
      header: 'Visibility',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <StatusBadge
            status={row.publishStatus}
          />
        </div>
      ),
    },
  ];

  const readyToPublishCount = readinessQuery.data?.filter(r => r.reportStatus === 'LOCKED' && r.publishStatus === 'UNPUBLISHED').length ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Ready to Publish"
          value={readyToPublishCount}
          icon={<Lock size={20} />}
          className="bg-emerald-50/50 border-emerald-100"
        />
        <StatCard
          title="Published Results"
          value={readinessQuery.data?.filter(r => r.publishStatus === 'PUBLISHED').length ?? 0}
          icon={<Megaphone size={20} />}
          className="bg-primary-50/50 border-primary-100"
        />
        <StatCard
          title="Pending Generation"
          value={readinessQuery.data?.filter(r => r.reportStatus === 'DRAFT').length ?? 0}
          icon={<RefreshCw size={20} />}
          className="bg-amber-50/50 border-amber-100"
        />
      </div>

      <FilterBar
        label="Context"
        description="Select exam term to view readiness"
        actions={
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNotify} 
              disabled={selectedIds.size === 0 || notifyMutation.isPending}
            >
              <Send size={16} className="mr-2" />
              Notify
            </Button>
            <Button 
              onClick={handlePublish} 
              disabled={selectedIds.size === 0 || publishMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 border-none"
            >
              <Megaphone size={16} className="mr-2" />
              Publish Results
            </Button>
          </div>
        }
      >
        <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="lg:w-48">
          <option value="">Academic Year</option>
          {academicYearsQuery.data?.map(y => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </Select>

        <Select value={examTermId} onChange={(e) => setExamTermId(e.target.value)} className="lg:w-48">
          <option value="">Exam Term</option>
          {examsQuery.data?.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </Select>

        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="lg:w-32">
          <option value="">Class</option>
          {classesQuery.data?.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <Select value={publishStatus} onChange={(e) => setPublishStatus(e.target.value)} className="lg:w-48">
          <option value="">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="UNPUBLISHED">Unpublished</option>
        </Select>
      </FilterBar>

      {!!examTermId ? (
        <SectionCard 
          title="Publishing Roster" 
          description="Select report cards to publish or notify families."
        >
          <DataTable
            columns={columns}
            data={readinessQuery.data ?? []}
            isLoading={readinessQuery.isLoading}
            getRowKey={(r) => r.reportCardId}
            onRowClick={(r) => {
              const next = new Set(selectedIds);
              if (next.has(r.reportCardId)) next.delete(r.reportCardId);
              else next.add(r.reportCardId);
              setSelectedIds(next);
            }}
            className={selectedIds.size > 0 ? 'border-primary-200 ring-2 ring-primary-50' : ''}
          />
        </SectionCard>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 rounded-[3rem] border-4 border-dashed border-slate-100 bg-slate-50/50">
          <div className="h-20 w-20 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-300 mb-6">
            <Search size={32} />
          </div>
          <p className="text-xl font-black italic uppercase tracking-tight text-slate-400">Select exam term to view readiness</p>
          <p className="mt-2 text-sm font-medium text-slate-400">The results dashboard will appear once an exam term is selected.</p>
        </div>
      )}
    </div>
  );
}
