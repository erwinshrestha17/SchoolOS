'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertCircle,
  BellRing,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Copy,
  Library,
  PackageCheck,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  libraryApi,
  type LibraryBook,
  type LibraryBookPayload,
  type LibraryCopy,
  type LibraryCopyPayload,
  type LibraryCopyStatus,
  type LibraryIssue,
  type LibraryIssuePayload,
  type ReturnLibraryIssuePayload,
} from '../../lib/library-api';
import { api } from '../../lib/api';
import { PageHeader } from '../ui/page-header';
import { StatCard } from '../ui/stat-card';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { StatusBadge } from '../ui/status-badge';
import { cn } from '../../lib/utils';

const tabs = [
  { key: 'overview', label: 'Overview', href: '/dashboard/library' },
  { key: 'books', label: 'Books', href: '/dashboard/library/books' },
  { key: 'copies', label: 'Copies', href: '/dashboard/library/copies' },
  { key: 'issues', label: 'Issues', href: '/dashboard/library/issues' },
  { key: 'overdue', label: 'Overdue', href: '/dashboard/library/overdue' },
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

export function LibraryWorkspace({ initialTab = 'overview' }: LibraryWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [bookSearch, setBookSearch] = useState('');
  const [copySearch, setCopySearch] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [issueStatus, setIssueStatus] = useState('');
  const [bookForm, setBookForm] = useState<LibraryBookPayload>(emptyBookForm);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [copyForm, setCopyForm] = useState<LibraryCopyPayload>(emptyCopyForm);
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [issueForm, setIssueForm] = useState<LibraryIssuePayload>(emptyIssueForm);
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnLibraryIssuePayload>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ['library-books', bookSearch],
    queryFn: () => libraryApi.listBooks({ q: bookSearch, limit: '100' }),
  });
  const copiesQuery = useQuery({
    queryKey: ['library-copies', copySearch, copyStatus],
    queryFn: () =>
      libraryApi.listCopies({
        barcode: copySearch,
        status: copyStatus,
        limit: '100',
      }),
  });
  const issuesQuery = useQuery({
    queryKey: ['library-issues', issueStatus],
    queryFn: () =>
      libraryApi.listIssues({
        status: issueStatus,
        limit: '100',
      }),
  });
  const overdueQuery = useQuery({
    queryKey: ['library-overdue'],
    queryFn: libraryApi.listOverdue,
  });
  const studentsQuery = useQuery({
    queryKey: ['students-for-library'],
    queryFn: api.listStudents,
  });
  const staffQuery = useQuery({
    queryKey: ['staff-for-library'],
    queryFn: api.listStaff,
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
    }: {
      id: string;
      status: LibraryCopyStatus;
    }) => libraryApi.updateCopyStatus(id, { status }),
    onSuccess: () => {
      setNotice('Copy status updated.');
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

  const books = booksQuery.data?.items ?? emptyBooks;
  const copies = copiesQuery.data?.items ?? emptyCopies;
  const issues = issuesQuery.data?.items ?? emptyIssues;
  const overdueIssues = overdueQuery.data ?? emptyIssues;

  const stats = useMemo(() => {
    const totalBooks = booksQuery.data?.meta.total ?? books.length;
    const totalCopies = copiesQuery.data?.meta.total ?? copies.length;
    const availableCopies = copies.filter((copy) => copy.status === 'AVAILABLE').length;
    const issuedCopies = copies.filter((copy) => copy.status === 'ISSUED').length;
    const lostDamaged = copies.filter((copy) =>
      ['LOST', 'DAMAGED'].includes(copy.status),
    ).length;

    return {
      totalBooks,
      totalCopies,
      availableCopies,
      issuedCopies,
      overdueIssues: overdueIssues.length,
      lostDamaged,
    };
  }, [books, booksQuery.data?.meta.total, copies, copiesQuery.data?.meta.total, overdueIssues.length]);

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
      <PageHeader
        title="Library Management"
        description="Manage book catalogues, barcode copies, issue-return workflows, overdue tracking, and library reminders."
        actions={
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-2xl px-4 text-sm font-semibold transition',
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        }
      />

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
          setSearch={setBookSearch}
          form={bookForm}
          setForm={setBookForm}
          editingBookId={editingBookId}
          setEditingBookId={setEditingBookId}
          onSubmit={handleBookSubmit}
          onEdit={editBook}
          isLoading={booksQuery.isLoading}
          isSaving={createBookMutation.isPending || updateBookMutation.isPending}
          error={createBookMutation.error || updateBookMutation.error}
        />
      )}

      {activeTab === 'copies' && (
        <CopiesPanel
          books={books}
          copies={copies}
          search={copySearch}
          setSearch={setCopySearch}
          status={copyStatus}
          setStatus={setCopyStatus}
          form={copyForm}
          setForm={setCopyForm}
          editingCopyId={editingCopyId}
          setEditingCopyId={setEditingCopyId}
          onSubmit={handleCopySubmit}
          onEdit={editCopy}
          onStatusChange={(copy, status) =>
            copyStatusMutation.mutate({ id: copy.id, status })
          }
          isLoading={copiesQuery.isLoading}
          isSaving={createCopyMutation.isPending || updateCopyMutation.isPending}
          error={
            createCopyMutation.error ||
            updateCopyMutation.error ||
            copyStatusMutation.error
          }
        />
      )}

      {activeTab === 'issues' && (
        <IssuesPanel
          copies={copies}
          issues={issues}
          students={studentsQuery.data ?? []}
          staff={staffQuery.data ?? []}
          status={issueStatus}
          setStatus={setIssueStatus}
          form={issueForm}
          setForm={setIssueForm}
          returnDrafts={returnDrafts}
          setReturnDrafts={setReturnDrafts}
          onIssueSubmit={handleIssueSubmit}
          onReturn={(issue, body) => returnMutation.mutate({ id: issue.id, body })}
          isLoading={issuesQuery.isLoading}
          isSaving={issueMutation.isPending || returnMutation.isPending}
          error={issueMutation.error || returnMutation.error}
        />
      )}

      {activeTab === 'overdue' && (
        <OverduePanel
          overdueIssues={overdueIssues}
          isLoading={overdueQuery.isLoading}
          isSending={remindersMutation.isPending}
          onSendReminders={() => remindersMutation.mutate()}
          error={remindersMutation.error}
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
    availableCopies: number;
    issuedCopies: number;
    overdueIssues: number;
    lostDamaged: number;
  };
  isLoading: boolean;
  overdueIssues: LibraryIssue[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total books" value={stats.totalBooks} icon={<BookOpen size={18} />} loading={isLoading} />
        <StatCard title="Total copies" value={stats.totalCopies} icon={<Copy size={18} />} loading={isLoading} />
        <StatCard title="Available copies" value={stats.availableCopies} icon={<PackageCheck size={18} />} loading={isLoading} />
        <StatCard title="Issued copies" value={stats.issuedCopies} icon={<ClipboardList size={18} />} loading={isLoading} />
        <StatCard title="Overdue issues" value={stats.overdueIssues} icon={<AlertCircle size={18} />} loading={isLoading} />
        <StatCard title="Lost / damaged" value={stats.lostDamaged} icon={<Library size={18} />} loading={isLoading} />
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Operational attention</h2>
            <p className="text-sm text-slate-500">Overdue copies that may need reminders or follow-up.</p>
          </div>
          <Link href="/dashboard/library/overdue" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
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
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader
          title="Book Catalogue"
          description="Search books by title, author, ISBN, or category."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SearchBox value={props.search} onChange={props.setSearch} placeholder="Search book catalogue" />
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
            const copyCount = props.copies.filter((copy) => copy.bookId === book.id).length || book.copies?.length || 0;
            return (
              <div key={book.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{book.title}</h3>
                    <p className="text-sm text-slate-500">{book.author} {book.isbn ? `• ISBN ${book.isbn}` : ''}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {book.subjectCategory || 'Uncategorized'} • {book.classLevel || 'All classes'} • {copyCount} copies
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => props.onEdit(book)} className="btn-secondary">Edit</button>
                    <Link href={`/dashboard/library/copies?bookId=${encodeURIComponent(book.id)}`} className="btn-secondary">Copies</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
  onStatusChange: (copy: LibraryCopy, status: LibraryCopyStatus) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
                    <h3 className="font-bold text-slate-900">{copy.book?.title ?? 'Unknown book'}</h3>
                    <StatusBadge status={copy.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Barcode: {copy.barcode} • Shelf: {copy.shelfLocation || 'Not set'}</p>
                  <p className="mt-2 text-xs text-slate-400">Replacement cost: {money(copy.replacementCost)} • QR: {copy.qrCode || 'Same as barcode'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => props.onEdit(copy)} className="btn-secondary">Edit</button>
                  {copy.status !== 'ISSUED' && copyStatuses.filter((status) => status !== copy.status).map((status) => (
                    <button key={status} type="button" onClick={() => props.onStatusChange(copy, status)} className="btn-secondary">
                      Mark {formatStatus(status)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
  students: Array<{ id: string; firstNameEn?: string; lastNameEn?: string; studentSystemId?: string }>;
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
}) {
  const availableCopies = props.copies.filter((copy) => copy.status === 'AVAILABLE');

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader title="Issue / Return" description="Issue available copies and close active borrower records." />
        <div className="mt-5 max-w-xs">
          <select value={props.status} onChange={(e) => props.setStatus(e.target.value)} className="input-control">
            <option value="">All issue statuses</option>
            {['ISSUED', 'RETURNED', 'OVERDUE', 'LOST'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </div>
        <div className="mt-5 space-y-4">
          {props.isLoading && <LoadingState label="Loading issue history..." />}
          {!props.isLoading && props.issues.length === 0 && <EmptyState title="No issue records" description="Issue an available copy to start circulation history." />}
          {props.issues.map((issue) => {
            const draft = props.returnDrafts[issue.id] ?? {};
            const active = issue.status === 'ISSUED';
            return (
              <div key={issue.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <IssueRow issue={issue} />
                {active && (
                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-4">
                    <TextInput label="Condition" value={draft.returnCondition ?? ''} onChange={(returnCondition) => props.setReturnDrafts({ ...props.returnDrafts, [issue.id]: { ...draft, returnCondition } })} />
                    <TextInput label="Fine amount" type="number" value={draft.fineAmount?.toString() ?? ''} onChange={(value) => props.setReturnDrafts({ ...props.returnDrafts, [issue.id]: { ...draft, fineAmount: value ? Number(value) : undefined } })} />
                    <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={Boolean(draft.markLost)} onChange={(e) => props.setReturnDrafts({ ...props.returnDrafts, [issue.id]: { ...draft, markLost: e.target.checked } })} />
                      Mark lost
                    </label>
                    <button type="button" className="btn-primary mt-6" disabled={props.isSaving} onClick={() => props.onReturn(issue, draft)}>
                      <RotateCcw size={16} /> Return
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader title="Issue copy" description="Select either a student or staff borrower, not both." />
        {props.error && <ErrorNotice message={props.error.message} />}
        <form onSubmit={props.onIssueSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Available copy
            <select required value={props.form.copyId} onChange={(e) => props.setForm({ ...props.form, copyId: e.target.value })} className="input-control mt-1">
              <option value="">Select copy</option>
              {availableCopies.map((copy) => <option key={copy.id} value={copy.id}>{copy.book?.title ?? 'Book'} • {copy.barcode}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Student borrower
            <select value={props.form.borrowerStudentId ?? ''} onChange={(e) => props.setForm({ ...props.form, borrowerStudentId: e.target.value, borrowerStaffId: e.target.value ? '' : props.form.borrowerStaffId })} className="input-control mt-1">
              <option value="">No student borrower</option>
              {props.students.map((student) => <option key={student.id} value={student.id}>{studentName(student)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Staff borrower
            <select value={props.form.borrowerStaffId ?? ''} onChange={(e) => props.setForm({ ...props.form, borrowerStaffId: e.target.value, borrowerStudentId: e.target.value ? '' : props.form.borrowerStudentId })} className="input-control mt-1">
              <option value="">No staff borrower</option>
              {props.staff.map((staff) => <option key={staff.id} value={staff.id}>{staffName(staff)}</option>)}
            </select>
          </label>
          <TextInput label="Due date" type="date" value={props.form.dueAt} required onChange={(dueAt) => props.setForm({ ...props.form, dueAt })} />
          <TextInput label="Notes" value={props.form.notes ?? ''} onChange={(notes) => props.setForm({ ...props.form, notes })} />
          <button type="submit" className="btn-primary w-full" disabled={props.isSaving || (!props.form.borrowerStudentId && !props.form.borrowerStaffId)}>
            {props.isSaving ? 'Issuing...' : 'Issue copy'}
          </button>
        </form>
      </section>
    </div>
  );
}

function OverduePanel({
  overdueIssues,
  isLoading,
  isSending,
  onSendReminders,
  error,
}: {
  overdueIssues: LibraryIssue[];
  isLoading: boolean;
  isSending: boolean;
  onSendReminders: () => void;
  error: Error | null;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
            <p className="mt-2 text-sm font-semibold text-red-700">Overdue by {overdueDays(issue.dueAt)} day(s)</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IssueRow({ issue, compact = false }: { issue: LibraryIssue; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-900">{issue.copy?.book?.title ?? 'Unknown book'}</h3>
          <StatusBadge status={issue.status} />
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1" />
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
  return 'Unknown borrower';
}

function studentName(student: { firstNameEn?: string; lastNameEn?: string; studentSystemId?: string }) {
  return `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() || student.studentSystemId || 'Student';
}

function staffName(staff: { firstName?: string; lastName?: string; employeeId?: string }) {
  return `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() || staff.employeeId || 'Staff';
}
