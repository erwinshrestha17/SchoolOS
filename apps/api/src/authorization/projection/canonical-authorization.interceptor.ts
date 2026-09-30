import {
  applyDecorators,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  buildResourceAuthorization,
  type EntitlementState,
} from '@schoolos/core';
import { map, type Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../auth/auth-request.interface';
import { entitlementStateFromEvidence } from '../../auth/decorators/entitlement-evidence.decorator';

/**
 * Phase 3A migration bridge for legacy per-domain action maps.
 *
 * Older endpoints return `allowedActions` as an object of booleans with
 * domain-specific names (`{ review, approve }`, `{ canEdit, canApprove }`).
 * Controllers that opt in with `@ProjectCanonicalAuthorization` get, next to
 * every such map in the response, the canonical `authorization`
 * (ResourceAuthorization) built from the SAME server decisions:
 *
 *   canApprove / approve   → APPROVE
 *   canCompleteReview      → COMPLETE_REVIEW
 *   isLocked / non-boolean → not an action (ignored)
 *
 * entitlementState comes only from EntitlementGuard evidence for this request
 * (UNKNOWN → every action denied). The legacy map is left in place for
 * backward compatibility; clients migrate to `authorization`.
 */
export const CANONICAL_AUTHORIZATION_KEY = 'schoolos:canonical-authorization';

export interface CanonicalAuthorizationOptions {
  /** Module key without `module.`, matching the controller's @Entitlement. */
  module: string;
  /** Property holding the resource lifecycle (defaults to `status`). */
  lifecycleKey?: string;
  /**
   * Top-level boolean action flags on the resource itself (e.g.
   * `canCancel`, `canFinalize`). Opt-in by name, because many `canXxx`
   * properties are domain data (eligibility, capacity), not authorization.
   */
  actionFlags?: readonly string[];
}

const MAX_DEPTH = 5;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** `canCompleteReview` → `COMPLETE_REVIEW`; `approve` → `APPROVE`. */
export function legacyActionCode(key: string): string | null {
  if (/^is[A-Z]/.test(key)) return null;
  const base = /^can[A-Z]/.test(key) ? key.slice(3) : key;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(base)) return null;
  return base.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function canonicalActions(
  legacy: Record<string, unknown> | readonly unknown[],
): Record<string, boolean> | null {
  const actions: Record<string, boolean> = {};
  // Array form: the listed codes are allowed; anything unlisted is simply
  // absent, which the fail-closed readers treat as denied.
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      if (typeof item !== 'string') continue;
      const code = legacyActionCode(item) ?? item.toUpperCase();
      if (/^[A-Z][A-Z0-9_]*$/.test(code)) actions[code] = true;
    }
    return Object.keys(actions).length > 0 ? actions : null;
  }
  for (const [key, value] of Object.entries(legacy)) {
    if (typeof value !== 'boolean') continue;
    const code = legacyActionCode(key);
    if (!code) continue;
    // Two legacy keys mapping to one code must BOTH allow.
    actions[code] = (actions[code] ?? true) && value;
  }
  return Object.keys(actions).length > 0 ? actions : null;
}

export function attachCanonicalAuthorization(
  value: unknown,
  options: CanonicalAuthorizationOptions,
  entitlementState: EntitlementState,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value))
    return value.map((item) =>
      attachCanonicalAuthorization(item, options, entitlementState, depth + 1),
    );
  if (!isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] =
      key === 'allowedActions' || key === 'authorization'
        ? child
        : attachCanonicalAuthorization(
            child,
            options,
            entitlementState,
            depth + 1,
          );
  }
  const legacyMap = value.allowedActions;
  const flags: Record<string, unknown> = {};
  for (const flag of options.actionFlags ?? []) {
    if (typeof value[flag] === 'boolean') flags[flag] = value[flag];
  }
  const legacy =
    isPlainObject(legacyMap) || Array.isArray(legacyMap)
      ? legacyMap
      : Object.keys(flags).length > 0
        ? flags
        : null;
  if (legacy && !('authorization' in value)) {
    const actions = canonicalActions(legacy);
    if (actions) {
      const lifecycle = value[options.lifecycleKey ?? 'status'];
      output.authorization = buildResourceAuthorization({
        actions,
        sections: {},
        lifecycleState: typeof lifecycle === 'string' ? lifecycle : null,
        entitlementState,
      });
    }
  }
  return output;
}

@Injectable()
export class CanonicalAuthorizationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options =
      this.reflector.getAllAndOverride<CanonicalAuthorizationOptions>(
        CANONICAL_AUTHORIZATION_KEY,
        [context.getHandler(), context.getClass()],
      );
    if (!options || context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const entitlementState = entitlementStateFromEvidence(
      request.entitlementEvidence,
      options.module,
    );
    return next
      .handle()
      .pipe(
        map((body: unknown) =>
          attachCanonicalAuthorization(body, options, entitlementState),
        ),
      );
  }
}

/** Opt a controller (or route) into the canonical authorization bridge. */
export function ProjectCanonicalAuthorization(
  options: CanonicalAuthorizationOptions,
) {
  return applyDecorators(
    SetMetadata(CANONICAL_AUTHORIZATION_KEY, options),
    UseInterceptors(CanonicalAuthorizationInterceptor),
  );
}
