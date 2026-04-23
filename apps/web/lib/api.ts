const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type JsonBody = Record<string, unknown>;

async function request<T>(path: string, init?: RequestInit & { json?: JsonBody }) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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

export const api = {
  login: (body: JsonBody) => request('/auth/login', { method: 'POST', json: body }),
  registerTenant: (body: JsonBody) =>
    request('/tenants/register', { method: 'POST', json: body }),
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
