'use client';

import { useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';

type ReasonDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirming?: boolean;
  minLength?: number;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

/**
 * A ConfirmDialog that additionally collects a required reason before the
 * confirm action is enabled — the shared pattern for reject/hide/archive
 * and other high-risk activity moderation actions.
 */
export function ReasonDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  isConfirming,
  minLength = 5,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Explain why this action is being taken.',
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');

  function handleClose() {
    setReason('');
    onClose();
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={destructive}
      isConfirming={isConfirming}
      confirmDisabled={reason.trim().length < minLength}
      onConfirm={() => onConfirm(reason.trim())}
      onClose={handleClose}
    >
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {reasonLabel}
        </span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          placeholder={reasonPlaceholder}
        />
        {reason.trim().length > 0 && reason.trim().length < minLength ? (
          <span className="mt-1 block text-xs font-semibold text-danger-600">
            At least {minLength} characters are required.
          </span>
        ) : null}
      </label>
    </ConfirmDialog>
  );
}
