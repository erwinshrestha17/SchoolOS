export type LibraryBookSummary = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  subjectCategory: string | null;
  classLevel: string | null;
  copyCount?: number;
};

export type LibraryCopySummary = {
  id: string;
  bookId: string;
  barcode: string;
  qrCode: string | null;
  status: string;
  shelfLocation: string | null;
  replacementCost: number | null;
};

export type LibraryIssueSummary = {
  id: string;
  copyId: string;
  borrowerStudentId: string | null;
  borrowerStaffId: string | null;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  fineAmount: number;
  invoiceId: string | null;
};
