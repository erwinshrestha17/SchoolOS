'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { MarkSheetAction, MarkSheetSummary } from '@schoolos/core';
import { CheckCircle2, Lock, RotateCcw, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { ApiRequestError } from '../../lib/api/client';
import { schoolFacingErrorMessage } from '../../lib/school-facing-error';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { ReasonDialog } from '../ui/reason-dialog';
import { StatusBadge } from '../ui/status-badge';

const STATUS_LABEL: Record<MarkSheetSummary['status'], string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted for review',
  RETURNED: 'Returned for changes',
  RESUBMITTED: 'Resubmitted for review',
  REVIEWED: 'Reviewed',
  LOCKED: 'Locked',
};

/** Whether marks on this sheet can be typed into (server re-checks). */
export function isMarkSheetEditable(sheet: MarkSheetSummary | undefined) {
  return !sheet || sheet.status === 'DRAFT' || sheet.status === 'RETURNED';
}

function newIdempotencyKey() {
  return `web-${crypto.randomUUID()}`;
}

function sheetErrorMessage(error: unknown) {
  // Lifecycle conflicts carry a specific, school-facing server message
  // (incomplete sheet, someone else acted first, already locked).
  if (error instanceof ApiRequestError && error.statusCode === 409) {
    return error.message;
  }
  return schoolFacingErrorMessage(error, {
    fallback: 'The mark sheet could not be updated. Nothing was changed.',
    forbidden:
      'You are not allowed to take this step. The person who submitted marks cannot review or lock them.',
    notFound: 'This mark sheet is no longer available.',
  });
}

type PendingAction =
  | { kind: 'submit' }
  | { kind: 'review' }
  | { kind: 'lock' }
  | { kind: 'return' };

type Props = {
  sheets: MarkSheetSummary[];
  sectionNames: Record<string, string>;
  hasUnsavedChanges: boolean;
  queryKeys: ReadonlyArray<readonly unknown[]>;
};

/**
 * 6G lifecycle strip for the marks grid: one row per sheet (section) with
 * its state and only the actions the server says this user may take.
 */
export function MarkSheetPanel({
  sheets,
  sectionNames,
  hasUnsavedChanges,
  queryKeys,
}: Props) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{
    sheet: MarkSheetSummary;
    action: PendingAction;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: {
      sheet: MarkSheetSummary;
      action: PendingAction;
      reason?: string;
      idempotencyKey: string;
    }) => {
      const base = {
        expectedVersion: input.sheet.version,
        idempotencyKey: input.idempotencyKey,
      };
      if (input.action.kind === 'submit') {
        return api.submitMarkSheet(input.sheet.id, base);
      }
      return api.reviewMarkSheet(input.sheet.id, {
        ...base,
        action:
          input.action.kind === 'return'
            ? 'RETURN'
            : input.action.kind === 'review'
              ? 'REVIEW'
              : 'LOCK',
        ...(input.reason ? { reason: input.reason } : {}),
      });
    },
    onSuccess: () => {
      setError(null);
      setPending(null);
      for (const key of queryKeys) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
    onError: (cause) => {
      setPending(null);
      setError(sheetErrorMessage(cause));
      for (const key of queryKeys) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
  });

  // One key per confirmed intent, reused if the request is retried.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const run = (
    sheet: MarkSheetSummary,
    action: PendingAction,
    reason?: string,
  ) => {
    mutation.mutate(
      { sheet, action, reason, idempotencyKey },
      { onSettled: () => setIdempotencyKey(newIdempotencyKey()) },
    );
  };

  if (sheets.length === 0) return null;

  const can = (sheet: MarkSheetSummary, action: MarkSheetAction) =>
    sheet.authorization.capabilities[action];

  return (
    <section
      aria-label="Mark sheet status"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <ul className="divide-y divide-slate-100">
        {sheets.map((sheet) => {
          const sectionLabel = sheet.sectionId
            ? `Section ${sectionNames[sheet.sectionId] ?? ''}`.trim()
            : 'Whole class';
          const canSubmit = can(sheet, 'SUBMIT') || can(sheet, 'RESUBMIT');
          return (
            <li
              key={sheet.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-900">
                  {sectionLabel}
                </span>
                <StatusBadge
                  status={sheet.status}
                  label={STATUS_LABEL[sheet.status]}
                />
                {sheet.status === 'RETURNED' && sheet.returnReason ? (
                  <span className="text-xs text-slate-600">
                    Reviewer note: {sheet.returnReason}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSubmit ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={hasUnsavedChanges || mutation.isPending}
                    title={
                      hasUnsavedChanges
                        ? 'Save your changes before submitting.'
                        : undefined
                    }
                    onClick={() =>
                      setPending({ sheet, action: { kind: 'submit' } })
                    }
                  >
                    <Send className="h-4 w-4" />
                    {sheet.status === 'RETURNED'
                      ? 'Resubmit for review'
                      : 'Submit for review'}
                  </Button>
                ) : null}
                {can(sheet, 'RETURN') ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      setPending({ sheet, action: { kind: 'return' } })
                    }
                  >
                    <RotateCcw className="h-4 w-4" />
                    Return
                  </Button>
                ) : null}
                {can(sheet, 'REVIEW') ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      setPending({ sheet, action: { kind: 'review' } })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark reviewed
                  </Button>
                ) : null}
                {can(sheet, 'LOCK') ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() =>
                      setPending({ sheet, action: { kind: 'lock' } })
                    }
                  >
                    <Lock className="h-4 w-4" />
                    Lock marks
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {hasUnsavedChanges ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
          Unsaved changes stay on this page. Save them before submitting.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="border-t border-danger-100 bg-danger-50 px-4 py-2 text-sm text-danger-700"
        >
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        isOpen={
          pending?.action.kind === 'submit' ||
          pending?.action.kind === 'review' ||
          pending?.action.kind === 'lock'
        }
        title={
          pending?.action.kind === 'lock'
            ? 'Lock these marks?'
            : pending?.action.kind === 'review'
              ? 'Mark these marks as reviewed?'
              : 'Submit these marks for review?'
        }
        description={
          pending?.action.kind === 'lock'
            ? 'Locked marks can no longer be edited. Changes after locking need an approved correction or an unlock with a reason.'
            : pending?.action.kind === 'review'
              ? 'The sheet can then be locked. It can still be returned to the teacher before locking.'
              : 'You will not be able to edit these marks while they are under review. Every student needs a mark or an absent/withheld status.'
        }
        confirmLabel={
          pending?.action.kind === 'lock'
            ? 'Lock marks'
            : pending?.action.kind === 'review'
              ? 'Mark reviewed'
              : 'Submit'
        }
        isConfirming={mutation.isPending}
        onConfirm={() => {
          if (pending) run(pending.sheet, pending.action);
        }}
        onClose={() => setPending(null)}
      />
      <ReasonDialog
        isOpen={pending?.action.kind === 'return'}
        title="Return marks to the teacher?"
        description="The teacher can edit and resubmit. Say exactly what needs to change."
        confirmLabel="Return marks"
        reasonLabel="What needs to change"
        minLength={5}
        isConfirming={mutation.isPending}
        onConfirm={(reason) => {
          if (pending) run(pending.sheet, pending.action, reason);
        }}
        onClose={() => setPending(null)}
      />
    </section>
  );
}
