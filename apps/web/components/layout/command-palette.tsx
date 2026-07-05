'use client';

import { FileText, Megaphone, Search, UserRound, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEntitlements } from '../entitlements-provider';
import { useRecentlyViewed } from '../../lib/hooks/use-recently-viewed';
import type { RecentlyViewedKind } from '../../lib/recently-viewed';
import { useSession } from '../session-provider';
import {
  canDisplayNavItem,
  dashboardNavGroups,
  settingsNavItem,
  type NavItem,
} from './sidebar';

const RECENT_KIND_ICON: Record<RecentlyViewedKind, LucideIcon> = {
  student: UserRound,
  invoice: FileText,
  notice: Megaphone,
};

type PaletteRow = {
  key: string;
  section: 'recent' | 'workspace';
  label: string;
  href: string;
  icon: LucideIcon;
};

const MAX_RECENT_ROWS = 5;

/**
 * Global Ctrl/Cmd+K jump-to palette. With an empty query it leads with
 * "Recently viewed" (the last few students/invoices/notices actually
 * opened, per lib/recently-viewed.ts) so staff can jump straight back
 * without re-searching, then lists workspaces below. Typing filters both.
 *
 * A "/" shortcut focuses the existing topbar student/invoice search instead
 * of duplicating it here — this palette is for "where do I need to be?",
 * the topbar search is for "which record?".
 */
export function CommandPalette() {
  const router = useRouter();
  const { session } = useSession();
  const { hasModule } = useEntitlements();
  const { entries: recentlyViewed } = useRecentlyViewed();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems = useMemo(() => {
    const flattened: NavItem[] = [
      ...dashboardNavGroups.flatMap((group) => group.items),
      settingsNavItem,
    ];
    return flattened.filter((item) => canDisplayNavItem(item, session, hasModule));
  }, [session, hasModule]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const recentRows: PaletteRow[] = (
      normalized
        ? recentlyViewed.filter((entry) => entry.label.toLowerCase().includes(normalized))
        : recentlyViewed
    )
      .slice(0, MAX_RECENT_ROWS)
      .map((entry) => ({
        key: `recent-${entry.kind}-${entry.id}`,
        section: 'recent' as const,
        label: entry.label,
        href: entry.href,
        icon: RECENT_KIND_ICON[entry.kind],
      }));

    const workspaceRows: PaletteRow[] = (
      normalized
        ? navItems.filter((item) => item.label.toLowerCase().includes(normalized))
        : navItems
    ).map((item) => ({
      key: `nav-${item.href}`,
      section: 'workspace' as const,
      label: item.label,
      href: item.href,
      icon: item.icon,
    }));

    return [...recentRows, ...workspaceRows];
  }, [navItems, recentlyViewed, query]);

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }

      if (event.key === '/' && !isTypingTarget && !isOpen) {
        event.preventDefault();
        document.getElementById('global-student-search')?.focus();
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePaletteKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) =>
          results.length ? (current === 0 ? results.length - 1 : current - 1) : 0,
        );
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = results[activeIndex];
        if (selected) goTo(selected.href);
      }
    }

    document.addEventListener('keydown', handlePaletteKeyDown);
    return () => document.removeEventListener('keydown', handlePaletteKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, activeIndex]);

  function goTo(href: string) {
    setIsOpen(false);
    router.push(href);
  }

  if (!isOpen || typeof document === 'undefined') return null;

  const hasRecentRows = results.some((row) => row.section === 'recent');
  const hasWorkspaceRows = results.some((row) => row.section === 'workspace');

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a workspace or a recently viewed record"
        className="relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg animate-scale-in"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to a workspace or recent record..."
            aria-label="Jump to a workspace or a recently viewed record"
            className="h-6 w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-slate-400 sm:block">
            Esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No match for &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <>
              {hasRecentRows ? (
                <PaletteSection label="Recently viewed">
                  {results
                    .map((row, index) => ({ row, index }))
                    .filter(({ row }) => row.section === 'recent')
                    .map(({ row, index }) => (
                      <PaletteRowButton
                        key={row.key}
                        row={row}
                        active={index === activeIndex}
                        onHover={() => setActiveIndex(index)}
                        onSelect={() => goTo(row.href)}
                      />
                    ))}
                </PaletteSection>
              ) : null}

              {hasWorkspaceRows ? (
                <PaletteSection label="Workspaces">
                  {results
                    .map((row, index) => ({ row, index }))
                    .filter(({ row }) => row.section === 'workspace')
                    .map(({ row, index }) => (
                      <PaletteRowButton
                        key={row.key}
                        row={row}
                        active={index === activeIndex}
                        onHover={() => setActiveIndex(index)}
                        onSelect={() => goTo(row.href)}
                      />
                    ))}
                </PaletteSection>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[0.68rem] font-semibold text-slate-400">
          <span>&uarr;&darr; to navigate &middot; Enter to open</span>
          <span>Ctrl/Cmd + K</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PaletteSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function PaletteRowButton({
  row,
  active,
  onHover,
  onSelect,
}: {
  row: PaletteRow;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon = row.icon;
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
        active ? 'bg-[var(--primary-soft)] text-[var(--primary-dark)]' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon size={16} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{row.label}</span>
    </button>
  );
}
