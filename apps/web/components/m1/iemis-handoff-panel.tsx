'use client';

import {
  formatBsDateTime,
  type ExternalAuthorityHandoffStatus,
  type IemisExportResult,
  type IemisHandoff,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { StatusBadge } from '../ui/status-badge';

const nextStates: Record<ExternalAuthorityHandoffStatus, ExternalAuthorityHandoffStatus[]> = {
  READY: ['EXPORTED'],
  EXPORTED: ['SUBMITTED'],
  SUBMITTED: ['ACKNOWLEDGED', 'REJECTED', 'CORRECTION_REQUIRED'],
  ACKNOWLEDGED: [],
  REJECTED: [],
  CORRECTION_REQUIRED: [],
};

function statusDescription(status: ExternalAuthorityHandoffStatus) {
  switch (status) {
    case 'READY':
      return 'Internal snapshot registered for authorized review.';
    case 'EXPORTED':
      return 'An operator recorded that the protected snapshot was exported. No authority submission is recorded.';
    case 'SUBMITTED':
      return 'A manual authority handoff was recorded with evidence. No acknowledgement is recorded.';
    case 'ACKNOWLEDGED':
      return 'An external acknowledgement and receipt reference were recorded.';
    case 'REJECTED':
      return 'The external response rejected this snapshot. Prepare a new snapshot for correction.';
    case 'CORRECTION_REQUIRED':
      return 'The external response requires correction. Prepare a new snapshot and link it to this handoff.';
  }
}

export function IemisHandoffPanel({
  exportResult,
  canManage,
}: {
  exportResult: IemisExportResult | null;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('');
  const [nextStatus, setNextStatus] = useState<ExternalAuthorityHandoffStatus>('EXPORTED');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState('');
  const [note, setNote] = useState('');
  const [supersedesId, setSupersedesId] = useState('');
  const [feedback, setFeedback] = useState('');
  const handoffsQuery = useQuery({
    queryKey: ['iemis-handoffs'],
    queryFn: api.listIemisHandoffs,
    enabled: canManage,
  });
  const handoffs = handoffsQuery.data ?? [];
  const selected = handoffs.find((item) => item.id === selectedId) ?? handoffs[0];
  const terminal = handoffs.filter(
    (item) => item.status === 'REJECTED' || item.status === 'CORRECTION_REQUIRED',
  );
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  useEffect(() => {
    if (selected) setNextStatus(nextStates[selected.status][0] ?? 'EXPORTED');
    setEvidenceFile(null);
    setReceipt('');
    setNote('');
  }, [selected?.id, selected?.status]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createIemisHandoff({
        reportExportId: exportResult!.exportId,
        ...(supersedesId ? { supersedesHandoffId: supersedesId } : {}),
      }),
    onSuccess: async (created) => {
      setFeedback('Internal snapshot registered. No government submission occurred.');
      setSelectedId(created.id);
      setSupersedesId('');
      await queryClient.invalidateQueries({ queryKey: ['iemis-handoffs'] });
    },
  });
  const eventMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a handoff first.');
      const evidenceFileId = evidenceFile
        ? (await api.uploadFile(evidenceFile, 'reports', selected.id)).id
        : undefined;
      return api.recordIemisHandoffEvent(selected.id, {
        status: nextStatus,
        evidenceFileId,
        externalReceiptReference: receipt.trim() || undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setFeedback(`${nextStatus.replace(/_/g, ' ')} recorded with an audit event.`);
      setEvidenceFile(null);
      setReceipt('');
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['iemis-handoffs'] });
    },
  });

  if (!canManage) return null;
  const canCreate =
    exportResult?.artifactStatus === 'REQUIRES_AUTHORIZED_REVIEW' &&
    exportResult.invalidRecords === 0 &&
    exportResult.issueCount === 0 &&
    exportResult.configurationIssues.length === 0 &&
    exportResult.validRecords > 0 &&
    !handoffs.some((item) => item.reportExportId === exportResult.exportId);
  const evidenceRequired = nextStatus !== 'EXPORTED';
  const actionEnabled =
    selected &&
    nextStates[selected.status].includes(nextStatus) &&
    (!evidenceRequired || evidenceFile !== null) &&
    (nextStatus !== 'ACKNOWLEDGED' || receipt.trim().length > 0) &&
    (!['REJECTED', 'CORRECTION_REQUIRED'].includes(nextStatus) ||
      note.trim().length > 0);

  return (
    <section className="border-t border-slate-200 pt-5" aria-labelledby="iemis-handoff-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="iemis-handoff-title" className="text-base font-bold text-slate-950">
            Manual authority handoff
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            SchoolOS stores snapshots and evidence. This internal CSV is not a verified official iEMIS format, and direct government synchronization is unavailable.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!canCreate || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Register latest snapshot
        </Button>
      </div>

      {terminal.length > 0 && canCreate ? (
        <label className="mt-4 block max-w-lg text-sm font-medium text-slate-700">
          Corrects earlier handoff
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={supersedesId}
            onChange={(event) => setSupersedesId(event.target.value)}
          >
            <option value="">New, unrelated handoff</option>
            {terminal.map((item) => (
              <option key={item.id} value={item.id}>
                {item.status.replace(/_/g, ' ')} · {formatBsDateTime(item.createdAt)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!canCreate && exportResult ? (
        <p className="mt-3 text-xs text-slate-600">
          A handoff can be registered after all records and configuration checks pass, with a fresh export snapshot.
        </p>
      ) : null}
      {feedback ? <p className="mt-3 text-sm text-slate-700" role="status">{feedback}</p> : null}
      {createMutation.isError || eventMutation.isError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : eventMutation.error instanceof Error
              ? eventMutation.error.message
              : 'The handoff could not be recorded.'}
        </p>
      ) : null}
      {handoffsQuery.isError ? (
        <ErrorState
          title="Handoff history unavailable"
          message="Authority state cannot be inferred while history is unavailable."
          onRetry={() => void handoffsQuery.refetch()}
        />
      ) : handoffsQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading handoff history…</p>
      ) : handoffs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No manual handoff has been registered.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr><th className="px-3 py-2">Snapshot</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Recorded</th></tr>
              </thead>
              <tbody>
                {handoffs.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-left font-semibold text-info-800 underline-offset-2 hover:underline focus-visible:underline"
                        onClick={() => setSelectedId(item.id)}
                      >
                        {item.reportExportId?.slice(0, 8) ?? item.id.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                    <td className="px-3 py-2 text-slate-600">{formatBsDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selected.status} />
                <span className="text-xs text-slate-500">{selected.id}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{statusDescription(selected.status)}</p>
              {selected.supersedesId ? (
                <p className="mt-2 text-xs text-slate-600">Corrects {selected.supersedesId}</p>
              ) : null}
              {selected.externalReceiptReference ? (
                <p className="mt-2 text-xs text-slate-700">Authority receipt: {selected.externalReceiptReference}</p>
              ) : null}
              <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <li>READY · {formatBsDateTime(selected.createdAt)}</li>
                {selected.events.map((event) => (
                  <li key={event.id}>
                    {event.status.replace(/_/g, ' ')} · {formatBsDateTime(event.occurredAt)}
                    {event.note ? ` · ${event.note}` : ''}
                  </li>
                ))}
              </ol>
              {nextStates[selected.status].length > 0 ? (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Record next state
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value as ExternalAuthorityHandoffStatus)}
                    >
                      {nextStates[selected.status].map((status) => (
                        <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  {evidenceRequired ? (
                    <label className="block text-sm font-medium text-slate-700">
                      External evidence file
                      <input
                        type="file"
                        className="mt-1 block w-full text-sm"
                        accept=".pdf,.png,.jpg,.jpeg,.csv,application/pdf,image/png,image/jpeg,text/csv"
                        onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  ) : null}
                  {nextStatus === 'ACKNOWLEDGED' ? (
                    <label className="block text-sm font-medium text-slate-700">
                      Authority receipt reference
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={receipt}
                        onChange={(event) => setReceipt(event.target.value)}
                        maxLength={200}
                      />
                    </label>
                  ) : null}
                  {nextStatus === 'REJECTED' || nextStatus === 'CORRECTION_REQUIRED' ? (
                    <label className="block text-sm font-medium text-slate-700">
                      Authority response reason
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={2000}
                      />
                    </label>
                  ) : null}
                  <Button
                    type="button"
                    disabled={!actionEnabled || eventMutation.isPending}
                    onClick={() => eventMutation.mutate()}
                  >
                    Record {nextStatus.replace(/_/g, ' ').toLowerCase()}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
