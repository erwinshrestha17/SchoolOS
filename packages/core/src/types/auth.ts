import type { PermissionKey } from '../permissions.js';
import type { TenantSummary } from './common.js';

export type AuthSessionUser = {
  id: string;
  tenantId: string;
  originalTenantId?: string;
  isSupportOverride?: boolean;
  tenantSlug: string;
  email: string | null;
  authMethod: string;
  roles: string[];
  permissions: PermissionKey[];
};

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string | null;
  user: AuthSessionUser;
  tenant: TenantSummary;
};
