"use client";

import {
  formatBsDate,
  formatBsDateTime,
  type BulkAdmissionImportResult,
  type IemisExportResult,
  type StudentIemisReadinessSummary,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { useSession } from "../session-provider";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { KpiCard, KpiGrid } from "../ui/kpi-card";
import { LoadingState } from "../ui/loading-state";
import { ProtectedFileButton } from "../ui/protected-file";
import { StatusBadge } from "../ui/status-badge";
import { Toast } from "../ui/toast";

type IssueRow = {
  key: string;
  student: StudentIemisReadinessSummary;
  field: string;
  message: string;
};

type PendingAdmissionImport = {
  fileName: string;
  csvContent: string;
  preview: BulkAdmissionImportResult;
};

const MAX_ADMISSION_IMPORT_FILE_BYTES = 1_000_000;

export function IemisReadinessWorkspace() {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"all" | "ready" | "has_issues">(
    "has_issues",
  );
  const [exportResult, setExportResult] = useState<IemisExportResult | null>(
    null,
  );
  const [importResult, setImportResult] = useState<Awaited<
    ReturnType<typeof api.bulkImportAdmissions>
  > | null>(null);
  const [pendingImport, setPendingImport] =
    useState<PendingAdmissionImport | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    description: string;
    tone: "success" | "danger" | "info";
  } | null>(null);
  const canImportAdmissions = hasPermissions([
    "enrollments:create",
    "students:create",
    "guardians:create",
  ]);

  const readinessQuery = useQuery({
    queryKey: ["student-iemis-readiness-list", "workspace", status],
    queryFn: () => api.listIemisReadiness({ status }),
  });
  const importBatchesQuery = useQuery({
    queryKey: ["admission-import-batches", 1],
    queryFn: () => api.listAdmissionImportBatches({ page: 1, limit: 10 }),
  });
  const importReviewQuery = useQuery({
    queryKey: ["admission-import-review-queue"],
    queryFn: () => api.listAdmissionImportReviewQueue({ limit: 25 }),
  });

  const exportMutation = useMutation({
    mutationFn: api.exportIemisStudents,
    onSuccess: (result) => {
      setExportResult(result);
      setToast({
        title: "iEMIS export prepared",
        description: `${result.validRecords} of ${result.totalRecords} records are ready.`,
        tone: "success",
      });
    },
    onError: (error) =>
      setToast({
        title: "Export failed",
        description: transferFailureMessage(error, "export"),
        tone: "danger",
      }),
  });

  const validateImportMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_ADMISSION_IMPORT_FILE_BYTES) {
        throw new Error("Admission CSV exceeds the one-megabyte limit.");
      }
      const csvContent = await file.text();
      const preview = await api.bulkImportAdmissions({
        csvContent,
        sourceFileName: file.name,
        dryRun: true,
        confirmDuplicates: false,
      });
      return { fileName: file.name, csvContent, preview };
    },
    onSuccess: (pending) => {
      setPendingImport(pending);
      setImportDialogOpen(true);
      setToast({
        title: "Admission CSV validated",
        description: `${pending.preview.validated} rows are ready and ${pending.preview.failed} need attention. No student records were created.`,
        tone: pending.preview.failed ? "info" : "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["admission-import-batches"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admission-import-review-queue"],
      });
    },
    onError: (error) =>
      setToast({
        title: "CSV validation failed",
        description: transferFailureMessage(error, "import"),
        tone: "danger",
      }),
  });

  const importMutation = useMutation({
    mutationFn: async (pending: PendingAdmissionImport) =>
      api.bulkImportAdmissions({
        csvContent: pending.csvContent,
        sourceFileName: pending.fileName,
        dryRun: false,
        confirmDuplicates: false,
        validationBatchId: pending.preview.batchId,
      }),
    onSuccess: (result) => {
      setImportResult(result);
      setPendingImport(null);
      setImportDialogOpen(false);
      setToast({
        title: "Import processed",
        description: `${result.created} created, ${result.failed} failed, ${result.validated} validated.`,
        tone: result.failed ? "info" : "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({
        queryKey: ["student-iemis-readiness-list"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admission-import-batches"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admission-import-review-queue"],
      });
    },
    onError: (error) =>
      setToast({
        title: "Import failed",
        description: transferFailureMessage(error, "import"),
        tone: "danger",
      }),
  });

  const rows = useMemo(() => readinessQuery.data ?? [], [readinessQuery.data]);
  const issueRows = useMemo<IssueRow[]>(
    () =>
      rows.flatMap((student) =>
        student.issues.map((issue, index) => ({
          key: `${student.studentId}-${issue.field}-${index}`,
          student,
          field: issue.field,
          message: issue.message,
        })),
      ),
    [rows],
  );
  const readyCount = rows.filter((row) => row.eligible).length;
  const missingFields = issueRows.filter((row) =>
    /missing|required/i.test(row.message),
  ).length;

  if (readinessQuery.isLoading)
    return <LoadingState variant="page" label="Loading iEMIS readiness…" />;
  if (readinessQuery.isError)
    return (
      <ErrorState
        title="iEMIS readiness could not load"
        message="Validation data remains unchanged."
        onRetry={() => void readinessQuery.refetch()}
      />
    );

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
          if (file) {
            setPendingImport(null);
            setImportDialogOpen(false);
            validateImportMutation.mutate(file);
          }
          event.currentTarget.value = "";
        }}
      />

      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          title="Ready Records"
          value={readyCount}
          icon={<CheckCircle2 size={19} />}
          tone="success"
          description="Current validation result"
        />
        <KpiCard
          title="Validation Errors"
          value={issueRows.length}
          icon={<AlertTriangle size={19} />}
          tone={issueRows.length ? "danger" : "success"}
          description="Returned by backend rules"
        />
        <KpiCard
          title="Missing Fields"
          value={missingFields}
          icon={<FileSpreadsheet size={19} />}
          tone={missingFields ? "warning" : "success"}
          description="From validation messages"
        />
        <KpiCard
          title="Duplicate Rows"
          value="—"
          icon={<FileSpreadsheet size={19} />}
          tone="neutral"
          description="No iEMIS duplicate summary API"
        />
        <KpiCard
          title="Last Export"
          value={exportResult ? formatBsDate(exportResult.exportedAt) : "—"}
          icon={<Download size={19} />}
          tone="info"
          description="Latest export requested here"
        />
        <KpiCard
          title="Import Jobs"
          value={
            importMutation.isPending || validateImportMutation.isPending
              ? "Running"
              : (importBatchesQuery.data?.total ?? "Unavailable")
          }
          icon={<Upload size={19} />}
          tone={
            importMutation.isPending || validateImportMutation.isPending
              ? "warning"
              : "info"
          }
          description="Persisted admission import batches"
        />
      </KpiGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Validation Issues
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Rules and issue messages are returned by the backend.
              </p>
            </div>
            <select
              className="w-full sm:w-52"
              aria-label="Filter readiness status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="has_issues">Records with issues</option>
              <option value="ready">Ready records</option>
              <option value="all">All records</option>
            </select>
          </div>
          {issueRows.length === 0 ? (
            <EmptyState
              title={
                status === "ready"
                  ? "Ready records have no validation issues"
                  : "No validation issues"
              }
              description="The selected server validation set has no issues to review."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Admission No.</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Affected field</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issueRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <strong className="block text-slate-900">
                          {row.student.fullNameEn}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {row.student.className}
                          {row.student.sectionName
                            ? ` / ${row.student.sectionName}`
                            : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {row.student.studentSystemId}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">
                        {row.message}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {row.field}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            /missing|required/i.test(row.message)
                              ? "HIGH"
                              : "MEDIUM"
                          }
                          tone={
                            /missing|required/i.test(row.message)
                              ? "rejected"
                              : "pending"
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status="OPEN" tone="rejected" />
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/dashboard/students/${encodeURIComponent(row.student.studentId)}?edit=true`}
                          className="font-bold text-primary-600 hover:text-primary-700"
                        >
                          Fix profile
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-900">
              Recent import result
            </h3>
            {importMutation.isPending || validateImportMutation.isPending ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {validateImportMutation.isPending
                  ? "Validating CSV without creating records…"
                  : "Creating the confirmed admission records…"}
              </p>
            ) : importResult ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {[
                  ["Rows", importResult.totalRows],
                  ["Created", importResult.created],
                  ["Validated", importResult.validated],
                  ["Failed", importResult.failed],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-black text-slate-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No import has been run in this browser session. Persisted batch
                history is listed below.
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  CSV Import History
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Tenant-scoped persisted batches from the admissions backend.
                </p>
              </div>
              <StatusBadge
                status={`${importBatchesQuery.data?.total ?? 0} JOBS`}
                tone="info"
              />
            </div>
            {importBatchesQuery.isError ? (
              <p className="mt-3 rounded-xl bg-danger-50 p-3 text-xs font-bold text-danger-700">
                Import history could not be loaded.
              </p>
            ) : (importBatchesQuery.data?.items.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No persisted import batches.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-xs">
                  <thead className="bg-slate-50 font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Started</th>
                      <th className="px-3 py-2">Rows</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Failed</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importBatchesQuery.data?.items.map((batch) => (
                      <tr key={batch.id}>
                        <td className="max-w-56 truncate px-3 py-3 font-bold text-slate-800">
                          {batch.sourceFileName}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {formatBsDateTime(batch.startedAt)}
                        </td>
                        <td className="px-3 py-3 font-bold">
                          {batch.totalRows}
                        </td>
                        <td className="px-3 py-3 font-bold text-success-700">
                          {batch.createdRows}
                        </td>
                        <td className="px-3 py-3 font-bold text-danger-700">
                          {batch.failedRows}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={batch.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Import Review Queue
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Failed or duplicate-matched rows that require operator review.
                </p>
              </div>
              <StatusBadge
                status={`${importReviewQuery.data?.total ?? 0} ROWS`}
                tone={
                  (importReviewQuery.data?.total ?? 0) > 0
                    ? "pending"
                    : "approved"
                }
              />
            </div>
            {(importReviewQuery.data?.items.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No import rows currently require review.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {importReviewQuery.data?.items.slice(0, 8).map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-xl border border-warning-100 bg-warning-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {row.sourceFileName} · row {row.rowNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {row.workflowLabel} · {row.errors.length} errors ·{" "}
                        {row.duplicates.length} duplicate candidates
                      </p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit space-y-4 xl:sticky xl:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-slate-950">
              Export Checklist
            </h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-primary-600"
                style={{
                  width: `${rows.length ? Math.round((readyCount / rows.length) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {readyCount} of {rows.length} records in this validation set are
              ready.
            </p>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => void readinessQuery.refetch()}
              disabled={readinessQuery.isFetching}
            >
              {readinessQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}{" "}
              Run validation
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-slate-950">
              Import & Export
            </h2>
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}{" "}
                Export iEMIS CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  !canImportAdmissions ||
                  importMutation.isPending ||
                  validateImportMutation.isPending
                }
              >
                {validateImportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}{" "}
                Validate admission CSV
              </Button>
              <ProtectedFileButton
                action="download"
                className="w-full"
                fileAssetId={exportResult?.fileAssetId}
                fileName={exportResult?.fileName}
                disabled={!exportResult}
              >
                Download latest protected export
              </ProtectedFileButton>
            </div>
            {!canImportAdmissions ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Your role can review import history but cannot create admission
                records.
              </p>
            ) : pendingImport ? (
              <div className="mt-4 rounded-xl border border-info-100 bg-info-50 p-3 text-sm text-info-900">
                <p className="font-bold">Validation ready</p>
                <p className="mt-1 text-xs">
                  {pendingImport.preview.validated} ready ·{" "}
                  {pendingImport.preview.failed} need attention
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setImportDialogOpen(true)}
                >
                  Review validated import
                </Button>
              </div>
            ) : null}
            {exportResult ? (
              <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">File</dt>
                  <dd className="truncate font-bold text-slate-800">
                    {exportResult.fileName}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Records</dt>
                  <dd className="font-bold">{exportResult.totalRecords}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Export ID</dt>
                  <dd className="max-w-[160px] truncate font-semibold">
                    {exportResult.exportId}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={importDialogOpen && pendingImport !== null}
        title="Create the validated admission records?"
        description="Only rows that passed the server validation will be attempted. Rows with errors or possible duplicates stay in the review queue. SchoolOS rechecks the one-time validation receipt before creating any records."
        confirmLabel={
          pendingImport
            ? `Create ${pendingImport.preview.validated} admission${pendingImport.preview.validated === 1 ? "" : "s"}`
            : "Create admissions"
        }
        isConfirming={importMutation.isPending}
        preventCloseWhileConfirming
        confirmDisabled={
          !pendingImport || pendingImport.preview.validated === 0
        }
        onClose={() => {
          if (!importMutation.isPending) {
            setImportDialogOpen(false);
            importMutation.reset();
          }
        }}
        onConfirm={() => {
          if (pendingImport) importMutation.mutate(pendingImport);
        }}
      >
        {pendingImport ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div>
              <p className="font-bold text-slate-950">
                {pendingImport.fileName}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Validation batch {pendingImport.preview.batchId}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <ImportPreviewMetric
                label="Rows"
                value={pendingImport.preview.totalRows}
              />
              <ImportPreviewMetric
                label="Ready"
                value={pendingImport.preview.validated}
              />
              <ImportPreviewMetric
                label="Need attention"
                value={pendingImport.preview.failed}
              />
            </dl>
            {pendingImport.preview.validated === 0 ? (
              <p className="font-semibold text-danger-700" role="alert">
                No rows passed validation. Correct the CSV and validate it again
                before importing.
              </p>
            ) : null}
          </div>
        ) : null}
        {importMutation.isError ? (
          <p className="text-sm font-semibold text-danger-700" role="alert">
            {transferFailureMessage(importMutation.error, "import")}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function ImportPreviewMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-black text-slate-950">{value}</dd>
    </div>
  );
}

function transferFailureMessage(
  error: unknown,
  operation: "import" | "export",
) {
  if (error instanceof ApiRequestError) {
    if (error.statusCode === 401) {
      return "Your session expired. Sign in again before continuing.";
    }
    if (error.statusCode === 403) {
      return `You do not have permission to ${operation} student records.`;
    }
    if ([400, 413, 422].includes(error.statusCode)) {
      return operation === "import"
        ? "The selected CSV was not accepted. Review its headers, row values, and file size, then try again."
        : "The export filters were not accepted. Refresh the readiness list and try again.";
    }
    if (error.statusCode === 409) {
      return operation === "import"
        ? "The import conflicts with current student records. Review the import queue before retrying."
        : "Student records changed while the export was prepared. Refresh and try again.";
    }
    if (error.statusCode === 429) {
      return "Too many requests were submitted. Wait a moment and try again.";
    }
  }

  return operation === "import"
    ? "The import could not be processed. No completed student rows were rolled back or hidden. Try again, or contact support with the request time."
    : "The export could not be prepared. Student records were not changed. Try again, or contact support with the request time.";
}
