'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { resourceAccess } from '@/lib/resource-authorization';

/**
 * Phase 3C canonical Entity360 workspace (SCHOOLOS_WEB_DESIGN_ASTRA §11.2)
 * wired to the Phase 3A authorization contract.
 *
 *   Identity strip: name / code / status / context            Primary action
 *   ───────────────────────────────────────────────────────────────────────
 *   Tabs (only server-authorized sections)
 *   ───────────────────────────────────────────────────────────────────────
 *   Main content                                   Context / audit panel
 *
 * A tab is listed only when EVERY section it needs is present in the server
 * projection's `authorizedSections` (read with the shared fail-closed reader).
 * A missing/malformed/non-ENABLED projection therefore shows no protected
 * tabs. This is presentation only: the server already omitted denied section
 * data from the payload, and every action re-authorizes server-side.
 */
export type Entity360Tab<Section extends string = string> = {
  id: string;
  label: string;
  /** Sections the tab renders. Empty = identity-level tab, always listed. */
  sections: readonly Section[];
  badge?: ReactNode;
};

export function authorizedEntityTabs<Section extends string>(
  authorization: unknown,
  tabs: readonly Entity360Tab<Section>[],
): Entity360Tab<Section>[] {
  const access = resourceAccess<string, Section>(authorization);
  return tabs.filter((tab) =>
    tab.sections.every((section) => access.sees(section)),
  );
}

export type Entity360Props<Section extends string = string> = {
  name: ReactNode;
  code?: ReactNode;
  status?: ReactNode;
  context?: ReactNode;
  avatar?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  authorization: unknown;
  tabs: readonly Entity360Tab<Section>[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  /** Rendered content for the active (authorized) tab. */
  children: ReactNode;
  contextPanel?: ReactNode;
  className?: string;
};

export function Entity360<Section extends string = string>({
  name,
  code,
  status,
  context,
  avatar,
  primaryAction,
  secondaryActions,
  authorization,
  tabs,
  activeTabId,
  onTabChange,
  children,
  contextPanel,
  className,
}: Entity360Props<Section>) {
  const visibleTabs = authorizedEntityTabs(authorization, tabs);
  const active =
    visibleTabs.find((tab) => tab.id === activeTabId) ?? visibleTabs[0];
  const baseId = useId();

  return (
    <div data-schoolos-ui="entity-360" className={cn('space-y-5', className)}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {avatar}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title text-[var(--ink)]">{name}</h1>
              {status}
            </div>
            {code || context ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {code}
                {code && context ? ' · ' : null}
                {context}
              </p>
            ) : null}
          </div>
        </div>
        {primaryAction || secondaryActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </header>

      {visibleTabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Record sections"
          className="flex gap-1 overflow-x-auto border-b border-[var(--line)]"
        >
          {visibleTabs.map((tab) => {
            const selected = tab.id === active?.id;
            return (
              <button
                key={tab.id}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
                    return;
                  event.preventDefault();
                  const index = visibleTabs.findIndex((t) => t.id === tab.id);
                  const next =
                    visibleTabs[
                      (index +
                        (event.key === 'ArrowRight' ? 1 : -1) +
                        visibleTabs.length) %
                        visibleTabs.length
                    ];
                  onTabChange(next.id);
                  document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
                }}
                className={cn(
                  '-mb-px inline-flex h-control items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                  selected
                    ? 'border-[var(--primary)] text-[var(--ink)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]',
                )}
              >
                {tab.label}
                {tab.badge}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={cn(
          contextPanel && 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]',
        )}
      >
        <div
          id={`${baseId}-panel`}
          role={visibleTabs.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={
            visibleTabs.length > 1 && active
              ? `${baseId}-tab-${active.id}`
              : undefined
          }
          className="min-w-0"
        >
          {active ? children : null}
        </div>
        {contextPanel ? <div className="min-w-0">{contextPanel}</div> : null}
      </div>
    </div>
  );
}
