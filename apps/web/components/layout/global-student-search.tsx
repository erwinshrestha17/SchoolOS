'use client';

import type { ApiResponse, InvoiceSummary } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type StudentSearchResult = {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  admissionNumber: string | null;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  lifecycleStatus: string;
};

/**
 * A single navigable search result. Kept as a union (rather than two
 * separate lists) so arrow-key navigation and Enter-to-open work across
 * every result type consistently.
 */
type SearchResultEntry =
  | { kind: 'student'; key: string; student: StudentSearchResult }
  | { kind: 'invoice'; key: string; invoice: InvoiceSummary };

export function GlobalStudentSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermissions } = useSession();
  const canSearchStudents = hasPermissions(['students:read']);
  // Only cashiers/accountants can look up invoices (matches the backend's
  // own `payments:collect` guard on GET /fees/invoices) — do not widen this
  // to a broader finance permission the endpoint doesn't actually accept.
  const canSearchInvoices = hasPermissions(['payments:collect']);
  const canSearchAnything = canSearchStudents || canSearchInvoices;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setActiveIndex(0);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const studentSearchQuery = useQuery({
    queryKey: ['global-student-search', debouncedQuery],
    queryFn: () => searchStudents(debouncedQuery),
    enabled: canSearchStudents && debouncedQuery.length >= 2,
  });

  const invoiceSearchQuery = useQuery({
    queryKey: ['global-invoice-search', debouncedQuery],
    queryFn: () => api.listInvoices({ search: debouncedQuery, limit: 5 }),
    enabled: canSearchInvoices && debouncedQuery.length >= 2,
  });

  const results: SearchResultEntry[] = [
    ...(studentSearchQuery.data ?? []).map((student) => ({
      kind: 'student' as const,
      key: `student-${student.id}`,
      student,
    })),
    ...(invoiceSearchQuery.data ?? []).map((invoice) => ({
      kind: 'invoice' as const,
      key: `invoice-${invoice.id}`,
      invoice,
    })),
  ];

  const isSearching =
    (canSearchStudents && studentSearchQuery.isLoading) ||
    (canSearchInvoices && invoiceSearchQuery.isLoading);
  const searchError = studentSearchQuery.error ?? invoiceSearchQuery.error;

  function clearSearch() {
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
  }

  function goToResult(entry: SearchResultEntry) {
    clearSearch();
    if (entry.kind === 'student') {
      router.push(`/dashboard/students/${encodeURIComponent(entry.student.id)}`);
      return;
    }

    const params = new URLSearchParams();
    params.set('invoiceId', entry.invoice.id);
    if (entry.invoice.studentId) {
      params.set('studentId', entry.invoice.studentId);
    }
    router.push(`/dashboard/finance?${params.toString()}`);
  }

  const placeholder = canSearchInvoices
    ? 'Search students or invoices...'
    : 'Search students by name, ID, phone...';

  return (
    <div className="relative max-w-md flex-1" ref={containerRef}>
      <label htmlFor="global-student-search" className="sr-only">
        Search students{canSearchInvoices ? ' or invoices' : ''}
      </label>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        id="global-student-search"
        type="text"
        placeholder={placeholder}
        className="search-input"
        aria-label={
          canSearchInvoices
            ? 'Search students or invoices by name, ID, invoice number, or guardian phone'
            : 'Search students by name, ID, admission number, or guardian phone'
        }
        disabled={!canSearchAnything}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(Boolean(query.trim()))}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearSearch();
            return;
          }

          if (!open || results.length === 0) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % results.length);
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) =>
              current === 0 ? results.length - 1 : current - 1,
            );
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            const selected = results[activeIndex];
            if (selected) {
              goToResult(selected);
            }
          }
        }}
      />

      {open && canSearchAnything && query.trim().length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          {query.trim().length < 2 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Type at least 2 characters to search.
            </div>
          ) : isSearching ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Searching...
            </div>
          ) : searchError ? (
            <div className="px-4 py-3 text-sm text-danger-700">
              Could not search: {searchError.message}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-500">
              No match found for “{debouncedQuery}”.
            </div>
          ) : (
            <div
              className="max-h-96 overflow-y-auto py-2"
              data-testid="global-student-search-results"
            >
              {results.map((entry, index) =>
                entry.kind === 'student' ? (
                  <button
                    key={entry.key}
                    type="button"
                    data-testid="global-student-search-result"
                    className={`grid w-full gap-1 px-4 py-3 text-left transition hover:bg-[var(--primary-soft)] ${
                      index === activeIndex ? 'bg-[var(--primary-soft)]' : 'bg-white'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goToResult(entry)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-gray-950">
                        <UserRound size={13} className="shrink-0 text-gray-400" />
                        <span className="truncate">{entry.student.fullNameEn}</span>
                      </p>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[0.68rem] font-semibold text-gray-600">
                        {entry.student.studentSystemId}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {entry.student.className}
                      {entry.student.sectionName ? ` - ${entry.student.sectionName}` : ''}
                      {entry.student.rollNumber ? ` / Roll ${entry.student.rollNumber}` : ''}
                      {entry.student.admissionNumber
                        ? ` / Admission ${entry.student.admissionNumber}`
                        : ''}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {entry.student.guardianName || 'Guardian unavailable'}
                      {entry.student.guardianPhone ? ` / ${entry.student.guardianPhone}` : ''}
                    </p>
                  </button>
                ) : (
                  <button
                    key={entry.key}
                    type="button"
                    data-testid="global-invoice-search-result"
                    className={`grid w-full gap-1 px-4 py-3 text-left transition hover:bg-[var(--primary-soft)] ${
                      index === activeIndex ? 'bg-[var(--primary-soft)]' : 'bg-white'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goToResult(entry)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-gray-950">
                        <FileText size={13} className="shrink-0 text-gray-400" />
                        <span className="truncate">{entry.invoice.invoiceNumber}</span>
                      </p>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[0.68rem] font-semibold text-gray-600">
                        {entry.invoice.status}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {entry.invoice.student?.name ?? 'Student unavailable'}
                    </p>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

async function searchStudents(query: string) {
  const response = await fetch(
    `${API_BASE_URL}/students/search?q=${encodeURIComponent(query)}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiErrorMessage(text) || `Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<StudentSearchResult[]>;
  return payload.data;
}

function parseApiErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as { message?: string | string[]; error?: string };
    return Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || payload.error || text;
  } catch {
    return text;
  }
}
