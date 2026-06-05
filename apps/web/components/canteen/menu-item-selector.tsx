'use client';

import { useState, useDeferredValue, useMemo } from 'react';
import { Search, Utensils, Check, X, Tag } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CanteenMenuItem } from '../../lib/canteen-api';

type MenuItemSelectorProps = {
  items: CanteenMenuItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
};

const moneyFormatter = new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 });

export function MenuItemSelector({
  items,
  selectedId,
  onSelect,
  label,
  placeholder = 'Select menu item...',
  className,
}: MenuItemSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId), [items, selectedId]);

  const filteredItems = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();
    if (!term) return items.filter(i => i.status === 'ACTIVE').slice(0, 10);
    return items
      .filter((i) => 
        i.name.toLowerCase().includes(term) || 
        i.category.toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [items, deferredSearch]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-[var(--color-mod-canteen-border)] focus:ring-2 focus:ring-[var(--color-mod-canteen-border)]/40',
            !selectedItem && 'text-slate-400'
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden text-left">
            <Utensils size={16} className="shrink-0 text-slate-400" />
            <span className="truncate font-medium">
              {selectedItem ? `${selectedItem.name} (${moneyFormatter.format(Number(selectedItem.unitPrice))})` : placeholder}
            </span>
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
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-md animate-in fade-in zoom-in-95">
              <div className="sticky top-0 mb-2 bg-white pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    autoFocus
                    className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-mod-canteen-border)] focus:bg-white"
                    placeholder="Search menu..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredItems.length === 1) {
                          onSelect(filteredItems[0].id);
                          setIsOpen(false);
                          setSearch('');
                        }
                      }
                    }}
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
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                      selectedId === item.id && 'bg-[var(--color-mod-canteen-bg)] text-[var(--color-mod-canteen-text)]'
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-mod-canteen-bg)] text-[var(--color-mod-canteen-text)]">
                      <Tag size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{item.name}</p>
                      <p className="text-[0.65rem] text-slate-500 font-medium">
                        {item.category} • {moneyFormatter.format(Number(item.unitPrice))}
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
