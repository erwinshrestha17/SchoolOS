export type LibraryBookSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publishedYear?: number | null;
  edition: string | null;
  language: string | null;
  deweyDecimal: string | null;
  materialType: string | null;
  subjectCategory: string | null;
  classLevel: string | null;
  keywords?: string[] | null;
  description: string | null;
  coverImageUrl: string | null;
  copyCount?: number;
};

export type LibraryCopySummary = {
  id: string;
  bookId: string;
  barcode: string;
  qrCode: string | null;
  status: string;
  shelfLocation: string | null;
  acquisitionSource: string | null;
  conditionNote: string | null;
  replacementCost: number | null;
  lastInventoryAt?: string | null;
};

export type LibraryIssueSummary = {
  id: string;
  copyId: string;
  borrowerStudentId: string | null;
  borrowerStaffId: string | null;
  issuedAt?: string;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  fineAmount: number;
  invoiceId: string | null;
};

export type LibraryReservationSummary = {
  id: string;
  bookId: string;
  copyId: string | null;
  borrowerStudentId: string | null;
  borrowerStaffId: string | null;
  status: string;
  reservedAt: string;
  expiresAt: string;
  fulfilledIssueId: string | null;
  notes: string | null;
};

export type LibraryCopyHistoryEntry = {
  id: string;
  copyId: string;
  eventType: string;
  statusBefore: string | null;
  statusAfter: string | null;
  reason: string | null;
  actorUserId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type LibraryPolicySettings = {
  finePerDay: number;
  maxFineAmount: number | null;
  gracePeriodDays: number;
  lostBookChargeMultiplier: number;
  maxBooksPerStudent: number;
  maxBooksPerStaff: number;
  studentLoanDays: number;
  staffLoanDays: number;
  includeHolidaysInFine: boolean;
  reservationHoldDays: number;
};
