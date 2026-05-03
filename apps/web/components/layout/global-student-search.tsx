'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';

export function GlobalStudentSearch() {
  const router = useRouter();
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
    queryFn: () => api.searchStudents(debouncedQuery),
    enabled: canSearchStudents && debouncedQuery.length >= 2,
  });

  const results = searchQuery.data ?? [];

  function goToStudent(studentId: string) {
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
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
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
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

          if (event.key === 'Escape') {
            setOpen(false);
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
            <div className="max-h-96 overflow-y-auto py-2">
              {results.map((student, index) => (
                <button
                  key={student.id}
                  type="button"
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
