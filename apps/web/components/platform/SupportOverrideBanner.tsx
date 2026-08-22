'use client';

import { useSession } from '../session-provider';
import { Button } from '../ui/button';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatBsDateTime,
  SUPPORT_OVERRIDE_SCOPE_DEFINITIONS,
} from '@schoolos/core';
import {
  clearSupportOverride,
  readSupportOverrideContext,
} from '../../lib/session';

export function SupportOverrideBanner() {
  const { session, status, refreshSession } = useSession();
  const queryClient = useQueryClient();
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const context = readSupportOverrideContext();
  const contextExpiresAt = context?.expiresAt ?? null;
  const isSupportOverride = session?.user.isSupportOverride === true;

  useEffect(() => {
    if (status !== 'authenticated' || !isSupportOverride) return;
    const handleExpiry = () => {
      clearSupportOverride();
      queryClient.clear();
      window.location.assign('/platform/schools');
    };
    if (!contextExpiresAt) {
      handleExpiry();
      return;
    }
    const remainingMs = Date.parse(contextExpiresAt) - Date.now();
    if (remainingMs <= 0) {
      handleExpiry();
      return;
    }
    const timer = window.setTimeout(handleExpiry, remainingMs);
    return () => window.clearTimeout(timer);
  }, [contextExpiresAt, isSupportOverride, queryClient, status]);

  if (status !== 'authenticated' || !session?.user.isSupportOverride) {
    return null;
  }

  const exitSupport = async () => {
    setExiting(true);
    setError(null);
    try {
      await api.exitPlatformSupportOverride();
      queryClient.clear();
      await refreshSession();
      window.location.href = '/platform/schools';
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Support mode could not be exited. Retry before continuing.',
      );
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-[100] w-full bg-indigo-700 px-4 py-2 text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0 text-sm">
            <p className="truncate font-bold">
              Read-only support ·{' '}
              <span className="font-black">{session.tenant.name}</span>
            </p>
            <p className="truncate text-xs text-indigo-100">
              {(context?.scopes ?? session.user.supportOverrideScopes ?? [])
                .map(
                  (scope) =>
                    SUPPORT_OVERRIDE_SCOPE_DEFINITIONS.find(
                      ({ key }) => key === scope,
                    )?.label ?? scope,
                )
                .join(', ') || 'Scope unavailable'}
              {context
                ? ` · Expires ${formatBsDateTime(context.expiresAt)}`
                : ''}
            </p>
            {error ? (
              <p className="mt-1 font-semibold text-amber-200">{error}</p>
            ) : null}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 shrink-0 rounded-lg bg-white font-black text-indigo-700 hover:bg-indigo-50"
          onClick={exitSupport}
          disabled={exiting}
        >
          {exiting ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <LogOut size={14} className="mr-2" />
          )}
          Exit Support Mode
        </Button>
      </div>
    </div>
  );
}
