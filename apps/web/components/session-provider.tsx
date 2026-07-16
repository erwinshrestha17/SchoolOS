"use client";

import type { AuthSession, PermissionKey } from "@schoolos/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, ApiRequestError, type AuthProfile } from "../lib/api";
import {
  getBrowserSessionIdentity,
  hasSameBrowserSessionIdentity,
  isConfirmedSessionFailureStatus,
} from "../lib/offline-policy";
import {
  type BrowserSession,
  clearAllAttendanceDrafts,
  clearRecentlyViewed,
  clearSupportOverride,
  hasAllPermissions,
  isSessionStorageEvent,
  readStoredSession,
  SESSION_CLEARED_EVENT,
  storeSession,
  toBrowserSession,
} from "../lib/session";

type SessionStatus =
  | "loading"
  | "authenticated"
  | "offline_locked"
  | "verification_failed"
  | "anonymous";

type SessionContextValue = {
  session: BrowserSession | null;
  status: SessionStatus;
  setAuthenticatedSession: (session: AuthSession) => Promise<void>;
  refreshSession: () => Promise<BrowserSession | null>;
  revalidateSession: () => Promise<BrowserSession | null>;
  logout: () => Promise<void>;
  hasPermissions: (permissions: PermissionKey[]) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function isConfirmedSessionFailure(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    isConfirmedSessionFailureStatus(error.statusCode)
  );
}

function statusForUnconfirmedSessionError(
  error: unknown,
): Extract<SessionStatus, "offline_locked" | "verification_failed"> {
  return error instanceof ApiRequestError
    ? "verification_failed"
    : "offline_locked";
}

function browserSessionFromProfile(
  profile: AuthProfile,
  existingSession: BrowserSession,
): BrowserSession {
  return {
    accessTokenExpiresAt: existingSession.accessTokenExpiresAt,
    user: {
      id: profile.userId,
      tenantId: profile.tenantId,
      originalTenantId: profile.originalTenantId,
      isSupportOverride: profile.isSupportOverride,
      tenantSlug: profile.tenantSlug,
      email: profile.email,
      authMethod: profile.authMethod,
      mustChangePassword: profile.mustChangePassword,
      roles: profile.roles,
      permissions: profile.permissions,
    },
    tenant: profile.tenant,
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSessionState] = useState<BrowserSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const sessionRef = useRef<BrowserSession | null>(null);
  const sessionGenerationRef = useRef(0);
  const revalidationPromiseRef = useRef<Promise<BrowserSession | null> | null>(
    null,
  );

  const setCurrentSession = useCallback(
    (nextSession: BrowserSession | null) => {
      sessionRef.current = nextSession;
      setSessionState(nextSession);
    },
    [],
  );

  const invalidatePendingSessionWork = useCallback(() => {
    sessionGenerationRef.current += 1;
    revalidationPromiseRef.current = null;
    return sessionGenerationRef.current;
  }, []);

  const clearPrivateBrowserState = useCallback(async () => {
    queryClient.clear();
    clearSupportOverride();
    clearRecentlyViewed();
    await clearAllAttendanceDrafts();
  }, [queryClient]);

  const performRealSessionTeardown = useCallback(async () => {
    invalidatePendingSessionWork();
    const cleanupPromise = clearPrivateBrowserState();
    storeSession(null, { notify: false });
    setCurrentSession(null);
    setStatus("anonymous");
    await cleanupPromise;
  }, [
    clearPrivateBrowserState,
    invalidatePendingSessionWork,
    setCurrentSession,
  ]);

  const acceptAuthenticatedBrowserSession = useCallback(
    async (
      currentSession: BrowserSession | null,
      nextSession: BrowserSession,
      generation: number,
      isCancelled?: () => boolean,
    ) => {
      if (!hasSameBrowserSessionIdentity(currentSession, nextSession)) {
        const cleanupPromise = clearPrivateBrowserState();
        setCurrentSession(null);
        setStatus("loading");
        await cleanupPromise;
      }

      if (
        generation !== sessionGenerationRef.current ||
        (isCancelled?.() ?? false)
      ) {
        return null;
      }

      storeSession(nextSession);
      setCurrentSession(nextSession);
      setStatus("authenticated");
      return nextSession;
    },
    [clearPrivateBrowserState, setCurrentSession],
  );

  useEffect(() => {
    function handleSessionCleared() {
      void performRealSessionTeardown();
    }

    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);

    const existingSession = readStoredSession();
    const generation = sessionGenerationRef.current;

    if (existingSession) {
      setCurrentSession(existingSession);
      // Keep the UI in loading while the cookie-backed session is verified.
      // Local storage is only a browser display cache and must not be trusted
      // as proof that the httpOnly access/refresh cookies still exist.
      setStatus("loading");
    }

    let cancelled = false;

    async function bootstrapSession() {
      try {
        if (existingSession) {
          const profile = await api.getProfile();

          if (cancelled || generation !== sessionGenerationRef.current) {
            return;
          }

          const browserSession = browserSessionFromProfile(
            profile,
            existingSession,
          );
          await acceptAuthenticatedBrowserSession(
            existingSession,
            browserSession,
            generation,
            () => cancelled,
          );
          return;
        }

        if (cancelled || generation !== sessionGenerationRef.current) {
          return;
        }

        setCurrentSession(null);
        setStatus("anonymous");
      } catch (error) {
        if (cancelled || generation !== sessionGenerationRef.current) {
          return;
        }

        if (isConfirmedSessionFailure(error)) {
          await performRealSessionTeardown();
          return;
        }

        // A missing network response is not proof that the cookie-backed
        // session has expired. Preserve metadata and local attendance drafts,
        // but do not render private workspaces until the server revalidates it.
        setCurrentSession(existingSession);
        setStatus(statusForUnconfirmedSessionError(error));
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
      window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
    };
  }, [
    acceptAuthenticatedBrowserSession,
    performRealSessionTeardown,
    setCurrentSession,
  ]);

  const revalidateSession = useCallback(() => {
    if (revalidationPromiseRef.current) {
      return revalidationPromiseRef.current;
    }

    const existingSession = readStoredSession();

    if (!existingSession) {
      setCurrentSession(null);
      setStatus("anonymous");
      return Promise.resolve(null);
    }

    const generation = sessionGenerationRef.current;
    const revalidationPromise = (async () => {
      try {
        const profile = await api.getProfile();

        if (generation !== sessionGenerationRef.current) {
          return null;
        }

        const browserSession = browserSessionFromProfile(
          profile,
          existingSession,
        );
        return await acceptAuthenticatedBrowserSession(
          existingSession,
          browserSession,
          generation,
        );
      } catch (error) {
        if (generation !== sessionGenerationRef.current) {
          return null;
        }

        if (isConfirmedSessionFailure(error)) {
          await performRealSessionTeardown();
          return null;
        }

        setCurrentSession(existingSession);
        setStatus(statusForUnconfirmedSessionError(error));
        return null;
      }
    })();

    revalidationPromiseRef.current = revalidationPromise;
    void revalidationPromise.finally(() => {
      if (revalidationPromiseRef.current === revalidationPromise) {
        revalidationPromiseRef.current = null;
      }
    });

    return revalidationPromise;
  }, [
    acceptAuthenticatedBrowserSession,
    performRealSessionTeardown,
    setCurrentSession,
  ]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (!isSessionStorageEvent(event)) {
        return;
      }

      if (event.newValue === null) {
        void performRealSessionTeardown();
        return;
      }

      const externalSession = readStoredSession();
      if (!getBrowserSessionIdentity(externalSession)) {
        void performRealSessionTeardown();
        return;
      }

      // Storage is only an identity-change signal. Never copy its roles or
      // permissions into authenticated state without a server profile check.
      if (hasSameBrowserSessionIdentity(sessionRef.current, externalSession)) {
        return;
      }

      const generation = invalidatePendingSessionWork();
      const synchronizeExternalSession = async () => {
        const cleanupPromise = clearPrivateBrowserState();
        setCurrentSession(null);
        setStatus("loading");
        await cleanupPromise;

        if (generation !== sessionGenerationRef.current) {
          return;
        }

        await revalidateSession();
      };

      void synchronizeExternalSession();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [
    clearPrivateBrowserState,
    invalidatePendingSessionWork,
    performRealSessionTeardown,
    revalidateSession,
    setCurrentSession,
  ]);

  useEffect(() => {
    if (status !== "offline_locked") {
      return;
    }

    const handleOnline = () => {
      void revalidateSession();
    };

    window.addEventListener("online", handleOnline);

    return () => window.removeEventListener("online", handleOnline);
  }, [revalidateSession, status]);

  async function refreshSession() {
    const existingSession = readStoredSession();
    const generation = invalidatePendingSessionWork();

    if (!existingSession) {
      setStatus("loading");
    }

    try {
      const refreshedSession = await api.refreshSession();

      if (generation !== sessionGenerationRef.current) {
        return null;
      }

      const browserSession = toBrowserSession(refreshedSession);
      return await acceptAuthenticatedBrowserSession(
        existingSession,
        browserSession,
        generation,
      );
    } catch (error) {
      if (generation !== sessionGenerationRef.current) {
        return null;
      }

      if (isConfirmedSessionFailure(error)) {
        await performRealSessionTeardown();
        return null;
      }

      if (existingSession) {
        setCurrentSession(existingSession);
        setStatus(statusForUnconfirmedSessionError(error));
      } else {
        setCurrentSession(null);
        setStatus(statusForUnconfirmedSessionError(error));
      }

      return null;
    }
  }

  async function logout() {
    invalidatePendingSessionWork();

    try {
      await api.logout();
    } finally {
      await performRealSessionTeardown();
    }
  }

  async function setAuthenticatedSession(nextSession: AuthSession) {
    const currentSession = sessionRef.current ?? readStoredSession();
    const generation = invalidatePendingSessionWork();
    const browserSession = toBrowserSession(nextSession);
    await acceptAuthenticatedBrowserSession(
      currentSession,
      browserSession,
      generation,
    );
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
        revalidateSession,
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
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
