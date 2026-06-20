'use client';

import { parseBsDateInput } from '@schoolos/core';

type BsDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function BsDateField({
  label,
  value,
  onChange,
  error,
  placeholder = '2083-01-01',
  disabled = false,
  required = false,
  className,
}: BsDateFieldProps) {
  return (
    <label className={className}>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        value={value}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        pattern="\d{4}-\d{2}-\d{2}"
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (!value.trim()) return;
          try {
            parseBsDateInput(value);
          } catch {
            // The caller owns visible validation state.
          }
        }}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100"
      />
      {error ? <p className="mt-1 text-xs font-semibold text-rose-700">{error}</p> : null}
    </label>
  );
}
