'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDateForInput,
  formatBsDateTime,
  parseBsDateInput,
  toGregorianDateFromBs,
  toNepalLocalDateTime,
  zonedNepalDateTimeToUtc,
  type AssessmentRetakeResultDecision,
  type AssessmentRetakeStatus,
  type AssessmentRetakeSummary,
  type AssessmentRetakeType,
} from '@schoolos/core';
import {
  Ban,
  CalendarPlus,
  Check,
  ClipboardCheck,
  Eye,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { academicsApi } from '@/lib/api/academics';
import { BsDateField } from '@/components/ui/bs-date-field';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '@/components/schoolos/data/paginated-data-table';

const PAGE_SIZE = 20;

const RETAKE_STATUSES: AssessmentRetakeStatus[] = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'SCHEDULED',
  'COMPLETED',
  'APPLIED',
  'CANCELLED',
];

type RetakeAction =
  | 'approve'
  | 'reject'
  | 'schedule'
  | 'complete'
  | 'apply'
  | 'cancel';

type ActionTarget = {
  action: RetakeAction;
  retake: AssessmentRetakeSummary;
};

type ActionForm = {
  note: string;
  dateBs: string;
  startsAt: string;
  endsAt: string;
  room: string;
  marksObtained: string;
  decision: AssessmentRetakeResultDecision | '';
  reason: string;
};

const EMPTY_FORM: ActionForm = {
  note: '',
  dateBs: '',
  startsAt: '',
  endsAt: '',
  room: '',
  marksObtained: '',
  decision: '',
  reason: '',
};

const retakeColumns: PaginatedDataTableColumn<AssessmentRetakeSummary>[] = [
  {
    id: 'student',
    header: 'Student',
    cell: (retake) => (
      <>
        <p className="font-bold text-slate-900">{studentName(retake)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {retake.student?.studentSystemId ?? retake.studentId}
          {' | '}
          {retake.class?.name ?? 'Class'}
          {retake.section?.name ? ` - ${retake.section.name}` : ''}
        </p>
      </>
    ),
  },
  {
    id: 'assessment',
    header: 'Assessment',
    cell: (retake) => (
      <>
        <p className="font-semibold text-slate-900">
          {retake.subject?.name ?? 'Subject'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {retake.examTerm?.name ?? 'Exam term'}
          {' | '}
          {retake.assessmentComponent?.name ?? 'Component'}
        </p>
      </>
    ),
  },
  {
    id: 'type',
    header: 'Type',
    cell: (retake) => (
      <span className="font-semibold text-slate-700">
        {displayType(retake.type)}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (retake) => (
      <StatusBadge status={retake.status} tone={statusTone(retake.status)} />
    ),
  },
  {
    id: 'schedule',
    header: 'Schedule',
    cell: (retake) =>
      retake.scheduledStartsAt ? (
        <>
          <p className="font-semibold text-slate-700">
            {formatBsDateTime(retake.scheduledStartsAt)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {retake.room ?? 'Room not assigned'}
          </p>
        </>
      ) : (
        <span className="text-slate-400">Not scheduled</span>
      ),
  },
  {
    id: 'attempt',
    header: 'Attempt',
    cell: (retake) =>
      retake.attemptMarks === null ? (
        <span className="text-slate-400">Pending</span>
      ) : (
        <>
          <p className="font-bold text-slate-900">
            {retake.attemptMarks} / {retake.assessmentComponent?.maxMarks ?? '-'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {displayDecision(retake.resultDecision)}
          </p>
        </>
      ),
  },
];

export function AssessmentRetakesTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AssessmentRetakeStatus | ''>('');
  const [type, setType] = useState<AssessmentRetakeType | ''>('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<ActionForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const retakesQuery = useQuery({
    queryKey: ['assessment-retakes', status, type, page],
    queryFn: () =>
      academicsApi.listAssessmentRetakes({
        status: status || undefined,
        type: type || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['assessment-retake', detailId],
    queryFn: () => {
      if (!detailId) {
        throw new Error('Select an assessment retake to view its detail.');
      }
      return academicsApi.getAssessmentRetake(detailId);
    },
    enabled: detailId !== null,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      retake,
      values,
    }: ActionTarget & { values: ActionForm }) => {
      switch (action) {
        case 'approve':
          return academicsApi.approveAssessmentRetake(retake.id, {
            reviewNote: values.note.trim() || undefined,
          });
        case 'reject':
          return academicsApi.rejectAssessmentRetake(retake.id, {
            reviewNote: values.reason.trim(),
          });
        case 'schedule':
          return academicsApi.scheduleAssessmentRetake(retake.id, {
            startsAt: toUtcIso(values.dateBs, values.startsAt),
            endsAt: toUtcIso(values.dateBs, values.endsAt),
            room: values.room.trim() || undefined,
          });
        case 'complete':
          return academicsApi.completeAssessmentRetake(retake.id, {
            marksObtained: Number(values.marksObtained),
            remarks: values.note.trim() || undefined,
          });
        case 'apply':
          return academicsApi.applyAssessmentRetakeResult(retake.id, {
            decision: values.decision as Exclude<
              AssessmentRetakeResultDecision,
              'PENDING'
            >,
            reason: values.reason.trim(),
          });
        case 'cancel':
          return academicsApi.cancelAssessmentRetake(retake.id, {
            reason: values.reason.trim(),
          });
      }
    },
    onSuccess: (_, variables) => {
      setSuccessMessage(successLabel(variables.action));
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['assessment-retakes'] });
      void queryClient.invalidateQueries({ queryKey: ['assessment-retake'] });
      void queryClient.invalidateQueries({ queryKey: ['marks'] });
      void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      void queryClient.invalidateQueries({
        queryKey: ['result-publishing-readiness'],
      });
    },
  });

  const openAction = (
    action: RetakeAction,
    retake: AssessmentRetakeSummary,
  ) => {
    const scheduledStart = retake.scheduledStartsAt
      ? new Date(retake.scheduledStartsAt)
      : null;
    const scheduledEnd = retake.scheduledEndsAt
      ? new Date(retake.scheduledEndsAt)
      : null;
    setDetailId(null);
    setTarget({ action, retake });
    setForm({
      ...EMPTY_FORM,
      dateBs: scheduledStart ? formatBsDateForInput(scheduledStart) : '',
      startsAt: scheduledStart ? toTimeInput(scheduledStart) : '',
      endsAt: scheduledEnd ? toTimeInput(scheduledEnd) : '',
      room: retake.room ?? '',
      marksObtained:
        retake.attemptMarks === null ? '' : String(retake.attemptMarks),
    });
    setFormError(null);
    actionMutation.reset();
  };

  const submitAction = () => {
    if (!target) return;
    const validation = validateAction(target, form);
    if (validation) {
      setFormError(validation);
      return;
    }
    setFormError(null);
    actionMutation.mutate({ ...target, values: form });
  };

  return (
    <section className="space-y-5" data-testid="assessment-retakes-workspace">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-[var(--color-mod-academics-accent)]" />
            <h2 className="text-lg font-black text-slate-950">
              Retest and make-up queue
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Review requests, schedule attempts, record scores, and explicitly
            apply the approved result.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">
              Status
            </span>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as AssessmentRetakeStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {RETAKE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {displayStatus(value)}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">
              Type
            </span>
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value as AssessmentRetakeType | '');
                setPage(1);
              }}
            >
              <option value="">All types</option>
              <option value="RETEST">Retest</option>
              <option value="MAKE_UP">Make-up assessment</option>
            </Select>
          </label>
        </div>
      </div>

      {successMessage ? (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          role="status"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
            onClick={() => setSuccessMessage(null)}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <PaginatedDataTable
        columns={retakeColumns}
        items={retakesQuery.data?.items ?? []}
        getRowId={(retake) => retake.id}
        status={
          retakesQuery.isError
            ? 'error'
            : retakesQuery.isLoading
              ? 'loading'
              : 'ready'
        }
        page={retakesQuery.data?.meta.page ?? page}
        pageSize={retakesQuery.data?.meta.limit ?? PAGE_SIZE}
        totalItems={retakesQuery.data?.meta.total ?? 0}
        onPageChange={setPage}
        onRetry={() => void retakesQuery.refetch()}
        errorMessage={
          retakesQuery.error instanceof Error
            ? retakesQuery.error.message
            : 'Retry the queue.'
        }
        emptyTitle="No retest or make-up records"
        emptyDescription="Requests created from saved marks will appear here for review."
        hasActiveFilters={Boolean(status || type)}
        noResultsTitle="No matching retest or make-up records"
        noResultsDescription="Try a different status or type filter."
        rowActions={(retake) => (
          <IconAction
            title="View retake details"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => setDetailId(retake.id)}
          />
        )}
      />

      <RetakeDetailDialog
        retake={detailQuery.data ?? null}
        isLoading={detailQuery.isLoading}
        error={
          detailQuery.isError
            ? detailQuery.error instanceof Error
              ? detailQuery.error.message
              : 'The retake detail could not be loaded.'
            : null
        }
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        onRetry={() => void detailQuery.refetch()}
        onAction={openAction}
      />

      <RetakeActionDialog
        target={target}
        form={form}
        setForm={setForm}
        error={formError}
        mutationError={
          actionMutation.isError
            ? actionMutation.error instanceof Error
              ? actionMutation.error.message
              : 'The lifecycle action could not be completed.'
            : null
        }
        isPending={actionMutation.isPending}
        onClose={() => setTarget(null)}
        onSubmit={submitAction}
      />
    </section>
  );
}

function RetakeDetailDialog({
  retake,
  isLoading,
  error,
  open,
  onClose,
  onRetry,
  onAction,
}: {
  retake: AssessmentRetakeSummary | null;
  isLoading: boolean;
  error: string | null;
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAction: (
    action: RetakeAction,
    retake: AssessmentRetakeSummary,
  ) => void;
}) {
  if (!open) return null;

  return (
    <Dialog open onOpenChange={(nextOpen: boolean) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assessment retake detail</DialogTitle>
          <DialogDescription>
            Current backend-owned lifecycle state and available commands.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto p-6">
          {isLoading ? (
            <LoadingState variant="skeleton" label="Loading retake detail" />
          ) : error ? (
            <ErrorState
              title="Could not load retake detail"
              message={error}
              onRetry={onRetry}
            />
          ) : retake ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">
                    {studentName(retake)}
                  </p>
                  <p className="text-sm text-slate-600">
                    {retake.subject?.name ?? 'Subject'} |{' '}
                    {retake.assessmentComponent?.name ?? 'Assessment'} |{' '}
                    {displayType(retake.type)}
                  </p>
                </div>
                <StatusBadge
                  status={retake.status}
                  tone={statusTone(retake.status)}
                />
              </div>

              <dl className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <DetailItem
                  label="Original result"
                  value={`${retake.originalMarks} | ${retake.originalStatus}`}
                />
                <DetailItem
                  label="Retake result"
                  value={
                    retake.attemptMarks === null
                      ? 'Not recorded'
                      : `${retake.attemptMarks} | ${displayDecision(
                          retake.resultDecision,
                        )}`
                  }
                />
                <DetailItem
                  label="Schedule"
                  value={
                    retake.scheduledStartsAt
                      ? `${formatBsDateTime(retake.scheduledStartsAt)}${
                          retake.room ? ` | ${retake.room}` : ''
                        }`
                      : 'Not scheduled'
                  }
                />
                <DetailItem
                  label="Exam term"
                  value={retake.examTerm?.name ?? retake.examTermId}
                />
              </dl>

              <DetailNote label="Request reason" value={retake.reason} />
              <DetailNote label="Review note" value={retake.reviewNote} />
              <DetailNote label="Attempt note" value={retake.attemptRemarks} />
              <DetailNote
                label="Result decision reason"
                value={retake.resultDecisionReason}
              />
              <DetailNote
                label="Cancellation reason"
                value={retake.cancellationReason}
              />

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                <RetakeActions retake={retake} onAction={onAction} />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function DetailNote({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{value}</p>
    </div>
  );
}

function RetakeActions({
  retake,
  onAction,
}: {
  retake: AssessmentRetakeSummary;
  onAction: (action: RetakeAction, retake: AssessmentRetakeSummary) => void;
}) {
  if (retake.status === 'REQUESTED') {
    return (
      <>
        <Button
          type="button"
          size="sm"
          onClick={() => onAction('approve', retake)}
        >
          <Check className="mr-1.5 h-4 w-4" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => onAction('reject', retake)}
        >
          <X className="mr-1.5 h-4 w-4" />
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAction('cancel', retake)}
        >
          <Ban className="mr-1.5 h-4 w-4" />
          Cancel
        </Button>
      </>
    );
  }

  if (retake.status === 'APPROVED' || retake.status === 'SCHEDULED') {
    return (
      <>
        <IconAction
          title={
            retake.status === 'SCHEDULED'
              ? 'Reschedule assessment'
              : 'Schedule assessment'
          }
          icon={<CalendarPlus className="h-4 w-4" />}
          onClick={() => onAction('schedule', retake)}
        />
        {retake.status === 'SCHEDULED' ? (
          <IconAction
            title="Record completed attempt"
            icon={<ClipboardCheck className="h-4 w-4" />}
            onClick={() => onAction('complete', retake)}
          />
        ) : null}
        <IconAction
          title="Cancel lifecycle"
          icon={<Ban className="h-4 w-4" />}
          onClick={() => onAction('cancel', retake)}
        />
      </>
    );
  }

  if (retake.status === 'COMPLETED') {
    return (
      <IconAction
        title="Apply result decision"
        icon={<ShieldCheck className="h-4 w-4" />}
        onClick={() => onAction('apply', retake)}
      />
    );
  }

  return <span className="px-2 py-1 text-xs text-slate-400">No actions</span>;
}

function IconAction({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip content={title}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-lg p-0"
        aria-label={title}
        onClick={onClick}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}

function RetakeActionDialog({
  target,
  form,
  setForm,
  error,
  mutationError,
  isPending,
  onClose,
  onSubmit,
}: {
  target: ActionTarget | null;
  form: ActionForm;
  setForm: React.Dispatch<React.SetStateAction<ActionForm>>;
  error: string | null;
  mutationError: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!target) return null;

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{actionTitle(target.action)}</DialogTitle>
          <DialogDescription className="mt-1">
            {studentName(target.retake)} |{' '}
            {target.retake.subject?.name ?? 'Subject'} |{' '}
            {displayType(target.retake.type)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto p-6">
          {target.action === 'approve' ? (
            <TextAreaField
              id="retake-review-note"
              label="Review note (optional)"
              value={form.note}
              onChange={(note) =>
                setForm((current) => ({ ...current, note }))
              }
            />
          ) : null}

          {target.action === 'reject' || target.action === 'cancel' ? (
            <TextAreaField
              id="retake-action-reason"
              label={
                target.action === 'reject'
                  ? 'Rejection reason'
                  : 'Cancellation reason'
              }
              value={form.reason}
              onChange={(reason) =>
                setForm((current) => ({ ...current, reason }))
              }
            />
          ) : null}

          {target.action === 'schedule' ? (
            <>
              <BsDateField
                label="Assessment date (BS)"
                value={form.dateBs}
                onChange={(dateBs) =>
                  setForm((current) => ({ ...current, dateBs }))
                }
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  id="retake-start-time"
                  label="Start time (NPT)"
                  type="time"
                  value={form.startsAt}
                  onChange={(startsAt) =>
                    setForm((current) => ({ ...current, startsAt }))
                  }
                />
                <InputField
                  id="retake-end-time"
                  label="End time (NPT)"
                  type="time"
                  value={form.endsAt}
                  onChange={(endsAt) =>
                    setForm((current) => ({ ...current, endsAt }))
                  }
                />
              </div>
              <InputField
                id="retake-room"
                label="Room (optional)"
                value={form.room}
                maxLength={120}
                onChange={(room) =>
                  setForm((current) => ({ ...current, room }))
                }
              />
            </>
          ) : null}

          {target.action === 'complete' ? (
            <>
              <InputField
                id="retake-marks"
                label={`Marks obtained (maximum ${target.retake.assessmentComponent?.maxMarks ?? '-'})`}
                type="number"
                min="0"
                max={String(
                  target.retake.assessmentComponent?.maxMarks ?? '',
                )}
                step="0.01"
                value={form.marksObtained}
                onChange={(marksObtained) =>
                  setForm((current) => ({ ...current, marksObtained }))
                }
              />
              <TextAreaField
                id="retake-attempt-note"
                label="Attempt note (optional)"
                value={form.note}
                onChange={(note) =>
                  setForm((current) => ({ ...current, note }))
                }
              />
            </>
          ) : null}

          {target.action === 'apply' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="retake-result-decision">
                  Result decision
                </Label>
                <Select
                  id="retake-result-decision"
                  value={form.decision}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      decision: event.target
                        .value as AssessmentRetakeResultDecision,
                    }))
                  }
                >
                  <option value="">Select a decision</option>
                  <option value="USE_RETAKE">Use retake score</option>
                  <option value="KEEP_ORIGINAL">Keep original score</option>
                </Select>
              </div>
              <TextAreaField
                id="retake-result-reason"
                label="Decision reason"
                value={form.reason}
                onChange={(reason) =>
                  setForm((current) => ({ ...current, reason }))
                }
              />
            </>
          ) : null}

          {error || mutationError ? (
            <p className="text-sm font-semibold text-rose-700" role="alert">
              {error ?? mutationError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onSubmit} isLoading={isPending}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InputField({
  id,
  label,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  id: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        {...props}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function validateAction(target: ActionTarget, form: ActionForm) {
  if (
    (target.action === 'reject' ||
      target.action === 'cancel' ||
      target.action === 'apply') &&
    form.reason.trim().length < 8
  ) {
    return 'Enter a clear reason using at least 8 characters.';
  }

  if (target.action === 'schedule') {
    try {
      const start = new Date(toUtcIso(form.dateBs, form.startsAt));
      const end = new Date(toUtcIso(form.dateBs, form.endsAt));
      if (end <= start) {
        return 'End time must be after start time.';
      }
    } catch {
      return 'Enter a valid BS date and both NPT times.';
    }
  }

  if (target.action === 'complete') {
    const marks = Number(form.marksObtained);
    const maxMarks = Number(
      target.retake.assessmentComponent?.maxMarks ?? Number.NaN,
    );
    if (
      !Number.isFinite(marks) ||
      marks < 0 ||
      !Number.isFinite(maxMarks) ||
      marks > maxMarks
    ) {
      return `Marks must be between 0 and ${Number.isFinite(maxMarks) ? maxMarks : 'the configured maximum'}.`;
    }
  }

  if (
    target.action === 'apply' &&
    form.decision !== 'KEEP_ORIGINAL' &&
    form.decision !== 'USE_RETAKE'
  ) {
    return 'Select whether to keep the original score or use the retake score.';
  }

  return null;
}

function toUtcIso(dateBs: string, time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error('Time must use HH:mm.');
  }
  const gregorian = toGregorianDateFromBs(parseBsDateInput(dateBs));
  return zonedNepalDateTimeToUtc({
    ...gregorian,
    hour: Number(match[1]),
    minute: Number(match[2]),
  }).toISOString();
}

function toTimeInput(value: Date) {
  const local = toNepalLocalDateTime(value);
  return `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}

function studentName(retake: AssessmentRetakeSummary) {
  if (!retake.student) return 'Student';
  return `${retake.student.firstNameEn} ${retake.student.lastNameEn}`.trim();
}

function displayType(type: AssessmentRetakeType) {
  return type === 'MAKE_UP' ? 'Make-up assessment' : 'Retest';
}

function displayStatus(status: AssessmentRetakeStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function displayDecision(decision: AssessmentRetakeResultDecision) {
  return decision === 'PENDING'
    ? 'Decision pending'
    : decision === 'USE_RETAKE'
      ? 'Retake score selected'
      : 'Original score retained';
}

function statusTone(status: AssessmentRetakeStatus) {
  if (status === 'REJECTED') return 'rejected' as const;
  if (status === 'APPLIED' || status === 'COMPLETED')
    return 'approved' as const;
  if (status === 'CANCELLED') return 'inactive' as const;
  if (status === 'APPROVED') return 'info' as const;
  return 'pending' as const;
}

function actionTitle(action: RetakeAction) {
  return {
    approve: 'Approve assessment request',
    reject: 'Reject assessment request',
    schedule: 'Schedule assessment attempt',
    complete: 'Record completed attempt',
    apply: 'Apply result decision',
    cancel: 'Cancel assessment lifecycle',
  }[action];
}

function successLabel(action: RetakeAction) {
  return {
    approve: 'Assessment request approved.',
    reject: 'Assessment request rejected.',
    schedule: 'Assessment schedule saved.',
    complete: 'Attempt score recorded for review.',
    apply: 'Result decision applied to the mark.',
    cancel: 'Assessment lifecycle cancelled.',
  }[action];
}
