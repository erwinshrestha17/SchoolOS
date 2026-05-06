'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ 
  label, 
  description, 
  children,
  className
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  );
}
