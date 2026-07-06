'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  /**
   * Debounce onChange by this many milliseconds. Use for server-side
   * searches so a request is not fired on every keystroke.
   */
  debounceMs?: number;
};

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
  className,
  disabled,
  debounceMs,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!debounceMs || draft === value) return;
    const timeoutId = window.setTimeout(() => onChange(draft), debounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [draft, value, debounceMs, onChange]);

  const shownValue = debounceMs ? draft : value;
  const handleChange = (next: string) => {
    if (debounceMs) {
      setDraft(next);
    } else {
      onChange(next);
    }
  };

  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
        />
        <input
          type="search"
          value={shownValue}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
        {shownValue ? (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onChange('');
            }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </span>
    </label>
  );
}
