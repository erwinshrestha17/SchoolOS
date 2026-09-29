/**
 * Phase 3E/3F/3G — pure presentation-state helpers for canonical workspaces.
 *
 * Everything here is viewer presentation state (column visibility, density,
 * which record the inspector shows, form dirtiness). None of it is authority:
 * the server still decides which rows, sections and actions exist.
 *
 * Values live in the URL (via useUrlFilters) so filters, pagination, the open
 * inspector and view options survive refresh and back/forward navigation.
 * Parsers are total and fail safe: unknown or malformed input falls back to
 * the default instead of throwing or inventing state.
 */

export type WorkspaceDensity = 'compact' | 'standard';

export function parseDensity(value: unknown): WorkspaceDensity {
  return value === 'compact' ? 'compact' : 'standard';
}

export type ColumnVisibilityOption = {
  id: string;
  label: string;
  /** Columns that identify the row (name, code) must stay visible. */
  hideable?: boolean;
};

/**
 * Parses a comma-separated hidden-column list. Unknown ids and columns that
 * are not hideable are ignored, so a stale or hand-edited URL can never hide
 * a row's identifying column or reference a column that no longer exists.
 */
export function parseHiddenColumns(
  value: unknown,
  options: readonly ColumnVisibilityOption[],
): Set<string> {
  if (typeof value !== 'string' || value.trim() === '') return new Set();
  const hideable = new Set(
    options.filter((option) => option.hideable !== false).map((o) => o.id),
  );
  return new Set(
    value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => hideable.has(id)),
  );
}

export function serializeHiddenColumns(hidden: ReadonlySet<string>): string {
  return [...hidden].sort().join(',');
}

export function toggleHiddenColumn(
  hidden: ReadonlySet<string>,
  columnId: string,
  options: readonly ColumnVisibilityOption[],
): Set<string> {
  const option = options.find((candidate) => candidate.id === columnId);
  const next = new Set(hidden);
  if (!option || option.hideable === false) return next;
  if (next.has(columnId)) next.delete(columnId);
  else next.add(columnId);
  // Never let the viewer hide every column.
  const visible = options.filter((candidate) => !next.has(candidate.id));
  return visible.length === 0 ? new Set(hidden) : next;
}

/* ------------------------------------------------------------------------ */
/* Inspector                                                                 */
/* ------------------------------------------------------------------------ */

export type InspectorSize = 'sm' | 'md' | 'lg';

/**
 * Inspector record ids come from the URL. Only opaque id-shaped values are
 * accepted; the inspector still fetches the record through the normal
 * authorized API, so a forged id yields that API's not-found/denied state.
 */
export function parseInspectorId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(trimmed) ? trimmed : null;
}

/* ------------------------------------------------------------------------ */
/* Forms                                                                     */
/* ------------------------------------------------------------------------ */

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          normalizeForCompare((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  // Treat empty string and null/undefined as the same "blank" value so a
  // touched-but-cleared optional field does not count as a change.
  if (value === undefined || value === null || value === '') return null;
  return value;
}

/** Names of fields whose value differs from the initial (server) value. */
export function changedFields<T extends Record<string, unknown>>(
  initial: T,
  current: T,
): string[] {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  return [...keys]
    .filter(
      (key) =>
        JSON.stringify(normalizeForCompare(initial[key])) !==
        JSON.stringify(normalizeForCompare(current[key])),
    )
    .sort();
}

export function isFormDirty<T extends Record<string, unknown>>(
  initial: T,
  current: T,
): boolean {
  return changedFields(initial, current).length > 0;
}

export type FormSectionStatus = 'complete' | 'incomplete' | 'error';

/** A section with any error is `error`; otherwise missing required → `incomplete`. */
export function formSectionStatus(input: {
  errors: number;
  missingRequired: number;
}): FormSectionStatus {
  if (input.errors > 0) return 'error';
  if (input.missingRequired > 0) return 'incomplete';
  return 'complete';
}
