'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LoadingState } from './loading-state';
import { EmptyState } from './empty-state';

interface Column<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyTitle?: string;
  onRowClick?: (item: T) => void;
  getRowKey?: (item: T, index: number) => string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  emptyMessage = 'No data available',
  emptyTitle = 'No data found',
  onRowClick,
  getRowKey,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState label="Loading data..." />;
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load data"
        description={error}
      />
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-slate-100 bg-white", className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50/50 border-b border-slate-100">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn(
                  "px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[0.7rem]",
                  column.className
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
                "transition-colors hover:bg-slate-50/50",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((column, colIndex) => {
                const value = column.accessorKey ? (item as any)[column.accessorKey] : undefined;
                return (
                  <td
                    key={colIndex}
                    className={cn("px-6 py-4 text-slate-700", column.className)}
                  >
                    {column.cell ? column.cell(item) : String(value ?? '')}
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
