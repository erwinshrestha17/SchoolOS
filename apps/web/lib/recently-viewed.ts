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
  /**
   * `${tenantId}:${userId}` that recorded the view. Entries are only ever
   * read back for the same school and person, so a multi-school account or a
   * shared computer never surfaces another context's records.
   */
  scope?: string;
};

export const RECENTLY_VIEWED_STORAGE_KEY = 'schoolos.recently-viewed';
export const RECENTLY_VIEWED_MAX_ENTRIES = 8;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function readAllRecentlyViewed(
  storage: ReadableStorage,
): RecentlyViewedEntry[] {
  const raw = storage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentlyViewedEntry) : [];
  } catch {
    return [];
  }
}

/**
 * Entries for `scope` only (unscoped legacy entries are not attributable to
 * anyone and are never returned for a scoped read).
 */
export function readRecentlyViewed(
  storage: ReadableStorage,
  scope?: string,
): RecentlyViewedEntry[] {
  const entries = readAllRecentlyViewed(storage);
  return scope === undefined
    ? entries
    : entries.filter((entry) => entry.scope === scope);
}

export function recentlyViewedScope(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
): string | null {
  return tenantId && userId ? `${tenantId}:${userId}` : null;
}

/** Records a view, moving it to the front and dropping the oldest beyond the cap. */
export function recordRecentlyViewed(
  storage: WritableStorage,
  entry: Omit<RecentlyViewedEntry, 'viewedAt' | 'scope'>,
  scope?: string,
): RecentlyViewedEntry[] {
  const all = readAllRecentlyViewed(storage);
  const mine = all.filter((item) => item.scope === scope);
  const others = all.filter((item) => item.scope !== scope);
  const deduped = mine.filter(
    (item) => !(item.kind === entry.kind && item.id === entry.id),
  );
  const next = [
    {
      ...entry,
      viewedAt: new Date().toISOString(),
      ...(scope === undefined ? {} : { scope }),
    },
    ...deduped,
  ].slice(0, RECENTLY_VIEWED_MAX_ENTRIES);

  // Other contexts keep their own capped trail; only `scope`'s is changed.
  storage.setItem(
    RECENTLY_VIEWED_STORAGE_KEY,
    JSON.stringify([...next, ...others]),
  );
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
    typeof candidate.viewedAt === 'string' &&
    (candidate.scope === undefined || typeof candidate.scope === 'string')
  );
}
