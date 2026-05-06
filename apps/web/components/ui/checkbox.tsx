'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ 
  label, 
  checked, 
  onChange, 
  disabled,
  className 
}: CheckboxProps) {
  return (
    <label className={cn(
      "flex items-center gap-2 group",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      className
    )}>
      <div className={cn(
        "flex h-5 w-5 items-center justify-center rounded border transition-colors",
        checked 
          ? "bg-primary-500 border-primary-500 text-white" 
          : "border-slate-300 bg-white group-hover:border-primary-400"
      )}>
        {checked && <CheckCircle2 size={14} strokeWidth={3} />}
      </div>
      <input 
        type="checkbox" 
        className="hidden" 
        checked={checked} 
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      {label && <span className="text-sm text-slate-600 select-none font-medium">{label}</span>}
    </label>
  );
}
