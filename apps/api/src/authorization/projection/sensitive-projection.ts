import { hasEffectivePermission, isPlatformRoleName } from '@schoolos/core';
import type { AuthContext } from '../../auth/auth.types';
import { grantAllows } from '../scopes/scope-resolver';
import type { ResourceScope } from '../scopes/scope.types';

/**
 * Phase 3B — reusable server-side sensitive-data projection.
 *
 * Pattern for Student 360, Staff 360, inspectors, reports, exports and search:
 *
 *   1. decide sections   `decideSections({ section: () => boolean })`
 *                        evaluated once per request, before loading data;
 *                        a throwing or non-boolean rule denies.
 *   2. load selectively  only query relations for allowed sections.
 *   3. project           `omitUnauthorizedKeys(payload, keySections, decisions)`
 *                        removes every key bound to a denied section — the key
 *                        is absent from JSON, not nulled.
 *   4. publish contract  `buildResourceAuthorization` (packages/core) reports
 *                        the same decisions as `authorizedSections`.
 *
 * Every consumer (full page, inspector, export, search) must call the same
 * domain projection function so they cannot drift apart.
 */

export type SectionDecisions<Section extends string> = Readonly<
  Record<Section, boolean>
>;

export function decideSections<Section extends string>(
  rules: Readonly<Record<Section, () => boolean>>,
): SectionDecisions<Section> {
  const decisions = {} as Record<Section, boolean>;
  for (const section of Object.keys(rules) as Section[]) {
    let allowed = false;
    try {
      // Typed as boolean, but policy code can still return non-booleans at
      // runtime (e.g. an undefined lookup); only a literal `true` allows.
      const result: unknown = rules[section]();
      allowed = result === true;
    } catch {
      allowed = false;
    }
    decisions[section] = allowed;
  }
  return Object.freeze(decisions);
}

/**
 * Removes keys whose section is denied. Keys not listed in `keySections` are
 * left untouched, so callers must bind every protected key explicitly (the
 * domain projection's tests assert the protected key inventory).
 */
export function omitUnauthorizedKeys<
  T extends Record<string, unknown>,
  Section extends string,
>(
  value: T,
  keySections: Readonly<Record<string, Section>>,
  decisions: SectionDecisions<Section>,
): Partial<T> {
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const section = Object.prototype.hasOwnProperty.call(keySections, key)
      ? keySections[key]
      : undefined;
    if (section !== undefined && decisions[section] !== true) continue;
    output[key] = child;
  }
  return output as Partial<T>;
}

/**
 * Resource-scoped permission check for projection decisions. Mirrors the
 * kernel/`hasDomainPermission` rules (no Platform identities, no support
 * override) but honours CLASS/SECTION/STUDENT-scoped grants for the resource.
 */
export function actorHoldsPermissionFor(
  actor: AuthContext | undefined,
  permission: string,
  resource?: ResourceScope,
): boolean {
  if (
    !actor?.userId ||
    !actor.tenantId ||
    !Array.isArray(actor.roles) ||
    actor.isSupportOverride ||
    actor.securityDomain === 'PLATFORM' ||
    actor.roles.some(isPlatformRoleName)
  )
    return false;
  return actor.accessGrants
    ? actor.accessGrants.some((grant) =>
        grantAllows(grant, permission, actor.tenantId, resource),
      )
    : hasEffectivePermission(actor.permissions ?? [], permission);
}
