'use client';

import { MoreHorizontal, LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ActionMenuItem = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success';
};

type ActionMenuProps = {
  trigger?: ReactNode;
  items: ActionMenuItem[];
  label?: string;
  align?: 'left' | 'right';
  className?: string;
};

export function ActionMenu({
  trigger,
  items,
  label = 'Open actions',
  align = 'right',
  className,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className={cn('relative inline-flex', className)} ref={rootRef}>
      <div onClick={() => setOpen((current) => !current)}>
        {trigger || (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
            aria-label={label}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute top-11 z-30 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, idx) => (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                item.variant === 'danger'
                  ? 'text-rose-600 hover:bg-rose-50'
                  : item.variant === 'success'
                  ? 'text-emerald-600 hover:bg-emerald-50'
                  : 'text-slate-700 hover:bg-slate-50',
              )}
            >
              {item.icon && <span className="text-slate-400 group-hover:text-current">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
