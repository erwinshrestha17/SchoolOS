'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select, TextArea } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FileText, Play, Download, Search, CheckCircle2, History } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';

export function ReportCardsWorkspace() {
  const queryClient = useQueryClient();
  const [academicYearId, setAcademicYearId] = useState('');
  const [examTermId, setExamTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [remarks, setRemarks] = useState('');

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({
    queryKey: ['students', classId, sectionId],
    queryFn: () => api.listStudents({ classId: classId || undefined, sectionId: sectionId || undefined }),
    enabled: !!classId,
  });
  const reportsQuery = useQuery({
    queryKey: ['report-cards', academicYearId, examTermId, classId, sectionId],
    queryFn: () => api.listReportCards({
      academicYearId: academicYearId || undefined,
      examTermId: examTermId || undefined,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
    }),
    enabled: !!academicYearId && !!examTermId,
  });

  const generateMutation = useMutation({
    mutationFn: api.batchGenerateReportCards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      alert('Report cards generation started');
    },
    onError: (error: any) => alert(error.message || 'Failed to generate report cards'),
  });

  const handleGenerate = () => {
    if (!academicYearId || !examTermId || !classId) {
      alert('Please select academic year, exam term, and class');
      return;
    }

    const studentIds = (studentsQuery.data as any[])?.map((s: any) => s.id) ?? [];
    if (studentIds.length === 0) {
      alert('No students found in selected class/section');
      return;
    }

    if (confirm(`Are you sure you want to generate report cards for ${studentIds.length} students? This will lock their marks and update their performance records.`)) {
      generateMutation.mutate({
        academicYearId,
        examTermId,
        studentIds,
        remarks,
        lock: true,
      });
    }
  };

  const openPdf = async (reportCardId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'}/academics/report-cards/${encodeURIComponent(reportCardId)}.pdf`,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error('Failed to load PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert('Could not load report card PDF');
    }
  };

  const columns = [
    {
      header: 'Student',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.student?.firstNameEn} {row.student?.lastNameEn}</span>
          <span className="text-[10px] font-mono text-slate-400">{row.student?.studentSystemId}</span>
        </div>
      ),
    },
    {
      header: 'Result',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-900">{row.grade}</span>
          <span className="text-[10px] font-bold text-slate-400">({Number(row.percentage).toFixed(1)}%)</span>
        </div>
      ),
    },
    {
      header: 'GPA',
      accessorKey: 'gpa',
      cell: (row: any) => (
        <span className="font-bold text-slate-700">{Number(row.gpa).toFixed(2)}</span>
      ),
    },
    {
      header: 'Status',
      cell: (row: any) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
          row.status === 'LOCKED' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {row.status}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'w-24',
      cell: (row: any) => (
        <Button variant="outline" size="sm" onClick={() => openPdf(row.id)}>
          <Download size={14} className="mr-2" />
          PDF
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Generated Reports"
          value={reportsQuery.data?.length ?? 0}
          icon={<FileText size={20} />}
          className="bg-primary-50/50 border-primary-100"
        />
        <StatCard
          title="Total Students"
          value={studentsQuery.data?.length ?? 0}
          icon={<CheckCircle2 size={20} />}
          className="bg-emerald-50/50 border-emerald-100"
        />
        <StatCard
          title="Avg. Class GPA"
          value={reportsQuery.data?.length ? ((reportsQuery.data as any[]).reduce((acc: number, r: any) => acc + Number(r.gpa), 0) / reportsQuery.data.length).toFixed(2) : '0.00'}
          icon={<History size={20} />}
          className="bg-indigo-50/50 border-indigo-100"
        />
      </div>

      <FilterBar
        label="Generation"
        description="Select criteria to generate or view"
        actions={
          <Button 
            onClick={handleGenerate} 
            disabled={!classId || !examTermId || generateMutation.isPending}
            className="bg-indigo-950 hover:bg-indigo-900 shadow-lg shadow-indigo-900/20 border-none"
          >
            <Play size={16} className="mr-2" />
            {generateMutation.isPending ? 'Generating...' : 'Start Generation'}
          </Button>
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

        <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId} className="lg:w-32">
          <option value="">Section</option>
          {sectionsQuery.data?.filter(s => s.classId === classId).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </FilterBar>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!!examTermId && !!classId ? (
            <SectionCard title="Report Cards" description="View and download generated report cards.">
              <DataTable
                columns={columns}
                data={reportsQuery.data ?? []}
                isLoading={reportsQuery.isLoading}
                getRowKey={(r) => r.id}
              />
            </SectionCard>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 rounded-[3rem] border-4 border-dashed border-slate-100 bg-slate-50/50">
              <div className="h-20 w-20 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-300 mb-6">
                <Search size={32} />
              </div>
              <p className="text-xl font-black italic uppercase tracking-tight text-slate-400">Select class and exam</p>
              <p className="mt-2 text-sm font-medium text-slate-400">Generation controls will appear once context is selected.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="Batch Settings" description="Configure generation parameters.">
            <div className="space-y-4">
              <TextArea 
                placeholder="Global remarks for this batch..." 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="min-h-[120px]"
              />
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800 font-medium">
                Generating report cards will automatically lock marks for the selected students to ensure data integrity.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
