'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/primitives/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/primitives/dropdown-menu';
import { cn } from '@/lib/utils';

export interface TabItem {
  href?: string;
  value?: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface WorkspaceTabsProps {
  items: TabItem[];
  /**
   * Low-frequency destinations kept behind a "More" affordance so the visible
   * tab row stays within the ≤7 budget. Active-route detection still covers
   * these, so a workspace opened from the menu highlights the trigger.
   */
  overflowItems?: TabItem[];
  overflowLabel?: string;
  activeValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  label?: string;
  /** @deprecated Module colour is scope-driven via data-module; this prop is ignored. */
  accentColor?:
    | 'blue'
    | 'emerald'
    | 'indigo'
    | 'purple'
    | 'amber'
    | 'orange'
    | 'lime'
    | 'rose'
    | 'slate';
  /** @deprecated SchoolOS now has one neutral/primary workspace-tab style. */
  variant?: 'dark' | 'light';
}

export type ModuleTabsProps = WorkspaceTabsProps;

const activeTabClassName =
  'bg-[var(--mod-soft,var(--primary-soft))] text-[color:var(--mod-text,var(--primary-dark))] shadow-sm hover:text-[color:var(--mod-text,var(--primary-dark))]';

/**
 * Resolve which href owns the current route: an exact match wins, otherwise
 * the longest prefix match, so nested detail routes highlight their own
 * section instead of every ancestor tab at once.
 */
function resolveActiveHref(
  pathname: string | null,
  items: TabItem[],
): string | undefined {
  for (const item of items) {
    if (pathname === item.href) return item.href;
  }
  let bestHref: string | undefined;
  for (const item of items) {
    if (!item.href || item.href === '/dashboard') continue;
    if (pathname?.startsWith(`${item.href}/`)) {
      if (!bestHref || item.href.length > bestHref.length) {
        bestHref = item.href;
      }
    }
  }
  return bestHref;
}

export function WorkspaceTabs({
  items,
  overflowItems,
  overflowLabel = 'More',
  activeValue,
  onValueChange,
  className,
  label = 'Workspace views',
}: WorkspaceTabsProps) {
  const pathname = usePathname();
  const allItems = overflowItems?.length ? [...items, ...overflowItems] : items;
  const activeHref = resolveActiveHref(pathname, allItems);

  const isItemActive = (item: TabItem) => {
    if (onValueChange && item.value !== undefined) {
      return activeValue === item.value;
    }
    if (!item.href) return false;
    return item.href === activeHref;
  };

  const overflowActive = Boolean(
    overflowItems?.some((item) => item.href && item.href === activeHref),
  );

  const itemClassNameFor = (active: boolean) =>
    cn(
      'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-(--schoolos-motion-fast) ease-(--schoolos-motion-ease-out) hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
      // The active tab shares the module tint (soft background + dark
      // accent text) so tab, selected row, and active filter read as one
      // location signal; brand blue remains the unscoped fallback.
      active && activeTabClassName,
    );

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'scrollbar-none flex h-10 max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      data-schoolos-ui="workspace-tabs"
    >
      {items.map((item) => {
        const active = isItemActive(item);
        const Icon = item.icon;
        const content = (
          <>
            {Icon ? <Icon aria-hidden /> : null}
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 ? (
              <Badge
                variant={active ? 'default' : 'secondary'}
                className={cn(
                  'ml-1 min-w-5 justify-center px-1.5',
                  active &&
                    'bg-[var(--mod-accent,var(--primary))] text-white',
                )}
              >
                {item.count}
              </Badge>
            ) : null}
          </>
        );
        const itemClassName = itemClassNameFor(active);

        if (item.href) {
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              className={itemClassName}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.value ?? item.label}
            type="button"
            role="tab"
            aria-selected={active}
            className={itemClassName}
            onClick={() =>
              item.value !== undefined && onValueChange?.(item.value)
            }
          >
            {content}
          </button>
        );
      })}

      {overflowItems?.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={itemClassNameFor(overflowActive)}
            aria-label={`${overflowLabel} workspace views`}
            data-schoolos-ui="workspace-tabs-overflow"
          >
            <span>{overflowLabel}</span>
            <ChevronDown aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflowItems.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const inner = (
                <>
                  {Icon ? <Icon aria-hidden /> : null}
                  <span>{item.label}</span>
                </>
              );
              return (
                <DropdownMenuItem
                  key={item.href ?? item.value ?? item.label}
                  asChild={Boolean(item.href)}
                  className={cn(
                    active &&
                      'bg-[var(--mod-soft,var(--primary-soft))] text-[color:var(--mod-text,var(--primary-dark))]',
                  )}
                  onClick={
                    item.href
                      ? undefined
                      : () =>
                          item.value !== undefined && onValueChange?.(item.value)
                  }
                >
                  {item.href ? (
                    <Link href={item.href} aria-current={active ? 'page' : undefined}>
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/** @deprecated Use WorkspaceTabs. */
export const ModuleTabs = WorkspaceTabs;
