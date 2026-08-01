"use client";

import {
  isValidElement,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { formatBsDate } from "@schoolos/core";
import { cn } from "../../lib/utils";
import { MoneyDisplay } from "../ui/money-display";
import { Button } from "../ui/button";
import { PageState } from "../ui/page-state";

export type ReportTableCellValue =
  | string
  | number
  | boolean
  | null
  | ReactElement;

export type ReportTableCell = {
  value: ReportTableCellValue;
  type?: "text" | "currency" | "date";
  bold?: boolean;
  indent?: number;
  align?: "left" | "right" | "center";
  className?: string;
};

export type ReportTableColumn = {
  /** Stable contract key. It must not depend on the visible label or position. */
  id: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  width?: number;
};

export type ReportTableRow = {
  id: string;
  cells: Readonly<Record<string, ReportTableCell>>;
  isHeader?: boolean;
  isFooter?: boolean;
  className?: string;
  accessibleLabel?: string;
  onActivate?: () => void;
};

type ReportTableProps = {
  columns: readonly ReportTableColumn[];
  rows: readonly ReportTableRow[];
  loading?: boolean;
  error?: string | null;
  denied?: boolean;
  stale?: boolean;
  onRetry?: () => void;
  sort?: {
    columnId: string;
    direction: "asc" | "desc";
    onChange: (columnId: string, direction: "asc" | "desc") => void;
  };
  pagination?: {
    page: number;
    totalPages: number;
    totalRows: number;
    onPageChange: (page: number) => void;
  };
  hiddenColumnIds?: readonly string[];
  ariaLabel?: string;
};

export function ReportTable({
  columns,
  rows,
  loading = false,
  error,
  denied = false,
  stale = false,
  onRetry,
  sort,
  pagination,
  hiddenColumnIds = [],
  ariaLabel = "Financial report results",
}: ReportTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumnIds.includes(column.id)),
    [columns, hiddenColumnIds],
  );

  const handleGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    const currentCell = target.closest<HTMLElement>("[data-grid-cell]");
    if (!currentCell) return;

    const rowIndex = Number(currentCell.dataset.rowIndex);
    const columnIndex = Number(currentCell.dataset.columnIndex);
    let nextRow = rowIndex;
    let nextColumn = columnIndex;

    if (event.key === "ArrowDown") nextRow += 1;
    else if (event.key === "ArrowUp") nextRow -= 1;
    else if (event.key === "ArrowRight") nextColumn += 1;
    else if (event.key === "ArrowLeft") nextColumn -= 1;
    else if (event.key === "Home") nextColumn = 0;
    else if (event.key === "End") nextColumn = visibleColumns.length - 1;
    else return;

    const next = tableRef.current?.querySelector<HTMLElement>(
      `[data-grid-cell][data-row-index="${Math.max(0, nextRow)}"][data-column-index="${Math.max(0, nextColumn)}"]`,
    );
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  if (denied) {
    return (
      <PageState
        tone="warning"
        title="Financial records are restricted"
        description="Your current role does not have permission to view this financial report."
      />
    );
  }

  if (error) {
    return (
      <PageState
        tone="danger"
        title="Unable to load the financial report"
        description={error}
        actionLabel={onRetry ? "Retry report" : undefined}
        onAction={onRetry}
      />
    );
  }

  return (
    <div className="space-y-3">
      {stale ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
        >
          Showing the last available result while updated figures are loading.
        </p>
      ) : null}

      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table
          ref={tableRef}
          aria-label={ariaLabel}
          aria-busy={loading}
          aria-rowcount={pagination?.totalRows ?? rows.length}
          className="w-full min-w-max border-separate border-spacing-0 text-left text-sm"
          onKeyDown={handleGridKeyDown}
        >
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-50">
              {visibleColumns.map((column, columnIndex) => {
                const activeSort = sort?.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "relative border-b border-slate-200 bg-slate-50/95 px-4 py-3.5 text-[0.65rem] font-black uppercase tracking-widest text-slate-500 backdrop-blur-sm first:sticky first:left-0 first:z-30 first:border-r first:bg-slate-50",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                    )}
                    style={{ minWidth: column.width ?? 144 }}
                  >
                    {column.sortable && sort ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex w-full items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                          column.align === "right" && "justify-end",
                          column.align === "center" && "justify-center",
                        )}
                        onClick={() =>
                          sort.onChange(
                            column.id,
                            activeSort && sort.direction === "asc" ? "desc" : "asc",
                          )
                        }
                        aria-label={`Sort by ${column.label}${activeSort ? `, currently ${sort.direction}ending` : ""}`}
                      >
                        {column.label}
                        {activeSort ? (
                          sort.direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          )
                        ) : null}
                      </button>
                    ) : (
                      column.label
                    )}
                    <span
                      aria-hidden
                      className="absolute inset-y-1 right-0 w-1 cursor-col-resize resize-x overflow-hidden border-r border-transparent hover:border-slate-400"
                    />
                    <span className="sr-only">Column {columnIndex + 1}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading && rows.length === 0
              ? Array.from({ length: 5 }, (_, rowIndex) => (
                  <tr key={`loading-${rowIndex}`}>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        className="border-b border-slate-100 px-4 py-4 first:sticky first:left-0 first:bg-white"
                      >
                        <span className="block h-4 w-28 animate-pulse rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "group transition-colors hover:bg-slate-50/70 focus-within:bg-blue-50/50",
                      row.isHeader && "bg-slate-50/40",
                      row.isFooter &&
                        "sticky bottom-0 z-10 bg-slate-50 font-black text-slate-900 shadow-[0_-1px_0_#e2e8f0]",
                      row.onActivate && "cursor-pointer",
                      row.className,
                    )}
                    aria-label={row.accessibleLabel}
                    onDoubleClick={row.onActivate}
                  >
                    {visibleColumns.map((column, columnIndex) => {
                      const cell = row.cells[column.id];
                      const alignment = cell?.align ?? column.align ?? "left";
                      return (
                        <td
                          key={column.id}
                          tabIndex={rowIndex === 0 && columnIndex === 0 ? 0 : -1}
                          data-grid-cell
                          data-row-index={rowIndex}
                          data-column-index={columnIndex}
                          className={cn(
                            "whitespace-nowrap border-b border-slate-100 bg-inherit px-4 py-4 text-slate-600 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 first:sticky first:left-0 first:z-10 first:border-r first:bg-inherit",
                            cell?.bold && "font-bold text-slate-900",
                            cell?.className,
                            row.isFooter && "py-5 text-slate-900",
                            alignment === "right" && "text-right tabular-nums",
                            alignment === "center" && "text-center",
                          )}
                          style={{
                            paddingLeft: cell?.indent
                              ? `${cell.indent * 1.5 + 1.5}rem`
                              : undefined,
                          }}
                          onKeyDown={(event) => {
                            if (
                              row.onActivate &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault();
                              row.onActivate();
                            }
                          }}
                        >
                          <ReportCellContent cell={cell} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? (
          <div className="bg-white py-16 text-center" role="status">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-accent)]">
              <Calculator size={30} aria-hidden />
            </div>
            <p className="text-base font-bold text-slate-900">No records found</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Try adjusting the server filters or selecting a different fiscal period.
            </p>
          </div>
        ) : null}
      </div>

      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p aria-live="polite">
            Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.totalRows} rows
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportCellContent({ cell }: { cell?: ReportTableCell }) {
  if (!cell) return <span aria-hidden>—</span>;
  if (cell.type === "currency") {
    const numericValue =
      typeof cell.value === "string" || typeof cell.value === "number"
        ? Number(cell.value)
        : 0;
    return (
      <MoneyDisplay
        amount={typeof cell.value === "string" || typeof cell.value === "number" ? cell.value : "0"}
        className={cn("font-bold", numericValue < 0 && "text-rose-600")}
        mutedZero
      />
    );
  }
  if (cell.type === "date") {
    return (
      <span className="font-medium text-slate-500">
        {typeof cell.value === "string" ? formatBsDate(cell.value) : "Unavailable"}
      </span>
    );
  }
  if (isValidElement(cell.value)) return cell.value;
  return String(cell.value ?? "");
}
