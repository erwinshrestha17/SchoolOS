'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ReportDefinition,
  ReportFormat,
} from '@schoolos/core';
import { api } from '@/lib/api';
import type { ReportSnapshot } from '@/lib/api/finance';
import { SectionCard } from '@/components/ui/section-card';
import { PageHeader } from '@/components/ui/page-header';
import { Select, Input } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { Toast, type ToastTone } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardList, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Filter,
  ChevronRight,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Reports & Exports" 
        description="Consolidated reporting engine for academics, finance, students, and operations."
      />
      <ReportsWorkspace />
    </div>
  );
}

function ReportsWorkspace() {
  const queryClient = useQueryClient();
  const [selectedReportKey, setSelectedReportKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [queueExport, setQueueExport] = useState(false);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [retryingSnapshotId, setRetryingSnapshotId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);

  const reportsQuery = useQuery({
    queryKey: ['report-definitions'],
    queryFn: api.listReports,
  });
  const snapshotsQuery = useQuery({
    queryKey: ['report-snapshots', 1, 8],
    queryFn: () => api.listReportSnapshots({ page: 1, limit: 8 }),
  });

  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });

  const reports = Array.isArray(reportsQuery.data) ? reportsQuery.data : [];
  const selectedReport = reports.find((r) => r.key === selectedReportKey);
  const selectedFilters = selectedReport?.filters ?? [];
  const selectedFormats = selectedReport?.formats ?? [];
  const groupedReports = groupReportsByCategory(reports);
  const snapshotItems = Array.isArray(snapshotsQuery.data?.items)
    ? snapshotsQuery.data.items
    : [];

  const handleExport = async (format: ReportFormat) => {
    if (!selectedReportKey) return;
    setExporting(format);
    try {
      const result = await api.exportReport(selectedReportKey, {
        format,
        filters,
        async: queueExport,
      });
      await queryClient.invalidateQueries({ queryKey: ['report-snapshots'] });
      const queued = result && typeof result === 'object' && 'status' in result && result.status === 'QUEUED';
      setExportNotice({
        title: queued ? 'Export queued' : 'Export ready',
        description: queued
          ? `${selectedReport?.name ?? 'Report'} will appear in recent exports when the backend worker finishes it.`
          : `${selectedReport?.name ?? 'Report'} ${format.toUpperCase()} export completed.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      setExportNotice({
        title: 'Export failed',
        description:
          error instanceof Error ? error.message : 'The report export failed.',
        tone: 'danger',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadSnapshot = async (id: string) => {
    try {
      await api.downloadReportSnapshot(id);
    } catch (error: unknown) {
      setExportNotice({
        title: 'Download failed',
        description:
          error instanceof Error
            ? error.message
            : 'The protected report snapshot could not be opened.',
        tone: 'danger',
      });
    }
  };

  const handleRetrySnapshot = async (snapshot: ReportSnapshot) => {
    setRetryingSnapshotId(snapshot.id);
    try {
      await api.retryReportSnapshot(snapshot.id);
      await queryClient.invalidateQueries({ queryKey: ['report-snapshots'] });
      setExportNotice({
        title: 'Export retry queued',
        description: `${reportName(snapshot.reportKey, reports)} will move back into recent exports when the worker finishes it.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      setExportNotice({
        title: 'Retry failed',
        description:
          error instanceof Error
            ? error.message
            : 'The report export could not be queued again.',
        tone: 'danger',
      });
    } finally {
      setRetryingSnapshotId(null);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Report List */}
      <div className="lg:col-span-1 space-y-4">
        <SectionCard title="Available Reports" description="Select a report to configure and export.">
          <div className="space-y-2">
            {reportsQuery.isLoading ? (
              <div className="py-8 text-center text-slate-500">Loading reports...</div>
            ) : reportsQuery.error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                Report definitions could not be loaded.
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                No reports are available for your current modules and permissions.
              </div>
            ) : (
              Object.entries(groupedReports).map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-2 px-3">
                    {category}
                  </h4>
                  {items.map((report) => (
                    <button
                      key={report.key}
                      onClick={() => {
                        setSelectedReportKey(report.key);
                        setFilters({});
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left text-sm transition-all",
                        selectedReportKey === report.key
                          ? "border border-slate-200 bg-slate-100 text-slate-950 font-bold"
                          : "hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ClipboardList size={16} className={selectedReportKey === report.key ? "text-slate-700" : "text-slate-400"} />
                        <span>{report.name}</span>
                      </div>
                      <ChevronRight size={14} className={selectedReportKey === report.key ? "text-slate-600" : "text-slate-300"} />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* Configuration & Actions */}
      <div className="lg:col-span-2 space-y-6">
        {exportNotice ? (
          <Toast
            title={exportNotice.title}
            description={exportNotice.description}
            tone={exportNotice.tone}
            onDismiss={() => setExportNotice(null)}
            className="max-w-none"
          />
        ) : null}

        {selectedReport ? (
          <SectionCard 
            title={selectedReport.name} 
            description={selectedReport.description}
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedFilters.map((filter) => (
                  <div key={filter.key} className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">{filter.label}</label>
                    {filter.type === 'class' ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Class</option>
                        {(classesQuery.data ?? []).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    ) : filter.type === 'select' && filter.key === 'academicYearId' ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Year</option>
                        {(academicYearsQuery.data ?? []).map(y => (
                          <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                      </Select>
                    ) : filter.type === 'select' && filter.key === 'examTermId' ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Term</option>
                        {(examsQuery.data ?? []).map(et => (
                          <option key={et.id} value={et.id}>{et.name}</option>
                        ))}
                      </Select>
                    ) : filter.type === 'select' && filter.options ? (
                      <Select 
                        value={filters[filter.key] || ''} 
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Select Option</option>
                        {filter.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input 
                        type={filter.type === 'date' ? 'date' : 'text'} 
                        placeholder={filter.label}
                        value={filters[filter.key] || ''}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={queueExport}
                  onChange={(event) => setQueueExport(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    Queue as background export
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    Use this for larger CSV/PDF/JSON exports. The generated file is tracked in recent exports when the backend worker completes it.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                {selectedFormats.includes('csv') && (
                  <Button
                    onClick={() => handleExport('csv')}
                    disabled={!!exporting}
                    variant="outline"
                    className="rounded-2xl"
                  >
                    <FileSpreadsheet size={16} className="mr-2 text-emerald-600" />
                    {exporting === 'csv' ? 'Exporting...' : 'Download CSV'}
                  </Button>
                )}
                {selectedFormats.includes('pdf') && (
                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={!!exporting}
                    variant="outline"
                    className="rounded-2xl"
                  >
                    <FileText size={16} className="mr-2 text-rose-600" />
                    {exporting === 'pdf' ? 'Exporting...' : 'Download PDF'}
                  </Button>
                )}
                {selectedFormats.includes('json') && (
                  <Button
                    onClick={() => handleExport('json')}
                    disabled={!!exporting}
                    variant="ghost"
                    className="rounded-2xl"
                  >
                    <Download size={16} className="mr-2" />
                    JSON Data
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center">
            <div className="h-20 w-20 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-300 mb-6">
              <Filter size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-400 italic uppercase">Select a Report</h3>
            <p className="mt-2 text-sm text-slate-400 font-medium">Choose a report from the list to start configuration.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-3">
        <SectionCard
          title="Recent Exports"
          description="Protected File Registry snapshots for completed report exports, plus queued and failed background jobs."
          headerAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void snapshotsQuery.refetch()}
              isLoading={snapshotsQuery.isRefetching}
            >
              <RefreshCw size={14} className="mr-2" />
              Refresh
            </Button>
          }
        >
          <div className="space-y-3">
            {snapshotsQuery.isLoading ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                Loading export history...
              </div>
            ) : snapshotsQuery.error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
                Export history could not be loaded.
              </div>
            ) : snapshotItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                No report exports have been recorded yet.
              </div>
            ) : (
              snapshotItems.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-slate-900">
                        {reportName(snapshot.reportKey, reports)}
                      </p>
                      <Badge variant={statusVariant(snapshot.status)} className="uppercase">
                        {snapshot.status}
                      </Badge>
                      <Badge variant="outline" className="uppercase">
                        {snapshot.format}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      Requested {formatDateTime(snapshot.createdAt)}
                      {snapshot.completedAt ? ` • Completed ${formatDateTime(snapshot.completedAt)}` : ''}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {snapshot.errorSummary || summarizeFilters(snapshot.filters)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {canRetrySnapshot(snapshot) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={retryingSnapshotId === snapshot.id}
                        onClick={() => void handleRetrySnapshot(snapshot)}
                      >
                        <RotateCcw size={14} className="mr-2" />
                        Retry
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={snapshot.status !== 'COMPLETED' || !snapshot.fileAssetId}
                      onClick={() => void handleDownloadSnapshot(snapshot.id)}
                    >
                      <Download size={14} className="mr-2" />
                      Open Snapshot
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function groupReportsByCategory(reports: ReportDefinition[]) {
  return reports.reduce<Record<string, ReportDefinition[]>>((acc, report) => {
    const category = report.category || 'general';
    acc[category] = [...(acc[category] ?? []), report];
    return acc;
  }, {});
}

function reportName(reportKey: string, reports: Array<{ key: string; name: string }>) {
  return reports.find((report) => report.key === reportKey)?.name ?? reportKey;
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'neutral' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED' || status === 'CANCELLED') return 'destructive';
  if (status === 'QUEUED' || status === 'RUNNING') return 'warning';
  return 'neutral';
}

function canRetrySnapshot(snapshot: ReportSnapshot) {
  return snapshot.status === 'FAILED' || snapshot.status === 'CANCELLED';
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function summarizeFilters(filters: ReportSnapshot['filters']) {
  const entries = Object.entries(filters ?? {}).filter(([, value]) => value);
  if (entries.length === 0) return 'No filters applied';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' • ');
}
