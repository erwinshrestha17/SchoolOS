'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Filter } from 'lucide-react';

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function FilterBar({ children, className, label = 'Filters' }: FilterBarProps) {
  return (
    <div className={cn(
      "flex flex-wrap items-end gap-4 p-5 rounded-[2rem] bg-slate-50/50 border border-slate-100",
      className
    )}>
      <div className="flex items-center gap-2 mb-1 w-full lg:w-auto lg:mb-0 lg:mr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 shadow-sm">
          <Filter size={14} />
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3 flex-1">
        {children}
      </div>
    </div>
  );
}
