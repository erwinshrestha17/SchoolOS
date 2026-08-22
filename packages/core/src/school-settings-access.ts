export const SCHOOL_SETTINGS_AUTHORITY_ROLES = [
  'admin',
  'school_config_owner',
] as const;

/**
 * Principal is a leadership persona, not an institutional configuration role.
 * A principal may enter institutional Settings only when the same account also
 * holds an explicit school configuration authority role.
 *
 * This helper intentionally evaluates roles rather than browser navigation.
 * Backend authorization remains the source of truth for each settings action.
 */
export function isPrincipalRestrictedFromInstitutionalSettings(
  roles: readonly string[] | undefined,
): boolean {
  const currentRoles = roles ?? [];
  if (!currentRoles.includes('principal')) return false;
  return !SCHOOL_SETTINGS_AUTHORITY_ROLES.some((role) =>
    currentRoles.includes(role),
  );
}
