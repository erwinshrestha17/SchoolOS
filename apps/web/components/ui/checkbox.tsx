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
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className={cn(
        "flex h-5 w-5 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary-soft)] peer-focus-visible:ring-offset-2",
        checked
          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
          : "border-slate-300 bg-white group-hover:border-[var(--primary)]"
      )}>
        {checked && <CheckCircle2 size={14} strokeWidth={3} />}
      </div>
      {label && <span className="text-sm text-slate-600 select-none font-medium">{label}</span>}
    </label>
  );
}
