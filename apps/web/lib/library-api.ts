import { clearStoredSession } from './session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type JsonBody = Record<string, unknown>;

type RequestOptions = RequestInit & {
  json?: JsonBody;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

export type LibraryCopyStatus =
  | 'AVAILABLE'
  | 'ISSUED'
  | 'LOST'
  | 'DAMAGED'
  | 'RESERVED';

export type LibraryIssueStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE' | 'LOST';

export type LibraryPaginationMeta = {
  page: number;
  limit: number;
  total: number;
};

export type LibraryPaginatedResult<T> = {
  items: T[];
  meta: LibraryPaginationMeta;
};

export type LibraryBook = {
  id: string;
  tenantId?: string;
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  subjectCategory?: string | null;
  classLevel?: string | null;
  purchasePrice?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  copies?: LibraryCopy[];
};

export type LibraryCopy = {
  id: string;
  tenantId?: string;
  bookId: string;
  barcode: string;
  qrCode?: string | null;
  status: LibraryCopyStatus;
  shelfLocation?: string | null;
  replacementCost?: string | number | null;
  purchasedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  book?: LibraryBook;
};

export type LibraryIssue = {
  id: string;
  tenantId?: string;
  copyId: string;
  borrowerStudentId?: string | null;
  borrowerStaffId?: string | null;
  issuedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  returnCondition?: string | null;
  status: LibraryIssueStatus;
  fineAmount?: string | number | null;
  invoiceId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  copy?: LibraryCopy;
  borrowerStudent?: {
    id: string;
    studentSystemId?: string;
    firstNameEn?: string;
    lastNameEn?: string;
  } | null;
  borrowerStaff?: {
    id: string;
    employeeId?: string;
    firstName?: string;
    lastName?: string;
  } | null;
};

export type LibraryBookPayload = {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  subjectCategory?: string;
  classLevel?: string;
  purchasePrice?: number;
};

export type LibraryCopyPayload = {
  bookId: string;
  barcode: string;
  qrCode?: string;
  shelfLocation?: string;
  replacementCost?: number;
  purchasedAt?: string;
};

export type LibraryIssuePayload = {
  copyId: string;
  borrowerStudentId?: string;
  borrowerStaffId?: string;
  dueAt: string;
  notes?: string;
};

export type ReturnLibraryIssuePayload = {
  returnCondition?: string;
  fineAmount?: number;
  markLost?: boolean;
  notes?: string;
};

function withQuery(path: string, params: Record<string, string | undefined | null>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
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
    if (
      response.status === 401 &&
      init?.auth !== false &&
      init?.retryOnUnauthorized !== false &&
      (await refreshAccessCookie())
    ) {
      return request<T>(path, { ...init, retryOnUnauthorized: false });
    }

    const text = await response.text();

    if (response.status === 401 && init?.auth !== false) {
      clearStoredSession();
    }

    throw new Error(
      parseApiErrorMessage(text) || `Request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function parseApiErrorMessage(text: string) {
  if (!text) return '';

  try {
    const payload = JSON.parse(text) as {
      message?: string | string[];
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

async function refreshAccessCookie() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const libraryApi = {
  listBooks: (params?: {
    q?: string | null;
    page?: string | null;
    limit?: string | null;
  }) =>
    request<LibraryPaginatedResult<LibraryBook>>(
      withQuery('/library/books', params ?? {}),
    ),
  createBook: (body: LibraryBookPayload) =>
    request<LibraryBook>('/library/books', { method: 'POST', json: body }),
  updateBook: (bookId: string, body: Partial<LibraryBookPayload>) =>
    request<LibraryBook>(`/library/books/${encodeURIComponent(bookId)}`, {
      method: 'PATCH',
      json: body,
    }),
  listCopies: (params?: {
    bookId?: string | null;
    status?: string | null;
    barcode?: string | null;
    page?: string | null;
    limit?: string | null;
  }) =>
    request<LibraryPaginatedResult<LibraryCopy>>(
      withQuery('/library/copies', params ?? {}),
    ),
  createCopy: (body: LibraryCopyPayload) =>
    request<LibraryCopy>('/library/copies', { method: 'POST', json: body }),
  updateCopy: (copyId: string, body: Partial<LibraryCopyPayload>) =>
    request<LibraryCopy>(`/library/copies/${encodeURIComponent(copyId)}`, {
      method: 'PATCH',
      json: body,
    }),
  updateCopyStatus: (
    copyId: string,
    body: { status: LibraryCopyStatus; reason?: string },
  ) =>
    request<LibraryCopy>(
      `/library/copies/${encodeURIComponent(copyId)}/status`,
      { method: 'PATCH', json: body },
    ),
  listIssues: (params?: {
    status?: string | null;
    studentId?: string | null;
    staffId?: string | null;
    page?: string | null;
    limit?: string | null;
  }) =>
    request<LibraryPaginatedResult<LibraryIssue>>(
      withQuery('/library/issues', params ?? {}),
    ),
  issueCopy: (body: LibraryIssuePayload) =>
    request<LibraryIssue>('/library/issues', { method: 'POST', json: body }),
  returnIssue: (issueId: string, body: ReturnLibraryIssuePayload) =>
    request<LibraryIssue>(`/library/issues/${encodeURIComponent(issueId)}/return`, {
      method: 'PATCH',
      json: body,
    }),
  listOverdue: () => request<LibraryIssue[]>('/library/overdue'),
  sendOverdueReminders: () =>
    request<{ overdue: number; deliveryCount: number }>(
      '/library/overdue/reminders',
      { method: 'POST', json: {} },
    ),
};
