"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatBsDate, type AccountingPostingBatchSummary } from "@schoolos/core";
import { accountingApi } from "../../lib/api/accounting";
import { useSession } from "../session-provider";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/status-badge";
import { WorkSurface } from "../ui/work-surface";
import {
  ReportTable,
  type ReportTableColumn,
  type ReportTableRow,
} from "./report-table";

const columns: readonly ReportTableColumn[] = [
  { id: "source", label: "Source ID", width: 260 },
  { id: "type", label: "Posting" },
  { id: "sourceTotal", label: "Source total", align: "right" },
  { id: "postedTotal", label: "Posted total", align: "right" },
  { id: "difference", label: "Difference", align: "right" },
  { id: "status", label: "Status" },
  { id: "postedAt", label: "Posted" },
  { id: "action", label: "Action", align: "right" },
];

export function SourcePostingBatchesPanel({
  sourceModule,
}: {
  sourceModule?: "M3" | "M7";
}) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canRead = hasPermissions(["accounting:posting-batches:read"]);
  const canRetry = hasPermissions(["accounting:posting-batches:retry"]);
  const query = useQuery({
    queryKey: ["accounting-posting-batches", sourceModule ?? "ALL", page],
    queryFn: () =>
      accountingApi.listPostingBatches({ page, limit: 20, sourceModule }),
    enabled: canRead,
    staleTime: 30_000,
  });
  const retry = useMutation({
    mutationFn: accountingApi.retryPostingBatch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting-posting-batches"],
      });
    },
  });

  const rows: ReportTableRow[] = (query.data?.items ?? []).map((batch) =>
    mapBatchRow(batch, {
      canRetry,
      retrying: retry.isPending && retry.variables === batch.id,
      onRetry: () => retry.mutate(batch.id),
    }),
  );
  const totalPages = Math.max(
    1,
    Math.ceil((query.data?.total ?? 0) / (query.data?.limit ?? 20)),
  );

  return (
    <WorkSurface
      title={sourceModule ? `${sourceModule} posting history` : "Source posting history"}
      description="Official source totals, posted totals, journal lineage, retry state, and exact reconciliation differences."
    >
      {retry.isError ? (
        <p role="alert" className="mb-3 text-sm font-medium text-rose-700">
          {retry.error instanceof Error
            ? retry.error.message
            : "The posting retry could not be completed."}
        </p>
      ) : null}
      <ReportTable
        columns={columns}
        rows={rows}
        loading={query.isLoading}
        denied={!canRead}
        stale={query.isStale && query.isSuccess}
        error={query.error instanceof Error ? query.error.message : null}
        onRetry={() => void query.refetch()}
        ariaLabel={`${sourceModule ?? "M3 and M7"} source posting batches`}
        pagination={{
          page,
          totalPages,
          totalRows: query.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </WorkSurface>
  );
}

function mapBatchRow(
  batch: AccountingPostingBatchSummary,
  action: { canRetry: boolean; retrying: boolean; onRetry: () => void },
): ReportTableRow {
  return {
    id: batch.id,
    accessibleLabel: `${batch.sourceModule} ${batch.sourceType} ${batch.status}`,
    cells: {
      source: {
        value: (
          <span className="font-mono text-xs" title={batch.sourceBatchId}>
            {batch.sourceBatchId}
          </span>
        ),
      },
      type: { value: `${batch.sourceModule} · ${batch.postingType}` },
      sourceTotal: { value: batch.sourceTotal, type: "currency" },
      postedTotal: { value: batch.postedTotal, type: "currency" },
      difference: { value: batch.reconciliationDifference, type: "currency" },
      status: { value: <StatusBadge status={batch.status} /> },
      postedAt: {
        value: batch.postedAt ? formatBsDate(batch.postedAt) : "Not posted",
      },
      action: {
        align: "right",
        value:
          action.canRetry && batch.status === "FAILED" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={action.retrying}
              onClick={action.onRetry}
            >
              {action.retrying ? "Retrying…" : "Retry"}
            </Button>
          ) : batch.journalEntryId ? (
            <span className="text-xs text-slate-500">Journal linked</span>
          ) : (
            <span className="text-xs text-slate-500">No action</span>
          ),
      },
    },
  };
}
