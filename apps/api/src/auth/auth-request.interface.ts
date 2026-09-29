import { type Request } from 'express';
import { type AuthContext } from './auth.types';

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
  requestId?: string;
  /**
   * Module/feature keys (without the `module.` prefix) that EntitlementGuard
   * verified as ENABLED for this tenant during this request. Absent means no
   * entitlement decision was made; consumers must treat that as UNKNOWN.
   */
  entitlementEvidence?: readonly string[];
}
