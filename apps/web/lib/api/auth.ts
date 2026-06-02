import type {
  AuthSession,
} from '@schoolos/core';
import {
  AuthChallengeResponse,
  JsonBody,
  request,
} from './client';

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
  getProfile: () => request('/auth/me'),
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
