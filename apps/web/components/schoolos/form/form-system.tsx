'use client';

import { useEffect, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormSectionStatus } from '@/lib/workspace-view-state';

/**
 * Phase 3G canonical form system (SCHOOLOS_WEB_DESIGN_ASTRA §5.1).
 *
 *   FormSection          structured grouping (fieldset + legend + help)
 *   FormSectionNav       in-page section navigation with per-section status
 *   StickyFormActions    sticky save/cancel bar with dirty + saving state
 *   useUnsavedChangesGuard  browser-level guard while a form is dirty
 *
 * Fields use the existing `FormField` (label, description, error, required,
 * aria wiring); destructive confirmation uses `ConfirmDialog`; searchable
 * selectors use `RemoteCombobox`. All are re-exported from
 * components/schoolos so there is one form vocabulary.
 *
 * Server validation remains authoritative: client validation only guides.
 * The save control never implies success before the server responds.
 */

export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  /** Stable id used by FormSectionNav anchors. */
  id: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      id={id}
      data-schoolos-ui="form-section"
      className={cn(
        'scroll-mt-24 space-y-4 border-t border-[var(--line)] pt-5 first:border-t-0 first:pt-0',
        className,
      )}
    >
      <legend className="float-left mb-1 w-full">
        <span className="text-card-title text-[var(--ink)]">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-helper text-[var(--muted)]">
            {description}
          </span>
        ) : null}
      </legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

export type FormSectionNavItem = {
  id: string;
  label: string;
  status?: FormSectionStatus;
};

const STATUS_LABEL: Record<FormSectionStatus, string> = {
  complete: 'complete',
  incomplete: 'incomplete',
  error: 'has errors',
};

export function FormSectionNav({
  items,
  activeId,
  label = 'Form sections',
}: {
  items: readonly FormSectionNavItem[];
  activeId?: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} data-schoolos-ui="form-section-nav">
      <ol className="space-y-1">
        {items.map((item) => {
          const Icon =
            item.status === 'error'
              ? AlertCircle
              : item.status === 'complete'
                ? CheckCircle2
                : Circle;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={item.id === activeId ? 'location' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-control px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                  item.id === activeId
                    ? 'bg-[var(--primary-soft)] font-semibold text-[var(--primary-dark)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]',
                )}
              >
                {item.status ? (
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className={cn(
                      item.status === 'error' && 'text-danger-600',
                      item.status === 'complete' && 'text-success-600',
                      item.status === 'incomplete' && 'text-slate-300',
                    )}
                  />
                ) : null}
                {item.label}
                {item.status ? (
                  <span className="sr-only">
                    {' '}
                    ({STATUS_LABEL[item.status]})
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StickyFormActions({
  dirty,
  saving,
  saveLabel = 'Save changes',
  savingLabel = 'Saving…',
  cancelLabel = 'Cancel',
  onCancel,
  saveDisabled,
  formId,
  status,
  className,
}: {
  dirty: boolean;
  saving: boolean;
  saveLabel?: string;
  savingLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  /** Additional disable reason (e.g. the projection disallows the action). */
  saveDisabled?: boolean;
  /** Associates the submit button with a <form id> outside this bar. */
  formId?: string;
  /** Server outcome text announced politely (e.g. "Saved", a server error). */
  status?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-schoolos-ui="sticky-form-actions"
      className={cn(
        'sticky bottom-0 z-10 -mx-gutter-compact flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-white/95 px-gutter-compact py-3 backdrop-blur md:-mx-gutter md:px-gutter',
        className,
      )}
    >
      <p aria-live="polite" className="text-sm text-[var(--muted)]">
        {status ??
          (dirty ? 'You have unsaved changes.' : 'No unsaved changes.')}
      </p>
      <div className="flex items-center gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-control items-center rounded-control border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          form={formId}
          disabled={!dirty || saving || saveDisabled}
          aria-busy={saving || undefined}
          className="inline-flex h-control items-center rounded-control bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Warns before the browser unloads a dirty form (refresh, close, external
 * navigation). In-app navigation away from a dirty form should confirm via
 * ConfirmDialog in the caller's cancel/back handler.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by some browsers to show the native prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
