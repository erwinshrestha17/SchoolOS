/**
 * Pure URL-filter-state logic, kept free of React/Next.js imports so it can
 * be unit-tested directly (see test/url-filters.test.mjs). `useUrlFilters`
 * in `use-url-filters.ts` is the thin React wrapper around this.
 *
 * The convention across this app's list pages was to hand-roll
 * "clone URLSearchParams, mutate, router.replace" in every page (see the
 * original apps/web/app/dashboard/finance/page.tsx). This factors that out
 * so every list page gets consistent, shareable-link, back-button-safe
 * filter state for free.
 */

export type FilterPrimitive = string | number;
export type FilterDefaults = Record<string, FilterPrimitive>;
export type FilterValues<T extends FilterDefaults> = { [K in keyof T]: T[K] };

/** Reads current filter values from the URL, falling back to `defaults` for any key not present. */
export function parseUrlFilters<T extends FilterDefaults>(
  defaults: T,
  searchParams: URLSearchParams,
): FilterValues<T> {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const raw = searchParams.get(key);
    if (raw === null) continue;
    const defaultValue = defaults[key as keyof T];
    if (typeof defaultValue === "number") {
      const parsed = Number(raw);
      (result as Record<string, FilterPrimitive>)[key] = Number.isFinite(parsed)
        ? parsed
        : defaultValue;
    } else {
      (result as Record<string, FilterPrimitive>)[key] = raw;
    }
  }
  return result;
}

/**
 * Builds the next query string for a filter update. A key is dropped from
 * the URL (not written as e.g. `page=1`) whenever the new value equals that
 * key's default, empty string, null, or undefined — keeping URLs clean and
 * matching the "no filter applied" state exactly.
 */
export function buildFilterQuery<T extends FilterDefaults>(
  defaults: T,
  currentSearchParams: URLSearchParams,
  updates: Partial<FilterValues<T>>,
  options?: { resetPage?: boolean; pageKey?: keyof T },
): string {
  const params = new URLSearchParams(currentSearchParams.toString());

  for (const key of Object.keys(updates)) {
    const value = (updates as Record<string, FilterPrimitive | undefined | null>)[
      key
    ];
    const defaultValue = defaults[key as keyof T];
    const isDefault =
      value === undefined ||
      value === null ||
      value === "" ||
      value === defaultValue;
    if (isDefault) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const pageKey = options?.pageKey ?? (("page" in defaults) ? "page" : undefined);
  if (options?.resetPage && pageKey && !(String(pageKey) in updates)) {
    params.delete(String(pageKey));
  }

  return params.toString();
}

/**
 * Returns the next client-navigation target, or null when the requested
 * filters already match the current URL. Next.js treats router.replace calls
 * to the current href as navigations, so callers must not issue a no-op
 * replace from an effect.
 */
export function buildFilterHref(
  pathname: string,
  currentQuery: string,
  nextQuery: string,
): string | null {
  if (nextQuery === currentQuery) {
    return null;
  }

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
