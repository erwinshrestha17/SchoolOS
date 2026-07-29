"use client";

import {
  resolveSchoolWebPersona,
  type SchoolWebPersona,
} from "@schoolos/core";
import { useMemo } from "react";
import { useSession } from "../components/session-provider";
import { useTeacherAccess } from "./teacher-access";

export type { SchoolWebPersona };

/**
 * Resolves the school-web navigation persona for the signed-in session.
 * Teacher shell remains owned by `useTeacherAccess`; this covers Principal,
 * HR, Accountant, Librarian, Cashier, Transport, Canteen, and Admin.
 */
export function useSchoolWebPersona(): SchoolWebPersona {
  const { session } = useSession();
  const { isTeacherPersona } = useTeacherAccess();

  return useMemo(() => {
    if (isTeacherPersona) return "teacher";
    return resolveSchoolWebPersona({
      roles: session?.user.roles ?? [],
      permissions: session?.user.permissions ?? [],
    });
  }, [isTeacherPersona, session?.user.roles, session?.user.permissions]);
}
