'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  StudentArchivePayload,
  StudentDeletePayload,
  StudentFeeClearance,
  StudentProfileDetail,
  StudentTransferPayload,
} from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  GraduationCap,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type LifecycleAction = 'transfer' | 'archive' | 'alumni' | 'delete';
type LifecycleRequest =
  | { action: 'transfer'; body: StudentTransferPayload }
  | { action: 'archive'; body: StudentArchivePayload }
  | { action: 'alumni'; body: StudentArchivePayload }
  | { action: 'delete'; body: StudentDeletePayload };

type LifecyclePanelProps = {
  profile: StudentProfileDetail;
  clearance: StudentFeeClearance | null;
  isCheckingClearance: boolean;
  onCheckClearance: () => void;
  onSelectAction: (action: LifecycleAction) => void;
  action: LifecycleAction | null;
  onCancelAction: () => void;
  onClose: () => void;
  onSubmit: (request: LifecycleRequest) => void;
  isSaving: boolean;
  error?: unknown;
  message: string;
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function LifecyclePanel({
  profile,
  clearance,
  isCheckingClearance,
  onCheckClearance,
  onSelectAction,
  action,
  onCancelAction,
  onClose,
  onSubmit,
  isSaving,
  error,
  message,
}: LifecyclePanelProps) {
  const status = profile.student.lifecycleStatus ?? 'ACTIVE';
  const active = status === 'ACTIVE';
  const hasCheckedClearance = clearance !== null;
  const hasOutstanding = clearance ? !clearance.cleared : false;
  const maySelectActiveAction = active && clearance?.cleared === true;
  const mayMarkAlumni = (status === 'EXITED' || status === 'TRANSFERRED') && clearance?.cleared === true;

  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [destinationSchool, setDestinationSchool] = useState('');
  const [conductRemark, setConductRemark] = useState('');
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);

  useEffect(() => {
    setReason('');
    setEffectiveDate('');
    setDestinationSchool('');
    setConductRemark('');
    setDeleteAcknowledged(false);
  }, [action]);

  function submitLifecycleAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !reason.trim() || isSaving || hasOutstanding || !clearance?.cleared) return;
    if (action === 'delete' && !deleteAcknowledged) return;

    if (action === 'transfer') {
      onSubmit({
        action,
        body: {
          reason: reason.trim(),
          destinationSchool: destinationSchool.trim() || null,
          conductRemark: conductRemark.trim() || null,
          exitedAt: effectiveDate || undefined,
        },
      });
      return;
    }

    if (action === 'delete') {
      onSubmit({
        action,
        body: { reason: reason.trim(), deletedAt: effectiveDate || undefined },
      });
      return;
    }

    onSubmit({
      action,
      body: { reason: reason.trim(), exitedAt: effectiveDate || undefined },
    });
  }

  return (
    <SectionCard
      title="Manage student lifecycle"
      description="Review fee clearance and record a reason before changing this student’s lifecycle status. Historical records remain preserved."
      headerAction={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          <X size={17} aria-hidden="true" />
          Close
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
            <p className="text-[0.68rem] font-black uppercase tracking-wider text-slate-500">Current status</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge className="border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-text)]">
                {formatLifecycleStatus(status)}
              </Badge>
              {!hasCheckedClearance ? (
                <button
                  type="button"
                  onClick={onCheckClearance}
                  disabled={isCheckingClearance}
                  className="text-sm font-bold text-[var(--color-mod-admissions-text)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCheckingClearance ? 'Checking fee clearance…' : 'Check fee clearance'}
                </button>
              ) : clearance?.cleared ? (
                <Badge variant="success">Fee clearance confirmed</Badge>
              ) : (
                <Badge variant="destructive">Outstanding {formatMoney(clearance?.outstandingAmount ?? 0)}</Badge>
              )}
            </div>
          </div>

          {!hasCheckedClearance ? (
            <div className="rounded-2xl border border-info-100 bg-info-50 p-5 text-sm text-info-800">
              Check fee clearance before starting a transfer, archive, alumni, or record-removal action.
            </div>
          ) : null}

          {hasOutstanding ? (
            <div className="flex gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-5 text-warning-800">
              <AlertTriangle size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">Lifecycle action blocked</p>
                <p className="mt-1 text-sm">Outstanding fees must be resolved before the student status can change.</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <LifecycleActionButton
              label="Transfer"
              description="Move to another school"
              icon={<ArrowRightLeft size={19} />}
              selected={action === 'transfer'}
              disabled={!maySelectActiveAction}
              onClick={() => onSelectAction('transfer')}
            />
            <LifecycleActionButton
              label="Archive"
              description="Keep history, hide inactive record"
              icon={<Archive size={19} />}
              selected={action === 'archive'}
              disabled={!maySelectActiveAction}
              onClick={() => onSelectAction('archive')}
            />
            <LifecycleActionButton
              label="Mark as alumni"
              description="For completed or exited students"
              icon={<GraduationCap size={19} />}
              selected={action === 'alumni'}
              disabled={!mayMarkAlumni}
              onClick={() => onSelectAction('alumni')}
            />
            <LifecycleActionButton
              label="Remove accidental record"
              description="Restricted, audited action"
              icon={<Trash2 size={19} />}
              selected={action === 'delete'}
              disabled={!maySelectActiveAction}
              danger
              onClick={() => onSelectAction('delete')}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          {message ? (
            <div className="flex gap-3 rounded-xl border border-success-200 bg-success-50 p-4 text-success-800">
              <CheckCircle2 size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">Lifecycle status updated</p>
                <p className="mt-1 text-sm">{message}</p>
              </div>
            </div>
          ) : action ? (
            <div className="space-y-4">
              {error ? (
                <div className="flex gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4 text-danger-800" role="alert">
                  <AlertTriangle size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Lifecycle action could not be completed</p>
                    <p className="mt-1 text-sm">
                      {error instanceof Error
                        ? error.message
                        : 'Please review the details and try again.'}
                    </p>
                  </div>
                </div>
              ) : null}
              <LifecycleReviewForm
                action={action}
                reason={reason}
                effectiveDate={effectiveDate}
                destinationSchool={destinationSchool}
                conductRemark={conductRemark}
                deleteAcknowledged={deleteAcknowledged}
                isSaving={isSaving}
                blocked={!clearance?.cleared || hasOutstanding}
                onReasonChange={setReason}
                onEffectiveDateChange={setEffectiveDate}
                onDestinationSchoolChange={setDestinationSchool}
                onConductRemarkChange={setConductRemark}
                onDeleteAcknowledgedChange={setDeleteAcknowledged}
                onCancel={onCancelAction}
                onSubmit={submitLifecycleAction}
              />
            </div>
          ) : (
            <div className="flex min-h-[18rem] flex-col items-center justify-center px-6 text-center">
              <ShieldAlert size={34} className="text-slate-300" aria-hidden="true" />
              <h4 className="mt-4 text-base font-bold text-slate-800">Choose a lifecycle action</h4>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Select an eligible action to review its impact, provide a reason, and submit the protected status change.
              </p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

type LifecycleReviewFormProps = {
  action: LifecycleAction;
  reason: string;
  effectiveDate: string;
  destinationSchool: string;
  conductRemark: string;
  deleteAcknowledged: boolean;
  isSaving: boolean;
  blocked: boolean;
  onReasonChange: (value: string) => void;
  onEffectiveDateChange: (value: string) => void;
  onDestinationSchoolChange: (value: string) => void;
  onConductRemarkChange: (value: string) => void;
  onDeleteAcknowledgedChange: (value: boolean) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function LifecycleReviewForm({
  action,
  reason,
  effectiveDate,
  destinationSchool,
  conductRemark,
  deleteAcknowledged,
  isSaving,
  blocked,
  onReasonChange,
  onEffectiveDateChange,
  onDestinationSchoolChange,
  onConductRemarkChange,
  onDeleteAcknowledgedChange,
  onCancel,
  onSubmit,
}: LifecycleReviewFormProps) {
  const actionLabel = lifecycleActionLabel(action);
  const isDelete = action === 'delete';

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-wider text-slate-500">Review action</p>
        <h4 className={cn('mt-2 text-xl font-black', isDelete ? 'text-danger-700' : 'text-slate-950')}>{actionLabel}</h4>
        <p className="mt-2 text-sm leading-6 text-slate-500">{lifecycleActionDescription(action)}</p>
      </div>

      <label className="block">
        <span className="text-sm font-bold text-slate-800">Reason <span className="text-danger-600">*</span></span>
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          required
          rows={3}
          placeholder="Explain why this lifecycle change is needed."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-mod-admissions-accent)] focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-slate-800">Effective date <span className="font-normal text-slate-400">(optional)</span></span>
        <input
          type="date"
          value={effectiveDate}
          onChange={(event) => onEffectiveDateChange(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[var(--color-mod-admissions-accent)] focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
        />
      </label>

      {action === 'transfer' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Destination school <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              value={destinationSchool}
              onChange={(event) => onDestinationSchoolChange(event.target.value)}
              placeholder="School name"
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-mod-admissions-accent)] focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-800">Conduct remark <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              value={conductRemark}
              onChange={(event) => onConductRemarkChange(event.target.value)}
              placeholder="Optional remark"
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-mod-admissions-accent)] focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
            />
          </label>
        </div>
      ) : null}

      {isDelete ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          <input
            type="checkbox"
            checked={deleteAcknowledged}
            onChange={(event) => onDeleteAcknowledgedChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-danger-300 text-danger-600 focus:ring-danger-500"
          />
          <span>I understand this is a restricted, audited action and should only be used for an accidental record.</span>
        </label>
      ) : null}

      {blocked ? (
        <p className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm font-medium text-warning-800">
          Fee clearance is required before this action can be submitted.
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || blocked || !reason.trim() || (isDelete && !deleteAcknowledged)}
          className={cn(
            'min-h-11 rounded-xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60',
            isDelete ? 'bg-danger-600 hover:bg-danger-700' : 'bg-[var(--color-mod-admissions-accent)] hover:bg-[var(--color-mod-admissions-text)]',
          )}
        >
          {isSaving ? 'Saving…' : actionLabel}
        </button>
      </div>
    </form>
  );
}

function LifecycleActionButton({
  label,
  description,
  icon,
  selected,
  disabled,
  onClick,
  danger,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
        selected
          ? danger
            ? 'border-danger-300 bg-danger-50 text-danger-700 ring-2 ring-danger-100'
            : 'border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-text)] ring-2 ring-[var(--color-mod-admissions-border)]'
          : danger
            ? 'border-danger-100 bg-white text-danger-700 hover:bg-danger-50'
            : 'border-slate-200 bg-white text-slate-700 hover:border-[var(--color-mod-admissions-border)] hover:bg-slate-50',
      )}
    >
      <span>{icon}</span>
      <span>
        <span className="block text-sm font-black">{label}</span>
        <span className="mt-1 block text-xs font-medium opacity-80">{description}</span>
      </span>
    </button>
  );
}

function lifecycleActionLabel(action: LifecycleAction) {
  switch (action) {
    case 'transfer':
      return 'Transfer student';
    case 'archive':
      return 'Archive student';
    case 'alumni':
      return 'Mark as alumni';
    case 'delete':
      return 'Remove accidental record';
  }
}

function lifecycleActionDescription(action: LifecycleAction) {
  switch (action) {
    case 'transfer':
      return 'Record a transfer without removing the student’s historical attendance, fee, document, and academic records.';
    case 'archive':
      return 'Archive an inactive record while retaining the student history required for school operations and audit.';
    case 'alumni':
      return 'Use this after the student has exited or transferred and should be retained as part of the alumni record.';
    case 'delete':
      return 'This is only for an accidental record. Use transfer, archive, or alumni status for normal student lifecycle changes.';
  }
}

function formatLifecycleStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
