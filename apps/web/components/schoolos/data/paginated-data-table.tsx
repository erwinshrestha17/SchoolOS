'use client';

import { Fragment, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/primitives/table';
import { Checkbox } from '@/components/ui/primitives/checkbox';
import { Skeleton } from '@/components/ui/primitives/skeleton';
import { Button } from '@/components/ui/primitives/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageState } from '@/components/ui/page-state';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { ModuleLockedState } from '@/components/ui/module-locked-state';
import { TablePagination } from '@/components/ui/table-pagination';

export type SortDirection = 'asc' | 'desc';

export type PaginatedDataTableSort = {
  columnId: string;
  direction: SortDirection;
};

export type PaginatedDataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  headerClassName?: string;
  cellClassName?: string;
  /** Hide on narrow viewports instead of forcing a cramped table. */
  hideBelow?: 'sm' | 'md' | 'lg';
};

/**
 * Selection state is a discriminated union so callers can never accidentally
 * imply "all backend records" from a UI-only "select all on this page"
 * action. `all-matching-filter` is only reachable through
 * `onSelectAllMatchingFilter`, which the caller only wires up when the
 * backend actually supports a filter-scoped bulk operation.
 */
export type PaginatedDataTableSelection =
  | { mode: 'none' }
  | { mode: 'explicit'; ids: Set<string> }
  | { mode: 'all-matching-filter'; totalCount: number };

export type PaginatedDataTableStatus =
  | 'loading'
  | 'error'
  | 'permission-denied'
  | 'module-locked'
  | 'ready';

export type PaginatedDataTableProps<T> = {
  columns: PaginatedDataTableColumn<T>[];
  items: T[];
  getRowId: (row: T) => string;
  status?: PaginatedDataTableStatus;

  /** Server-owned pagination metadata — never inferred from loaded rows. */
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;

  sort?: PaginatedDataTableSort | null;
  onSortChange?: (sort: PaginatedDataTableSort | null) => void;

  selection?: PaginatedDataTableSelection;
  onSelectionChange?: (selection: PaginatedDataTableSelection) => void;
  /** Only pass this when the backend exposes a filter-scoped bulk action. */
  onSelectAllMatchingFilter?: () => void;
  bulkActions?: (selection: PaginatedDataTableSelection) => ReactNode;

  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** For master-detail layouts (row click selects detail) — not the checkbox `selection` state. */
  getRowClassName?: (row: T) => string | undefined;

  emptyTitle?: string;
  emptyDescription?: string;
  hasActiveFilters?: boolean;
  noResultsTitle?: string;
  noResultsDescription?: string;

  errorMessage?: string;
  onRetry?: () => void;

  moduleName?: string;
  moduleLockedDescription?: string;

  caption?: ReactNode;
  className?: string;
};

function alignClass(align: PaginatedDataTableColumn<unknown>['align']) {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

function hideClass(hideBelow: PaginatedDataTableColumn<unknown>['hideBelow']) {
  if (hideBelow === 'sm') return 'hidden sm:table-cell';
  if (hideBelow === 'md') return 'hidden md:table-cell';
  if (hideBelow === 'lg') return 'hidden lg:table-cell';
  return undefined;
}

function TableSkeletonRows({ columnCount, rows = 6 }: { columnCount: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnCount }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4 w-full max-w-40" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Server-driven data table for growing operational records (students,
 * invoices, staff, books, vehicles, notices, journals, ...). Renders every
 * required screen state explicitly instead of collapsing them into a single
 * loading/empty branch, and keeps row-selection scope unambiguous: "select
 * all" on this component only ever means the current page unless the caller
 * opts into a backend-confirmed filter-scoped bulk action.
 */
export function PaginatedDataTable<T>({
  columns,
  items,
  getRowId,
  status = 'ready',
  page,
  pageSize,
  totalItems,
  onPageChange,
  sort,
  onSortChange,
  selection,
  onSelectionChange,
  onSelectAllMatchingFilter,
  bulkActions,
  rowActions,
  onRowClick,
  getRowClassName,
  emptyTitle = 'No records yet',
  emptyDescription = 'Records will appear here once they exist.',
  hasActiveFilters = false,
  noResultsTitle = 'No matching records',
  noResultsDescription = 'Try adjusting or clearing your filters.',
  errorMessage = 'This list could not be loaded. Please try again.',
  onRetry,
  moduleName,
  moduleLockedDescription,
  caption,
  className,
}: PaginatedDataTableProps<T>) {
  if (status === 'permission-denied') {
    return <PermissionDenied showNavigation={false} />;
  }

  if (status === 'module-locked') {
    return <ModuleLockedState moduleName={moduleName} description={moduleLockedDescription} />;
  }

  if (status === 'error') {
    return (
      <PageState
        tone="danger"
        title="Unable to load this list"
        description={errorMessage}
        actionLabel={onRetry ? 'Retry' : undefined}
        onAction={onRetry}
      />
    );
  }

  const selectable = Boolean(selection && onSelectionChange);
  const selectedIds = selection?.mode === 'explicit' ? selection.ids : new Set<string>();
  const isAllMatchingFilterSelected = selection?.mode === 'all-matching-filter';

  const pageRowIds = items.map((row) => getRowId(row));
  const selectedOnPageCount = pageRowIds.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected =
    !isAllMatchingFilterSelected && pageRowIds.length > 0 && selectedOnPageCount === pageRowIds.length;
  const someOnPageSelected =
    !isAllMatchingFilterSelected && selectedOnPageCount > 0 && !allOnPageSelected;

  function toggleRow(id: string, checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(isAllMatchingFilterSelected ? [] : selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onSelectionChange(next.size === 0 ? { mode: 'none' } : { mode: 'explicit', ids: next });
  }

  function toggleAllOnPage(checked: boolean) {
    if (!onSelectionChange) return;
    if (!checked) {
      onSelectionChange({ mode: 'none' });
      return;
    }
    onSelectionChange({ mode: 'explicit', ids: new Set(pageRowIds) });
  }

  function toggleSort(columnId: string) {
    if (!onSortChange) return;
    if (!sort || sort.columnId !== columnId) {
      onSortChange({ columnId, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      onSortChange({ columnId, direction: 'desc' });
    } else {
      onSortChange(null);
    }
  }

  const selectionActive = Boolean(selection && selection.mode !== 'none');
  const selectedCount =
    selection?.mode === 'explicit'
      ? selection.ids.size
      : selection?.mode === 'all-matching-filter'
        ? selection.totalCount
        : 0;

  const showEmpty = status === 'ready' && items.length === 0 && !hasActiveFilters;
  const showNoResults = status === 'ready' && items.length === 0 && hasActiveFilters;

  return (
    <div className={cn('rounded-2xl border border-slate-100 bg-white', className)}>
      {selectionActive && bulkActions ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[var(--primary-soft)] px-4 py-2.5"
          role="status"
        >
          <p className="text-sm font-semibold text-[var(--primary-dark)]">
            {selectedCount} {selectedCount === 1 ? 'record' : 'records'} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">{bulkActions(selection!)}</div>
        </div>
      ) : null}

      {selectable &&
      !isAllMatchingFilterSelected &&
      allOnPageSelected &&
      totalItems > pageRowIds.length &&
      onSelectAllMatchingFilter ? (
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-sm text-slate-600">
          All {pageRowIds.length} records on this page are selected.{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onSelectAllMatchingFilter}>
            Select all {totalItems} records matching your filters
          </Button>
        </div>
      ) : null}

      {isAllMatchingFilterSelected ? (
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-sm text-slate-600">
          All {selection && selection.mode === 'all-matching-filter' ? selection.totalCount : totalItems}{' '}
          records matching your filters are selected.{' '}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => onSelectionChange?.({ mode: 'none' })}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <Table>
        {caption}
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllMatchingFilterSelected ? true : someOnPageSelected ? 'indeterminate' : allOnPageSelected}
                  onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
                  disabled={status === 'loading' || items.length === 0}
                  aria-label="Select all rows on this page"
                />
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const isSorted = sort?.columnId === column.id;
              return (
                <TableHead
                  key={column.id}
                  className={cn(alignClass(column.align), hideClass(column.hideBelow), column.headerClassName)}
                  aria-sort={isSorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortable && onSortChange ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 gap-1.5 px-3 font-medium text-foreground hover:bg-transparent hover:underline"
                      onClick={() => toggleSort(column.id)}
                    >
                      {column.header}
                      {isSorted ? (
                        sort!.direction === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
            {rowActions ? <TableHead className="w-10 text-right">More</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {status === 'loading' ? (
            <TableSkeletonRows columnCount={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} />
          ) : (
            items.map((row, index) => {
              const id = getRowId(row);
              const isSelected = isAllMatchingFilterSelected || selectedIds.has(id);
              return (
                <TableRow
                  key={id}
                  data-state={isSelected ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && 'cursor-pointer', getRowClassName?.(row))}
                >
                  {selectable ? (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        disabled={isAllMatchingFilterSelected}
                        onCheckedChange={(checked) => toggleRow(id, checked === true)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(alignClass(column.align), hideClass(column.hideBelow), column.cellClassName)}
                    >
                      {column.cell(row, index)}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      {rowActions(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {showEmpty ? <EmptyState title={emptyTitle} description={emptyDescription} className="border-0" /> : null}
      {showNoResults ? (
        <EmptyState title={noResultsTitle} description={noResultsDescription} className="border-0" />
      ) : null}

      {status === 'ready' && items.length > 0 ? (
        <TablePagination page={page} pageSize={pageSize} total={totalItems} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}
