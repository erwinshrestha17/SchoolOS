export type AuthContext = {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string | null;
  roles: string[];
  permissions: string[];
};

export type JwtAccessPayload = {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  email: string | null;
  roles: string[];
  permissions: string[];
};
