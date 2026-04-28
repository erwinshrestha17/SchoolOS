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
  clearStoredSession,
  hasAllPermissions,
  readStoredSession,
  SESSION_CLEARED_EVENT,
  storeSession,
} from '../lib/session';

type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type SessionContextValue = {
  session: AuthSession | null;
  status: SessionStatus;
  setAuthenticatedSession: (session: AuthSession) => void;
  refreshSession: () => Promise<AuthSession | null>;
  logout: () => Promise<void>;
  hasPermissions: (permissions: PermissionKey[]) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
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

        storeSession(refreshedSession);
        setSession(refreshedSession);
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
      storeSession(refreshedSession);
      setSession(refreshedSession);
      setStatus('authenticated');
      return refreshedSession;
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
    storeSession(nextSession);
    setSession(nextSession);
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
