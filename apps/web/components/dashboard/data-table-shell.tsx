'use client';

import { ReactNode } from 'react';
import { LoadingState } from './loading-state';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { cn } from '../../lib/utils';

interface DataTableShellProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: any;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}

export function DataTableShell({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle = "No records found",
  emptyDescription = "There is no data to show in this view right now.",
  emptyIcon,
  emptyAction,
  onRetry,
  children,
  className,
}: DataTableShellProps) {
  if (isLoading) {
    return <LoadingState variant="skeleton" className={className} />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load list"
        message="An error occurred while loading this workspace dataset. Please try again."
        error={error}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={cn("animate-in fade-in duration-300", className)}>
      {children}
    </div>
  );
}
