"use client";

import {
  resolveTeacherPersona,
  resolveTeacherRouteRestriction,
  TeacherCapability,
  type TeacherRestrictedRoute,
} from "@schoolos/core";
import { useMemo } from "react";
import { useSession } from "../components/session-provider";

export { TeacherCapability };
export type { TeacherRestrictedRoute };

export interface TeacherAccess {
  /** True when this session gets the teacher-scoped shell and nav tree. */
  isTeacherPersona: boolean;
  /** Administrative capabilities actually held (delegation-aware). */
  capabilities: ReadonlySet<TeacherCapability>;
  /** Capability check that is safe to call for every persona. */
  can: (capability: TeacherCapability) => boolean;
  /**
   * True when this persona must be prevented from seeing the surface behind
   * `capability`. Non-teacher personas are never restricted here — their
   * access is decided by the existing permission route gates.
   */
  isRestricted: (capability: TeacherCapability) => boolean;
  /** Route restriction for `pathname`, or null when the route is allowed. */
  restrictionFor: (pathname: string) => TeacherRestrictedRoute | null;
}

/**
 * Single source of truth for "what may this teacher see" in the web app.
 *
 * Components must call this instead of inspecting `session.user.roles` or
 * re-listing permission keys: role-name checks silently break delegated
 * authority (an exam-coordinator teacher still has the `teacher` role), and
 * duplicated permission lists drift apart. The backend remains the
 * authorization authority — this only decides what to render.
 */
export function useTeacherAccess(): TeacherAccess {
  const { session } = useSession();

  return useMemo(() => {
    const { isTeacherPersona, capabilities } = resolveTeacherPersona({
      roles: session?.user.roles ?? [],
      permissions: session?.user.permissions ?? [],
    });

    return {
      isTeacherPersona,
      capabilities,
      can: (capability: TeacherCapability) => capabilities.has(capability),
      isRestricted: (capability: TeacherCapability) =>
        isTeacherPersona && !capabilities.has(capability),
      restrictionFor: (pathname: string) =>
        isTeacherPersona
          ? resolveTeacherRouteRestriction(pathname, capabilities)
          : null,
    };
  }, [session?.user.roles, session?.user.permissions]);
}

/**
 * Removes tabs/links whose destination this teacher may not open, so no
 * workspace advertises a tab that would immediately bounce them back. Used by
 * every module tab strip (academics, activity, library, notices, timetable)
 * rather than each one re-deriving the rule.
 */
export function useAuthorizedLinks<T extends { href: string }>(
  items: readonly T[],
): T[] {
  const { restrictionFor } = useTeacherAccess();
  return useMemo(
    () => items.filter((item) => !restrictionFor(item.href)),
    [items, restrictionFor],
  );
}
