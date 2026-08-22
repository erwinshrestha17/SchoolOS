import type { PermissionKey } from "../permissions.js";
import type { TenantSummary } from "./common.js";

export type SupportOverrideScope =
  | 'SCHOOL_PROFILE'
  | 'STUDENT_RECORDS'
  | 'ATTENDANCE'
  | 'ACADEMICS'
  | 'HOMEWORK_TIMETABLE'
  | 'NOTICES_DELIVERY';

export type AuthSessionUser = {
  id: string;
  tenantId: string;
  originalTenantId?: string;
  isSupportOverride?: boolean;
  supportOverrideScopes?: SupportOverrideScope[];
  supportOverrideReadOnly?: boolean;
  securityDomain?: 'SCHOOL' | 'PLATFORM';
  tenantSlug: string;
  email: string | null;
  authMethod: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: PermissionKey[];
};

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string | null;
  user: AuthSessionUser;
  tenant: TenantSummary;
};
