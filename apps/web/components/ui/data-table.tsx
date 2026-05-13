'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LoadingState } from './loading-state';
import { EmptyState } from './empty-state';
import { PageState } from './page-state';

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
    <div className={cn('overflow-x-auto rounded-2xl border border-slate-100 bg-white', className)}>
      <table className={cn('w-full border-collapse text-left text-sm', tableClassName)}>
        <thead className="border-b border-slate-100 bg-slate-50/50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn(
                  'px-6 py-4 text-[0.7rem] font-bold uppercase tracking-wider text-slate-500',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((item, rowIndex) => (
            <tr
              key={getRowKey?.(item, rowIndex) ?? rowIndex}
              onClick={() => onRowClick?.(item)}
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
                    className={cn('px-6 py-4 text-slate-700', column.className)}
                  >
                    {column.cell ? column.cell(item, rowIndex) : String(value ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
