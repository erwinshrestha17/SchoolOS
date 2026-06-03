'use client';

import React, { ReactNode, FormEvent } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit?: (e: FormEvent) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  className?: string;
}

export function FormDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  className,
}: FormDialogProps) {
  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
      </DialogHeader>
      
      <div className={cn("p-6 overflow-y-auto flex-1", className)}>
        {children}
      </div>

      <DialogFooter className="gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        {onSubmit && (
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        )}
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {onSubmit ? (
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          {content}
        </form>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {content}
        </div>
      )}
    </Dialog>
  );
}
