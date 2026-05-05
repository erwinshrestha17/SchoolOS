import type { ApiResponse } from '@schoolos/core';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type JsonBody = Record<string, unknown>;

type RequestOptions = RequestInit & {
  json?: JsonBody;
};

type MarkLockFilters = {
  examTermId?: string | null;
  status?: string | null;
  requestedById?: string | null;
};

export type MarkLockRequestSummary = {
  id: string;
  tenantId: string;
  examTermId: string;
  requestedById: string;
  reviewedById?: string | null;
  status: string;
  reason: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  examTerm?: {
    id: string;
    name: string;
    isLocked: boolean;
    academicYear?: {
      id: string;
      name: string;
    } | null;
  } | null;
  requestedBy?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  reviewedBy?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};

function parseApiErrorMessage(text: string) {
  if (!text) return '';

  try {
    const payload = JSON.parse(text) as ApiResponse<unknown> & {
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;
    return message || payload.error || text;
  } catch {
    return text;
  }
}

async function request<T>(path: string, init?: RequestOptions) {
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
    throw new Error(
      parseApiErrorMessage(text) || `Request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function withQuery(path: string, params: MarkLockFilters) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export const markLockApi = {
  listRequests: (filters?: MarkLockFilters) =>
    request<MarkLockRequestSummary[]>(
      withQuery('/academics/marks/lock-requests', filters ?? {}),
    ),
  createRequest: (body: { examTermId: string; reason: string }) =>
    request<MarkLockRequestSummary>('/academics/marks/lock-requests', {
      method: 'POST',
      json: body,
    }),
  reviewRequest: (
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string },
  ) =>
    request<MarkLockRequestSummary>(
      `/academics/marks/lock-requests/${encodeURIComponent(id)}/review`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  unlockExamTerm: (id: string, body: { reason?: string }) =>
    request<{ examTermId: string; unlocked: true; request: MarkLockRequestSummary }>(
      `/academics/exams/${encodeURIComponent(id)}/unlock`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
};
