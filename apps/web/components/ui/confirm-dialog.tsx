'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirming?: boolean;
  variant?: 'default' | 'warning' | 'destructive';
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  variant,
  isConfirming,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl">
        <DialogHeader className="flex flex-row items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
            <AlertTriangle size={22} />
          </div>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="mt-1">{description}</DialogDescription>
          </div>
        </DialogHeader>

        {children}

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={() => onClose()}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={isConfirming}
            variant={variant === 'destructive' || destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {isConfirming ? 'Working...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
