'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDate,
  formatBsDateTime,
  parseBsDateInput,
  toGregorianDateFromBs,
} from '@schoolos/core';
import { toast } from 'sonner';
import { CalendarClock, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button';
import { Checkbox } from '@/components/ui/primitives/checkbox';
import { Textarea } from '@/components/ui/primitives/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/primitives/sheet';
import { BsDateField } from '@/components/ui/bs-date-field';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  api,
  type AddInterventionEntryPayload,
  type UpdateStudentInterventionPayload,
} from '@/lib/api';
import { schoolFacingErrorMessage } from '@/lib/school-facing-error';

export function InterventionCaseSheet({
  caseId,
  canWrite,
  onClose,
}: {
  caseId: string | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [entryType, setEntryType] = useState('PROGRESS');
  const [entryBody, setEntryBody] = useState('');
  const [parentVisible, setParentVisible] = useState(false);
  const [entryFollowUpBs, setEntryFollowUpBs] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [error, setError] = useState('');

  const detailQuery = useQuery({
    queryKey: ['learning-improvement', 'intervention', caseId],
    queryFn: () => api.getStudentIntervention(caseId as string),
    enabled: Boolean(caseId),
  });

  const entryMutation = useMutation({
    mutationFn: () =>
      api.addStudentInterventionEntry(caseId as string, {
        entryType:
          entryType as AddInterventionEntryPayload['entryType'],
        body: entryBody.trim(),
        parentVisible,
        ...(entryFollowUpBs
          ? { nextFollowUpOn: gregorianDateString(entryFollowUpBs) }
          : {}),
        clientRequestId: crypto.randomUUID(),
      }),
    onSuccess: () => {
      refreshCase();
      setEntryBody('');
      setParentVisible(false);
      setEntryFollowUpBs('');
      toast.success('Case timeline updated.');
    },
    onError: (mutationError) => setError(caseError(mutationError)),
  });

  const statusMutation = useMutation({
    mutationFn: () => {
      const current = detailQuery.data;
      if (!current) throw new Error('Case unavailable');
      return api.updateStudentIntervention(caseId as string, {
        status:
          nextStatus as UpdateStudentInterventionPayload['status'],
        reason: statusReason.trim(),
        expectedVersion: current.version,
        ...(resolutionSummary.trim()
          ? { resolutionSummary: resolutionSummary.trim() }
          : {}),
      });
    },
    onSuccess: () => {
      refreshCase();
      setNextStatus('');
      setStatusReason('');
      setResolutionSummary('');
      toast.success('Case status updated.');
    },
    onError: (mutationError) => setError(caseError(mutationError)),
  });

  function refreshCase() {
    void queryClient.invalidateQueries({
      queryKey: ['learning-improvement'],
    });
  }

  function submitEntry(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (entryBody.trim().length < 2) {
      setError('Enter a timeline note before saving.');
      return;
    }
    try {
      if (entryFollowUpBs) parseBsDateInput(entryFollowUpBs);
    } catch {
      setError('Enter a valid Bikram Sambat follow-up date.');
      return;
    }
    entryMutation.mutate();
  }

  function submitStatus(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!nextStatus) {
      setError('Select the next case status.');
      return;
    }
    if (statusReason.trim().length < 4) {
      setError('Enter a clear reason for the status change.');
      return;
    }
    if (
      (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') &&
      resolutionSummary.trim().length < 8
    ) {
      setError('Enter a resolution summary before resolving or closing.');
      return;
    }
    statusMutation.mutate();
  }

  function close() {
    setError('');
    onClose();
  }

  const item = detailQuery.data;
  return (
    <Sheet
      open={Boolean(caseId)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle>{item?.title ?? 'Learning follow-up case'}</SheetTitle>
          <SheetDescription>
            {item
              ? `${item.student.fullName} · ${item.student.studentSystemId}`
              : 'Loading the tenant-scoped case timeline.'}
          </SheetDescription>
        </SheetHeader>

        {detailQuery.isLoading ? (
          <LoadingState variant="page" label="Loading follow-up case" />
        ) : detailQuery.isError || !item ? (
          <ErrorState
            className="m-5"
            message="This follow-up case could not be loaded."
            onRetry={() => void detailQuery.refetch()}
          />
        ) : (
          <div className="space-y-6 p-5">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <StatusBadge
                  status={item.priority}
                  tone={
                    item.priority === 'URGENT'
                      ? 'conflict'
                      : item.priority === 'IMPORTANT'
                        ? 'pending'
                        : 'info'
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Version {item.version}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6">{item.concernSummary}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Owner
                  </dt>
                  <dd className="mt-1 font-medium">
                    {item.owner?.fullName ?? 'Unassigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Next follow-up
                  </dt>
                  <dd className="mt-1 font-medium">
                    {item.nextFollowUpOn
                      ? formatBsDate(item.nextFollowUpOn)
                      : 'Not scheduled'}
                  </dd>
                </div>
              </dl>
              {item.parentVisibleSummary ? (
                <div className="mt-4 rounded-lg border border-info-100 bg-info-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-info-700">
                    Parent-visible summary
                  </p>
                  <p className="mt-1 text-sm text-info-900">
                    {item.parentVisibleSummary}
                  </p>
                </div>
              ) : null}
            </div>

            <section>
              <h3 className="text-sm font-semibold">Case timeline</h3>
              {item.entries.length ? (
                <div className="mt-3 space-y-3">
                  {item.entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-xl border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge status={entry.entryType} tone="info" />
                        <span className="text-xs text-muted-foreground">
                          {formatBsDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        {entry.body}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {entry.parentVisible ? (
                          <span>Visible to linked parents</span>
                        ) : (
                          <span>School staff only</span>
                        )}
                        {entry.nextFollowUpOn ? (
                          <span>
                            · Follow up {formatBsDate(entry.nextFollowUpOn)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No timeline entries have been recorded.
                </p>
              )}
            </section>

            {canWrite &&
            item.status !== 'RESOLVED' &&
            item.status !== 'CLOSED' ? (
              <>
                <form
                  onSubmit={submitEntry}
                  className="space-y-4 rounded-xl border p-4"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquarePlus className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Add timeline entry</h3>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Entry type</span>
                    <select
                      value={entryType}
                      onChange={(event) => setEntryType(event.target.value)}
                      className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
                    >
                      {[
                        'NOTE',
                        'PARENT_CONTACT',
                        'ACTION',
                        'FOLLOW_UP',
                        'PROGRESS',
                        'ESCALATION',
                        'RESOLUTION',
                      ].map((value) => (
                        <option key={value} value={value}>
                          {value.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Timeline note</span>
                    <Textarea
                      value={entryBody}
                      onChange={(event) => setEntryBody(event.target.value)}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <BsDateField
                    label="Next follow-up (BS, optional)"
                    value={entryFollowUpBs}
                    onChange={setEntryFollowUpBs}
                  />
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={parentVisible}
                      onCheckedChange={(checked) =>
                        setParentVisible(checked === true)
                      }
                    />
                    Show this note to linked parents
                  </label>
                  <Button type="submit" disabled={entryMutation.isPending}>
                    {entryMutation.isPending ? 'Saving…' : 'Add entry'}
                  </Button>
                </form>

                <form
                  onSubmit={submitStatus}
                  className="space-y-4 rounded-xl border p-4"
                >
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">
                      Update case lifecycle
                    </h3>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Next status</span>
                    <select
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value)}
                      className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
                      required
                    >
                      <option value="">Select status</option>
                      {interventionNextStatuses(item.status).map((value) => (
                          <option key={value} value={value}>
                            {value.replace(/_/g, ' ')}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Reason</span>
                    <Textarea
                      value={statusReason}
                      onChange={(event) =>
                        setStatusReason(event.target.value)
                      }
                      maxLength={600}
                      required
                    />
                  </label>
                  {nextStatus === 'RESOLVED' || nextStatus === 'CLOSED' ? (
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">
                        Resolution summary
                      </span>
                      <Textarea
                        value={resolutionSummary}
                        onChange={(event) =>
                          setResolutionSummary(event.target.value)
                        }
                        maxLength={1200}
                        required
                      />
                    </label>
                  ) : null}
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending
                      ? 'Updating…'
                      : 'Update status'}
                  </Button>
                </form>
              </>
            ) : null}

            {error ? (
              <p
                className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm font-medium text-danger-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
        )}

        <SheetFooter className="border-t">
          <Button type="button" variant="outline" onClick={close}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
}

function caseError(error: unknown) {
  return schoolFacingErrorMessage(error, {
    fallback:
      'The follow-up case could not be updated. No student record was changed.',
    invalid: 'Review the timeline details and try again.',
    forbidden: 'Your role cannot update this follow-up case.',
    conflict:
      'This case changed while you were working. Refresh the case before trying again.',
  });
}

function interventionNextStatuses(status: string) {
  return {
    OPEN: ['IN_PROGRESS', 'MONITORING', 'RESOLVED'],
    IN_PROGRESS: ['MONITORING', 'RESOLVED'],
    MONITORING: ['IN_PROGRESS', 'RESOLVED'],
    RESOLVED: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: [],
  }[status] ?? [];
}
