export interface AuthContext {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string | null;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  email: string | null;
  roles: string[];
  permissions: string[];
}
