'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

type TooltipProps = {
  content: ReactNode;
  children: ReactElement;
  side?: TooltipSide;
  className?: string;
};

const sidePositionClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/**
 * Lightweight, dependency-free tooltip. Shows on hover AND keyboard focus so
 * icon-only controls stay accessible without a mouse, and links the trigger
 * via aria-describedby so screen readers announce it too.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(
    children as ReactElement<Record<string, unknown>>,
    {
      'aria-describedby': content ? tooltipId : undefined,
      onMouseEnter: (event: React.MouseEvent) => {
        (children.props as { onMouseEnter?: (e: React.MouseEvent) => void }).onMouseEnter?.(event);
        setVisible(true);
      },
      onMouseLeave: (event: React.MouseEvent) => {
        (children.props as { onMouseLeave?: (e: React.MouseEvent) => void }).onMouseLeave?.(event);
        setVisible(false);
      },
      onFocus: (event: React.FocusEvent) => {
        (children.props as { onFocus?: (e: React.FocusEvent) => void }).onFocus?.(event);
        setVisible(true);
      },
      onBlur: (event: React.FocusEvent) => {
        (children.props as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(event);
        setVisible(false);
      },
    },
  );

  return (
    <span className="relative inline-flex">
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg transition-opacity duration-100',
          sidePositionClasses[side],
          visible ? 'opacity-100' : 'opacity-0',
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
