import {
  type AuthMethod,
  type OtpPurpose,
  type SecurityDomain,
} from '@prisma/client';
import type { SupportOverrideScope } from '@schoolos/core';

export interface AuthContext {
  userId: string;
  tenantId: string;
  originalTenantId?: string;
  isSupportOverride?: boolean;
  supportOverrideScopes?: SupportOverrideScope[];
  supportOverrideReadOnly?: boolean;
  securityDomain?: SecurityDomain;
  tenantSlug: string;
  email: string | null;
  authMethod: AuthMethod;
  mustChangePassword?: boolean;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  securityDomain?: SecurityDomain;
  email: string | null;
  authMethod: AuthMethod;
  mustChangePassword?: boolean;
  roles: string[];
  iss?: string;
  aud?: string;
  jti?: string;
}

export interface JwtChallengePayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  purpose: OtpPurpose;
}
