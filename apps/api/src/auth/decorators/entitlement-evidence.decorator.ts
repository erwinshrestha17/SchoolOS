import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { EntitlementState } from '@schoolos/core';
import { type AuthenticatedRequest } from '../auth-request.interface';

/**
 * Entitlement keys EntitlementGuard verified for this request (Phase 3A).
 * Empty when no guard decision exists.
 */
export const EntitlementEvidence = createParamDecorator(
  (_data: unknown, context: ExecutionContext): readonly string[] => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.entitlementEvidence ?? [];
  },
);

/**
 * ENABLED only when the guard verified `module` for this request; otherwise
 * UNKNOWN, which the canonical authorization contract treats as deny-all.
 */
export function entitlementStateFromEvidence(
  evidence: readonly string[] | undefined,
  module: string,
): EntitlementState {
  return {
    module,
    state: evidence?.includes(module) ? 'ENABLED' : 'UNKNOWN',
  };
}
