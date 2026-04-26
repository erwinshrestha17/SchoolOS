import type { AuthSession } from '@schoolos/core';
import { readStoredSession } from './session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type JsonBody = Record<string, unknown>;

export type AuthChallengeResponse = {
  requiresMfa: true;
  challengeToken: string;
  challengeExpiresAt: string;
  delivery: string;
};

type RequestOptions = RequestInit & {
  auth?: boolean;
  json?: JsonBody;
};

function getAccessToken() {
  return readStoredSession()?.accessToken;
}

async function request<T>(path: string, init?: RequestOptions) {
  const accessToken = init?.auth === false ? null : getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function isAuthSession(
  value: AuthSession | AuthChallengeResponse,
): value is AuthSession {
  return 'accessToken' in value;
}

export const api = {
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
  registerTenant: (body: JsonBody) =>
    request('/tenants/register', { method: 'POST', json: body, auth: false }),
  createAdmission: (body: JsonBody) =>
    request('/admissions', { method: 'POST', json: body }),
  submitAttendance: (body: JsonBody) =>
    request('/attendance/sessions', { method: 'POST', json: body }),
  createFeeHead: (body: JsonBody) =>
    request('/fees/heads', { method: 'POST', json: body }),
  createFeePlan: (body: JsonBody) =>
    request('/fees/plans', { method: 'POST', json: body }),
  collectPayment: (body: JsonBody) =>
    request('/payments', { method: 'POST', json: body }),
  createNotice: (body: JsonBody) =>
    request('/notices', { method: 'POST', json: body }),
  createEvent: (body: JsonBody) =>
    request('/events', { method: 'POST', json: body }),
};
