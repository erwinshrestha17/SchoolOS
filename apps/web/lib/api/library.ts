import {
  downloadCsv,
  JsonBody,
  request,
  withQuery,
} from './client';

export type LibraryCopyStatus =
  | 'AVAILABLE'
  | 'ISSUED'
  | 'LOST'
  | 'DAMAGED'
  | 'RESERVED';

export type LibraryIssueStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE' | 'LOST';
export type LibraryFineStatus =
  | 'PENDING'
  | 'POSTED_TO_FEES'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'WAIVED';

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
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
  } | null;
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

export type LibraryFine = {
  id: string;
  tenantId: string;
  issueId: string;
  amount: string | number;
  waivedAmount: string | number;
  status: LibraryFineStatus;
  feeInvoiceId?: string | null;
  feePostedAt?: string | null;
  waiverReason?: string | null;
  correctionReason?: string | null;
  notes?: string | null;
  alreadyPosted?: boolean;
  createdAt: string;
  updatedAt: string;
  issue?: LibraryIssue;
};

export type LibraryPopularBookReportItem = {
  book?: LibraryBook | null;
  issueCount: number;
};

export type LibraryFineSummaryReport = {
  items: LibraryIssue[];
  summary: {
    totalIssuesWithFine: number;
    totalFine: string | number;
  };
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

export type LibraryFinePayload = {
  issueId: string;
  amount: number;
  notes?: string;
};

export type UpdateLibraryFinePayload = {
  status?: LibraryFineStatus;
  waivedAmount?: number;
  waiverReason?: string;
  correctionReason?: string;
  notes?: string;
};

export type PostLibraryFineToFeesPayload = {
  reason: string;
};

export type ReturnLibraryIssuePayload = {
  returnCondition?: string;
  fineAmount?: number;
  markLost?: boolean;
  notes?: string;
};

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
  archiveCopy: (copyId: string, body: { reason: string }) =>
    request<LibraryCopy>(
      `/library/copies/${encodeURIComponent(copyId)}/archive`,
      { method: 'POST', json: body },
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
  listOverdue: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<LibraryIssue>>(
      withQuery('/library/overdue', params ?? {}),
    ),
  listFines: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<LibraryFine>>(
      withQuery('/library/fines', params ?? {}),
    ),
  updateFine: (fineId: string, body: UpdateLibraryFinePayload) =>
    request<LibraryFine>(`/library/fines/${encodeURIComponent(fineId)}`, {
      method: 'PATCH',
      json: body,
    }),
  postFineToFees: (fineId: string, body: PostLibraryFineToFeesPayload) =>
    request<LibraryFine>(
      `/library/fines/${encodeURIComponent(fineId)}/post-to-fees`,
      {
        method: 'POST',
        json: body,
      },
    ),
  getIssuedBooksReport: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<LibraryIssue>>(
      withQuery('/library/reports/issued', params ?? {}),
    ),
  getOverdueBooksReport: () =>
    request<LibraryPaginatedResult<LibraryIssue>>('/library/reports/overdue'),
  getPopularBooks: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<LibraryPopularBookReportItem>>(
      withQuery('/library/reports/popular', params ?? {}),
    ),
  getLostDamagedReport: () =>
    request<LibraryPaginatedResult<LibraryCopy>>('/library/reports/lost-damaged'),
  getFineSummary: () =>
    request<LibraryFineSummaryReport>('/library/reports/fines'),
  getBorrowerHistory: (params?: {
    studentId?: string | null;
    staffId?: string | null;
    page?: string | null;
    limit?: string | null;
  }) =>
    request<LibraryPaginatedResult<LibraryIssue>>(
      withQuery('/library/reports/borrower-history', params ?? {}),
    ),
  downloadIssuedBooksCsv: () =>
    downloadCsv('/library/reports/issued.csv', 'library-issued-books.csv'),
  getBookHistory: (bookId: string) =>
    request<{ book: LibraryBook; history: LibraryIssue[] }>(
      `/library/books/${encodeURIComponent(bookId)}/history`,
    ),
  getCopyHistory: (copyId: string) =>
    request<{ copy: LibraryCopy; history: LibraryIssue[] }>(
      `/library/copies/${encodeURIComponent(copyId)}/history`,
    ),
  sendOverdueReminders: () =>
    request<{ overdue: number; deliveryCount: number }>(
      '/library/overdue/reminders',
      { method: 'POST', json: {} },
    ),
};
