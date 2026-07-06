"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import {
  buildFilterHref,
  buildFilterQuery,
  parseUrlFilters,
  type FilterDefaults,
  type FilterValues,
} from "./url-filters";

/**
 * Keeps a list page's filters/pagination in the URL instead of local state,
 * so refreshing, using the browser back/forward buttons, or sharing a link
 * preserves exactly what the sender was looking at (e.g. "Fees → Overdue →
 * Grade 6, page 2"). Server-scoped values only — never use this to store
 * anything that should not be visible in a shared URL.
 *
 * Usage:
 *   const [filters, setFilters] = useUrlFilters({ page: 1, search: "", status: "" });
 *   setFilters({ search: "aarav" }, { resetPage: true });
 */
export function useUrlFilters<T extends FilterDefaults>(
  defaults: T,
): [
  FilterValues<T>,
  (updates: Partial<FilterValues<T>>, options?: { resetPage?: boolean }) => void,
] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const values = parseUrlFilters(defaults, searchParams);

  const setFilters = useCallback(
    (
      updates: Partial<FilterValues<T>>,
      options?: { resetPage?: boolean },
    ) => {
      const query = buildFilterQuery(
        defaultsRef.current,
        new URLSearchParams(currentQuery),
        updates,
        options,
      );
      const nextHref = buildFilterHref(pathname, currentQuery, query);

      if (!nextHref) {
        return;
      }

      router.replace(nextHref, {
        scroll: false,
      });
    },
    [currentQuery, pathname, router],
  );

  return [values, setFilters];
}
