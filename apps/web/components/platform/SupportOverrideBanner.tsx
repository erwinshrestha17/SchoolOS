'use client';

import { useSession } from '../session-provider';
import { Button } from '../ui/button';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';

export function SupportOverrideBanner() {
  const { session, refreshSession } = useSession();
  const [exiting, setExiting] = useState(false);

  if (!session?.user.isSupportOverride) {
    return null;
  }

  const exitSupport = async () => {
    setExiting(true);
    try {
      await api.exitPlatformSupportOverride();
      await refreshSession();
      window.location.href = '/platform/schools';
    } catch (err) {
      console.error('Failed to exit support mode', err);
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-[100] w-full bg-indigo-600 px-4 py-2 text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <ShieldAlert size={18} />
          </div>
          <p className="truncate text-sm font-bold">
            <span className="hidden sm:inline">Active Support Session: </span>
            <span className="font-black underline decoration-indigo-300 underline-offset-4">
              {session.tenant.name}
            </span>
          </p>
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
