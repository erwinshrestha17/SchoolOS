import { type AuthMethod, type OtpPurpose } from '@prisma/client';

export interface AuthContext {
  userId: string;
  tenantId: string;
  originalTenantId?: string;
  isSupportOverride?: boolean;
  tenantSlug: string;
  email: string | null;
  authMethod: AuthMethod;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  email: string | null;
  authMethod: AuthMethod;
  roles: string[];
}

export interface JwtChallengePayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  purpose: OtpPurpose;
}
