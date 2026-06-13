import type { PermissionKey, RoleSummary } from '@schoolos/core';
import { JsonBody, request } from './client';

export type SchoolUserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export type SchoolUserSummary = {
  id: string;
  email: string | null;
  phone: string | null;
  status: SchoolUserStatus;
  roles: Array<Pick<RoleSummary, 'id' | 'name'>>;
  profileType: 'staff' | 'student' | 'user';
  staffId: string | null;
  studentId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export type RolePermissionSummary = {
  id: string;
  key: PermissionKey;
};

export type TenantRoleSummary = RoleSummary & {
  permissions: RolePermissionSummary[];
};

export type PermissionCatalogItem = {
  id: string;
  resource: string;
  action: string;
  key: PermissionKey;
  description: string | null;
};

export const usersApi = {
  listUsers: () => request<SchoolUserSummary[]>('/users'),
  listRoleCatalog: () => request<TenantRoleSummary[]>('/roles'),
  listPermissionCatalog: () =>
    request<PermissionCatalogItem[]>('/roles/permissions'),
  createUser: (body: JsonBody) =>
    request<SchoolUserSummary>('/users', { method: 'POST', json: body }),
  updateUserStatus: (userId: string, body: { status: SchoolUserStatus }) =>
    request<SchoolUserSummary>(`/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      json: body,
    }),
  resetUserPassword: (userId: string, password: string) =>
    request<{ success: true }>(
      `/users/${encodeURIComponent(userId)}/reset-password`,
      { method: 'POST', json: { password } },
    ),
  forceLogoutUser: (userId: string) =>
    request<{ success: true }>(
      `/users/${encodeURIComponent(userId)}/force-logout`,
      { method: 'POST', json: {} },
    ),
};
