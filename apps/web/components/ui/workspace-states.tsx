'use client';

import type { ReactNode } from 'react';
import { FileWarning, RotateCcw, SearchX } from 'lucide-react';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { PageState } from './page-state';

export type NoResultsStateProps = {
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
};

export function NoResultsState({
  title = 'No results found',
  description = 'Try changing or resetting the current filters.',
  onReset,
  resetLabel = 'Reset filters',
  className,
}: NoResultsStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<SearchX className="h-7 w-7" />}
      className={className}
      action={
        onReset ? (
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            {resetLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export type PartialFailureStateProps = {
  title?: string;
  description?: string;
  items?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function PartialFailureState({
  title = 'Some items need attention',
  description = 'The completed items remain available. Retry only the items that did not finish.',
  items,
  onRetry,
  retryLabel = 'Retry failed items',
  className,
}: PartialFailureStateProps) {
  return (
    <PageState
      tone="warning"
      title={title}
      description={description}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      className={className}
    >
      {items}
    </PageState>
  );
}

export type FileUnavailableStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function FileUnavailableState({
  title = 'Protected file unavailable',
  description = 'The record is available, but its protected file cannot be opened right now.',
  onRetry,
  retryLabel = 'Check again',
  className,
}: FileUnavailableStateProps) {
  return (
    <PageState
      tone="warning"
      title={title}
      description={description}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      className={className}
    >
      <span className="inline-flex items-center gap-2 rounded-md border border-warning-100 bg-white px-3 py-1 text-xs font-bold text-warning-800">
        <FileWarning className="h-3.5 w-3.5" />
        File Registry status unavailable
      </span>
    </PageState>
  );
}
