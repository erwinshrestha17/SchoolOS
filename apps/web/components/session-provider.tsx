'use client';

import type { AuthSession, PermissionKey } from '@schoolos/core';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '../lib/api';
import {
  type BrowserSession,
  clearStoredSession,
  hasAllPermissions,
  readStoredSession,
  SESSION_CLEARED_EVENT,
  storeSession,
  toBrowserSession,
} from '../lib/session';

type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type SessionContextValue = {
  session: BrowserSession | null;
  status: SessionStatus;
  setAuthenticatedSession: (session: AuthSession) => void;
  refreshSession: () => Promise<BrowserSession | null>;
  logout: () => Promise<void>;
  hasPermissions: (permissions: PermissionKey[]) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    function handleSessionCleared() {
      setSession(null);
      setStatus('anonymous');
    }

    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);

    const existingSession = readStoredSession();

    if (existingSession) {
      setSession(existingSession);
      setStatus('authenticated');
    }

    let cancelled = false;

    async function bootstrapSession() {
      try {
        const refreshedSession = await api.refreshSession();

        if (cancelled) {
          return;
        }

        const browserSession = toBrowserSession(refreshedSession);
        storeSession(browserSession);
        setSession(browserSession);
        setStatus('authenticated');
      } catch {
        if (cancelled) {
          return;
        }

        clearStoredSession();
        setSession(null);
        setStatus('anonymous');
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
      window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
    };
  }, []);

  async function refreshSession() {
    try {
      const refreshedSession = await api.refreshSession();
      const browserSession = toBrowserSession(refreshedSession);
      storeSession(browserSession);
      setSession(browserSession);
      setStatus('authenticated');
      return browserSession;
    } catch {
      clearStoredSession();
      setSession(null);
      setStatus('anonymous');
      return null;
    }
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      clearStoredSession();
      setSession(null);
      setStatus('anonymous');
    }
  }

  function setAuthenticatedSession(nextSession: AuthSession) {
    const browserSession = toBrowserSession(nextSession);
    storeSession(browserSession);
    setSession(browserSession);
    setStatus('authenticated');
  }

  function hasPermissions(permissions: PermissionKey[]) {
    return hasAllPermissions(session, permissions);
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        status,
        setAuthenticatedSession,
        refreshSession,
        logout,
        hasPermissions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}
