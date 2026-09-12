import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button as PrimitiveButton } from './primitives/button';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

const sizeClasses = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 px-3',
  lg: 'h-11 px-6',
  icon: 'h-10 w-10 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'default', isLoading, children, disabled, ...props },
  ref,
) {
  return (
    <PrimitiveButton
      ref={ref}
      variant={variant}
      size={size}
      className={cn('rounded-lg font-semibold', sizeClasses[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </PrimitiveButton>
  );
});
