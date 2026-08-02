'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SidebarNavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  badge?: number | string;
  description?: string;
  variant?: 'light' | 'dark';
  disabled?: boolean;
  trailing?: ReactNode;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active = false,
  collapsed = false,
  badge,
  description,
  variant = 'light',
  disabled = false,
  trailing,
  onNavigate,
  className,
}: SidebarNavLinkProps) {
  if (variant === 'dark') {
    return (
      <DarkSidebarNavLink
        href={href}
        label={label}
        icon={Icon}
        active={active}
        description={description}
        disabled={disabled}
        onNavigate={onNavigate}
        className={className}
      />
    );
  }

  const content = (
    <>
      {active && !collapsed ? (
        <span
          className="absolute -left-3 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sidebar-active-indicator)]"
          aria-hidden="true"
        />
      ) : null}
      <Icon
        size={18}
        className={cn(
          'shrink-0 transition-colors',
          active
            ? 'text-[var(--sidebar-active-indicator)]'
            : 'text-[var(--sidebar-icon)] group-hover:text-[var(--ink)]',
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'sidebar-label min-w-0 flex-1 truncate font-semibold transition-all duration-200',
          collapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100',
        )}
      >
        {label}
      </span>
      {!collapsed && badge ? (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--sidebar-active-indicator)] px-1.5 text-[0.65rem] font-bold text-white">
          {badge}
        </span>
      ) : null}
      {!collapsed && trailing ? trailing : null}
    </>
  );

  const linkClassName = cn(
    'group relative flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-[0.8rem] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 focus:ring-offset-[var(--sidebar-bg)]',
    collapsed && 'justify-center px-0',
    active
      ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-label)]'
      : 'text-[var(--sidebar-label)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--ink)]',
    disabled && 'pointer-events-none opacity-55',
    className,
  );

  if (disabled) {
    return (
      <span
        className={linkClassName}
        aria-disabled="true"
        aria-label={collapsed ? label : undefined}
        title={collapsed ? label : undefined}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={linkClassName}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
    >
      {content}
    </Link>
  );
}

function DarkSidebarNavLink({
  href,
  label,
  icon: Icon,
  active = false,
  description,
  disabled = false,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  description?: string;
  disabled?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const linkClassName = cn(
    'platform-nav-item group focus:outline-none',
    active && 'platform-nav-item--active',
    disabled &&
      'cursor-not-allowed opacity-55 hover:bg-transparent hover:text-[var(--platform-sidebar-muted)]',
    className,
  );

  const content = (
    <>
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          active
            ? 'bg-white text-[var(--platform-sidebar-bg)]'
            : 'bg-white/5 text-[var(--platform-sidebar-muted)] group-hover:text-white',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description ? (
          <span
            className={cn(
              'mt-0.5 block text-xs leading-5',
              active
                ? 'text-white/80'
                : 'text-[var(--platform-sidebar-heading)] group-hover:text-[var(--platform-sidebar-muted)]',
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
    </>
  );

  if (disabled) {
    return (
      <button type="button" className={linkClassName} disabled aria-disabled="true">
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={linkClassName}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
    >
      {content}
    </Link>
  );
}

export function SidebarNavHeading({
  children,
  collapsed = false,
  className,
}: {
  children: ReactNode;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'sidebar-nav-heading truncate px-2.5 pb-1.5 pt-3 text-left text-[0.68rem] font-extrabold uppercase tracking-[0.06em] first:pt-0',
        collapsed && 'sr-only',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PlatformNavHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'platform-nav-heading px-3 pb-2 text-xs font-bold uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </p>
  );
}
