import fs from 'fs';
import path from 'path';

const file = '/Users/erwin/Projects/SchoolOS/apps/web/lib/library-api.ts';
let code = fs.readFileSync(file, 'utf8');

const additionalTypes = `
export type LibraryFine = {
  id: string;
  tenantId: string;
  issueId: string;
  amount: string | number;
  waivedAmount?: string | number | null;
  status: 'PENDING' | 'WAIVED' | 'PAID';
  waiverReason?: string | null;
  correctionReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  issue?: LibraryIssue;
};

export type LibraryFinePayload = {
  issueId: string;
  amount: number;
  notes?: string;
};

export type UpdateLibraryFinePayload = {
  status?: 'PENDING' | 'WAIVED' | 'PAID';
  waivedAmount?: number;
  waiverReason?: string;
  correctionReason?: string;
  notes?: string;
};
`;

code = code.replace("export type LibraryIssuePayload = {", additionalTypes + "\nexport type LibraryIssuePayload = {");

const newEndpoints = `
  resolveQrBorrower: (token: string) =>
    request<{
      studentId: string;
      studentCode?: string;
      name: string;
      classSection: string;
      photoUrl?: string | null;
      lifecycleStatus: string;
      activeIssues: number;
      overdueBooks: number;
      canBorrow: boolean;
    }>('/library/qr-lookup', { method: 'POST', json: { token } }),
  getBorrowedStudents: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<any>>(
      withQuery('/library/borrowed-students', params ?? {}),
    ),
  listFines: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<LibraryFine>>(
      withQuery('/library/fines', params ?? {}),
    ),
  createFine: (body: LibraryFinePayload) =>
    request<LibraryFine>('/library/fines', { method: 'POST', json: body }),
  updateFine: (fineId: string, body: UpdateLibraryFinePayload) =>
    request<LibraryFine>(\`/library/fines/\${encodeURIComponent(fineId)}\`, {
      method: 'PATCH',
      json: body,
    }),
  getFineSummary: () => request<any>('/library/reports/fines'),
  getPopularBooks: (params?: { page?: string; limit?: string }) =>
    request<LibraryPaginatedResult<{ book: LibraryBook; issueCount: number }>>(
      withQuery('/library/reports/popular', params ?? {}),
    ),
  getLostDamagedReport: () =>
    request<LibraryPaginatedResult<LibraryCopy>>('/library/reports/lost-damaged'),
`;

code = code.replace("sendOverdueReminders: () =>", newEndpoints + "\n  sendOverdueReminders: () =>");

fs.writeFileSync(file, code);
