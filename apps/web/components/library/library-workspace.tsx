'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  BellRing,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Library,
  PackageCheck,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { StudentProfile } from '@schoolos/core';
import {
  libraryApi,
  type LibraryBook,
  type LibraryBookPayload,
  type LibraryCopy,
  type LibraryCopyPayload,
  type LibraryCopyStatus,
  type LibraryFineSummaryReport,
  type LibraryIssue,
  type LibraryIssuePayload,
  type LibraryPaginationMeta,
  type LibraryPaginatedResult,
  type LibraryPopularBookReportItem,
  type ReturnLibraryIssuePayload,
} from '../../lib/library-api';
import { api } from '../../lib/api';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { StatusBadge, type StatusTone } from '../ui/status-badge';
import { cn } from '../../lib/utils';
import { StudentSelector } from '../students/student-selector';
import { BookSelector } from './book-selector';
import { QRResolver } from '../ui/qr-resolver';
import { ConfirmDialog } from '../ui/confirm-dialog';

const tabs = [
  { key: 'overview', label: 'Overview', href: '/dashboard/library' },
  { key: 'books', label: 'Books', href: '/dashboard/library/books' },
  { key: 'copies', label: 'Copies', href: '/dashboard/library/copies' },
  { key: 'issues', label: 'Issues', href: '/dashboard/library/issues' },
  { key: 'overdue', label: 'Overdue', href: '/dashboard/library/overdue' },
  { key: 'fines', label: 'Fines', href: '/dashboard/library/fines' },
  { key: 'reports', label: 'Reports', href: '/dashboard/library/reports' },
] as const;

type LibraryTab = (typeof tabs)[number]['key'];

type LibraryWorkspaceProps = {
  initialTab?: LibraryTab;
};

const copyStatuses: LibraryCopyStatus[] = [
  'AVAILABLE',
  'ISSUED',
  'RESERVED',
  'LOST',
  'DAMAGED',
];

const emptyBookForm: LibraryBookPayload = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  subjectCategory: '',
  classLevel: '',
};

const emptyCopyForm: LibraryCopyPayload = {
  bookId: '',
  barcode: '',
  qrCode: '',
  shelfLocation: '',
};

const emptyIssueForm: LibraryIssuePayload = {
  copyId: '',
  borrowerStudentId: '',
  borrowerStaffId: '',
  dueAt: '',
  notes: '',
};

const emptyBooks: LibraryBook[] = [];
const emptyCopies: LibraryCopy[] = [];
const emptyIssues: LibraryIssue[] = [];
const listPageSize = '25';

type LibraryQrBorrower = {
  id?: string;
  studentId?: string;
  name?: string;
  studentCode?: string;
  classSection?: string;
  photoUrl?: string | null;
  activeIssues?: number;
  overdueBooks?: number;
  canBorrow?: boolean;
};

type LibraryCopyScanResult = {
  code: string;
  status: 'matched' | 'unavailable' | 'missing';
  message: string;
  copy?: LibraryCopy;
  scannedAt: string;
};

export function LibraryWorkspace({ initialTab = 'overview' }: LibraryWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [bookSearch, setBookSearch] = useState('');
  const [copySearch, setCopySearch] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [issueStatus, setIssueStatus] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [copyPage, setCopyPage] = useState(1);
  const [issuePage, setIssuePage] = useState(1);
  const [overduePage, setOverduePage] = useState(1);
  const [finePage, setFinePage] = useState(1);
  const [bookForm, setBookForm] = useState<LibraryBookPayload>(emptyBookForm);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [copyForm, setCopyForm] = useState<LibraryCopyPayload>(emptyCopyForm);
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [issueForm, setIssueForm] = useState<LibraryIssuePayload>(emptyIssueForm);
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnLibraryIssuePayload>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isConfirmingReturn, setIsConfirmingReturn] = useState<string | null>(null);
  const [viewingHistory, setViewingHistory] = useState<{ type: 'book' | 'copy'; id: string } | null>(null);
  const [copyStatusReasons, setCopyStatusReasons] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ['library-books', bookSearch, bookPage],
    queryFn: () =>
      libraryApi.listBooks({
        q: bookSearch,
        page: String(bookPage),
        limit: listPageSize,
      }),
  });
  const copiesQuery = useQuery({
    queryKey: ['library-copies', copySearch, copyStatus, copyPage],
    queryFn: () =>
      libraryApi.listCopies({
        barcode: copySearch,
        status: copyStatus,
        page: String(copyPage),
        limit: listPageSize,
      }),
  });
  const issuesQuery = useQuery({
    queryKey: ['library-issues', issueStatus, issuePage],
    queryFn: () =>
      libraryApi.listIssues({
        status: issueStatus,
        page: String(issuePage),
        limit: listPageSize,
      }),
  });
  const overdueQuery = useQuery({
    queryKey: ['library-overdue', overduePage],
    queryFn: () =>
      libraryApi.listOverdue({
        page: String(overduePage),
        limit: listPageSize,
      }),
  });
  const schoolStudentsQuery = useQuery({ 
    queryKey: ['students-for-library'], 
    queryFn: () => api.listStudents({ limit: 1000 }) 
  });
  const staffQuery = useQuery({
    queryKey: ['staff-for-library'],
    queryFn: api.listStaff,
  });

  const finesQuery = useQuery({
    queryKey: ['library-fines', finePage],
    queryFn: () =>
      libraryApi.listFines({
        page: String(finePage),
        limit: listPageSize,
      }),
    enabled: activeTab === 'fines' || activeTab === 'overview',
  });

  const popularBooksQuery = useQuery({
    queryKey: ['library-popular-books'],
    queryFn: () => libraryApi.getPopularBooks({ limit: '10' }),
    enabled: activeTab === 'reports',
  });

  const issuedBooksReportQuery = useQuery({
    queryKey: ['library-issued-books-report'],
    queryFn: () => libraryApi.getIssuedBooksReport({ limit: '8' }),
    enabled: activeTab === 'reports',
  });

  const overdueBooksReportQuery = useQuery({
    queryKey: ['library-overdue-books-report'],
    queryFn: libraryApi.getOverdueBooksReport,
    enabled: activeTab === 'reports',
  });

  const lostDamagedQuery = useQuery({
    queryKey: ['library-lost-damaged'],
    queryFn: () => libraryApi.getLostDamagedReport(),
    enabled: activeTab === 'reports',
  });

  const fineSummaryQuery = useQuery({
    queryKey: ['library-fine-summary'],
    queryFn: libraryApi.getFineSummary,
    enabled: activeTab === 'reports',
  });

  const historyQuery = useQuery<{ history: LibraryIssue[] }, Error>({
    queryKey: ['library-history', viewingHistory],
    queryFn: async () => {
      if (viewingHistory?.type === 'book') {
        const res = await libraryApi.getBookHistory(viewingHistory.id);
        return { history: res.history };
      }
      if (viewingHistory?.type === 'copy') {
        const res = await libraryApi.getCopyHistory(viewingHistory.id);
        return { history: res.history };
      }
      return { history: [] };
    },
    enabled: Boolean(viewingHistory),
  });

  const updateFineMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      libraryApi.updateFine(id, body),
    onSuccess: () => {
      setNotice('Fine updated successfully.');
      void queryClient.invalidateQueries({ queryKey: ['library-fines'] });
    },
  });

  const postFineToFeesMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      libraryApi.postFineToFees(id, { reason }),
    onSuccess: (fine) => {
      setNotice(
        fine.alreadyPosted
          ? 'Library fine was already linked to a fee invoice.'
          : 'Library fine posted to Fees. Open the linked invoice from the fine row.',
      );
      void queryClient.invalidateQueries({ queryKey: ['library-fines'] });
      void queryClient.invalidateQueries({ queryKey: ['library-issues'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const invalidateLibrary = () => {
    void queryClient.invalidateQueries({ queryKey: ['library-books'] });
    void queryClient.invalidateQueries({ queryKey: ['library-copies'] });
    void queryClient.invalidateQueries({ queryKey: ['library-issues'] });
    void queryClient.invalidateQueries({ queryKey: ['library-overdue'] });
  };

  const createBookMutation = useMutation({
    mutationFn: libraryApi.createBook,
    onSuccess: () => {
      setBookForm(emptyBookForm);
      setNotice('Book saved successfully.');
      invalidateLibrary();
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<LibraryBookPayload> }) =>
      libraryApi.updateBook(id, body),
    onSuccess: () => {
      setBookForm(emptyBookForm);
      setEditingBookId(null);
      setNotice('Book updated successfully.');
      invalidateLibrary();
    },
  });

  const createCopyMutation = useMutation({
    mutationFn: libraryApi.createCopy,
    onSuccess: () => {
      setCopyForm(emptyCopyForm);
      setNotice('Book copy saved successfully.');
      invalidateLibrary();
    },
  });

  const updateCopyMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<LibraryCopyPayload> }) =>
      libraryApi.updateCopy(id, body),
    onSuccess: () => {
      setCopyForm(emptyCopyForm);
      setEditingCopyId(null);
      setNotice('Copy updated successfully.');
      invalidateLibrary();
    },
  });

  const copyStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: LibraryCopyStatus;
      reason?: string;
    }) => libraryApi.updateCopyStatus(id, { status, reason }),
    onSuccess: () => {
      setNotice('Copy status updated.');
      invalidateLibrary();
    },
  });

  const archiveCopyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      libraryApi.archiveCopy(id, { reason }),
    onSuccess: () => {
      setNotice('Copy archived with audit reason.');
      invalidateLibrary();
    },
  });

  const issueMutation = useMutation({
    mutationFn: libraryApi.issueCopy,
    onSuccess: () => {
      setIssueForm(emptyIssueForm);
      setNotice('Copy issued successfully.');
      invalidateLibrary();
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnLibraryIssuePayload }) =>
      libraryApi.returnIssue(id, body),
    onSuccess: () => {
      setNotice('Issue closed successfully.');
      invalidateLibrary();
    },
  });

  const remindersMutation = useMutation({
    mutationFn: libraryApi.sendOverdueReminders,
    onSuccess: (result) => {
      setNotice(
        `Overdue reminders queued for ${result.deliveryCount} recipient delivery records.`,
      );
      invalidateLibrary();
    },
  });

  const issuedCsvMutation = useMutation({
    mutationFn: libraryApi.downloadIssuedBooksCsv,
    onSuccess: () => {
      setNotice('Issued books CSV export downloaded.');
    },
  });

  const resolveCopyScanMutation = useMutation({
    mutationFn: libraryApi.resolveScannedCopy,
  });

  const books = booksQuery.data?.items ?? emptyBooks;
  const copies = copiesQuery.data?.items ?? emptyCopies;
  const issues = issuesQuery.data?.items ?? emptyIssues;
  const overdueIssues = overdueQuery.data?.items ?? emptyIssues;

  const stats = useMemo(() => {
    const totalBooks = booksQuery.data?.meta.total ?? books.length;
    const totalCopies = copiesQuery.data?.meta.total ?? copies.length;

    return {
      totalBooks,
      totalCopies,
      availableCopies: 'Unavailable' as const,
      issuedCopies: 'Unavailable' as const,
      overdueIssues: overdueQuery.data?.meta.total ?? overdueIssues.length,
      lostDamaged: 'Unavailable' as const,
    };
  }, [
    books.length,
    booksQuery.data?.meta.total,
    copies.length,
    copiesQuery.data?.meta.total,
    overdueIssues.length,
    overdueQuery.data?.meta.total,
  ]);

  const isLoading = booksQuery.isLoading || copiesQuery.isLoading || issuesQuery.isLoading;
  const error =
    booksQuery.error || copiesQuery.error || issuesQuery.error || overdueQuery.error;

  function handleBookSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = cleanBookPayload(bookForm);

    if (editingBookId) {
      updateBookMutation.mutate({ id: editingBookId, body: payload });
      return;
    }

    createBookMutation.mutate(payload);
  }

  function handleCopySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = cleanCopyPayload(copyForm);

    if (editingCopyId) {
      updateCopyMutation.mutate({ id: editingCopyId, body: payload });
      return;
    }

    createCopyMutation.mutate(payload);
  }

  function handleIssueSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: LibraryIssuePayload = {
      copyId: issueForm.copyId,
      dueAt: issueForm.dueAt,
      notes: issueForm.notes || undefined,
      ...(issueForm.borrowerStudentId
        ? { borrowerStudentId: issueForm.borrowerStudentId }
        : {}),
      ...(issueForm.borrowerStaffId
        ? { borrowerStaffId: issueForm.borrowerStaffId }
        : {}),
    };

    issueMutation.mutate(payload);
  }

  function editBook(book: LibraryBook) {
    setEditingBookId(book.id);
    setBookForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? '',
      publisher: book.publisher ?? '',
      publishedYear: book.publishedYear ?? undefined,
      subjectCategory: book.subjectCategory ?? '',
      classLevel: book.classLevel ?? '',
      purchasePrice:
        book.purchasePrice === null || book.purchasePrice === undefined
          ? undefined
          : Number(book.purchasePrice),
    });
    setActiveTab('books');
  }

  function editCopy(copy: LibraryCopy) {
    setEditingCopyId(copy.id);
    setCopyForm({
      bookId: copy.bookId,
      barcode: copy.barcode,
      qrCode: copy.qrCode ?? '',
      shelfLocation: copy.shelfLocation ?? '',
      replacementCost:
        copy.replacementCost === null || copy.replacementCost === undefined
          ? undefined
          : Number(copy.replacementCost),
      purchasedAt: copy.purchasedAt?.slice(0, 10) ?? '',
    });
    setActiveTab('copies');
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {error && <ErrorNotice message={(error as Error).message} />}

      {activeTab === 'overview' && (
        <OverviewPanel stats={stats} isLoading={isLoading} overdueIssues={overdueIssues} />
      )}

      {activeTab === 'books' && (
        <BooksPanel
          books={books}
          copies={copies}
          search={bookSearch}
          setSearch={(value) => {
            setBookSearch(value);
            setBookPage(1);
          }}
          form={bookForm}
          setForm={setBookForm}
          editingBookId={editingBookId}
          setEditingBookId={setEditingBookId}
          onSubmit={handleBookSubmit}
          onEdit={editBook}
          onViewHistory={(type, id) => setViewingHistory({ type, id })}
          isLoading={booksQuery.isLoading}
          isSaving={createBookMutation.isPending || updateBookMutation.isPending}
          error={createBookMutation.error || updateBookMutation.error}
          meta={booksQuery.data?.meta}
          onPageChange={setBookPage}
        />
      )}

      {activeTab === 'copies' && (
        <CopiesPanel
          books={books}
          copies={copies}
          search={copySearch}
          setSearch={(value) => {
            setCopySearch(value);
            setCopyPage(1);
          }}
          status={copyStatus}
          setStatus={(value) => {
            setCopyStatus(value);
            setCopyPage(1);
          }}
          form={copyForm}
          setForm={setCopyForm}
          editingCopyId={editingCopyId}
          setEditingCopyId={setEditingCopyId}
          onSubmit={handleCopySubmit}
          onEdit={editCopy}
          onViewHistory={(type, id) => setViewingHistory({ type, id })}
          onStatusChange={(copy, status) =>
            copyStatusMutation.mutate({
              id: copy.id,
              status,
              reason: copyStatusReasons[copy.id]?.trim() || undefined,
            })
          }
          onArchiveCopy={(copy, reason) =>
            archiveCopyMutation.mutate({ id: copy.id, reason })
          }
          reasons={copyStatusReasons}
          setReason={(copyId, reason) =>
            setCopyStatusReasons((current) => ({
              ...current,
              [copyId]: reason,
            }))
          }
          isLoading={copiesQuery.isLoading}
          isSaving={createCopyMutation.isPending || updateCopyMutation.isPending}
          error={
            createCopyMutation.error ||
            updateCopyMutation.error ||
            copyStatusMutation.error ||
            archiveCopyMutation.error
          }
          meta={copiesQuery.data?.meta}
          onPageChange={setCopyPage}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(viewingHistory)}
        onClose={() => setViewingHistory(null)}
        title={`${viewingHistory?.type === 'book' ? 'Book' : 'Copy'} Circulation History`}
        description="Review all historical issue and return events for this item."
        confirmLabel="Close"
        onConfirm={() => setViewingHistory(null)}
      >
        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-4">
          {historyQuery.isLoading && <LoadingState label="Loading history..." />}
          {historyQuery.data?.history.map((issue: any) => (
            <div key={issue.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm">
              <div className="flex justify-between font-bold">
                <span>{borrowerName(issue)}</span>
                <LibraryStatusBadge status={issue.status} />
              </div>
              <div className="mt-1 text-slate-500">
                <p>Issued: {formatDate(issue.issuedAt)}</p>
                <p>Returned: {formatDate(issue.returnedAt)}</p>
                {issue.fineAmount > 0 && <p className="text-red-600 font-bold">Fine: {money(issue.fineAmount)}</p>}
              </div>
            </div>
          ))}
          {historyQuery.data?.history.length === 0 && <EmptyState title="No history" description="This item has never been issued." />}
        </div>
      </ConfirmDialog>

      {activeTab === 'issues' && (
        <IssuesPanel
          copies={copies}
          issues={issues}
          students={schoolStudentsQuery.data?.items ?? []}
          staff={staffQuery.data ?? []}
          status={issueStatus}
          setStatus={(value) => {
            setIssueStatus(value);
            setIssuePage(1);
          }}
          form={issueForm}
          setForm={setIssueForm}
          returnDrafts={returnDrafts}
          setReturnDrafts={setReturnDrafts}
          onIssueSubmit={handleIssueSubmit}
          onReturn={(issue, body) => returnMutation.mutate({ id: issue.id, body })}
          isLoading={issuesQuery.isLoading}
          isSaving={issueMutation.isPending || returnMutation.isPending}
          error={issueMutation.error || returnMutation.error}
          onResolveCopyScan={(code) => resolveCopyScanMutation.mutateAsync(code)}
          isResolvingCopyScan={resolveCopyScanMutation.isPending}
          scanError={resolveCopyScanMutation.error}
          meta={issuesQuery.data?.meta}
          onPageChange={setIssuePage}
        />
      )}

      {activeTab === 'overdue' && (
        <OverduePanel
          overdueIssues={overdueIssues}
          isLoading={overdueQuery.isLoading}
          isSending={remindersMutation.isPending}
          onSendReminders={() => remindersMutation.mutate()}
          error={remindersMutation.error}
          meta={overdueQuery.data?.meta}
          onPageChange={setOverduePage}
        />
      )}
      
      {activeTab === 'fines' && (
        <FinesPanel
          fines={finesQuery.data?.items ?? []}
          isLoading={finesQuery.isLoading}
          onUpdateFine={(id, body) => updateFineMutation.mutate({ id, body })}
          isUpdating={updateFineMutation.isPending}
          onPostFineToFees={(id, reason) =>
            postFineToFeesMutation.mutate({ id, reason })
          }
          isPosting={postFineToFeesMutation.isPending}
          postError={postFineToFeesMutation.error}
          meta={finesQuery.data?.meta}
          onPageChange={setFinePage}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsPanel
          issuedBooksReport={issuedBooksReportQuery.data}
          overdueBooksReport={overdueBooksReportQuery.data}
          popularBooks={popularBooksQuery.data?.items ?? []}
          lostDamaged={lostDamagedQuery.data?.items ?? []}
          fineSummary={fineSummaryQuery.data}
          isLoading={
            issuedBooksReportQuery.isLoading ||
            overdueBooksReportQuery.isLoading ||
            popularBooksQuery.isLoading ||
            lostDamagedQuery.isLoading ||
            fineSummaryQuery.isLoading
          }
          isExportingIssuedCsv={issuedCsvMutation.isPending}
          exportError={issuedCsvMutation.error}
          onExportIssuedCsv={() => issuedCsvMutation.mutate()}
        />
      )}
    </div>
  );
}

function OverviewPanel({
  stats,
  isLoading,
  overdueIssues,
}: {
  stats: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number | 'Unavailable';
    issuedCopies: number | 'Unavailable';
    overdueIssues: number;
    lostDamaged: number | 'Unavailable';
  };
  isLoading: boolean;
  overdueIssues: LibraryIssue[];
}) {
  return (
    <div className="space-y-6">
      <KpiGrid className="xl:grid-cols-3">
        <KpiCard title="Total books" value={stats.totalBooks} icon={<BookOpen size={18} />} loading={isLoading} description="Backend catalog metadata" />
        <KpiCard title="Total copies" value={stats.totalCopies} icon={<Copy size={18} />} loading={isLoading} description="Backend copy metadata" />
        <KpiCard title="Available copies" value={stats.availableCopies} icon={<PackageCheck size={18} />} tone="neutral" description="Needs copy-status summary" />
        <KpiCard title="Issued copies" value={stats.issuedCopies} icon={<ClipboardList size={18} />} tone="neutral" description="Needs circulation summary" />
        <KpiCard title="Overdue issues" value={stats.overdueIssues} icon={<AlertCircle size={18} />} loading={isLoading} description="Backend overdue metadata" tone={stats.overdueIssues > 0 ? 'warning' : 'success'} />
        <KpiCard title="Lost / damaged" value={stats.lostDamaged} icon={<Library size={18} />} tone="neutral" description="Needs inventory-health summary" />
      </KpiGrid>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Operational attention</h2>
            <p className="text-sm text-slate-500">Overdue copies that may need reminders or follow-up.</p>
          </div>
          <Link href="/dashboard/library/overdue" className="rounded-xl bg-[var(--color-mod-library-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-mod-library-text)]">
            Open overdue
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {overdueIssues.slice(0, 5).map((issue) => (
            <IssueRow key={issue.id} issue={issue} compact />
          ))}
          {overdueIssues.length === 0 && (
            <EmptyState title="No overdue books" description="Library circulation is currently clear." />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-warning-100 bg-warning-50 p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-warning-800">
          Remaining Issues
        </h2>
        <p className="mt-2 text-sm leading-6 text-warning-800">
          Available, issued, and lost/damaged official totals need a module-owned
          Library summary endpoint. Until then, this overview only shows totals
          from backend list metadata and marks missing summaries unavailable.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PanelHeader
          title="Library operations"
          description="Access detailed borrower history, fine records, and health reports."
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Link href="/dashboard/library/reports" className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-[var(--color-mod-library-border)] hover:bg-[var(--color-mod-library-bg)]">
            <h3 className="font-bold text-slate-900 group-hover:text-[var(--color-mod-library-text)]">Detailed reports</h3>
            <p className="mt-1 text-sm text-slate-500">Popular books, damaged inventory, and CSV exports.</p>
          </Link>
          <Link href="/dashboard/library/fines" className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-[var(--color-mod-library-border)] hover:bg-[var(--color-mod-library-bg)]">
            <h3 className="font-bold text-slate-900 group-hover:text-[var(--color-mod-library-text)]">Fine management</h3>
            <p className="mt-1 text-sm text-slate-500">Track pending fines and apply audit-logged waivers.</p>
          </Link>
          <Link href="/dashboard/library/issues" className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-[var(--color-mod-library-border)] hover:bg-[var(--color-mod-library-bg)]">
            <h3 className="font-bold text-slate-900 group-hover:text-[var(--color-mod-library-text)]">Borrower lookup</h3>
            <p className="mt-1 text-sm text-slate-500">Search student history and check active issue limits.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

function BooksPanel(props: {
  books: LibraryBook[];
  copies: LibraryCopy[];
  search: string;
  setSearch: (value: string) => void;
  form: LibraryBookPayload;
  setForm: (form: LibraryBookPayload) => void;
  editingBookId: string | null;
  setEditingBookId: (value: string | null) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (book: LibraryBook) => void;
  onViewHistory: (type: 'book' | 'copy', id: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  meta?: LibraryPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const categories = Array.from(
    new Set(props.books.map((book) => book.subjectCategory).filter(Boolean)),
  ) as string[];
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const authors = Array.from(new Set(props.books.map((book) => book.author).filter(Boolean)));
  const visibleBooks = props.books.filter((book) =>
    (!category || book.subjectCategory === category) && (!author || book.author === author),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader
          title="Book Catalogue"
          description="Search books by title, author, ISBN, or category."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SearchBox value={props.search} onChange={props.setSearch} placeholder="Search catalogue (Title, ISBN, Author)" />
          <select value={author} onChange={(e) => setAuthor(e.target.value)} className="input-control">
            <option value="">All authors</option>
            {authors.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-control">
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="mt-5 space-y-3">
          {props.isLoading && <LoadingState label="Loading book catalogue..." />}
          {!props.isLoading && visibleBooks.length === 0 && (
            <EmptyState title="No books found" description="Add your first library book or adjust the filters." />
          )}
          {visibleBooks.map((book) => {
            const bookCopies = props.copies.filter((copy) => copy.bookId === book.id);
            const fallbackCopies = book.copies ?? [];
            const copiesForBook = bookCopies.length > 0 ? bookCopies : fallbackCopies;
            const copyCount = copiesForBook.length;
            const availableCopies = copiesForBook.filter((copy) => copy.status === 'AVAILABLE').length;
            return (
              <div key={book.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900">{book.title}</h3>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                      <BookMeta label="Author" value={book.author} />
                      <BookMeta label="ISBN" value={book.isbn || 'Not set'} />
                      <BookMeta label="Category" value={book.subjectCategory || 'Uncategorized'} />
                      <BookMeta label="Total copies" value={String(copyCount)} />
                      <BookMeta label="Available copies" value={String(availableCopies)} />
                    </dl>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {availableCopies > 0 ? (
                      <LibraryStatusBadge status="AVAILABLE" />
                    ) : copyCount > 0 ? (
                      <LibraryStatusBadge status="ISSUED" />
                    ) : (
                      <StatusBadge status="DRAFT" label="No copies" tone="draft" />
                    )}
                      <button type="button" onClick={() => props.onEdit(book)} className="btn-secondary">Edit</button>
                      <button type="button" onClick={() => props.onViewHistory('book', book.id)} className="btn-secondary">History</button>
                      <Link href={`/dashboard/library/copies?bookId=${encodeURIComponent(book.id)}`} className="btn-secondary">Copies</Link>
                    </div>
                </div>
              </div>
            );
          })}
        </div>
        <PaginationControls meta={props.meta} onPageChange={props.onPageChange} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader
          title={props.editingBookId ? 'Edit Book' : 'Add Book'}
          description="Catalogue data used by copy tracking and issue workflows."
        />
        {props.error && <ErrorNotice message={props.error.message} />}
        <form onSubmit={props.onSubmit} className="mt-5 space-y-4">
          <TextInput label="Title" value={props.form.title} required onChange={(title) => props.setForm({ ...props.form, title })} />
          <TextInput label="Author" value={props.form.author} required onChange={(author) => props.setForm({ ...props.form, author })} />
          <TextInput label="ISBN" value={props.form.isbn ?? ''} onChange={(isbn) => props.setForm({ ...props.form, isbn })} />
          <TextInput label="Publisher" value={props.form.publisher ?? ''} onChange={(publisher) => props.setForm({ ...props.form, publisher })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Category" value={props.form.subjectCategory ?? ''} onChange={(subjectCategory) => props.setForm({ ...props.form, subjectCategory })} />
            <TextInput label="Class suitability" value={props.form.classLevel ?? ''} onChange={(classLevel) => props.setForm({ ...props.form, classLevel })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Published year" type="number" value={props.form.publishedYear?.toString() ?? ''} onChange={(value) => props.setForm({ ...props.form, publishedYear: value ? Number(value) : undefined })} />
            <TextInput label="Purchase price" type="number" value={props.form.purchasePrice?.toString() ?? ''} onChange={(value) => props.setForm({ ...props.form, purchasePrice: value ? Number(value) : undefined })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={props.isSaving}>{props.isSaving ? 'Saving...' : props.editingBookId ? 'Update book' : 'Add book'}</button>
            {props.editingBookId && <button type="button" className="btn-secondary" onClick={() => { props.setEditingBookId(null); props.setForm(emptyBookForm); }}>Cancel</button>}
          </div>
        </form>
      </section>
    </div>
  );
}

function CopiesPanel(props: {
  books: LibraryBook[];
  copies: LibraryCopy[];
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  form: LibraryCopyPayload;
  setForm: (form: LibraryCopyPayload) => void;
  editingCopyId: string | null;
  setEditingCopyId: (value: string | null) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (copy: LibraryCopy) => void;
  onViewHistory: (type: 'book' | 'copy', id: string) => void;
  onStatusChange: (copy: LibraryCopy, status: LibraryCopyStatus) => void;
  onArchiveCopy: (copy: LibraryCopy, reason: string) => void;
  reasons: Record<string, string>;
  setReason: (copyId: string, reason: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  meta?: LibraryPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    copy: LibraryCopy;
    status: LibraryCopyStatus;
  } | null>(null);
  const [pendingArchiveCopy, setPendingArchiveCopy] =
    useState<LibraryCopy | null>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader title="Copy Management" description="Track physical copies, barcodes, shelf location, and circulation status." />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <SearchBox value={props.search} onChange={props.setSearch} placeholder="Search barcode" />
          <select value={props.status} onChange={(e) => props.setStatus(e.target.value)} className="input-control">
            <option value="">All statuses</option>
            {copyStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </div>
        <div className="mt-5 space-y-3">
          {props.isLoading && <LoadingState label="Loading copies..." />}
          {!props.isLoading && props.copies.length === 0 && <EmptyState title="No copies found" description="Add barcode copies from the form." />}
          {props.copies.map((copy) => (
            <div key={copy.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{copy.book?.title?.trim() || 'Book title not set'}</h3>
                    <LibraryStatusBadge status={copy.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Barcode: {copy.barcode} • Shelf: {copy.shelfLocation || 'Not set'}</p>
                  <p className="mt-2 text-xs text-slate-400">Replacement cost: {money(copy.replacementCost)} • QR: {copy.qrCode || 'Same as barcode'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => props.onEdit(copy)} className="btn-secondary">Edit</button>
                  <button type="button" onClick={() => props.onViewHistory('copy', copy.id)} className="btn-secondary">History</button>
                  {copy.status !== 'ISSUED' && (
                    <button
                      type="button"
                      onClick={() => setPendingArchiveCopy(copy)}
                      className="btn-secondary text-red-600"
                    >
                      Archive
                    </button>
                  )}
                  {copy.status !== 'ISSUED' && copyStatuses.filter((status) => status !== copy.status).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        if (status === 'LOST' || status === 'DAMAGED') {
                          setPendingStatusChange({ copy, status });
                          return;
                        }

                        props.onStatusChange(copy, status);
                      }}
                      className={status === 'LOST' || status === 'DAMAGED' ? 'btn-secondary text-red-600' : 'btn-secondary'}
                    >
                      Mark {formatStatus(status)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <PaginationControls meta={props.meta} onPageChange={props.onPageChange} />
        <ConfirmDialog
          isOpen={Boolean(pendingStatusChange)}
          onClose={() => setPendingStatusChange(null)}
          onConfirm={() => {
            if (pendingStatusChange) {
              props.onStatusChange(pendingStatusChange.copy, pendingStatusChange.status);
            }
            setPendingStatusChange(null);
          }}
          title={`Mark copy ${formatStatus(pendingStatusChange?.status ?? '')}?`}
          description="This changes the physical copy status used by issue/return workflows. Use this only after confirming the book is actually lost or damaged."
          confirmLabel="Confirm status change"
          confirmDisabled={
            pendingStatusChange
              ? !(props.reasons[pendingStatusChange.copy.id] ?? '').trim()
              : false
          }
          variant="destructive"
        >
          {pendingStatusChange ? (
            <label className="block px-6 pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Audit reason
              </span>
              <textarea
                value={props.reasons[pendingStatusChange.copy.id] ?? ''}
                onChange={(event) =>
                  props.setReason(
                    pendingStatusChange.copy.id,
                    event.target.value,
                  )
                }
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Record who confirmed the loss or damage and any replacement/fine context."
              />
            </label>
          ) : null}
        </ConfirmDialog>
        <ConfirmDialog
          isOpen={Boolean(pendingArchiveCopy)}
          onClose={() => setPendingArchiveCopy(null)}
          onConfirm={() => {
            if (pendingArchiveCopy) {
              props.onArchiveCopy(
                pendingArchiveCopy,
                props.reasons[pendingArchiveCopy.id]?.trim() ?? '',
              );
            }
            setPendingArchiveCopy(null);
          }}
          title="Archive library copy?"
          description="Archive copies instead of deleting them when circulation history may exist. Issued copies must be returned or resolved before archive."
          confirmLabel="Archive copy"
          confirmDisabled={
            pendingArchiveCopy
              ? !(props.reasons[pendingArchiveCopy.id] ?? '').trim()
              : false
          }
          variant="destructive"
        >
          {pendingArchiveCopy ? (
            <label className="block px-6 pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Audit reason
              </span>
              <textarea
                value={props.reasons[pendingArchiveCopy.id] ?? ''}
                onChange={(event) =>
                  props.setReason(pendingArchiveCopy.id, event.target.value)
                }
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Record why this copy is being archived and where the physical item is stored."
              />
            </label>
          ) : null}
        </ConfirmDialog>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader title={props.editingCopyId ? 'Edit Copy' : 'Add Copy'} description="Barcode must be unique per tenant." />
        {props.error && <ErrorNotice message={props.error.message} />}
        <form onSubmit={props.onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Book
            <select required value={props.form.bookId} onChange={(e) => props.setForm({ ...props.form, bookId: e.target.value })} className="input-control mt-1">
              <option value="">Select book</option>
              {props.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
            </select>
          </label>
          <TextInput label="Barcode" value={props.form.barcode} required onChange={(barcode) => props.setForm({ ...props.form, barcode })} />
          <TextInput label="QR code" value={props.form.qrCode ?? ''} onChange={(qrCode) => props.setForm({ ...props.form, qrCode })} />
          <TextInput label="Shelf / location" value={props.form.shelfLocation ?? ''} onChange={(shelfLocation) => props.setForm({ ...props.form, shelfLocation })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Replacement cost" type="number" value={props.form.replacementCost?.toString() ?? ''} onChange={(value) => props.setForm({ ...props.form, replacementCost: value ? Number(value) : undefined })} />
            <TextInput label="Purchased at" type="date" value={props.form.purchasedAt ?? ''} onChange={(purchasedAt) => props.setForm({ ...props.form, purchasedAt })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={props.isSaving}>{props.isSaving ? 'Saving...' : props.editingCopyId ? 'Update copy' : 'Add copy'}</button>
            {props.editingCopyId && <button type="button" className="btn-secondary" onClick={() => { props.setEditingCopyId(null); props.setForm(emptyCopyForm); }}>Cancel</button>}
          </div>
        </form>
      </section>
    </div>
  );
}

function IssuesPanel(props: {
  copies: LibraryCopy[];
  issues: LibraryIssue[];
  students: StudentProfile[];
  staff: Array<{ id: string; firstName?: string; lastName?: string; employeeId?: string }>;
  status: string;
  setStatus: (value: string) => void;
  form: LibraryIssuePayload;
  setForm: (form: LibraryIssuePayload) => void;
  returnDrafts: Record<string, ReturnLibraryIssuePayload>;
  setReturnDrafts: (drafts: Record<string, ReturnLibraryIssuePayload>) => void;
  onIssueSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReturn: (issue: LibraryIssue, body: ReturnLibraryIssuePayload) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onResolveCopyScan: (code: string) => Promise<LibraryCopy>;
  isResolvingCopyScan: boolean;
  scanError: Error | null;
  meta?: LibraryPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copyScanValue, setCopyScanValue] = useState('');
  const [copyScanResult, setCopyScanResult] = useState<LibraryCopyScanResult | null>(null);
  const [recentCopyScans, setRecentCopyScans] = useState<LibraryCopyScanResult[]>([]);
  const [resolvedBorrower, setResolvedBorrower] = useState<LibraryQrBorrower | null>(null);
  const [scannedCopy, setScannedCopy] = useState<LibraryCopy | null>(null);
  const availableCopies = [
    ...props.copies.filter((copy) => copy.status === 'AVAILABLE'),
    ...(scannedCopy &&
    scannedCopy.status === 'AVAILABLE' &&
    !props.copies.some((copy) => copy.id === scannedCopy.id)
      ? [scannedCopy]
      : []),
  ];
  const selectedCopy =
    props.copies.find((copy) => copy.id === props.form.copyId) ??
    (scannedCopy?.id === props.form.copyId ? scannedCopy : undefined);
  const selectedStudent = props.students.find(
    (student) => student.id === props.form.borrowerStudentId,
  );
  const selectedStaff = props.staff.find(
    (staff) => staff.id === props.form.borrowerStaffId,
  );

  function recordCopyScan(scan: LibraryCopyScanResult) {
    setCopyScanResult(scan);
    setRecentCopyScans((items) => [
      scan,
      ...items.filter(
        (item) => item.code.toLowerCase() !== scan.code.toLowerCase(),
      ),
    ].slice(0, 5));
  }

  function selectCopyFromScan(copy: LibraryCopy, code: string) {
    setScannedCopy(copy);
    props.setForm({ ...props.form, copyId: copy.id });
    recordCopyScan({
      code,
      copy,
      status: 'matched',
      message: `${copy.book?.title ?? 'Copy'} selected for issue.`,
      scannedAt: new Date().toISOString(),
    });
  }

  async function handleCopyScan() {
    const code = copyScanValue.trim();
    if (!code) return;

    try {
      const copy = await props.onResolveCopyScan(code);

      if (copy.status !== 'AVAILABLE') {
        recordCopyScan({
          code,
          copy,
          status: 'unavailable',
          message: `${copy.book?.title ?? 'Copy'} is ${formatStatus(copy.status)} and cannot be issued.`,
          scannedAt: new Date().toISOString(),
        });
        return;
      }

      selectCopyFromScan(copy, code);
      setCopyScanValue('');
    } catch {
      recordCopyScan({
        code,
        status: 'missing',
        message: 'No library copy matched this barcode or QR code.',
        scannedAt: new Date().toISOString(),
      });
    }
  }

  function handleBorrowerResolved(data: LibraryQrBorrower) {
    const studentId = data.id ?? data.studentId;
    if (!studentId) return;

    setResolvedBorrower({ ...data, id: studentId });
    props.setForm({
      ...props.form,
      borrowerStudentId: studentId,
      borrowerStaffId: '',
    });
  }
  
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader title="Issue / Return" description="Issue available copies and close active borrower records." />
        <div className="mt-5 max-w-xs">
          <select value={props.status} onChange={(e) => props.setStatus(e.target.value)} className="input-control">
            <option value="">All active & historical records</option>
            {['ISSUED', 'RETURNED', 'OVERDUE', 'LOST'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </div>
        <div className="mt-5 space-y-4">
          {props.isLoading && <LoadingState label="Loading issue history..." />}
          {!props.isLoading && props.issues.length === 0 && <EmptyState title="No issue records" description="Issue an available copy to start circulation history." />}
          {props.issues.map((issue) => {
            const draft = props.returnDrafts[issue.id] ?? {};
            const active = ['ISSUED', 'OVERDUE'].includes(issue.status);
            return (
              <div key={issue.id} className={cn("rounded-2xl border p-4 transition", active ? "border-slate-200 bg-white shadow-sm" : "border-slate-100 bg-slate-50 opacity-80")}>
                <IssueRow issue={issue} />
                {active && (
                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4 lg:items-end">
                    <TextInput label="Condition" placeholder="e.g. Good" value={draft.returnCondition ?? ''} onChange={(returnCondition) => props.setReturnDrafts({ ...props.returnDrafts, [issue.id]: { ...draft, returnCondition } })} />
                    <TextInput label="Fine (NPR)" type="number" value={draft.fineAmount?.toString() ?? ''} onChange={(value) => props.setReturnDrafts({ ...props.returnDrafts, [issue.id]: { ...draft, fineAmount: value ? Number(value) : undefined } })} />
                    <label className="flex items-center gap-2 pb-3 text-sm font-bold text-slate-700">
                      <input type="checkbox" className="rounded-lg border-slate-300 text-[var(--color-mod-library-text)] focus:ring-[var(--color-mod-library-bg)]" checked={Boolean(draft.markLost)} onChange={(e) => props.setReturnDrafts({ ...props.returnDrafts, [issue.id]: { ...draft, markLost: e.target.checked } })} />
                      Mark lost/damaged
                    </label>
                    <button type="button" className="btn-primary h-11" disabled={props.isSaving} onClick={() => setConfirmId(issue.id)}>
                      <RotateCcw size={16} /> Return Copy
                    </button>
                  </div>
                )}
                <ConfirmDialog
                  isOpen={confirmId === issue.id}
                  onClose={() => setConfirmId(null)}
                  onConfirm={() => {
                    props.onReturn(issue, draft);
                    setConfirmId(null);
                  }}
                  title="Confirm Return"
                  description={`Are you sure you want to mark "${issue.copy?.book?.title}" as returned? ${draft.markLost ? 'This copy will be marked as lost.' : ''}`}
                  confirmLabel="Return now"
                  variant={draft.markLost ? 'destructive' : 'default'}
                />
              </div>
            );
          })}
        </div>
        <PaginationControls meta={props.meta} onPageChange={props.onPageChange} />
      </section>

      <section className="space-y-6">
        <section className="rounded-2xl border border-[var(--color-mod-library-border)] bg-[var(--color-mod-library-bg)] p-5 shadow-sm">
          <PanelHeader title="Quick QR Lookup" description="Scan student QR to select the borrower and review borrowing status." />
          <QRResolver
            purpose="LIBRARY"
            autoFocus
            helperText="Scan or paste a student QR token; the borrower field updates automatically."
            submitLabel="Select"
            onResolved={handleBorrowerResolved}
            className="mt-4"
          />
          {resolvedBorrower ? <QrBorrowerSummary borrower={resolvedBorrower} /> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Issue copy" description="Select a physical copy and a borrower." />
          {props.error && <ErrorNotice message={props.error.message} />}
          <form onSubmit={props.onIssueSubmit} className="mt-5 space-y-4">
            <LibraryCopyScanner
              value={copyScanValue}
              onChange={setCopyScanValue}
              onScan={() => void handleCopyScan()}
              result={copyScanResult}
              recentScans={recentCopyScans}
              onSelectCopy={(copy, code) => selectCopyFromScan(copy, code)}
              isResolving={props.isResolvingCopyScan}
            />
            {props.scanError ? (
              <ErrorNotice message="Copy scan lookup is unavailable. You can still select a visible copy manually." />
            ) : null}

            <BookSelector
              mode="copy"
              copies={availableCopies}
              selectedId={props.form.copyId}
              onSelect={(copyId) => {
                props.setForm({ ...props.form, copyId });
                setCopyScanResult(null);
              }}
              label="Physical Copy"
              placeholder="Search available barcode or book title..."
            />

            <IssueSelectionSummary
              copy={selectedCopy}
              student={selectedStudent}
              staff={selectedStaff}
            />
            
            <StudentSelector
              students={props.students}
              selectedId={props.form.borrowerStudentId ?? ''}
              onSelect={(studentId) => {
                props.setForm({
                  ...props.form,
                  borrowerStudentId: studentId,
                  borrowerStaffId: studentId ? '' : props.form.borrowerStaffId,
                });
                if (studentId !== resolvedBorrower?.id) {
                  setResolvedBorrower(null);
                }
              }}
              label="Student Borrower"
              optional
            />

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-white px-2 text-slate-400 italic">or</span>
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Staff Borrower
              <select
                value={props.form.borrowerStaffId ?? ''}
                onChange={(e) => {
                  props.setForm({
                    ...props.form,
                    borrowerStaffId: e.target.value,
                    borrowerStudentId: e.target.value ? '' : props.form.borrowerStudentId,
                  });
                  if (e.target.value) {
                    setResolvedBorrower(null);
                  }
                }}
                className="input-control mt-1"
              >
                <option value="">No staff borrower</option>
                {props.staff.map((staff) => <option key={staff.id} value={staff.id}>{staffName(staff)}</option>)}
              </select>
            </label>
            
            <TextInput label="Due date" type="date" value={props.form.dueAt ?? ''} required onChange={(dueAt) => props.setForm({ ...props.form, dueAt })} />
            <TextInput label="Internal Notes" value={props.form.notes ?? ''} onChange={(notes) => props.setForm({ ...props.form, notes })} />
            
            <button
              type="submit"
              className="btn-primary w-full h-12 text-base shadow-sm"
              disabled={
                props.isSaving ||
                !props.form.copyId ||
                !props.form.dueAt ||
                (!props.form.borrowerStudentId && !props.form.borrowerStaffId)
              }
            >
              {props.isSaving ? 'Issuing...' : 'Issue book now'}
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}

function LibraryCopyScanner({
  value,
  onChange,
  onScan,
  result,
  recentScans,
  onSelectCopy,
  isResolving,
}: {
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
  result: LibraryCopyScanResult | null;
  recentScans: LibraryCopyScanResult[];
  onSelectCopy: (copy: LibraryCopy, code: string) => void;
  isResolving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Copy barcode / QR scan</h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            Scan the physical copy code, then scan borrower QR or select manually.
          </p>
        </div>
        {result?.status === 'matched' ? (
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={value}
            autoComplete="off"
            aria-label="Library copy barcode or QR code"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onScan();
              }
            }}
            placeholder="Scan barcode or QR code"
            className={cn(
              'input-control pl-10',
              result?.status === 'matched' && 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100',
              result?.status === 'unavailable' && 'border-amber-300 focus:border-amber-400 focus:ring-amber-100',
              result?.status === 'missing' && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            )}
          />
        </label>
        <button type="button" onClick={onScan} disabled={!value.trim() || isResolving} className="btn-secondary shrink-0">
          {isResolving ? 'Checking...' : 'Scan'}
        </button>
      </div>

      {result ? (
        <div
          className={cn(
            'mt-3 rounded-xl border px-3 py-2 text-xs font-bold',
            result.status === 'matched' && 'border-emerald-100 bg-emerald-50 text-emerald-700',
            result.status === 'unavailable' && 'border-amber-100 bg-amber-50 text-amber-800',
            result.status === 'missing' && 'border-red-100 bg-red-50 text-red-700',
          )}
        >
          {result.message}
        </div>
      ) : null}

      {recentScans.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {recentScans.map((scan) => (
            <button
              key={`${scan.code}-${scan.scannedAt}`}
              type="button"
              disabled={!scan.copy || scan.copy.status !== 'AVAILABLE'}
              onClick={() => scan.copy && onSelectCopy(scan.copy, scan.code)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                scan.status === 'matched'
                  ? 'border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50'
                  : 'border-slate-100 bg-white text-slate-500',
                (!scan.copy || scan.copy.status !== 'AVAILABLE') && 'cursor-not-allowed opacity-70',
              )}
            >
              {scan.copy?.barcode ?? scan.code}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QrBorrowerSummary({ borrower }: { borrower: LibraryQrBorrower }) {
  const activeIssues = borrower.activeIssues ?? 0;
  const overdueBooks = borrower.overdueBooks ?? 0;
  const canBorrow = borrower.canBorrow ?? true;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--color-mod-library-border)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-mod-library-text)]">QR borrower selected</p>
          <h3 className="mt-1 truncate font-bold text-slate-900">{borrower.name?.trim() || 'Student name not set'}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {[borrower.studentCode, borrower.classSection].filter(Boolean).join(' • ') || 'Student QR resolved'}
          </p>
        </div>
        <StatusBadge
          status={canBorrow ? 'CAN_BORROW' : 'LIMIT_REACHED'}
          label={canBorrow ? 'Can borrow' : 'Limit reached'}
          tone={canBorrow ? 'approved' : 'conflict'}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
        <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
          <p className="text-slate-400">Active issues</p>
          <p className="mt-1 text-lg text-slate-900">{activeIssues}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
          <p className="text-slate-400">Overdue books</p>
          <p className={cn('mt-1 text-lg', overdueBooks > 0 ? 'text-red-600' : 'text-slate-900')}>
            {overdueBooks}
          </p>
        </div>
      </div>
    </div>
  );
}

function IssueSelectionSummary({
  copy,
  student,
  staff,
}: {
  copy?: LibraryCopy;
  student?: StudentProfile;
  staff?: { id: string; firstName?: string; lastName?: string; employeeId?: string };
}) {
  if (!copy && !student && !staff) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selected issue</p>
      <div className="mt-3 space-y-2">
        <IssueSummaryLine label="Copy" value={copy ? `${copy.book?.title ?? 'Book'} (${copy.barcode})` : 'No copy selected'} />
        <IssueSummaryLine
          label="Borrower"
          value={
            student
              ? studentName(student)
              : staff
                ? staffName(staff)
                : 'No borrower selected'
          }
        />
      </div>
    </div>
  );
}

function IssueSummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="min-w-0 text-right font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function OverduePanel({
  overdueIssues,
  isLoading,
  isSending,
  onSendReminders,
  error,
  meta,
  onPageChange,
}: {
  overdueIssues: LibraryIssue[];
  isLoading: boolean;
  isSending: boolean;
  onSendReminders: () => void;
  error: Error | null;
  meta?: LibraryPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeader title="Overdue Issues" description="Review overdue copies and queue consent-aware reminders." />
        <button type="button" onClick={onSendReminders} disabled={isSending || overdueIssues.length === 0} className="btn-primary">
          <BellRing size={16} /> {isSending ? 'Sending...' : 'Send reminders'}
        </button>
      </div>
      {error && <ErrorNotice message={error.message} />}
      <div className="mt-5 space-y-3">
        {isLoading && <LoadingState label="Loading overdue issues..." />}
        {!isLoading && overdueIssues.length === 0 && <EmptyState title="No overdue issues" description="No active library issues are past their due date." />}
        {overdueIssues.map((issue) => (
          <div key={issue.id} className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
            <IssueRow issue={issue} compact />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <LibraryStatusBadge status="OVERDUE" />
              <p className="text-sm font-semibold text-red-700">Overdue by {overdueDays(issue.dueAt)} day(s)</p>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls meta={meta} onPageChange={onPageChange} />
    </section>
  );
}

function IssueRow({ issue, compact = false }: { issue: LibraryIssue; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-900">{issue.copy?.book?.title?.trim() || 'Book title not set'}</h3>
          <LibraryStatusBadge status={issue.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {borrowerName(issue)} • Copy {issue.copy?.barcode ?? issue.copyId}
        </p>
        {!compact && (
          <p className="mt-2 text-xs text-slate-400">Notes: {issue.notes || '—'}</p>
        )}
      </div>
      <div className="text-sm text-slate-500 lg:text-right">
        <p>Due: {formatDate(issue.dueAt)}</p>
        <p>Returned: {issue.returnedAt ? formatDate(issue.returnedAt) : '—'}</p>
        <p>Fine: {money(issue.fineAmount)}</p>
      </div>
    </div>
  );
}

function BookMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-700">{value}</dd>
    </div>
  );
}

function PaginationControls({
  meta,
  onPageChange,
}: {
  meta?: LibraryPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.total <= meta.limit) return null;

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {from}-{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
        >
          Previous
        </button>
        <span className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={meta.page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, meta.page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function PendingLibraryCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
      <EmptyState
        title={title}
        description="Backend endpoint pending."
        className="min-h-[180px] border-0 bg-transparent p-0"
      />
    </div>
  );
}

function LibraryStatusBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const badgeMap: Record<string, { label: string; tone: StatusTone }> = {
    AVAILABLE: { label: 'Available', tone: 'approved' },
    ISSUED: { label: 'Issued', tone: 'published' },
    RESERVED: { label: 'Reserved', tone: 'pending' },
    LOST: { label: 'Lost', tone: 'conflict' },
    DAMAGED: { label: 'Damaged', tone: 'conflict' },
    OVERDUE: { label: 'Overdue', tone: 'overdue' },
    RETURNED: { label: 'Returned', tone: 'approved' },
  };
  const config = badgeMap[normalized] ?? {
    label: formatStatus(normalized),
    tone: 'info' as StatusTone,
  };

  return <StatusBadge status={normalized} label={config.label} tone={config.tone} />;
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="input-control pl-10" />
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input type={type} placeholder={placeholder} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1" />
    </label>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="my-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function cleanBookPayload(form: LibraryBookPayload): LibraryBookPayload {
  return {
    title: form.title.trim(),
    author: form.author.trim(),
    ...(form.isbn ? { isbn: form.isbn.trim() } : {}),
    ...(form.publisher ? { publisher: form.publisher.trim() } : {}),
    ...(form.publishedYear ? { publishedYear: Number(form.publishedYear) } : {}),
    ...(form.subjectCategory ? { subjectCategory: form.subjectCategory.trim() } : {}),
    ...(form.classLevel ? { classLevel: form.classLevel.trim() } : {}),
    ...(form.purchasePrice !== undefined && form.purchasePrice !== null
      ? { purchasePrice: Number(form.purchasePrice) }
      : {}),
  };
}

function cleanCopyPayload(form: LibraryCopyPayload): LibraryCopyPayload {
  return {
    bookId: form.bookId,
    barcode: form.barcode.trim(),
    ...(form.qrCode ? { qrCode: form.qrCode.trim() } : {}),
    ...(form.shelfLocation ? { shelfLocation: form.shelfLocation.trim() } : {}),
    ...(form.replacementCost !== undefined && form.replacementCost !== null
      ? { replacementCost: Number(form.replacementCost) }
      : {}),
    ...(form.purchasedAt ? { purchasedAt: form.purchasedAt } : {}),
  };
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-NP', { dateStyle: 'medium' }).format(new Date(value));
}

function money(value?: string | number | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(amount);
}

function overdueDays(dueAt: string) {
  const diff = Date.now() - new Date(dueAt).getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function borrowerName(issue: LibraryIssue) {
  if (issue.borrowerStudent) return studentName(issue.borrowerStudent);
  if (issue.borrowerStaff) return staffName(issue.borrowerStaff);
  return 'Borrower record unavailable';
}

function studentName(student: { firstNameEn?: string; lastNameEn?: string; studentSystemId?: string }) {
  return `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() || student.studentSystemId || 'Student';
}

function staffName(staff: { firstName?: string; lastName?: string; employeeId?: string }) {
  return `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() || staff.employeeId || 'Staff';
}

function FinesPanel({
  fines,
  isLoading,
  onUpdateFine,
  isUpdating,
  onPostFineToFees,
  isPosting,
  postError,
  meta,
  onPageChange,
}: {
  fines: any[];
  isLoading: boolean;
  onUpdateFine: (id: string, body: any) => void;
  isUpdating: boolean;
  onPostFineToFees: (id: string, reason: string) => void;
  isPosting: boolean;
  postError: Error | null;
  meta?: LibraryPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveAmount, setWaiveAmount] = useState<number>(0);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postReason, setPostReason] = useState('');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader title="Fine Management" description="Track, waive, and hand student library fines to the Fees counter with mandatory audit logging." />
      {postError && <ErrorNotice message={postError.message} />}
      <div className="mt-5 space-y-3">
        {isLoading && <LoadingState label="Loading fines..." />}
        {!isLoading && fines.length === 0 && <EmptyState title="No fines found" description="Library circulation is currently clear of outstanding fines." />}
        {fines.map((fine) => {
          const linkedInvoiceId = fine.feeInvoiceId ?? fine.issue?.invoiceId ?? null;
          const canPostToFees =
            fine.status === 'PENDING' &&
            Boolean(fine.issue?.borrowerStudentId) &&
            !linkedInvoiceId;

          return (
            <div key={fine.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{fine.issue?.copy?.book?.title?.trim() || 'Book title not set'}</h3>
                    <StatusBadge status={fine.status} label={fine.status} tone={fine.status === 'PENDING' ? 'overdue' : 'approved'} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Borrower: {fine.issue ? borrowerName(fine.issue) : 'Borrower not set'} • Amount: {money(fine.amount)}
                  </p>
                  {fine.waivedAmount > 0 && (
                    <p className="mt-1 text-xs text-emerald-600 font-semibold">Waived: {money(fine.waivedAmount)} (Reason: {fine.waiverReason})</p>
                  )}
                  {linkedInvoiceId && (
                    <p className="mt-1 text-xs font-semibold text-[var(--color-mod-library-text)]">
                      Linked Fees invoice: {fine.issue?.invoice?.invoiceNumber ?? linkedInvoiceId}
                    </p>
                  )}
                  {!fine.issue?.borrowerStudentId && fine.status === 'PENDING' && (
                    <p className="mt-1 text-xs font-semibold text-slate-500">Staff fines stay in Library and are not posted to student fees.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {linkedInvoiceId && (
                    <Link
                      href={`/dashboard/finance?invoiceId=${encodeURIComponent(linkedInvoiceId)}`}
                      className="btn-secondary"
                      data-testid="library-fine-open-invoice"
                    >
                      <ArrowUpRight size={16} /> Open invoice
                    </Link>
                  )}
                  {canPostToFees && (
                    <button
                      type="button"
                      onClick={() => {
                        setPostingId(fine.id);
                        setPostReason(`Post library fine for ${fine.issue?.copy?.book?.title ?? 'returned book'}`);
                      }}
                      className="btn-primary"
                      data-testid="library-fine-post-to-fees"
                    >
                      <FileText size={16} /> Post to fees
                    </button>
                  )}
                  {fine.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWaivingId(fine.id);
                        setWaiveAmount(Number(fine.amount));
                      }}
                      className="btn-secondary"
                    >
                      Waive / Correct
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <PaginationControls meta={meta} onPageChange={onPageChange} />

      <ConfirmDialog
        isOpen={Boolean(waivingId)}
        onClose={() => {
          setWaivingId(null);
          setWaiveReason('');
        }}
        onConfirm={() => {
          if (waivingId) {
            onUpdateFine(waivingId, {
              status: waiveAmount >= Number(fines.find(f => f.id === waivingId)?.amount) ? 'WAIVED' : 'PENDING',
              waivedAmount: waiveAmount,
              waiverReason: waiveReason,
            });
          }
          setWaivingId(null);
          setWaiveReason('');
        }}
        title="Waive Library Fine"
        description="Provide a reason for waiving this fine. This action is audit-logged and visible to school administrators."
        confirmLabel="Confirm Waiver"
      >
        <div className="mt-4 space-y-4">
          <TextInput
            label="Waiver Amount (NPR)"
            type="number"
            value={waiveAmount.toString()}
            onChange={(val) => setWaiveAmount(Number(val))}
          />
          <TextInput
            label="Reason for Waiver"
            placeholder="e.g. Special permission, Technical error"
            value={waiveReason}
            required
            onChange={setWaiveReason}
          />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={Boolean(postingId)}
        onClose={() => {
          setPostingId(null);
          setPostReason('');
        }}
        onConfirm={() => {
          if (postingId) {
            onPostFineToFees(postingId, postReason);
          }
          setPostingId(null);
          setPostReason('');
        }}
        title="Post Library Fine to Fees"
        description="This creates a student fee invoice through the M3 Fees module and routes collection to the Finance counter."
        confirmLabel="Post to Fees"
        isConfirming={isPosting}
      >
        <div className="mt-4">
          <TextInput
            label="Audit reason"
            placeholder="e.g. Returned overdue book fine"
            value={postReason}
            required
            onChange={setPostReason}
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}

function ReportsPanel({
  issuedBooksReport,
  overdueBooksReport,
  popularBooks,
  lostDamaged,
  fineSummary,
  isLoading,
  isExportingIssuedCsv,
  exportError,
  onExportIssuedCsv,
}: {
  issuedBooksReport?: LibraryPaginatedResult<LibraryIssue>;
  overdueBooksReport?: LibraryPaginatedResult<LibraryIssue>;
  popularBooks: LibraryPopularBookReportItem[];
  lostDamaged: LibraryCopy[];
  fineSummary?: LibraryFineSummaryReport;
  isLoading: boolean;
  isExportingIssuedCsv: boolean;
  exportError: Error | null;
  onExportIssuedCsv: () => void;
}) {
  const issuedBooks = issuedBooksReport?.items ?? emptyIssues;
  const overdueBooks = overdueBooksReport?.items ?? emptyIssues;
  const issuedTotal = issuedBooksReport?.meta.total ?? issuedBooks.length;
  const overdueTotal = overdueBooksReport?.meta.total ?? overdueBooks.length;
  const fineTotal = fineSummary?.summary.totalFine ?? 0;
  const fineIssueTotal = fineSummary?.summary.totalFines ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <PanelHeader
            title="Reports & Exports"
            description="Review circulation, overdue, inventory health, and fine exposure from backend reports."
          />
          <button
            type="button"
            className="btn-secondary inline-flex items-center justify-center gap-2"
            disabled={isExportingIssuedCsv}
            onClick={onExportIssuedCsv}
            data-testid="library-issued-books-csv-export"
          >
            <Download className="h-4 w-4" />
            {isExportingIssuedCsv ? 'Exporting...' : 'Export issued CSV'}
          </button>
        </div>

        {exportError && <ErrorNotice message={exportError.message} />}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LibraryReportStat
            title="Issued books"
            value={issuedTotal}
            description="Currently issued copies"
          />
          <LibraryReportStat
            title="Overdue report"
            value={overdueTotal}
            description="Past due active issues"
            tone={overdueTotal > 0 ? 'danger' : 'normal'}
          />
          <LibraryReportStat
            title="Fine exposure"
            value={money(fineTotal)}
            description={`${fineIssueTotal} issue(s) with fines`}
          />
          <LibraryReportStat
            title="Lost or damaged"
            value={lostDamaged.length}
            description="Unusable inventory copies"
            tone={lostDamaged.length > 0 ? 'warning' : 'normal'}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Issued Books" description="Recent active circulation records included in the CSV export." />
          <div className="mt-5 space-y-3">
            {isLoading && <LoadingState label="Loading issued report..." />}
            {issuedBooks.map((issue) => (
              <LibraryIssueReportRow key={issue.id} issue={issue} />
            ))}
            {issuedBooks.length === 0 && !isLoading && (
              <EmptyState title="No issued books" description="There are no active issued copies in this report." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Overdue Books" description="Active issues past their due date." />
          <div className="mt-5 space-y-3">
            {isLoading && <LoadingState label="Loading overdue report..." />}
            {overdueBooks.map((issue) => (
              <LibraryIssueReportRow key={issue.id} issue={issue} overdue />
            ))}
            {overdueBooks.length === 0 && !isLoading && (
              <EmptyState title="No overdue books" description="No active library issues are past their due date." />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Popular Books" description="Most frequently issued books in the library." />
          <div className="mt-5 space-y-3">
            {isLoading && <LoadingState label="Loading popularity report..." />}
            {popularBooks.map((item, idx) => (
              <div key={`${item.book?.id ?? 'book'}-${idx}`} className="flex items-center justify-between border-b border-slate-50 p-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{item.book?.title?.trim() || 'Book title not set'}</p>
                  <p className="text-xs text-slate-500">{item.book?.author ?? 'Author not recorded'}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {item.issueCount} issues
                </span>
              </div>
            ))}
            {popularBooks.length === 0 && !isLoading && (
              <EmptyState title="No popularity data" description="Book issue history will appear here after circulation starts." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Lost / Damaged Copies" description="Current inventory items marked as unusable." />
          <div className="mt-5 space-y-3">
            {isLoading && <LoadingState label="Loading loss report..." />}
            {lostDamaged.map((copy) => (
              <div key={copy.id} className="flex items-center justify-between border-b border-slate-50 p-3 last:border-0">
                <div>
                  <p className="font-bold text-slate-900">{copy.book?.title?.trim() || 'Book title not set'}</p>
                  <p className="text-xs text-slate-500">Barcode: {copy.barcode} - Status: {copy.status}</p>
                </div>
                <LibraryStatusBadge status={copy.status} />
              </div>
            ))}
            {lostDamaged.length === 0 && !isLoading && (
              <EmptyState title="No lost/damaged books" description="Inventory health is currently clear." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function LibraryReportStat({
  title,
  value,
  description,
  tone = 'normal',
}: {
  title: string;
  value: string | number;
  description: string;
  tone?: 'normal' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-100 bg-red-50 text-red-700'
      : tone === 'warning'
        ? 'border-amber-100 bg-amber-50 text-amber-700'
        : 'border-slate-100 bg-slate-50 text-slate-700';

  return (
    <div className={cn('rounded-2xl border p-4', toneClass)}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        <FileText className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-semibold">{description}</p>
    </div>
  );
}

function LibraryIssueReportRow({
  issue,
  overdue = false,
}: {
  issue: LibraryIssue;
  overdue?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 p-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{issue.copy?.book?.title?.trim() || 'Book title not set'}</p>
        <p className="text-xs text-slate-500">
          {borrowerName(issue)} - Barcode {issue.copy?.barcode ?? 'Barcode not recorded'}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
        <p>{overdue ? `${overdueDays(issue.dueAt)} day(s) overdue` : `Due ${formatDate(issue.dueAt)}`}</p>
        <p className={overdue ? 'text-red-600' : 'text-slate-400'}>{issue.status}</p>
      </div>
    </div>
  );
}
