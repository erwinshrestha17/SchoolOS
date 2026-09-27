import { SecurityDomain } from '@prisma/client';
import type { AuthContext } from '../../src/auth/auth.types';
import { recordVerifiedAuthorizationIdentity } from '../../src/authorization/authorization-request-identity';

/** Synthetic authentication evidence for tests that replace the live JWT guard. */
export function recordTestAuthorizationIdentity(request: {
  auth?: AuthContext;
}): void {
  if (!request.auth) return;
  recordVerifiedAuthorizationIdentity(request, request.auth, {
    securityDomain: request.auth.securityDomain ?? SecurityDomain.SCHOOL,
    tenantId: request.auth.tenantId,
    userSessionActive: true,
    tenantActive: true,
    supportOverrideApproved: request.auth.isSupportOverride === true,
  });
}

/** Explicit fixture authentication for manual guard tests, not a live JWT substitute. */
export function recordSyntheticContextIdentity(
  context: import('@nestjs/common').ExecutionContext,
): void {
  const req = context.switchToHttp().getRequest<{ auth?: AuthContext }>();
  if (req.auth) {
    // Older manual tests specified only grants/domain. Bind a complete,
    // synthetic authenticated actor so the intended policy stage is exercised.
    req.auth = {
      ...req.auth,
      tenantSlug: req.auth.tenantSlug ?? 'synthetic',
      email: req.auth.email ?? null,
      authMethod: req.auth.authMethod ?? 'PASSWORD',
      userId: req.auth.userId ?? 'synthetic-actor',
      securityDomain: req.auth.securityDomain ?? SecurityDomain.SCHOOL,
    };
    recordTestAuthorizationIdentity(req);
  }
  const http = context.switchToHttp();
  context.switchToHttp = (() => ({
    ...http,
    getRequest: () => req,
  })) as typeof context.switchToHttp;
}
