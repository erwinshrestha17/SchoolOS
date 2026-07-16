'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { ActionMenu, type ActionMenuItem } from './action-menu';

export type ModuleHeaderProps = {
  breadcrumb?: ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  moreActionItems?: ActionMenuItem[];
  metadata?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function ModuleHeader({
  breadcrumb,
  title,
  description,
  eyebrow,
  primaryAction,
  secondaryActions,
  moreActionItems,
  metadata,
  children,
  className,
}: ModuleHeaderProps) {
  const hasMoreActionItems = Boolean(moreActionItems?.length);

  return (
    <header className={cn('border-b border-border pb-5', className)} data-schoolos-ui="module-header">
      {breadcrumb ? <div className="mb-3">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[color:var(--mod-text,var(--muted))]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
          {metadata ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {metadata}
            </div>
          ) : null}
        </div>

        {(primaryAction || secondaryActions || hasMoreActionItems) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {primaryAction}
            {secondaryActions}
            {hasMoreActionItems ? (
              <ActionMenu
                items={moreActionItems ?? []}
                label="Open more actions"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}
