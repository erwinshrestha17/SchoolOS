'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  Dialog as PrimitiveDialog,
  DialogContent as PrimitiveDialogContent,
  DialogDescription as PrimitiveDialogDescription,
  DialogFooter as PrimitiveDialogFooter,
  DialogHeader as PrimitiveDialogHeader,
  DialogTitle as PrimitiveDialogTitle,
} from './primitives/dialog';

export { DialogClose, DialogTrigger } from './primitives/dialog';
export const Dialog = PrimitiveDialog;

function hasDescription(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return false;
    return child.type === DialogDescription || child.type === PrimitiveDialogDescription || hasDescription(child.props.children);
  });
}

/** Keep the established padded header/body/footer layout on the Radix modal. */
export function DialogContent({
  children,
  className,
  showCloseButton = false,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof PrimitiveDialogContent>) {
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  return (
    <PrimitiveDialogContent
      className={cn(
        'flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-y-auto rounded-xl bg-[var(--surface)] p-0',
        className,
      )}
      showCloseButton={showCloseButton}
      {...(!hasDescription(children) ? { 'aria-describedby': undefined } : {})}
      {...props}
      onOpenAutoFocus={(event) => {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        onOpenAutoFocus?.(event);
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented && returnFocusRef.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus();
        }
      }}
      onPointerDownOutside={(event) => {
        // Existing operational forms never dismissed on a background click.
        // Keep that data-preserving default; explicit handlers may opt in.
        if (onPointerDownOutside) onPointerDownOutside(event);
        else event.preventDefault();
      }}
    >
      {children}
    </PrimitiveDialogContent>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<typeof PrimitiveDialogHeader>) {
  return <PrimitiveDialogHeader className={cn('shrink-0 border-b border-border p-5 text-left', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof PrimitiveDialogTitle>) {
  return <PrimitiveDialogTitle className={cn('text-lg font-semibold leading-6 text-foreground', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof PrimitiveDialogDescription>) {
  return <PrimitiveDialogDescription className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<typeof PrimitiveDialogFooter>) {
  return <PrimitiveDialogFooter className={cn('shrink-0 border-t border-border bg-[var(--hover-subtle)] p-5', className)} {...props} />;
}
