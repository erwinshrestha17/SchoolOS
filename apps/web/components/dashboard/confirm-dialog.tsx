'use client';

import { ConfirmDialog as UIConfirmDialog } from '../ui/confirm-dialog';

interface ConfirmDialogProps {
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
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return <UIConfirmDialog {...props} />;
}
