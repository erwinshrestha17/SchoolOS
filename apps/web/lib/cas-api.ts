import type { ApiResponse, CasRecordSummary } from '@schoolos/core';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type JsonBody = Record<string, unknown>;

type RequestOptions = RequestInit & {
  json?: JsonBody;
};

type CasListFilters = {
  academicYearId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  studentId?: string | null;
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
    throw new Error(parseApiErrorMessage(text) || `Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function withQuery(path: string, params: CasListFilters) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export const casApi = {
  listCasRecords: (filters?: CasListFilters) =>
    request<CasRecordSummary[]>(withQuery('/academics/cas', filters ?? {})),
  updateCasRecord: (id: string, body: JsonBody) =>
    request<CasRecordSummary>(`/academics/cas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: body,
    }),
  deleteCasRecord: (id: string) =>
    request<{ deleted: true; casRecordId: string }>(
      `/academics/cas/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  batchCreateCasRecords: (body: JsonBody) =>
    request<{ created: number; entries: CasRecordSummary[] }>('/academics/cas/batch', {
      method: 'POST',
      json: body,
    }),
};
