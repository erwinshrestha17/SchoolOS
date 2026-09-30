'use client';

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '../lib/api';
import { useSession } from './session-provider';

type Entitlements = {
  tier: string | null;
  modules: string[];
  features: string[];
  addOns: string[];
};

type EntitlementsContextValue = {
  entitlements: Entitlements | null;
  loading: boolean;
  error: Error | null;
  hasModule: (moduleName: string) => boolean;
  hasFeature: (featureKey: string) => boolean;
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(
  null,
);

/** Plan changes must reach open tabs: re-read on focus and periodically. */
const ENTITLEMENTS_REFRESH_MS = 5 * 60_000;

export function EntitlementsProvider({ children }: PropsWithChildren) {
  const { status, session } = useSession();
  const tenantId = session?.tenant.id;
  const [refreshTick, setRefreshTick] = useState(0);

  // Entitlements are UX hints only (the API enforces them), but a module
  // disabled mid-session should disappear from navigation without a reload.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setRefreshTick((tick) => tick + 1);
      }
    };
    const timer = window.setInterval(refresh, ENTITLEMENTS_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [status]);

  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setEntitlements(null);
      setLoading(status === 'loading');
      return;
    }

    let cancelled = false;
    // Only the first load (or a school switch) shows a loading state; a
    // background refresh keeps the last known entitlements meanwhile.
    if (refreshTick === 0) setLoading(true);

    async function fetchEntitlements() {
      try {
        const res = await api.getEntitlements();
        if (!cancelled) {
          setEntitlements(res);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    }

    void fetchEntitlements();

    return () => {
      cancelled = true;
    };
  }, [status, tenantId, refreshTick]);

  const hasModule = (moduleName: string) => {
    if (!entitlements) return false;
    return entitlements.modules.includes(moduleName);
  };

  const hasFeature = (featureKey: string) => {
    if (!entitlements) return false;
    return entitlements.features.includes(featureKey);
  };

  return (
    <EntitlementsContext.Provider
      value={{ entitlements, loading, error, hasModule, hasFeature }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error(
      'useEntitlements must be used within an EntitlementsProvider',
    );
  }
  return context;
}
