"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActionMenu } from "@/components/ui/action-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckCircle2, Lock, Archive } from "lucide-react";
import { formatBsDate } from "@schoolos/core";
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from "@/components/schoolos/data/paginated-data-table";

type VersionAction = "publish" | "lock" | "archive";
type TimetableVersionRow = Awaited<ReturnType<typeof api.listTimetableVersions>>["items"][number];

const PAGE_SIZE = 20;

export function TimetableVersionsList({
  academicYearId,
}: {
  academicYearId?: string;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    action: VersionAction;
    id: string;
    versionName: string;
  } | null>(null);
  const [page, setPage] = useState(1);

  const versionsQuery = useQuery({
    queryKey: ["timetable-versions", academicYearId, page],
    queryFn: () => api.listTimetableVersions({ academicYearId, page, limit: PAGE_SIZE }),
    enabled: Boolean(academicYearId),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.publishTimetableVersion(id),
    onSuccess: () => {
      setConfirmTarget(null);
      setNotice({
        title: "Version published",
        description:
          "The selected timetable version is now active for school operations.",
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
    onError: (error: Error) => {
      setNotice({
        title: "Publish failed",
        description: error.message,
        tone: "danger",
      });
    },
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => api.lockTimetableVersion(id),
    onSuccess: () => {
      setConfirmTarget(null);
      setNotice({
        title: "Version locked",
        description: "The timetable version is locked for audit-safe changes.",
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
    onError: (error: Error) => {
      setNotice({
        title: "Lock failed",
        description: error.message,
        tone: "danger",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.archiveTimetableVersion(id),
    onSuccess: () => {
      setConfirmTarget(null);
      setNotice({
        title: "Version archived",
        description: "The timetable version has been moved out of active use.",
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
    onError: (error: Error) => {
      setNotice({
        title: "Archive failed",
        description: error.message,
        tone: "danger",
      });
    },
  });

  const confirmMutation =
    confirmTarget?.action === "publish"
      ? publishMutation
      : confirmTarget?.action === "lock"
        ? lockMutation
        : archiveMutation;

  const CONFIRM_COPY: Record<
    VersionAction,
    { title: string; description: (versionName: string) => string; confirmLabel: string }
  > = {
    publish: {
      title: "Publish Timetable Version",
      description: (versionName) =>
        `Publish "${versionName}"? It will become the active timetable for school operations.`,
      confirmLabel: "Publish Version",
    },
    lock: {
      title: "Lock Timetable Version",
      description: (versionName) =>
        `Lock "${versionName}" for audit-safe changes? Further edits will require an explicit unlock.`,
      confirmLabel: "Lock Version",
    },
    archive: {
      title: "Archive Timetable Version",
      description: (versionName) =>
        `Archive "${versionName}"? It will be moved out of active use.`,
      confirmLabel: "Archive Version",
    },
  };

  if (!academicYearId) {
    return (
      <EmptyState
        title="Select academic year"
        description="Please select an academic year to view timetable versions."
      />
    );
  }

  const columns: PaginatedDataTableColumn<TimetableVersionRow>[] = [
    {
      id: "versionName",
      header: "Version Name",
      cell: (row) => <span className="font-bold text-slate-900">{row.versionName}</span>,
    },
    {
      id: "effectiveFrom",
      header: "Effective From",
      cell: (row) => formatBsDate(row.effectiveFrom),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "slots",
      header: "Slots",
      cell: (row) => row.slots?.length || 0,
    },
  ];

  function renderRowActions(row: TimetableVersionRow) {
    return (
      <ActionMenu
        items={[
          {
            label: "Publish",
            icon: <CheckCircle2 className="h-4 w-4" />,
            onClick: () =>
              setConfirmTarget({ action: "publish", id: row.id, versionName: row.versionName }),
            disabled: row.status === "PUBLISHED" || row.status === "ARCHIVED",
          },
          {
            label: "Lock",
            icon: <Lock className="h-4 w-4" />,
            onClick: () =>
              setConfirmTarget({ action: "lock", id: row.id, versionName: row.versionName }),
            disabled: row.status === "LOCKED" || row.status === "ARCHIVED",
          },
          {
            label: "Archive",
            icon: <Archive className="h-4 w-4" />,
            onClick: () =>
              setConfirmTarget({ action: "archive", id: row.id, versionName: row.versionName }),
            disabled: row.status === "ARCHIVED",
          },
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
          className="max-w-none"
        />
      ) : null}

      <PaginatedDataTable
        columns={columns}
        items={versionsQuery.data?.items ?? []}
        getRowId={(row) => row.id}
        status={versionsQuery.isError ? "error" : versionsQuery.isLoading ? "loading" : "ready"}
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={versionsQuery.data?.meta.total ?? 0}
        onPageChange={setPage}
        onRetry={() => void versionsQuery.refetch()}
        errorMessage="Timetable versions could not load. Please try again."
        emptyTitle="No versions found"
        emptyDescription="Create your first timetable version to start scheduling classes."
        rowActions={renderRowActions}
      />

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && confirmMutation.mutate(confirmTarget.id)}
        title={confirmTarget ? CONFIRM_COPY[confirmTarget.action].title : ""}
        description={
          confirmTarget
            ? CONFIRM_COPY[confirmTarget.action].description(confirmTarget.versionName)
            : ""
        }
        confirmLabel={confirmTarget ? CONFIRM_COPY[confirmTarget.action].confirmLabel : "Confirm"}
        isConfirming={confirmMutation.isPending}
      />
    </div>
  );
}
