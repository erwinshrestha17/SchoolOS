'use client';

import { formatBsDateTime, type PermissionKey } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Send, UsersRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { communicationsApi } from '@/lib/api/communications';
import { useSession } from '@/components/session-provider';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { TablePagination } from '@/components/ui/table-pagination';

const PAGE_SIZE = 25;

export function NoticeAcknowledgementPanel({
  noticeId,
  lifecycleStatus,
}: {
  noticeId: string;
  lifecycleStatus: string;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permissions = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canReadReport = permissions.has('notices:read_reports');
  const canAcknowledge =
    permissions.has('notices:read') && lifecycleStatus === 'PUBLISHED';
  const [status, setStatus] = useState<'PENDING' | 'ACKNOWLEDGED'>('PENDING');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [reason, setReason] = useState('');
  const idempotencyKey = useRef<string | undefined>(undefined);

  const acknowledgements = useQuery({
    queryKey: ['notice-acknowledgements', noticeId, { status, page }],
    queryFn: () =>
      communicationsApi.listNoticeAcknowledgements(noticeId, {
        status,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canReadReport,
  });
  const acknowledge = useMutation({
    mutationFn: () => communicationsApi.acknowledgeNotice(noticeId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['notice-acknowledgements', noticeId],
      }),
  });
  const followUp = useMutation({
    mutationFn: () => {
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      return communicationsApi.requestNoticeAcknowledgementFollowUp(noticeId, {
        recipientUserIds: Array.from(selected),
        reason: reason.trim(),
        idempotencyKey: idempotencyKey.current,
      });
    },
    onSuccess: async () => {
      setFollowUpOpen(false);
      setReason('');
      setSelected(new Set());
      idempotencyKey.current = undefined;
      await queryClient.invalidateQueries({
        queryKey: ['notice-acknowledgements', noticeId],
      });
    },
  });

  if (!canReadReport && !canAcknowledge) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="notice-acknowledgement-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <UsersRound size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-950">Acknowledgement</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Read means the message was opened. Acknowledged means the
              recipient explicitly confirmed it.
            </p>
          </div>
        </div>
        {canAcknowledge ? (
          <button
            type="button"
            disabled={acknowledge.isPending || acknowledge.isSuccess}
            onClick={() => acknowledge.mutate()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {acknowledge.isPending
              ? 'Acknowledging…'
              : acknowledge.isSuccess
                ? 'Acknowledged'
                : 'Acknowledge this notice'}
          </button>
        ) : null}
      </div>

      {acknowledge.isError ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          This notice could not be acknowledged. It may not be addressed to your
          account.
        </p>
      ) : null}

      {canReadReport ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Acknowledgement state
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as 'PENDING' | 'ACKNOWLEDGED');
                  setPage(1);
                  setSelected(new Set());
                }}
                className="min-h-10"
              >
                <option value="PENDING">Pending</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
              </select>
            </label>
            {status === 'PENDING' && selected.size > 0 ? (
              <button
                type="button"
                onClick={() => setFollowUpOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                <Send size={15} /> Follow up with {selected.size}
              </button>
            ) : null}
          </div>

          {followUp.data ? (
            <p
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              Follow-up queued through M12: {followUp.data.queued} queued,{' '}
              {followUp.data.skipped} skipped.
            </p>
          ) : null}
          {followUp.isError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Follow-up could not be queued. No provider was called directly
              from this notice.
            </p>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            {acknowledgements.isLoading ? (
              <p className="p-6 text-sm text-slate-500">
                Loading acknowledgement recipients…
              </p>
            ) : acknowledgements.isError ? (
              <p role="alert" className="p-6 text-sm text-red-700">
                Acknowledgement recipients could not be loaded.
              </p>
            ) : (acknowledgements.data?.items.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No {status.toLowerCase()} recipients on this page.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {acknowledgements.data!.items.map((item) => (
                  <article
                    key={item.recipientUserId}
                    className="flex flex-wrap items-center justify-between gap-4 p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {status === 'PENDING' ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.recipientLabel} for follow-up`}
                          checked={selected.has(item.recipientUserId)}
                          onChange={(event) => {
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked)
                                next.add(item.recipientUserId);
                              else next.delete(item.recipientUserId);
                              return next;
                            });
                          }}
                          className="mt-1 h-4 w-4"
                        />
                      ) : null}
                      <div>
                        <p className="font-semibold text-slate-950">
                          {item.recipientLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.recipientType.toLowerCase()} · first delivered{' '}
                          {formatBsDateTime(item.firstDeliveredAt)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={
                        item.firstAcknowledgedAt ? 'ACKNOWLEDGED' : 'PENDING'
                      }
                      label={
                        item.firstAcknowledgedAt
                          ? `Acknowledged ${formatBsDateTime(item.firstAcknowledgedAt)}`
                          : 'Pending'
                      }
                    />
                  </article>
                ))}
              </div>
            )}
          </div>

          <TablePagination
            page={acknowledgements.data?.page ?? page}
            pageSize={acknowledgements.data?.limit ?? PAGE_SIZE}
            total={acknowledgements.data?.total ?? 0}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setSelected(new Set());
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={followUpOpen}
        title="Queue acknowledgement follow-up?"
        description="M12 will resolve allowed channels and re-check delivery policy when the job executes."
        confirmLabel="Queue follow-up"
        confirmDisabled={!reason.trim() || selected.size === 0}
        isConfirming={followUp.isPending}
        onClose={() => {
          if (!followUp.isPending) setFollowUpOpen(false);
        }}
        onConfirm={() => followUp.mutate()}
      >
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
            placeholder="Record why follow-up is needed"
          />
        </label>
      </ConfirmDialog>
    </section>
  );
}
