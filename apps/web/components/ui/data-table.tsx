'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LoadingState } from './loading-state';
import { EmptyState } from './empty-state';
import { PageState } from './page-state';
import { Button } from './button';

interface Column<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | Error | null;
  emptyMessage?: string;
  emptyTitle?: string;
  loadingLabel?: string;
  onRowClick?: (item: T) => void;
  getRowActionLabel?: (item: T, index: number) => string;
  getRowKey?: (item: T, index: number) => string;
  className?: string;
  tableClassName?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  emptyMessage = 'No data available',
  emptyTitle = 'No data found',
  loadingLabel = 'Loading data...',
  onRowClick,
  getRowActionLabel,
  getRowKey,
  className,
  tableClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState label={loadingLabel} />;
  }

  if (error) {
    const description = typeof error === 'string' ? error : error.message;

    return (
      <PageState
        tone="danger"
        title="Unable to load data"
        description={description || 'The requested data could not be loaded. Please try again.'}
        className={className}
      />
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} className={className} />;
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border bg-white', className)}>
      <table className={cn('w-full border-collapse text-left text-sm', tableClassName)}>
        <thead className="border-b border-border bg-[var(--hover-subtle)]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={cn(
                  'px-4 py-3 text-xs font-semibold text-muted-foreground',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {onRowClick ? <th scope="col" className="w-20 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Open</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((item, rowIndex) => (
            <tr
              key={getRowKey?.(item, rowIndex) ?? rowIndex}
              onClick={onRowClick ? (event) => {
                if (!(event.target instanceof Element) || event.target.closest('a, button, input, select, textarea, [role="button"], [role="checkbox"]')) return;
                onRowClick(item);
              } : undefined}
              className={cn(
                'transition-colors hover:bg-slate-50/50',
                onRowClick && 'cursor-pointer',
              )}
            >
              {columns.map((column, colIndex) => {
                const value = column.accessorKey
                  ? (item as Record<string, unknown>)[column.accessorKey as string]
                  : undefined;
                return (
                  <td
                    key={colIndex}
                    className={cn('px-4 py-3 text-slate-700', column.className)}
                  >
                    {column.cell ? column.cell(item, rowIndex) : String(value ?? '')}
                  </td>
                );
              })}
              {onRowClick ? (
                <td className="px-4 py-2 text-right">
                  <Button type="button" variant="ghost" size="sm" aria-label={getRowActionLabel?.(item, rowIndex) ?? `Open row ${rowIndex + 1}`} onClick={() => onRowClick(item)}>Open</Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
