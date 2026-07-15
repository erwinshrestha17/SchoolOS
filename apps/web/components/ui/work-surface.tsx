import type { ComponentProps, ReactNode } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives/card';
import { cn } from '@/lib/utils';

export type WorkSurfaceVariant =
  | 'table'
  | 'queue'
  | 'form'
  | 'builder'
  | 'transaction'
  | 'grid'
  | 'monitoring';

export function WorkSurface({
  title,
  description,
  action,
  children,
  footer,
  variant = 'table',
  flush = false,
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'title' | 'children'> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: WorkSurfaceVariant;
  flush?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn('gap-0 overflow-hidden py-0 shadow-sm', className)}
      data-schoolos-ui="work-surface"
      data-variant={variant}
      {...props}
    >
      {title || description || action ? (
        <CardHeader className="gap-1 border-b border-border px-5 py-4">
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {description ? (
            <CardDescription className="max-w-3xl">{description}</CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(flush ? 'p-0' : 'p-5')}>{children}</CardContent>
      {footer ? <CardFooter className="border-t p-4">{footer}</CardFooter> : null}
    </Card>
  );
}
