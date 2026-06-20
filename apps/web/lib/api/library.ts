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
  | 'RESERVED'
  | 'ARCHIVED';

export type LibraryIssueStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE' | 'LOST';
export type LibraryFineStatus =
  | 'PENDING'
  | 'POSTED_TO_FEES'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'WAIVED';

export type LibraryReservationStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

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
  subtitle?: string | null;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  edition?: string | null;
  language?: string | null;
  deweyDecimal?: string | null;
  materialType?: string | null;
  subjectCategory?: string | null;
  classLevel?: string | null;
  keywords?: string[] | null;
  description?: string | null;
  coverImageUrl?: string | null;
  purchasePrice?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  copies?: LibraryCopy[];
};

export type LibraryCopyHistory = {
  id: string;
  tenantId?: string;
  copyId: string;
  eventType: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type LibraryCopy = {
  id: string;
  tenantId?: string;
  bookId: string;
  barcode: string;
  qrCode?: string | null;
  status: LibraryCopyStatus;
  shelfLocation?: string | null;
  acquisitionSource?: string | null;
  conditionNote?: string | null;
  replacementCost?: string | number | null;
  purchasedAt?: string | null;
  lastInventoryAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  book?: LibraryBook;
  history?: LibraryCopyHistory[];
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
  fines?: LibraryFine[];
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
  alreadyReconciled?: boolean;
  paidAmount?: string | number;
  createdAt: string;
  updatedAt: string;
  issue?: LibraryIssue;
};

export type LibraryReservation = {
  id: string;
  tenantId?: string;
  bookId: string;
  copyId?: string | null;
  borrowerStudentId?: string | null;
  borrowerStaffId?: string | null;
  status: LibraryReservationStatus | string;
  reservedAt: string;
  expiresAt: string;
  fulfilledIssueId?: string | null;
  notes?: string | null;
  book?: LibraryBook;
  copy?: LibraryCopy | null;
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
  alreadyReserved?: boolean;
};

export type LibraryPolicySettings = {
  finePerDay: string | number;
  maxFineAmount?: string | number | null;
  gracePeriodDays: number;
  lostBookChargeMultiplier: string | number;
  maxBooksPerStudent: number;
  maxBooksPerStaff: number;
  studentLoanDays: number;
  staffLoanDays: number;
  includeHolidaysInFine: boolean;
  reservationHoldDays: number;
};

export type LibraryPopularBookReportItem = {
  book?: LibraryBook | null;
  issueCount: number;
};

export type LibraryFineSummaryReport = {
  items: LibraryFine[];
  summary: {
    totalFines: number;
    totalFine: string | number;
    totalWaived: string | number;
    pending: number;
    postedToFees: number;
    paid: number;
  };
};

export type LibraryBookPayload = {
  title: string;
  subtitle?: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  edition?: string;
  language?: string;
  deweyDecimal?: string;
  materialType?: string;
  subjectCategory?: string;
  classLevel?: string;
  keywords?: string[];
  description?: string;
  coverImageUrl?: string;
  purchasePrice?: number;
};

export type LibraryCopyPayload = {
  bookId: string;
  barcode: string;
  qrCode?: string;
  shelfLocation?: string;
  acquisitionSource?: string;
  conditionNote?: string;
  replacementCost?: number;
  purchasedAt?: string;
  lastInventoryAt?: string;
};

export type LibraryIssuePayload = {
  copyId: string;
  borrowerStudentId?: string;
  borrowerStaffId?: string;
  dueAt?: string;
  notes?: string;
};

export type ScannerIssueLibraryCopyPayload = Omit<LibraryIssuePayload, 'copyId'> & {
  code: string;
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

export type ScannerReturnLibraryIssuePayload = ReturnLibraryIssuePayload & {
  code: string;
};

export type LibraryReservationPayload = {
  bookId: string;
  copyId?: string;
  borrowerStudentId?: string;
  borrowerStaffId?: string;
  expiresAt?: string;
  notes?: string;
};

export type FulfillLibraryReservationPayload = {
  copyId?: string;
  dueAt?: string;
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
  resolveScannedCopy: (code: string) =>
    request<LibraryCopy>(`/library/copies/scan/${encodeURIComponent(code)}`),
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
  listMyIssues: (params?: {
    status?: string | null;
    page?: string | null;
    limit?: string | null;
  }) =>
    request<LibraryPaginatedResult<LibraryIssue>>(
      withQuery('/library/my/issues', params ?? {}),
    ),
  issueCopy: (body: LibraryIssuePayload) =>
    request<LibraryIssue>('/library/issues', { method: 'POST', json: body }),
  issueCopyByScanner: (body: ScannerIssueLibraryCopyPayload) =>
    request<LibraryIssue>('/library/issues/scanner', {
      method: 'POST',
      json: body,
    }),
  returnIssue: (issueId: string, body: ReturnLibraryIssuePayload) =>
    request<LibraryIssue>(`/library/issues/${encodeURIComponent(issueId)}/return`, {
      method: 'PATCH',
      json: body,
    }),
  returnIssueByScanner: (body: ScannerReturnLibraryIssuePayload) =>
    request<LibraryIssue>('/library/returns/scanner', {
      method: 'POST',
      json: body,
    }),
  listReservations: (params?: {
    status?: string | null;
    bookId?: string | null;
    page?: string | null;
    limit?: string | null;
  }) =>
    request<LibraryPaginatedResult<LibraryReservation>>(
      withQuery('/library/reservations', params ?? {}),
    ),
  createReservation: (body: LibraryReservationPayload) =>
    request<LibraryReservation>('/library/reservations', {
      method: 'POST',
      json: body,
    }),
  cancelReservation: (reservationId: string) =>
    request<LibraryReservation>(
      `/library/reservations/${encodeURIComponent(reservationId)}/cancel`,
      { method: 'PATCH', json: {} },
    ),
  fulfillReservation: (
    reservationId: string,
    body: FulfillLibraryReservationPayload,
  ) =>
    request<LibraryIssue>(
      `/library/reservations/${encodeURIComponent(reservationId)}/fulfill`,
      { method: 'POST', json: body },
    ),
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
  reconcileFinePayment: (fineId: string) =>
    request<LibraryFine>(
      `/library/fines/${encodeURIComponent(fineId)}/reconcile-payment`,
      { method: 'POST', json: {} },
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
  getSettings: () => request<LibraryPolicySettings>('/library/settings'),
  updateSettings: (body: Partial<LibraryPolicySettings>) =>
    request<LibraryPolicySettings>('/library/settings', {
      method: 'PATCH',
      json: body as JsonBody,
    }),
  sendOverdueReminders: () =>
    request<{ overdue: number; deliveryCount: number }>(
      '/library/overdue/reminders',
      { method: 'POST', json: {} },
    ),
};
