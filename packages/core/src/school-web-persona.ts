/**
 * School-web persona shells for non-teacher operators.
 *
 * Teacher persona resolution stays in `teacher-capabilities.ts`. This module
 * picks Principal / HR / Accountant / Librarian / Cashier / Transport /
 * Canteen / Admin navigation trees for everyone else.
 *
 * Frontend UX only — backend `@Permissions` and entitlements remain authority.
 */

import { resolveTeacherPersona } from "./teacher-capabilities.js";

export type SchoolWebPersona =
  | "teacher"
  | "principal"
  | "hr"
  | "accountant"
  | "librarian"
  | "cashier"
  | "transport_operator"
  | "canteen_operator"
  | "admin";

export interface SchoolWebPersonaInput {
  roles: readonly string[];
  permissions: readonly string[];
}

const FULL_ADMIN_ROLES = [
  "admin",
  "school_config_owner",
  "platform_super_admin",
  "platform_support",
  "platform_billing_admin",
] as const;

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/-/g, "_");
}

function hasPermission(
  permissions: readonly string[],
  keys: readonly string[],
): boolean {
  return keys.some((key) => permissions.includes(key));
}

function hasBroadSchoolOps(permissions: readonly string[]): boolean {
  return hasPermission(permissions, [
    "settings:manage",
    "users:manage",
    "roles:manage",
    "students:create",
  ]);
}

/**
 * Resolves which school-web navigation shell a session should receive.
 *
 * Priority (first match wins after teacher check):
 * 1. Teacher-only → teacher
 * 2. Full admin / config owner → admin
 * 3. Principal → principal
 * 4. Accountant role → accountant
 * 5. HR manager → hr
 * 6. Librarian → librarian
 * 7. Permission-shaped operational personas (cashier / transport / canteen)
 * 8. Default → admin (permission-filtered full ops tree)
 */
export function resolveSchoolWebPersona(
  input: SchoolWebPersonaInput,
): SchoolWebPersona {
  const roles = input.roles.map(normalizeRole);
  const { permissions } = input;

  if (resolveTeacherPersona(input).isTeacherPersona) {
    return "teacher";
  }

  if (roles.some((role) => (FULL_ADMIN_ROLES as readonly string[]).includes(role))) {
    return "admin";
  }

  if (roles.includes("principal") || roles.includes("head_teacher")) {
    return "principal";
  }

  if (roles.includes("accountant") || roles.includes("finance_officer")) {
    return "accountant";
  }

  if (roles.includes("hr_manager") || roles.includes("hr")) {
    return "hr";
  }

  if (roles.includes("librarian")) {
    return "librarian";
  }

  if (
    !hasBroadSchoolOps(permissions) &&
    hasPermission(permissions, ["payments:collect", "payments:close"]) &&
    !hasPermission(permissions, [
      "accounting:journals:post",
      "accounting:fiscal:manage",
      "settings:accounting:manage",
    ])
  ) {
    return "cashier";
  }

  if (
    !hasBroadSchoolOps(permissions) &&
    hasPermission(permissions, ["transport:operate", "transport:read"]) &&
    !hasPermission(permissions, ["students:create", "fees:manage"])
  ) {
    return "transport_operator";
  }

  if (
    !hasBroadSchoolOps(permissions) &&
    hasPermission(permissions, [
      "canteen:pos:create",
      "canteen:pos:read",
      "canteen:serving:create",
      "canteen:serving:read",
      "canteen:menu:read",
    ]) &&
    !hasPermission(permissions, ["students:create", "fees:manage", "hr:manage"])
  ) {
    return "canteen_operator";
  }

  return "admin";
}
