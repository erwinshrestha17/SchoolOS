import type { AuthSession, PermissionKey } from '@schoolos/core';
import {
  AuthChallengeResponse,
  JsonBody,
  RequestOptions,
  request,
} from './client';

export type AuthProfile = {
  userId: string;
  tenantId: string;
  originalTenantId?: string;
  isSupportOverride?: boolean;
  tenantSlug: string;
  email: string | null;
  authMethod: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: PermissionKey[];
  tenant: AuthSession['tenant'];
  profileType: 'staff' | 'student' | 'user';
  staff: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
  } | null;
  student: {
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
    class: { id: string; name: string };
  } | null;
};

export const authApi = {
  login: (body: JsonBody) =>
    request<AuthSession | AuthChallengeResponse>('/auth/login', {
      method: 'POST',
      json: body,
      auth: false,
    }),
  refreshSession: () =>
    request<AuthSession>('/auth/refresh', {
      method: 'POST',
      json: {},
      auth: false,
    }),
  logout: () =>
    request<{ success: true }>('/auth/logout', {
      method: 'POST',
      json: {},
      auth: false,
    }),
  getProfile: (options?: RequestOptions) =>
    request<AuthProfile>('/auth/me', options),
  forgotPassword: (body: JsonBody) =>
    request<{ success: true }>('/auth/forgot-password', {
      method: 'POST',
      json: body,
      auth: false,
    }),
  resetPassword: (body: JsonBody) =>
    request<{ success: true }>('/auth/reset-password', {
      method: 'POST',
      json: body,
      auth: false,
    }),
  changePassword: (body: JsonBody) =>
    request<{ success: true; message: string }>('/auth/change-password', {
      method: 'POST',
      json: body,
    }),
  getEntitlements: () =>
    request<{
      tier: string | null;
      modules: string[];
      features: string[];
      addOns: string[];
    }>('/me/entitlements'),
  registerTenant: (body: JsonBody) =>
    request('/tenants/register', { method: 'POST', json: body, auth: false }),
};
