'use client';

import { cn } from '../../lib/utils';

type NotificationBadgeProps = {
  count?: number;
  label?: string;
  className?: string;
};

export function NotificationBadge({ count = 0, label, className }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > 99 ? '99+' : String(count);

  return (
    <span
      className={cn(
        'inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1.5 text-[0.65rem] font-black leading-none text-white shadow-sm',
        className,
      )}
      aria-label={label ?? `${count} unread notifications`}
    >
      {display}
    </span>
  );
}
