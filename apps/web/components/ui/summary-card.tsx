'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/primitives/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives/card';
import { Skeleton } from '@/components/ui/primitives/skeleton';
import { cn } from '@/lib/utils';

export type SummaryTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'module';

export type SummaryCardProps = {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  status?: ReactNode;
  href?: string;
  loading?: boolean;
  tone?: SummaryTone;
  className?: string;
};

const iconTone: Record<SummaryTone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-info-100 bg-info-50 text-info-700',
  success: 'border-success-100 bg-success-50 text-success-700',
  warning: 'border-warning-100 bg-warning-50 text-warning-700',
  danger: 'border-danger-100 bg-danger-50 text-danger-700',
  module:
    'border-[color:var(--mod-border,var(--color-primary-100))] bg-[var(--mod-soft,var(--primary-soft))] text-[color:var(--mod-text,var(--primary-dark))]',
};

/**
 * Canonical SchoolOS decision summary. Tone is restricted to the small icon
 * treatment; the card surface, border, typography, and interaction remain
 * global so module colour never becomes a second design system. The
 * `module` tone resolves through the data-module scope for location-only
 * icon chips; semantic tones keep owning risk and status meaning.
 */
export function SummaryCard({
  label,
  value,
  description,
  icon,
  status,
  href,
  loading = false,
  tone = 'neutral',
  className,
}: SummaryCardProps) {
  const content = (
    <Card
      className={cn(
        'h-full min-h-36 gap-3 py-4 shadow-sm transition-colors duration-(--schoolos-motion-fast) ease-(--schoolos-motion-ease-out)',
        href && 'hover:bg-accent/25',
        className,
      )}
    >
      <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3 px-4">
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          {status ? <div className="mt-1">{status}</div> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4',
              iconTone[tone],
            )}
          >
            {icon}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-4">
        {loading ? (
          <Skeleton className="h-8 w-20" aria-label={`Loading ${label}`} />
        ) : value === 'Unavailable' ? (
          <Badge variant="outline" className="w-fit">
            Unavailable
          </Badge>
        ) : (
          <p className="break-words text-2xl font-semibold leading-8 tabular-nums text-foreground">
            {value}
          </p>
        )}
        {description ? (
          <CardDescription className="line-clamp-2 text-xs leading-5">
            {description}
          </CardDescription>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label={`${label}: ${loading ? 'Loading' : value}${description ? `. ${description}` : ''}`}
    >
      {content}
    </Link>
  );
}

export function SummaryGrid({
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        className,
        'grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
      )}
      data-schoolos-ui="summary-grid"
      {...props}
    >
      {children}
    </div>
  );
}
