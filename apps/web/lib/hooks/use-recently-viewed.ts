'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RecentlyViewedEntry } from '../recently-viewed';
import {
  clearRecentlyViewed,
  readRecentlyViewed,
  recordRecentlyViewed,
  SESSION_CLEARED_EVENT,
} from '../session';

export function useRecentlyViewed() {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);

  const reload = useCallback(() => {
    setEntries(readRecentlyViewed());
  }, []);

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

  const record = useCallback(
    (entry: Omit<RecentlyViewedEntry, 'viewedAt'>) => {
      setEntries(recordRecentlyViewed(entry));
    },
    [],
  );

  return { entries, record };
}
