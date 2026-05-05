'use client';

import type { ApiResponse } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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

export function GlobalStudentSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermissions } = useSession();
  const canSearchStudents = hasPermissions(['students:read']);
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

  const searchQuery = useQuery({
    queryKey: ['global-student-search', debouncedQuery],
    queryFn: () => searchStudents(debouncedQuery),
    enabled: canSearchStudents && debouncedQuery.length >= 2,
  });

  const results = searchQuery.data ?? [];

  function clearSearch() {
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
  }

  function goToStudent(studentId: string) {
    clearSearch();
    router.push(`/dashboard/students/${encodeURIComponent(studentId)}`);
  }

  return (
    <div className="relative max-w-md flex-1" ref={containerRef}>
      <label htmlFor="global-student-search" className="sr-only">
        Search students
      </label>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        id="global-student-search"
        type="text"
        placeholder="Search students by name, ID, phone..."
        className="search-input"
        aria-label="Search students by name, ID, admission number, or guardian phone"
        disabled={!canSearchStudents}
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
              goToStudent(selected.id);
            }
          }
        }}
      />

      {open && canSearchStudents && query.trim().length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          {query.trim().length < 2 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Type at least 2 characters to search.
            </div>
          ) : searchQuery.isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Searching students...
            </div>
          ) : searchQuery.isError ? (
            <div className="px-4 py-3 text-sm text-danger-700">
              Could not search students: {searchQuery.error.message}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-500">
              No student found for “{debouncedQuery}”.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-2" data-testid="global-student-search-results">
              {results.map((student, index) => (
                <button
                  key={student.id}
                  type="button"
                  data-testid="global-student-search-result"
                  className={`grid w-full gap-1 px-4 py-3 text-left transition hover:bg-primary-50 ${
                    index === activeIndex ? 'bg-primary-50' : 'bg-white'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goToStudent(student.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-gray-950">
                      {student.fullNameEn}
                    </p>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[0.68rem] font-semibold text-gray-600">
                      {student.studentSystemId}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {student.className}
                    {student.sectionName ? ` - ${student.sectionName}` : ''}
                    {student.rollNumber ? ` / Roll ${student.rollNumber}` : ''}
                    {student.admissionNumber
                      ? ` / Admission ${student.admissionNumber}`
                      : ''}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {student.guardianName || 'Guardian unavailable'}
                    {student.guardianPhone ? ` / ${student.guardianPhone}` : ''}
                  </p>
                </button>
              ))}
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
