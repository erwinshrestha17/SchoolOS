'use client';

import React, { ReactNode, ComponentType } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ComponentType<{ size?: number; className?: string }> | ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) return <Inbox size={28} className="text-slate-400" />;
    
    // Check if icon is a React element
    if (React.isValidElement(icon)) {
      return icon;
    }
    
    // Otherwise treat as component type
    const IconComponent = icon as ComponentType<{ size?: number; className?: string }>;
    return <IconComponent size={28} className="text-slate-400" />;
  };

  return (
    <div
      className={cn(
        'flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/20 p-8 text-center animate-in fade-in duration-300',
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-500 shadow-sm">
        {renderIcon()}
      </div>
      <h3 className="text-lg font-bold text-slate-900 leading-snug">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
