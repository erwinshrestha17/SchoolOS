'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { BookOpen, BookmarkCheck, Clock3, Search } from 'lucide-react';
import { libraryApi } from '@/lib/api/library';
import { ApiRequestError } from '@/lib/api/client';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SummaryCard, SummaryGrid } from '@/components/ui/summary-card';
import { WorkspaceTabs } from '@/components/ui/module-tabs';
import { formatSchoolDate } from '@/lib/date-utils';

type TeacherLibraryTab = 'loans' | 'catalog';

function isOverdue(dueAt: string, returnedAt?: string | null) {
  if (returnedAt) return false;
  const due = new Date(dueAt).getTime();
  return Number.isFinite(due) && due < Date.now();
}

/**
 * Teacher Library (Teacher Persona spec M8, P0.9 / P1.11).
 *
 * A borrower workspace, not the circulation desk. It uses only the two APIs a
 * teacher is actually authorised for:
 *
 *   GET /library/my/issues  -- self-scoped by LibraryHardeningService
 *   GET /library/books      -- the shared catalogue
 *
 * It deliberately does not call the catalogue-administration, copy, borrower,
 * fine, overdue-operations or report endpoints, all of which need
 * `library:manage` / `library:reports:read`. That is why the previous shared
 * librarian console rendered "Insufficient permissions" as a teacher's whole
 * library experience: it issued nine administrative requests on mount.
 *
 * Teacher-librarians hold LIBRARY_ADMIN and get the full console instead.
 */
export function TeacherLibraryWorkspace() {
  const [tab, setTab] = useState<TeacherLibraryTab>('loans');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const myIssuesQuery = useQuery({
    queryKey: ['library-my-issues'],
    queryFn: () => libraryApi.listMyIssues({ limit: '50' }),
    staleTime: 60_000,
  });

  const catalogQuery = useQuery({
    queryKey: ['library-catalog', submittedSearch],
    queryFn: () =>
      libraryApi.listBooks({ q: submittedSearch || null, limit: '20' }),
    enabled: tab === 'catalog',
    staleTime: 60_000,
  });

  const issues = useMemo(
    () => myIssuesQuery.data?.items ?? [],
    [myIssuesQuery.data],
  );
  // A 403 here is not an authorization defect: /library/my/issues resolves the
  // caller's own Staff row and refuses when there isn't one.
  const noStaffProfile =
    myIssuesQuery.error instanceof ApiRequestError &&
    myIssuesQuery.error.statusCode === 403;
  const activeLoans = issues.filter((issue) => !issue.returnedAt);
  const overdueLoans = activeLoans.filter((issue) => isOverdue(issue.dueAt));
  const dueSoonLoans = activeLoans.filter((issue) => {
    if (isOverdue(issue.dueAt)) return false;
    const due = new Date(issue.dueAt).getTime();
    return Number.isFinite(due) && due - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-6">
      <SummaryGrid>
        <SummaryCard
          label="Books I have out"
          loading={myIssuesQuery.isLoading}
          value={myIssuesQuery.isError ? 'Unavailable' : activeLoans.length}
          icon={<BookOpen size={20} />}
          tone="module"
          description="Copies currently issued to you."
        />
        <SummaryCard
          label="Due within a week"
          loading={myIssuesQuery.isLoading}
          value={myIssuesQuery.isError ? 'Unavailable' : dueSoonLoans.length}
          icon={<Clock3 size={20} />}
          tone={!myIssuesQuery.isError && dueSoonLoans.length > 0 ? 'info' : 'module'}
          description="Return or ask the library desk to renew."
        />
        <SummaryCard
          label="Overdue"
          loading={myIssuesQuery.isLoading}
          value={myIssuesQuery.isError ? 'Unavailable' : overdueLoans.length}
          icon={<BookmarkCheck size={20} />}
          tone={
            !myIssuesQuery.isError && overdueLoans.length > 0
              ? 'warning'
              : 'module'
          }
          description="Past their due date."
        />
      </SummaryGrid>

      <WorkspaceTabs
        label="Library views"
        activeValue={tab}
        onValueChange={(value) => setTab(value as TeacherLibraryTab)}
        items={[
          { value: 'loans', label: 'My loans', icon: BookOpen },
          { value: 'catalog', label: 'Search catalogue', icon: Search },
        ]}
      />

      {tab === 'loans' ? (
        myIssuesQuery.isLoading ? (
          <LoadingState variant="page" label="Loading your borrowing record..." />
        ) : noStaffProfile ? (
          // Validation scenario: an account with no active Staff row (new
          // joiner not yet onboarded, or an ended employment record). The
          // backend is right to refuse, and retrying will never succeed --
          // so this is a plain explanation with the actual next step, not a
          // generic error with a Try again button that cannot work.
          <EmptyState
            title="Your staff profile is not linked yet"
            description="Library borrowing is tied to your staff record, and this account does not have an active one. Ask the school office to link your staff profile, then reload this page."
            icon={<BookOpen size={28} aria-hidden="true" />}
          />
        ) : myIssuesQuery.isError ? (
          <ErrorState
            title="Could not load your library record"
            message="Your loans could not be loaded just now. Please try again."
            onRetry={() => void myIssuesQuery.refetch()}
          />
        ) : issues.length === 0 ? (
          <EmptyState
            title="You have not borrowed anything yet"
            description="Search the catalogue to find a title, then ask the library desk to issue it to you."
            icon={<BookOpen size={28} aria-hidden="true" />}
          />
        ) : (
          <SectionCard
            title="My loans"
            description="Every copy issued to you, most recent first."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Library copies issued to you, with issue date, due date and
                  current status
                </caption>
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3">Title</th>
                    <th scope="col" className="py-2 pr-3">Issued</th>
                    <th scope="col" className="py-2 pr-3">Due</th>
                    <th scope="col" className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => {
                    const overdue = isOverdue(issue.dueAt, issue.returnedAt);
                    return (
                      <tr
                        key={issue.id}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="py-2 pr-3 font-bold text-slate-900">
                          {issue.copy?.book?.title ?? 'Library copy'}
                          {issue.copy?.barcode ? (
                            <span className="ml-2 font-normal text-slate-400">
                              {issue.copy.barcode}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {formatSchoolDate(issue.issuedAt)}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {formatSchoolDate(issue.dueAt)}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusBadge
                            status={overdue ? 'OVERDUE' : issue.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )
      ) : (
        <SectionCard
          title="Search the catalogue"
          description="Find a title to request from the library desk."
        >
          <form
            className="mb-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(search.trim());
            }}
          >
            <label htmlFor="library-catalog-search" className="sr-only">
              Search the library catalogue
            </label>
            <input
              id="library-catalog-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, author, or ISBN"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </button>
          </form>

          {catalogQuery.isLoading ? (
            <LoadingState label="Searching the catalogue..." />
          ) : catalogQuery.isError ? (
            <ErrorState
              title="Could not search the catalogue"
              message="The catalogue could not be reached just now. Please try again."
              onRetry={() => void catalogQuery.refetch()}
            />
          ) : (catalogQuery.data?.items.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {submittedSearch
                ? `No titles match "${submittedSearch}".`
                : 'Search for a title, author, or ISBN to see what the library holds.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {catalogQuery.data?.items.map((book) => (
                <li key={book.id} className="flex flex-wrap gap-x-4 gap-y-1 py-3">
                  <span className="font-bold text-slate-900">{book.title}</span>
                  {book.author ? (
                    <span className="text-slate-600">{book.author}</span>
                  ) : null}
                  {book.isbn ? (
                    <span className="text-slate-400">ISBN {book.isbn}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
