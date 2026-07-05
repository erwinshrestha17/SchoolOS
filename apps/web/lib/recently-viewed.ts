/**
 * Client-only "recently viewed" trail so staff can jump back to a record
 * they were just looking at (a student, an invoice, a notice) without
 * re-searching or re-filtering. Purely a personal browsing convenience —
 * never a source of truth, never sent to the backend, and cleared whenever
 * the session is cleared (see use-recently-viewed.ts) so one person's
 * browsing history never lingers into the next person's session on a
 * shared front-desk computer.
 */

export type RecentlyViewedKind = 'student' | 'invoice' | 'notice';

export type RecentlyViewedEntry = {
  kind: RecentlyViewedKind;
  id: string;
  label: string;
  href: string;
  viewedAt: string;
};

export const RECENTLY_VIEWED_STORAGE_KEY = 'schoolos.recently-viewed';
export const RECENTLY_VIEWED_MAX_ENTRIES = 8;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readRecentlyViewed(storage: ReadableStorage): RecentlyViewedEntry[] {
  const raw = storage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentlyViewedEntry) : [];
  } catch {
    return [];
  }
}

/** Records a view, moving it to the front and dropping the oldest beyond the cap. */
export function recordRecentlyViewed(
  storage: WritableStorage,
  entry: Omit<RecentlyViewedEntry, 'viewedAt'>,
): RecentlyViewedEntry[] {
  const current = readRecentlyViewed(storage);
  const deduped = current.filter(
    (item) => !(item.kind === entry.kind && item.id === entry.id),
  );
  const next = [
    { ...entry, viewedAt: new Date().toISOString() },
    ...deduped,
  ].slice(0, RECENTLY_VIEWED_MAX_ENTRIES);

  storage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentlyViewed(storage: WritableStorage): void {
  storage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
}

function isRecentlyViewedEntry(value: unknown): value is RecentlyViewedEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.kind === 'student' ||
      candidate.kind === 'invoice' ||
      candidate.kind === 'notice') &&
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.href === 'string' &&
    typeof candidate.viewedAt === 'string'
  );
}
