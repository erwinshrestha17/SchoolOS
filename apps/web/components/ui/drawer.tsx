'use client';

import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Panel width. Use 'lg' for record detail that includes tables or protected files. */
  width?: 'sm' | 'md' | 'lg';
  /** Focus target restored after the drawer closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const WIDTH_CLASSES: Record<NonNullable<DrawerProps['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
};

/**
 * A right-anchored slide-in panel for quick single-record inspection
 * (an invoice, an attendance exception, a notice's delivery status) without
 * leaving the list page behind it — per the design system's prescribed
 * "DetailDrawer for short record inspection, full route for complex
 * workflows" pattern. Use a full route instead of this for anything with
 * its own multi-step workflow (that belongs on its own page).
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  returnFocusRef,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const portalRootRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const explicitReturnFocus = returnFocusRef?.current ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const portalRoot = portalRootRef.current;
    const backgroundElements = Array.from(document.body.children)
      .filter((element) => element !== portalRoot)
      .map((element) => ({
        element: element as HTMLElement,
        inert: (element as HTMLElement).inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }));
    for (const { element } of backgroundElements) {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    }
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') &&
          element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !dialogRef.current.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialogRef.current.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const { element, inert, ariaHidden } of backgroundElements) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
      const focusTarget = explicitReturnFocus ?? previousFocusRef.current;
      if (focusTarget?.isConnected) focusTarget.focus();
    };
  }, [isOpen, returnFocusRef]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={portalRootRef} className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'sidebar-transition relative flex h-full w-full flex-col bg-white shadow-lg',
          WIDTH_CLASSES[width],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-black text-slate-950">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer ? (
          <footer className="border-t border-slate-200 bg-slate-50 p-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
