'use client';

import { ReactNode } from 'react';
import { Button, ButtonProps } from '../ui/button';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface PageActionButtonProps extends Omit<ButtonProps, 'children'> {
  label?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
  ariaLabel?: string;
  tooltip?: string;
}

export function PageActionButton({
  label,
  icon: Icon,
  iconPosition = 'left',
  children,
  ariaLabel,
  tooltip,
  className,
  ...props
}: PageActionButtonProps) {
  const content = children || label;
  const fallbackAriaLabel = typeof content === 'string' ? content : undefined;

  return (
    <Button
      className={cn("gap-2 font-bold transition-all duration-200 active:scale-[0.98]", className)}
      aria-label={ariaLabel || fallbackAriaLabel}
      title={tooltip || ariaLabel || fallbackAriaLabel}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon size={16} className="shrink-0" />}
      {content}
      {Icon && iconPosition === 'right' && <Icon size={16} className="shrink-0" />}
    </Button>
  );
}
