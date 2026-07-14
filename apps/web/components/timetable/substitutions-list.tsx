"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TimetableSubstitutionModal } from "@/components/timetable/substitution-modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActionMenu } from "@/components/ui/action-menu";
import { Plus, Users, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { formatBsDate } from "@schoolos/core";
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from "@/components/schoolos/data/paginated-data-table";

type TimetableSubstitutionRow = Awaited<
  ReturnType<typeof api.listSubstitutions>
>["items"][number];
type TimetableTeacherIdentity = NonNullable<
  TimetableSubstitutionRow["absentTeacher"]
>;

const PAGE_SIZE = 20;

function formatSubstitutionDate(value: string | null | undefined) {
  if (!value) return "Date not set";
  try {
    return formatBsDate(value);
  } catch {
    return "Date unavailable";
  }
}

function formatTeacherName(
  teacher: TimetableTeacherIdentity | null | undefined,
) {
  if (!teacher) return "Teacher not assigned";
  return (
    [teacher.firstName, teacher.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") || "Teacher name not set"
  );
}

export function SubstitutionsList({ filters }: { filters: any }) {
  const queryClient = useQueryClient();
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: ToastTone;
  } | null>(null);
  const [page, setPage] = useState(1);
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
  }, [filtersKey]);

  const substitutionsQuery = useQuery({
    queryKey: ["timetable-substitutions", filters, page],
    queryFn: () =>
      api.listSubstitutions({ ...filters, page, limit: PAGE_SIZE }),
  });
  const slotQuery = useQuery({
    queryKey: ["timetable-substitution-slots", filters.classId],
    queryFn: () => api.listTimetable({ classId: filters.classId }),
    enabled: Boolean(filters.classId),
  });
  const slotOptions = slotQuery.data?.items ?? [];

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelSubstitution(id),
    onSuccess: () => {
      setConfirmingCancelId(null);
      setNotice({
        title: "Substitution cancelled",
        description:
          "The substitution record has been cancelled and refreshed.",
        tone: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["timetable-substitutions"],
      });
    },
    onError: (error: Error) => {
      setNotice({
        title: "Cancellation failed",
        description: error.message,
        tone: "danger",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeSubstitution(id),
    onSuccess: () => {
      setNotice({
        title: "Substitution completed",
        description: "The substitution has been marked complete.",
        tone: "success",
      });
      void queryClient.invalidateQueries({
        queryKey: ["timetable-substitutions"],
      });
    },
    onError: (error: Error) => {
      setNotice({
        title: "Completion failed",
        description: error.message,
        tone: "danger",
      });
    },
  });

  const columns: PaginatedDataTableColumn<TimetableSubstitutionRow>[] = [
    {
      id: "date",
      header: "Date",
      cell: (row) => formatSubstitutionDate(row.date),
    },
    {
      id: "slot",
      header: "Class / Slot",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">
            {row.timetableSlot?.subject?.name?.trim() || "Subject not set"}
          </span>
          <span className="text-xs text-slate-500">
            {row.timetableSlot?.startsAt && row.timetableSlot?.endsAt
              ? `${row.timetableSlot.startsAt} - ${row.timetableSlot.endsAt}`
              : "Slot time not set"}
          </span>
        </div>
      ),
    },
    {
      id: "absentTeacher",
      header: "Absent Teacher",
      cell: (row) => (
        <span className="text-sm font-medium text-slate-700">
          {formatTeacherName(row.absentTeacher)}
        </span>
      ),
    },
    {
      id: "substituteTeacher",
      header: "Substitute Teacher",
      cell: (row) => (
        <span className="text-sm font-bold text-slate-700">
          {formatTeacherName(row.substituteTeacher)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  function renderRowActions(row: TimetableSubstitutionRow) {
    return (
      <ActionMenu
        items={[
          {
            label: "Assign Substitute",
            icon: <Users className="h-4 w-4" />,
            onClick: () => {
              setSelectedSub(row);
              setIsModalOpen(true);
            },
            disabled: row.status === "CANCELLED" || row.status === "COMPLETED",
          },
          {
            label: "Complete",
            icon: <CheckCircle2 className="h-4 w-4" />,
            onClick: () => completeMutation.mutate(row.id),
            disabled: row.status !== "ASSIGNED",
          },
          {
            label: "Cancel",
            icon: <XCircle className="h-4 w-4" />,
            onClick: () => setConfirmingCancelId(row.id),
            disabled: row.status === "CANCELLED" || row.status === "COMPLETED",
          },
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
          className="max-w-none"
        />
      ) : null}

      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
            Teacher Substitutions
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Manage faculty absences and assign replacement teachers.
          </p>
        </div>
        <Button
          className="rounded-2xl font-bold"
          disabled={
            !filters.classId || slotQuery.isLoading || slotOptions.length === 0
          }
          title={
            !filters.classId
              ? "Select a class before recording an absence."
              : slotOptions.length === 0
                ? "No timetable slots are available for the selected class."
                : undefined
          }
          onClick={() => {
            setSelectedSub(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {slotQuery.isLoading ? "Loading slots..." : "Record Absence"}
        </Button>
      </div>
      {!filters.classId ? (
        <p className="rounded-2xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] px-4 py-3 text-xs font-semibold text-[var(--color-mod-homework-text)]">
          Select a class in the timetable filters to record an absence from a
          real published slot.
        </p>
      ) : null}

      <PaginatedDataTable
        columns={columns}
        items={substitutionsQuery.data?.items ?? []}
        getRowId={(row) => row.id}
        status={
          substitutionsQuery.isError
            ? "error"
            : substitutionsQuery.isLoading
              ? "loading"
              : "ready"
        }
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={substitutionsQuery.data?.meta.total ?? 0}
        onPageChange={setPage}
        onRetry={() => void substitutionsQuery.refetch()}
        errorMessage="Substitutions could not load. Please try again."
        emptyTitle="No substitutions found"
        emptyDescription="Everything looks normal. No teacher absences recorded."
        rowActions={renderRowActions}
      />

      <TimetableSubstitutionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSub(null);
        }}
        slots={slotOptions}
        substitution={selectedSub}
        mode={selectedSub ? "assign" : "create"}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmingCancelId)}
        onClose={() => setConfirmingCancelId(null)}
        onConfirm={() => {
          if (confirmingCancelId) {
            cancelMutation.mutate(confirmingCancelId);
          }
        }}
        title="Cancel substitution?"
        description="This records a cancelled substitution through the backend and keeps the timetable audit trail intact."
        confirmLabel="Cancel substitution"
        variant="destructive"
        isConfirming={cancelMutation.isPending}
      />
    </div>
  );
}
