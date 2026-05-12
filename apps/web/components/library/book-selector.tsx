'use client';

import { useState, useDeferredValue, useMemo } from 'react';
import { Search, Book, Check, X, Hash } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LibraryBook, LibraryCopy } from '../../lib/library-api';

type BookSelectorProps = {
  books?: LibraryBook[];
  copies?: LibraryCopy[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  mode?: 'book' | 'copy';
};

export function BookSelector({
  books = [],
  copies = [],
  selectedId,
  onSelect,
  label,
  placeholder = 'Search...',
  className,
  mode = 'book',
}: BookSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const selectedItem = useMemo(() => {
    if (mode === 'book') return books.find((b) => b.id === selectedId);
    return copies.find((c) => c.id === selectedId);
  }, [books, copies, selectedId, mode]);

  const filteredItems = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();
    if (mode === 'book') {
      if (!term) return books.slice(0, 10);
      return books
        .filter((b) => 
          b.title.toLowerCase().includes(term) || 
          (b.isbn ?? '').toLowerCase().includes(term) ||
          b.author.toLowerCase().includes(term)
        )
        .slice(0, 10);
    } else {
      if (!term) return copies.filter(c => c.status === 'AVAILABLE').slice(0, 10);
      return copies
        .filter((c) => 
          (c.barcode ?? '').toLowerCase().includes(term) || 
          (c.book?.title ?? '').toLowerCase().includes(term)
        )
        .slice(0, 10);
    }
  }, [books, copies, deferredSearch, mode]);

  const displayLabel = useMemo(() => {
    if (!selectedItem) return placeholder;
    if (mode === 'book') {
      const b = selectedItem as LibraryBook;
      return `${b.title} by ${b.author}`;
    } else {
      const c = selectedItem as LibraryCopy;
      return `${c.book?.title ?? 'Book'} (${c.barcode})`;
    }
  }, [selectedItem, mode, placeholder]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100',
            !selectedItem && 'text-slate-400'
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden text-left">
            {mode === 'book' ? <Book size={16} className="shrink-0 text-slate-400" /> : <Hash size={16} className="shrink-0 text-slate-400" />}
            <span className="truncate font-medium">{displayLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {selectedItem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <Search size={14} className="text-slate-400" />
          </div>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95">
              <div className="sticky top-0 mb-2 bg-white pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    autoFocus
                    className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-primary-200 focus:bg-white"
                    placeholder="Search catalogue..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50',
                      selectedId === item.id && 'bg-primary-50 text-primary-700'
                    )}
                  >
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      mode === 'book' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {mode === 'book' ? <Book size={16} /> : <Hash size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">
                        {mode === 'book' ? (item as LibraryBook).title : (item as LibraryCopy).book?.title}
                      </p>
                      <p className="text-[0.65rem] text-slate-500 font-medium">
                        {mode === 'book' 
                          ? `${(item as LibraryBook).author} • ISBN: ${(item as LibraryBook).isbn || 'N/A'}`
                          : `Barcode: ${(item as LibraryCopy).barcode} • Status: ${(item as LibraryCopy).status}`}
                      </p>
                    </div>
                    {selectedId === item.id && <Check size={14} className="ml-auto" />}
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs font-semibold text-slate-400">No items found</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
