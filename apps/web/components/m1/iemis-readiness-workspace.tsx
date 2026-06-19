'use client';

import type { IemisExportResult, StudentIemisReadinessSummary } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Play, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { LoadingState } from '../ui/loading-state';
import { ProtectedFileButton } from '../ui/protected-file';
import { StatusBadge } from '../ui/status-badge';
import { Toast } from '../ui/toast';

type IssueRow = {
  key: string;
  student: StudentIemisReadinessSummary;
  field: string;
  message: string;
};

export function IemisReadinessWorkspace() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'all' | 'ready' | 'has_issues'>('has_issues');
  const [exportResult, setExportResult] = useState<IemisExportResult | null>(null);
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof api.bulkImportAdmissions>> | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone: 'success' | 'danger' | 'info' } | null>(null);

  const readinessQuery = useQuery({
    queryKey: ['student-iemis-readiness-list', 'workspace', status],
    queryFn: () => api.listIemisReadiness({ status }),
  });

  const exportMutation = useMutation({
    mutationFn: api.exportIemisStudents,
    onSuccess: (result) => {
      setExportResult(result);
      setToast({ title: 'iEMIS export prepared', description: `${result.validRecords} of ${result.totalRecords} records are ready.`, tone: 'success' });
    },
    onError: (error) => setToast({ title: 'Export failed', description: error instanceof Error ? error.message : 'The export could not be prepared.', tone: 'danger' }),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => api.bulkImportAdmissions({ csvContent: await file.text(), dryRun: false, confirmDuplicates: false }),
    onSuccess: (result) => {
      setImportResult(result);
      setToast({ title: 'Import processed', description: `${result.created} created, ${result.failed} failed, ${result.validated} validated.`, tone: result.failed ? 'info' : 'success' });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['student-iemis-readiness-list'] });
    },
    onError: (error) => setToast({ title: 'Import failed', description: error instanceof Error ? error.message : 'The import could not be processed.', tone: 'danger' }),
  });

  const rows = useMemo(() => readinessQuery.data ?? [], [readinessQuery.data]);
  const issueRows = useMemo<IssueRow[]>(() => rows.flatMap((student) =>
    student.issues.map((issue, index) => ({
      key: `${student.studentId}-${issue.field}-${index}`,
      student,
      field: issue.field,
      message: issue.message,
    }))), [rows]);
  const readyCount = rows.filter((row) => row.eligible).length;
  const missingFields = issueRows.filter((row) => /missing|required/i.test(row.message)).length;

  if (readinessQuery.isLoading) return <LoadingState variant="page" label="Loading iEMIS readiness…" />;
  if (readinessQuery.isError) return <ErrorState title="iEMIS readiness could not load" message="Validation data remains unchanged." onRetry={() => void readinessQuery.refetch()} />;

  return (
    <div className="space-y-6">
      {toast ? <Toast {...toast} onDismiss={() => setToast(null)} /> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importMutation.mutate(file);
          event.currentTarget.value = '';
        }}
      />

      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Ready Records" value={readyCount} icon={<CheckCircle2 size={19} />} tone="success" description="Current validation result" />
        <KpiCard title="Validation Errors" value={issueRows.length} icon={<AlertTriangle size={19} />} tone={issueRows.length ? 'danger' : 'success'} description="Returned by backend rules" />
        <KpiCard title="Missing Fields" value={missingFields} icon={<FileSpreadsheet size={19} />} tone={missingFields ? 'warning' : 'success'} description="From validation messages" />
        <KpiCard title="Duplicate Rows" value="Unavailable" icon={<FileSpreadsheet size={19} />} tone="neutral" description="No iEMIS duplicate summary API" />
        <KpiCard title="Last Export" value={exportResult ? new Date(exportResult.exportedAt).toLocaleDateString() : 'Not in session'} icon={<Download size={19} />} tone="info" description="Latest export requested here" />
        <KpiCard title="Import Jobs" value={importMutation.isPending ? 'Running' : importResult ? '1 processed' : 'No session jobs'} icon={<Upload size={19} />} tone={importMutation.isPending ? 'warning' : 'neutral'} description="Current API processes synchronously" />
      </KpiGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">Validation Issues</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Rules and issue messages are returned by the backend.</p>
            </div>
            <select className="w-full sm:w-52" aria-label="Filter readiness status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="has_issues">Records with issues</option>
              <option value="ready">Ready records</option>
              <option value="all">All records</option>
            </select>
          </div>
          {issueRows.length === 0 ? (
            <EmptyState title={status === 'ready' ? 'Ready records have no validation issues' : 'No validation issues'} description="The selected server validation set has no issues to review." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Admission No.</th><th className="px-4 py-3">Issue</th><th className="px-4 py-3">Affected field</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issueRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><strong className="block text-slate-900">{row.student.fullNameEn}</strong><span className="text-xs text-slate-500">{row.student.className}{row.student.sectionName ? ` / ${row.student.sectionName}` : ''}</span></td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{row.student.studentSystemId}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">{row.message}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.field}</td>
                      <td className="px-4 py-3"><StatusBadge status={/missing|required/i.test(row.message) ? 'HIGH' : 'MEDIUM'} tone={/missing|required/i.test(row.message) ? 'rejected' : 'pending'} /></td>
                      <td className="px-4 py-3"><StatusBadge status="OPEN" tone="rejected" /></td>
                      <td className="px-4 py-3"><a href={`/dashboard/students/${encodeURIComponent(row.student.studentId)}?edit=true`} className="font-bold text-primary-600 hover:text-primary-700">Fix profile</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-900">Recent import result</h3>
            {importMutation.isPending ? <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Processing CSV through the admissions import API…</p> : importResult ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {[['Rows', importResult.totalRows], ['Created', importResult.created], ['Validated', importResult.validated], ['Failed', importResult.failed]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div>)}
              </div>
            ) : <p className="mt-2 text-sm text-slate-500">No import has been run in this browser session. The current backend does not expose durable async import-job history.</p>}
          </div>
        </section>

        <aside className="h-fit space-y-4 xl:sticky xl:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Export Checklist</h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-primary-600" style={{ width: `${rows.length ? Math.round((readyCount / rows.length) * 100) : 0}%` }} /></div>
            <p className="mt-2 text-xs font-semibold text-slate-500">{readyCount} of {rows.length} records in this validation set are ready.</p>
            <Button type="button" className="mt-4 w-full" onClick={() => void readinessQuery.refetch()} disabled={readinessQuery.isFetching}>
              {readinessQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run validation
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Import & Export</h2>
            <div className="mt-4 grid gap-2">
              <Button type="button" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>{exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export iEMIS CSV</Button>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}><Upload className="h-4 w-4" /> Import students</Button>
              <ProtectedFileButton action="download" className="w-full" fileAssetId={exportResult?.fileAssetId} fileName={exportResult?.fileName} disabled={!exportResult}>Download latest protected export</ProtectedFileButton>
            </div>
            {exportResult ? <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">File</dt><dd className="truncate font-bold text-slate-800">{exportResult.fileName}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Records</dt><dd className="font-bold">{exportResult.totalRecords}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Export ID</dt><dd className="max-w-[160px] truncate font-semibold">{exportResult.exportId}</dd></div></dl> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
