import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

interface MarketingCardProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  initials?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info' | 'neutral' | 'phase2' | 'later';
  children?: React.ReactNode;
  className?: string;
}

export function MarketingCard({
  title,
  description,
  icon: Icon,
  initials,
  badge,
  badgeVariant = 'default',
  children,
  className,
}: MarketingCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-slate-250 bg-white p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between h-full space-y-4",
      className
    )}>
      <div className="space-y-3">
        {(Icon || initials || badge) && (
          <div className="flex justify-between items-start">
            {Icon && (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-150 text-slate-650 shadow-2xs">
                <Icon size={20} />
              </span>
            )}
            {!Icon && initials && (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50/80 border border-slate-200/60 font-black text-sm text-slate-650">
                {initials}
              </span>
            )}
            {badge && (
              <Badge variant={badgeVariant} className="text-[9px] uppercase tracking-wider font-bold">
                {badge}
              </Badge>
            )}
          </div>
        )}
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  );
}
