'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/primitives/badge';
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
  activeValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  label?: string;
  /** @deprecated Module colour no longer controls workspace navigation. */
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

export function WorkspaceTabs({
  items,
  activeValue,
  onValueChange,
  className,
  label = 'Workspace views',
}: WorkspaceTabsProps) {
  const pathname = usePathname();
  const hasExactHref = items.some((item) => item.href === pathname);

  const isItemActive = (item: TabItem) => {
    if (onValueChange && item.value !== undefined) {
      return activeValue === item.value;
    }
    if (!item.href) return false;
    return (
      pathname === item.href ||
      (!hasExactHref &&
        item.href !== '/dashboard' &&
        pathname?.startsWith(`${item.href}/`))
    );
  };

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
                className="ml-1 min-w-5 justify-center px-1.5"
              >
                {item.count}
              </Badge>
            ) : null}
          </>
        );
        const itemClassName = cn(
          'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-(--schoolos-motion-fast) ease-(--schoolos-motion-ease-out) hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
          active && 'bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground',
        );

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
    </div>
  );
}

/** @deprecated Use WorkspaceTabs. */
export const ModuleTabs = WorkspaceTabs;
