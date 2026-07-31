"use client";

import { X } from "lucide-react";

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type FilterChipsProps = {
  chips: FilterChip[];
  onClearAll?: () => void;
  /** Shown in the accessible label when chips are present. */
  activeCount?: number;
  className?: string;
};

/**
 * Removable active-filter chips for list workspaces. Pair with FilterBar
 * controls; chips reflect filters already applied in the URL or query state.
 */
export function FilterChips({
  chips,
  onClearAll,
  activeCount,
  className = "",
}: FilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  const count = activeCount ?? chips.length;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      data-schoolos-ui="filter-chips"
      role="group"
      aria-label={`${count} active filter${count === 1 ? "" : "s"}`}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary-dark)] transition-colors hover:bg-[var(--primary-soft)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          aria-label={`Remove filter: ${chip.label}`}
        >
          <span className="truncate">{chip.label}</span>
          <X size={14} aria-hidden="true" className="shrink-0 opacity-70" />
        </button>
      ))}
      {onClearAll && chips.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex min-h-9 items-center rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
