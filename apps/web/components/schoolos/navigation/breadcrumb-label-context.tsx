'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { usePathname } from 'next/navigation';

type BreadcrumbLabelState = { pathname: string; label: string } | null;

const BreadcrumbLabelContext = createContext<{
  state: BreadcrumbLabelState;
  setState: Dispatch<SetStateAction<BreadcrumbLabelState>>;
} | null>(null);

/** Mounted once, globally — see app/providers.tsx. */
export function BreadcrumbLabelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BreadcrumbLabelState>(null);
  const value = useMemo(() => ({ state, setState }), [state]);
  return (
    <BreadcrumbLabelContext.Provider value={value}>
      {children}
    </BreadcrumbLabelContext.Provider>
  );
}

/**
 * Lets a detail page override the last breadcrumb segment with a real,
 * already-loaded record name (invoice number, student name, notice title)
 * instead of the route id or the generic "Detail" fallback. Pass
 * null/undefined while the record is still loading — the breadcrumb falls
 * back to its default label until then, never guessing.
 *
 * Keyed by the exact pathname it was set from, so navigating to a different
 * record (even one matching the same dynamic route) can never show a
 * stale label: SchoolBreadcrumbs only trusts a stored label when its
 * pathname still matches the current one.
 */
export function useBreadcrumbLabel(label: string | null | undefined) {
  const ctx = useContext(BreadcrumbLabelContext);
  const pathname = usePathname();

  useEffect(() => {
    if (!ctx || !pathname || !label) return;
    ctx.setState({ pathname, label });
    return () => {
      ctx.setState((current) =>
        current && current.pathname === pathname ? null : current,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, label]);
}

/** Used internally by SchoolBreadcrumbs. */
export function useCurrentBreadcrumbLabel(pathname: string | null) {
  const ctx = useContext(BreadcrumbLabelContext);
  if (!ctx?.state || ctx.state.pathname !== pathname) return undefined;
  return ctx.state.label;
}
