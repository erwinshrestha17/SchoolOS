'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../components/session-provider';
import type { RecentlyViewedEntry } from '../recently-viewed';
import {
  clearRecentlyViewed,
  readRecentlyViewed,
  recordRecentlyViewed,
  SESSION_CLEARED_EVENT,
} from '../session';

export function useRecentlyViewed() {
  const { session } = useSession();
  const tenantId = session?.tenant.id;
  const userId = session?.user.id;
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);

  // Re-read whenever the school or person changes: recents are scoped to
  // `${tenantId}:${userId}` and must never carry across contexts.
  const reload = useCallback(() => {
    setEntries(tenantId && userId ? readRecentlyViewed() : []);
  }, [tenantId, userId]);

  useEffect(() => {
    reload();

    function handleSessionCleared() {
      clearRecentlyViewed();
      setEntries([]);
    }

    // Also keep multiple tabs of the same session in sync with each other.
    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  const record = useCallback((entry: Omit<RecentlyViewedEntry, 'viewedAt'>) => {
    setEntries(recordRecentlyViewed(entry));
  }, []);

  return { entries, record };
}
