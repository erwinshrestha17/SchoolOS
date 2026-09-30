/**
 * Persona homes (Phase 4). A school user may legitimately hold more than one
 * operational persona — a Principal who also teaches, an Admin who is also
 * the Accountant. This is the single resolver used by BOTH the Web (switcher,
 * home rendering, cache partitioning) and the API (dashboard composition), so
 * the two can never disagree about which homes a session may open.
 *
 * Choosing a home is presentation only: every home's endpoint still
 * re-authorizes on the server (roles, permissions, entitlements, scope).
 */

import type { DashboardCompositionPersona } from "./operational-summary.js";
import { isPlatformRoleName } from "./permissions.js";
import { resolveSchoolWebPersona } from "./school-web-persona.js";
import { resolveTeacherPersona } from "./teacher-capabilities.js";

export type HomePersona = DashboardCompositionPersona | "teacher";

export const HOME_PERSONA_LABELS: Record<HomePersona, string> = {
  admin: "Operations",
  principal: "Principal",
  hr: "HR",
  accountant: "Finance",
  teacher: "Teaching",
};

export interface HomePersonaInput {
  roles: readonly string[];
  permissions: readonly string[];
}

const ROLE_HOMES: Array<{ roles: readonly string[]; home: HomePersona }> = [
  { roles: ["admin", "school_admin", "school_config_owner"], home: "admin" },
  { roles: ["principal", "head_teacher"], home: "principal" },
  { roles: ["accountant", "finance_officer"], home: "accountant" },
  { roles: ["hr_manager", "hr"], home: "hr" },
  { roles: ["teacher", "subject_teacher"], home: "teacher" },
];

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/-/g, "_");
}

function primaryHome(input: HomePersonaInput): HomePersona | null {
  if (resolveTeacherPersona(input).isTeacherPersona) return "teacher";
  const persona = resolveSchoolWebPersona(input);
  if (
    persona === "admin" ||
    persona === "principal" ||
    persona === "hr" ||
    persona === "accountant"
  ) {
    return persona;
  }
  return null;
}

/**
 * Homes this session may open, default first. Platform identities never
 * receive a school home (Platform/School separation), and a home is only
 * offered for a role the session actually holds.
 */
export function availableHomePersonas(input: HomePersonaInput): HomePersona[] {
  const roles = input.roles.map(normalizeRole);
  if (roles.some(isPlatformRoleName)) return [];
  const homes: HomePersona[] = [];
  const primary = primaryHome({ roles, permissions: input.permissions });
  if (primary) homes.push(primary);
  for (const entry of ROLE_HOMES) {
    if (
      !homes.includes(entry.home) &&
      entry.roles.some((role) => roles.includes(role))
    ) {
      homes.push(entry.home);
    }
  }
  return homes;
}

/**
 * The active home: the preferred one when the session may still open it
 * (a stale or tampered preference is ignored), otherwise the default.
 */
export function resolveHomePersona(
  input: HomePersonaInput,
  preferred?: string | null,
): HomePersona | null {
  const homes = availableHomePersonas(input);
  const match = homes.find((home) => home === preferred);
  return match ?? homes[0] ?? null;
}

/** Dashboard composition for a home, or null for the Teaching home. */
export function compositionForHome(
  home: HomePersona | null,
): DashboardCompositionPersona | null {
  return home && home !== "teacher" ? home : null;
}
