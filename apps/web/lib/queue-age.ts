/**
 * Phase 5A: compact age for queue rows ("Today", "3d", "5w", "4mo").
 * Presentation only — the timestamp is server-owned (submission time).
 */
export type QueueAge = {
  label: string;
  days: number;
  /** Aging tone for open work: 7+ days pending, 14+ days overdue. */
  tone: 'none' | 'pending' | 'overdue';
};

const DAY_MS = 86_400_000;

export function queueAge(
  since: string | Date,
  now: number = Date.now(),
): QueueAge {
  const start = typeof since === 'string' ? Date.parse(since) : since.getTime();
  const days = Number.isFinite(start)
    ? Math.max(0, Math.floor((now - start) / DAY_MS))
    : 0;
  const label =
    days < 1
      ? 'Today'
      : days < 14
        ? `${days}d`
        : days < 60
          ? `${Math.floor(days / 7)}w`
          : `${Math.floor(days / 30)}mo`;
  const tone = days >= 14 ? 'overdue' : days >= 7 ? 'pending' : 'none';
  return { label, days, tone };
}
