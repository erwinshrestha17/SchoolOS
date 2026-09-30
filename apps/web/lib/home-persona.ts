'use client';

import {
  availableHomePersonas,
  resolveHomePersona,
  type HomePersona,
} from '@schoolos/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../components/session-provider';
import {
  readHomePersonaPreference,
  writeHomePersonaPreference,
} from './session';

export type { HomePersona };

/** Queries whose data belongs to one home and must not leak into another. */
export const HOME_SCOPED_QUERY_KEYS = [
  ['operational-dashboard-summary'],
  ['teacher-today'],
] as const;

/**
 * The signed-in person's homes (from the same core resolver the API uses)
 * and the active one. The preference is remembered per school + person and
 * re-validated on every render, so a revoked role silently falls back to the
 * default home. Switching drops cached data of the other homes.
 */
export function useHomePersona() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const tenantId = session?.tenant.id ?? null;
  const userId = session?.user.id ?? null;
  const roles = session?.user.roles;
  const permissions = session?.user.permissions;

  const available = useMemo(
    () =>
      availableHomePersonas({
        roles: roles ?? [],
        permissions: permissions ?? [],
      }),
    [roles, permissions],
  );

  const [preferred, setPreferred] = useState<string | null>(null);
  useEffect(() => {
    setPreferred(
      tenantId && userId ? readHomePersonaPreference(tenantId, userId) : null,
    );
  }, [tenantId, userId]);

  const active = useMemo(
    () =>
      resolveHomePersona(
        { roles: roles ?? [], permissions: permissions ?? [] },
        preferred,
      ),
    [roles, permissions, preferred],
  );

  const setActive = useCallback(
    (home: HomePersona) => {
      if (!available.includes(home) || home === active) return;
      for (const queryKey of HOME_SCOPED_QUERY_KEYS) {
        queryClient.removeQueries({ queryKey: [...queryKey] });
      }
      if (tenantId && userId) {
        writeHomePersonaPreference(tenantId, userId, home);
      }
      setPreferred(home);
    },
    [active, available, queryClient, tenantId, userId],
  );

  return { available, active, setActive };
}
