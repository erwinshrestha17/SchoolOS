'use client';

import { useCallback, type ReactNode, type RefObject } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { useUrlFilters } from '@/lib/hooks/use-url-filters';
import {
  parseInspectorId,
  type InspectorSize,
} from '@/lib/workspace-view-state';

/**
 * Phase 3F canonical Inspector (SCHOOLOS_WEB_DESIGN_ASTRA §5.1, §5.3, §11.1).
 *
 * Contextual right-side detail for routine review. It is the shared Drawer
 * (portal, focus trap, Escape, inert background, focus return) at the
 * Design System v2 inspector widths: sm ≈360px, md ≈440px, lg ≈560px.
 *
 * List state is preserved because the open record lives in the URL
 * (`?inspect=<id>` by default) alongside the list's filters and page, and is
 * opened/closed with `router.replace(..., { scroll: false })`: closing returns
 * to the exact filtered page and scroll position, and back/forward works.
 *
 * The inspector renders only what the caller fetched through the normal
 * authorized API. A forged id must surface that API's not-found/denied state.
 */

const SIZE_CLASSES: Record<InspectorSize, string> = {
  sm: 'max-w-inspector-sm',
  md: 'max-w-inspector-md',
  lg: 'max-w-inspector-lg',
};

export type InspectorProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: InspectorSize;
  footer?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function Inspector({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  returnFocusRef,
  children,
}: InspectorProps) {
  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      returnFocusRef={returnFocusRef}
      panelClassName={SIZE_CLASSES[size]}
    >
      <div data-schoolos-ui="inspector" data-inspector-size={size}>
        {children}
      </div>
    </Drawer>
  );
}

/**
 * URL-backed inspector state. `param` lets two inspectors coexist on one page.
 * Opening/closing never resets the list's page or filters.
 */
export function useInspectorState(param = 'inspect') {
  const [values, setValues] = useUrlFilters({ [param]: '' } as Record<
    string,
    string
  >);
  const inspectedId = parseInspectorId(values[param]);
  const openInspector = useCallback(
    (id: string) => {
      const safe = parseInspectorId(id);
      if (!safe) return;
      setValues({ [param]: safe }, { history: 'push' });
    },
    [param, setValues],
  );
  const closeInspector = useCallback(
    () => setValues({ [param]: '' }, { history: 'replace' }),
    [param, setValues],
  );
  return { inspectedId, openInspector, closeInspector };
}
