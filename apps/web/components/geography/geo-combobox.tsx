'use client';

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface GeoComboboxOption {
  id: number;
  label: string;
}

interface GeoComboboxProps {
  label: string;
  options: GeoComboboxOption[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  placeholder: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  id?: string;
  required?: boolean;
}

/**
 * Single searchable, keyboard-accessible dropdown shared by the three
 * cascading levels of NepalAddressSelector (Province / District / Local
 * Level). Implemented as a listbox popover rather than a full WAI-ARIA
 * combobox to match this codebase's existing selector baseline
 * (components/students/student-selector.tsx) while adding real keyboard
 * navigation and screen-reader roles on top of it.
 */
export function GeoCombobox({
  label,
  options,
  selectedId,
  onSelect,
  placeholder,
  disabled,
  isLoading,
  emptyMessage = 'No matches found',
  id,
  required,
}: GeoComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredSearch = useDeferredValue(search);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reactId = useId();
  const baseId = id ?? reactId;
  const listboxId = `${baseId}-listbox`;

  const selected = useMemo(
    () => options.find((o) => o.id === selectedId) ?? null,
    [options, selectedId],
  );

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, deferredSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [deferredSearch, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  function open() {
    if (disabled) return;
    setIsOpen(true);
    setSearch('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close(refocusTrigger = false) {
    setIsOpen(false);
    setSearch('');
    if (refocusTrigger) triggerRef.current?.focus();
  }

  function selectOption(option: GeoComboboxOption | null) {
    onSelect(option?.id ?? null);
    close(true);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) selectOption(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label htmlFor={baseId} className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          id={baseId}
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={label}
          disabled={disabled}
          onClick={() => (isOpen ? close() : open())}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]',
            !selected && 'text-slate-400',
            disabled && 'cursor-not-allowed bg-slate-50 text-slate-300',
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            {isLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            {selected && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(null);
                  }
                }}
                aria-label={`Clear ${label}`}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown size={14} className="text-slate-400" />
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="sticky top-0 mb-2 bg-white pb-2">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <input
                  ref={inputRef}
                  role="searchbox"
                  aria-label={`Search ${label.toLowerCase()}`}
                  aria-controls={listboxId}
                  aria-activedescendant={
                    filtered[activeIndex] ? `${baseId}-option-${filtered[activeIndex].id}` : undefined
                  }
                  className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--primary)] focus:bg-white"
                  placeholder="Type to search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onInputKeyDown}
                />
              </div>
            </div>
            <ul id={listboxId} role="listbox" aria-label={label} className="space-y-1">
              {isLoading && (
                <li className="px-3 py-6 text-center text-xs font-semibold text-slate-400">
                  Loading...
                </li>
              )}
              {!isLoading && filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-xs font-semibold text-slate-400">
                  {emptyMessage}
                </li>
              )}
              {!isLoading &&
                filtered.map((option, index) => (
                  <li
                    key={option.id}
                    id={`${baseId}-option-${option.id}`}
                    role="option"
                    aria-selected={option.id === selectedId}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
                        index === activeIndex && 'bg-slate-50',
                        option.id === selectedId &&
                          'bg-[var(--primary-soft)] text-[var(--primary-dark)]',
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {option.id === selectedId && <Check size={14} className="ml-auto shrink-0" />}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
