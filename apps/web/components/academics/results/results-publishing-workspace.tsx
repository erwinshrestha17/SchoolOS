'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, Lock, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/form-field';
import { PageState } from '@/components/ui/page-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

export function ResultsPublishingWorkspace() {
  const [examTermId, setExamTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [includeCas, setIncludeCas] = useState(true);

  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });

  const previewQuery = useQuery({
    queryKey: ['result-preview', examTermId, classId, sectionId, includeCas],
    queryFn: () =>
      api.previewClassResults({
        examTermId,
        classId,
        sectionId: sectionId || undefined,
        includeCas,
        limit: 100,
      }),
    enabled: Boolean(examTermId && classId),
  });

  const selectedExam = examsQuery.data?.find((exam) => exam.id === examTermId);
  const sectionsForClass = useMemo(
    () => (sectionsQuery.data ?? []).filter((section) => section.classId === classId),
    [sectionsQuery.data, classId],
  );
  const rows = previewQuery.data?.items ?? [];
  const incompleteCount = rows.filter((row) => row.summary.incompleteSubjectCount > 0).length;
  const failedCount = rows.filter((row) => row.summary.failedSubjectCount > 0).length;
  const withheldCount = rows.filter((row) => row.summary.withheldSubjectCount > 0).length;
  const readyCount = rows.filter(
    (row) =>
      row.summary.resultStatus === 'PASS' &&
      row.summary.incompleteSubjectCount === 0 &&
      row.summary.withheldSubjectCount === 0,
  ).length;

  const columns = [
    {
      header: 'Student',
      cell: (row: (typeof rows)[number]) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.student.name}</span>
          <span className="text-[10px] text-slate-400">
            {row.student.rollNumber ? `Roll ${row.student.rollNumber} · ` : ''}
            {row.student.studentSystemId}
          </span>
        </div>
      ),
    },
    {
      header: 'Grade',
      cell: (row: (typeof rows)[number]) => (
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-900">{row.summary.grade}</span>
          <span className="text-[10px] font-bold text-slate-400">
            {row.summary.percentage.toFixed(1)}% / GPA {row.summary.gpa.toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row: (typeof rows)[number]) => <StatusBadge status={row.summary.resultStatus} />,
    },
    {
      header: 'Validation',
      cell: (row: (typeof rows)[number]) => {
        const warnings = [
          row.summary.incompleteSubjectCount > 0
            ? `${row.summary.incompleteSubjectCount} incomplete`
            : null,
          row.summary.failedSubjectCount > 0 ? `${row.summary.failedSubjectCount} failed` : null,
          row.summary.withheldSubjectCount > 0
            ? `${row.summary.withheldSubjectCount} withheld`
            : null,
        ].filter(Boolean);

        return warnings.length > 0 ? (
          <span className="text-xs font-bold text-amber-700">{warnings.join(' · ')}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} />
            Ready for review
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Previewed Students"
          value={previewQuery.data?.meta.total ?? 0}
          icon={<FileText size={20} />}
          className="border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-surface)]"
        />
        <StatCard
          title="Ready for Lock"
          value={readyCount}
          icon={<CheckCircle2 size={20} />}
          className="bg-emerald-50/50 border-emerald-100"
        />
        <StatCard
          title="Needs Attention"
          value={incompleteCount + failedCount + withheldCount}
          icon={<AlertTriangle size={20} />}
          className="bg-amber-50/50 border-amber-100"
        />
        <StatCard
          title="Term State"
          value={selectedExam?.isLocked ? 'Locked' : 'Open'}
          icon={<Lock size={20} />}
          className="bg-slate-50/80 border-slate-200"
        />
      </div>

      <FilterBar
        label="Preview Context"
        description="Review backend-calculated results before locking or publishing"
        actions={
          <Link
            href="/dashboard/academics/locks"
            aria-disabled={!examTermId}
            className={`inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--color-mod-academics-accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-mod-academics-text)] active:scale-[0.98] ${
              !examTermId ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <Lock size={16} className="mr-2" />
            Review & Lock
          </Link>
        }
      >
        <Select value={examTermId} onChange={(event) => setExamTermId(event.target.value)} className="lg:w-48">
          <option value="">Exam Term</option>
          {examsQuery.data?.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
              {exam.isLocked ? ' (Locked)' : ''}
            </option>
          ))}
        </Select>

        <Select
          value={classId}
          onChange={(event) => {
            setClassId(event.target.value);
            setSectionId('');
          }}
          className="lg:w-36"
        >
          <option value="">Class</option>
          {classesQuery.data?.map((classItem) => (
            <option key={classItem.id} value={classItem.id}>
              {classItem.name}
            </option>
          ))}
        </Select>

        <Select
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
          disabled={!classId}
          className="lg:w-36"
        >
          <option value="">All Sections</option>
          {sectionsForClass.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>

        <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={includeCas}
            onChange={(event) => setIncludeCas(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-accent)]"
          />
          Include CAS
        </label>
      </FilterBar>

      {examTermId && classId ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <SectionCard
            title="Result Preview"
            description="Calculated by the Academics backend. Use this view to find issues before lock."
          >
            <DataTable
              columns={columns}
              data={rows}
              isLoading={previewQuery.isLoading}
              error={previewQuery.error as Error | null}
              emptyTitle="No preview data"
              emptyMessage="No students or assessment results were found for this class and term."
              getRowKey={(row) => row.student.id}
            />
          </SectionCard>

          <SectionCard title="Validation Warnings" description="Resolve these before report-card generation.">
            <div className="space-y-3 text-sm">
              <WarningRow label="Missing or incomplete marks" value={incompleteCount} />
              <WarningRow label="Failed subject threshold" value={failedCount} />
              <WarningRow label="Withheld results" value={withheldCount} />
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-medium leading-5 text-slate-600">
                Results shown here are backend-calculated only. Lock marks after staff review, then generate report cards from the locked data.
              </div>
              <Link
                href="/dashboard/reports"
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                Export Preview
              </Link>
            </div>
          </SectionCard>
        </div>
      ) : (
        <PageState
          tone="info"
          title="Select class and term"
          description="Choose an exam term and class to preview calculated results and validation warnings."
          className="border-dashed bg-slate-50/70"
        >
          <Search className="mx-auto h-8 w-8 text-slate-300" />
        </PageState>
      )}
    </div>
  );
}

function WarningRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4">
      <span className="font-bold text-slate-600">{label}</span>
      <span className={value > 0 ? 'font-black text-amber-700' : 'font-black text-emerald-700'}>
        {value}
      </span>
    </div>
  );
}
