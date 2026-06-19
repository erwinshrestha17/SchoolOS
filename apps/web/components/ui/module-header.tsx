'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { ActionMenu, type ActionMenuItem } from './action-menu';

export type ModuleHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  primaryAction?: ReactNode;
  moreActionItems?: ActionMenuItem[];
  metadata?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function ModuleHeader({
  title,
  description,
  eyebrow,
  primaryAction,
  moreActionItems,
  metadata,
  children,
  className,
}: ModuleHeaderProps) {
  const hasMoreActionItems = Boolean(moreActionItems?.length);

  return (
    <header
      className={cn(
        'mb-6 border-b border-slate-100 pb-5',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
          {metadata ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {metadata}
            </div>
          ) : null}
        </div>

        {(primaryAction || hasMoreActionItems) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {primaryAction}
            {hasMoreActionItems ? (
              <ActionMenu
                items={moreActionItems ?? []}
                label="Open more actions"
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                    More Actions
                  </Button>
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}
