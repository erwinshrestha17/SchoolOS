'use client';

import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
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

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export function EntitlementsProvider({ children }: PropsWithChildren) {
  const { status } = useSession();
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
    setLoading(true);

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
  }, [status]);

  const hasModule = (moduleName: string) => {
    if (!entitlements) return false;
    return entitlements.modules.includes(moduleName);
  };

  const hasFeature = (featureKey: string) => {
    if (!entitlements) return false;
    return entitlements.features.includes(featureKey);
  };

  return (
    <EntitlementsContext.Provider value={{ entitlements, loading, error, hasModule, hasFeature }}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }
  return context;
}
