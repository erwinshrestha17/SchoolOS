'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';

export function TeacherReplacementsList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [handoverBody, setHandoverBody] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['teacher-replacements', statusFilter],
    queryFn: () =>
      api.listTeacherReplacements({
        status: statusFilter || undefined,
        limit: 50,
      }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateTeacherReplacement(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['teacher-replacements'] }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeTeacherReplacement(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['teacher-replacements'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.cancelTeacherReplacement(id, { reason: 'Cancelled by coordinator' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['teacher-replacements'] }),
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.addReplacementHandoverNote(id, { body }),
    onSuccess: () => {
      setHandoverBody('');
      queryClient.invalidateQueries({ queryKey: ['teacher-replacements'] });
    },
  });

  if (listQuery.isLoading) {
    return <LoadingState label="Loading teacher replacements" />;
  }
  if (listQuery.isError) {
    return (
      <ErrorState
        title="Unable to load replacements"
        message="Retry once network or permission issues are resolved."
        onRetry={() => listQuery.refetch()}
      />
    );
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            className="block rounded-md border px-3 py-2"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No teacher replacements"
          description="Schedule a long-term replacement when an assignment needs a lasting handoff."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Former</th>
                <th className="px-3 py-2 font-medium">Replacement</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Pending</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const openPending =
                  item.pendingWork?.filter((work) => !work.disposition)
                    .length ?? 0;
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      {item.formerStaff
                        ? `${item.formerStaff.firstName} ${item.formerStaff.lastName}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {item.replacementStaff
                        ? `${item.replacementStaff.firstName} ${item.replacementStaff.lastName}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {[
                        item.class?.name,
                        item.section?.name,
                        item.subject?.name,
                      ]
                        .filter(Boolean)
                        .join(' / ') || '—'}
                    </td>
                    <td className="px-3 py-2">{openPending} open</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {item.status === 'SCHEDULED' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => activateMutation.mutate(item.id)}
                            >
                              Activate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelMutation.mutate(item.id)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                        {item.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            onClick={() => completeMutation.mutate(item.id)}
                          >
                            Complete
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(item.id)}
                        >
                          Handover note
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <div className="space-y-2 rounded-md border p-4">
          <p className="text-sm font-medium">Add handover note</p>
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={handoverBody}
            onChange={(event) => setHandoverBody(event.target.value)}
            placeholder="Coverage context for the incoming teacher"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!handoverBody.trim() || noteMutation.isPending}
              onClick={() =>
                noteMutation.mutate({ id: selectedId, body: handoverBody })
              }
            >
              Save note
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedId(null);
                setHandoverBody('');
              }}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
