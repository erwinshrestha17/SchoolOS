'use client';

import { useId, useState, type ReactNode } from 'react';
import { Columns3, RefreshCw, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { FilterChips, type FilterChip } from '@/components/ui/filter-chips';
import {
  PaginatedDataTable,
  type PaginatedDataTableProps,
} from '@/components/schoolos/data/paginated-data-table';
import {
  toggleHiddenColumn,
  type ColumnVisibilityOption,
  type WorkspaceDensity,
} from '@/lib/workspace-view-state';

/**
 * Phase 3E canonical DataWorkspace (SCHOOLOS_WEB_DESIGN_ASTRA §11.1).
 *
 *   Workspace header                              Primary action
 *   Secondary tabs / saved views
 *   Search + high-frequency filters + More filters
 *   Active filter chips
 *   ─────────────────────────────────────────────
 *   Table (PaginatedDataTable — the one grid)       Inspector
 *   ─────────────────────────────────────────────
 *   Selection / bulk actions / pagination
 *
 * Rules carried by construction:
 * - Rows, totals, sort, pagination and selection scope are server-owned
 *   (PaginatedDataTable). Bulk "all matching filter" is only offered when the
 *   caller wires a backend filter-scoped action.
 * - Search, filters, page, density, hidden columns and the open inspector
 *   are URL state (useUrlFilters / useInspectorState), so they survive
 *   refresh and back navigation.
 * - Export is a slot for a server-authorized export action; this component
 *   never assembles export data from loaded rows.
 * - Refresh shows its own in-flight state; a failed refresh keeps the last
 *   rows visible with an inline notice instead of blanking the page, and
 *   "unavailable" is never rendered as zero.
 */
/** Distributive so the server-paged / complete-list union survives. */
type WorkspaceTableProps<T> =
  PaginatedDataTableProps<T> extends infer P
    ? P extends unknown
      ? Omit<P, 'density' | 'hiddenColumnIds' | 'hasActiveFilters'>
      : never
    : never;

export type DataWorkspaceProps<T> = {
  title?: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  /** Secondary tabs / saved views. */
  views?: ReactNode;

  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    debounceMs?: number;
  };
  /** High-frequency filter controls rendered beside search. */
  filters?: ReactNode;
  /** Less frequent filters, disclosed on demand. */
  moreFilters?: ReactNode;
  chips?: FilterChip[];
  onClearFilters?: () => void;

  columnOptions?: readonly ColumnVisibilityOption[];
  hiddenColumnIds?: ReadonlySet<string>;
  onHiddenColumnIdsChange?: (hidden: Set<string>) => void;

  density?: WorkspaceDensity;
  onDensityChange?: (density: WorkspaceDensity) => void;

  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Set when a background refresh failed while earlier rows are shown. */
  refreshError?: string | null;
  /** Server-authorized export control (e.g. a queued export button). */
  exportAction?: ReactNode;

  table: WorkspaceTableProps<T>;
  /** Rendered Inspector for the currently inspected row, if any. */
  inspector?: ReactNode;
  className?: string;
};

export function DataWorkspace<T>({
  title,
  description,
  primaryAction,
  views,
  search,
  filters,
  moreFilters,
  chips = [],
  onClearFilters,
  columnOptions,
  hiddenColumnIds,
  onHiddenColumnIdsChange,
  density = 'standard',
  onDensityChange,
  onRefresh,
  isRefreshing = false,
  refreshError,
  exportAction,
  table,
  inspector,
  className,
}: DataWorkspaceProps<T>) {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const moreFiltersId = useId();
  const columnsId = useId();
  const hasActiveFilters =
    chips.length > 0 || Boolean(search?.value && search.value.trim() !== '');

  return (
    <section
      data-schoolos-ui="data-workspace"
      className={cn('space-y-4', className)}
    >
      {title || primaryAction ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-section text-[var(--ink)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-helper text-[var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {primaryAction ? (
            <div className="flex shrink-0 items-center gap-2">
              {primaryAction}
            </div>
          ) : null}
        </header>
      ) : null}

      {views ? <div>{views}</div> : null}

      <div
        role="search"
        className="flex flex-wrap items-center gap-2"
        aria-label="Filter records"
      >
        {search ? (
          <SearchInput
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            label={search.label}
            debounceMs={search.debounceMs ?? 300}
            className="min-w-[14rem] flex-1 sm:max-w-sm"
          />
        ) : null}
        {filters}
        {moreFilters ? (
          <button
            type="button"
            className="inline-flex h-control items-center gap-1.5 rounded-control border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-expanded={showMoreFilters}
            aria-controls={moreFiltersId}
            onClick={() => setShowMoreFilters((open) => !open)}
          >
            More filters
          </button>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {columnOptions && onHiddenColumnIdsChange ? (
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-control items-center gap-1.5 rounded-control border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                aria-expanded={showColumns}
                aria-controls={columnsId}
                onClick={() => setShowColumns((open) => !open)}
              >
                <Columns3 size={16} aria-hidden="true" />
                Columns
              </button>
              {showColumns ? (
                <fieldset
                  id={columnsId}
                  className="absolute right-0 z-20 mt-1 w-56 space-y-1 rounded-control border border-[var(--line)] bg-white p-2 shadow-popover max-sm:fixed max-sm:inset-x-4 max-sm:w-auto"
                >
                  <legend className="sr-only">Visible columns</legend>
                  {columnOptions.map((option) => {
                    const hideable = option.hideable !== false;
                    const checked = !hiddenColumnIds?.has(option.id);
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex items-center gap-2 rounded-chip px-2 py-1.5 text-sm',
                          hideable
                            ? 'cursor-pointer hover:bg-slate-50'
                            : 'text-[var(--muted)]',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={checked}
                          disabled={!hideable}
                          onChange={() =>
                            onHiddenColumnIdsChange(
                              toggleHiddenColumn(
                                hiddenColumnIds ?? new Set(),
                                option.id,
                                columnOptions,
                              ),
                            )
                          }
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
            </div>
          ) : null}
          {onDensityChange ? (
            <button
              type="button"
              className="inline-flex h-control items-center gap-1.5 rounded-control border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-pressed={density === 'compact'}
              onClick={() =>
                onDensityChange(density === 'compact' ? 'standard' : 'compact')
              }
            >
              <Rows3 size={16} aria-hidden="true" />
              Compact rows
            </button>
          ) : null}
          {exportAction}
          {onRefresh ? (
            <button
              type="button"
              className="inline-flex h-control items-center gap-1.5 rounded-control border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-busy={isRefreshing || undefined}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={cn(isRefreshing && 'motion-safe:animate-spin')}
              />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          ) : null}
        </div>
      </div>

      {moreFilters && showMoreFilters ? (
        <div
          id={moreFiltersId}
          className="flex flex-wrap items-center gap-2 rounded-control border border-[var(--line)] bg-slate-50 p-3"
        >
          {moreFilters}
        </div>
      ) : null}

      <FilterChips chips={chips} onClearAll={onClearFilters} />

      {refreshError ? (
        <p
          role="status"
          className="rounded-control border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning-text)]"
        >
          {refreshError} Showing the last loaded results.
        </p>
      ) : null}

      <PaginatedDataTable
        {...table}
        density={density}
        hiddenColumnIds={hiddenColumnIds}
        hasActiveFilters={hasActiveFilters}
      />

      {inspector}
    </section>
  );
}
