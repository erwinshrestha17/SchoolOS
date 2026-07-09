import { type AuthMethod, type OtpPurpose } from '@prisma/client';

export interface AuthContext {
  userId: string;
  tenantId: string;
  originalTenantId?: string;
  isSupportOverride?: boolean;
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
