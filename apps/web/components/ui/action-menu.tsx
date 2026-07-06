'use client';

import { MoreHorizontal } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  ReactElement,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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

type MenuPosition = {
  top: number;
  left: number;
  transformOrigin: 'top' | 'bottom';
};

const MENU_MIN_WIDTH = 224;
const MENU_MARGIN = 12;

export function ActionMenu({
  trigger,
  items,
  label = 'Open actions',
  align = 'right',
  className,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastCloseWasKeyboardRef = useRef(false);

  const closeMenu = useCallback((restoreFocus = false) => {
    lastCloseWasKeyboardRef.current = restoreFocus;
    setOpen(false);
  }, []);

  const updatePosition = useCallback(() => {
    const triggerRect = rootRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const menuWidth = Math.max(menuRef.current?.offsetWidth ?? MENU_MIN_WIDTH, MENU_MIN_WIDTH);
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredLeft =
      align === 'right' ? triggerRect.right - menuWidth : triggerRect.left;
    const left = Math.min(
      Math.max(MENU_MARGIN, preferredLeft),
      Math.max(MENU_MARGIN, viewportWidth - menuWidth - MENU_MARGIN),
    );
    const spaceBelow = viewportHeight - triggerRect.bottom - MENU_MARGIN;
    const spaceAbove = triggerRect.top - MENU_MARGIN;
    const shouldFlip = menuHeight > 0 && spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const top = shouldFlip
      ? Math.max(MENU_MARGIN, triggerRect.top - menuHeight - 8)
      : Math.min(
          triggerRect.bottom + 8,
          Math.max(MENU_MARGIN, viewportHeight - menuHeight - MENU_MARGIN),
        );

    setPosition({
      top,
      left,
      transformOrigin: shouldFlip ? 'bottom' : 'top',
    });
  }, [align]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      if (lastCloseWasKeyboardRef.current) {
        lastCloseWasKeyboardRef.current = false;
        rootRef.current?.querySelector('button')?.focus();
      }
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    }

    updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [closeMenu, open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [items.length, open, updatePosition]);

  const handleTriggerClick = () => {
    setOpen((current) => !current);
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = itemRefs.current.filter(
      (item): item is HTMLButtonElement => Boolean(item && !item.disabled),
    );
    if (enabledItems.length === 0) return;

    const currentIndex = enabledItems.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      enabledItems[(currentIndex + 1 + enabledItems.length) % enabledItems.length]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      enabledItems[(currentIndex - 1 + enabledItems.length) % enabledItems.length]?.focus();
    }
    if (event.key === 'Home') {
      event.preventDefault();
      enabledItems[0]?.focus();
    }
    if (event.key === 'End') {
      event.preventDefault();
      enabledItems[enabledItems.length - 1]?.focus();
    }
  };

  const renderedTrigger = isValidElement(trigger) ? (
    cloneElement(trigger as ReactElement<Record<string, unknown>>, {
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-label': label,
      onClick: (event: React.MouseEvent) => {
        const existingOnClick = (trigger as ReactElement<{ onClick?: (event: React.MouseEvent) => void }>).props.onClick;
        existingOnClick?.(event);
        if (!event.defaultPrevented) handleTriggerClick();
      },
    })
  ) : (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)] focus-visible:ring-offset-2"
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={handleTriggerClick}
    >
      <MoreHorizontal size={18} />
    </button>
  );

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={handleMenuKeyDown}
            className="fixed z-[2147483647] min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              minWidth: MENU_MIN_WIDTH,
              maxWidth: `calc(100vw - ${MENU_MARGIN * 2}px)`,
              transformOrigin: position?.transformOrigin ?? 'top',
            }}
          >
            {items.map((item, idx) => (
              <button
                key={`${item.label}-${idx}`}
                ref={(node) => {
                  itemRefs.current[idx] = node;
                }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  closeMenu(true);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold leading-5 transition disabled:cursor-not-allowed disabled:opacity-50',
                  item.variant === 'danger'
                    ? 'text-rose-600 hover:bg-rose-50'
                    : item.variant === 'success'
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-slate-700 hover:bg-slate-50',
                  item.variant === 'danger' && idx > 0 ? 'mt-1 border-t border-slate-100 pt-3' : '',
                )}
              >
                {item.icon && <span className="shrink-0 text-slate-400">{item.icon}</span>}
                <span className="min-w-0 whitespace-normal">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn('relative inline-flex', className)} ref={rootRef}>
      {renderedTrigger}
      {menu}
    </div>
  );
}
