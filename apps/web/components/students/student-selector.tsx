'use client';

import { useState, useDeferredValue, useMemo } from 'react';
import { Search, User, Check, X } from 'lucide-react';
import type { StudentProfile } from '@schoolos/core';
import { cn } from '../../lib/utils';
import { Avatar } from '../ui/avatar';

type StudentSelectorProps = {
  students: StudentProfile[];
  selectedId: string;
  onSelect: (studentId: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  optional?: boolean;
};

export function StudentSelector({
  students,
  selectedId,
  onSelect,
  label = 'Select Student',
  placeholder = 'Search by name or ID...',
  className,
  optional = false,
}: StudentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedId),
    [students, selectedId]
  );

  const filteredStudents = useMemo(() => {
    if (!deferredSearch.trim()) return students.slice(0, 5);
    const term = deferredSearch.toLowerCase();
    return students
      .filter((s) => {
        const fullName = `${s.firstNameEn ?? ''} ${s.lastNameEn ?? ''}`.toLowerCase();
        return (
          fullName.includes(term) ||
          (s.studentSystemId ?? '').toLowerCase().includes(term)
        );
      })
      .slice(0, 10);
  }, [students, deferredSearch]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]',
            !selectedStudent && 'text-slate-400'
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <User size={16} className="shrink-0 text-slate-400" />
            <span className="truncate">
              {selectedStudent
                ? `${selectedStudent.firstNameEn} ${selectedStudent.lastNameEn} (${selectedStudent.studentSystemId})`
                : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
             {selectedStudent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('');
                }}
                title="Clear selected student"
                aria-label="Clear selected student"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <Search size={14} className="text-slate-400" />
          </div>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in zoom-in-95">
              <div className="sticky top-0 mb-2 bg-white pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    autoFocus
                    className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--primary)] focus:bg-white"
                    placeholder="Type to search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                {optional && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelect('');
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50',
                      !selectedId && 'bg-[var(--primary-soft)] text-[var(--primary-dark)]'
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <X size={14} />
                    </div>
                    <span className="font-semibold">No Student</span>
                    {!selectedId && <Check size={14} className="ml-auto" />}
                  </button>
                )}
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      onSelect(student.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                      selectedId === student.id &&
                        'bg-[var(--primary-soft)] text-[var(--primary-dark)]'
                    )}
                  >
                    <Avatar
                      initials={`${student.firstNameEn?.[0]}${student.lastNameEn?.[0]}`}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-bold truncate">
                        {student.firstNameEn} {student.lastNameEn}
                      </p>
                      <p className="text-[0.65rem] text-slate-500">
                        {student.studentSystemId} • {student.className}
                      </p>
                    </div>
                    {selectedId === student.id && <Check size={14} className="ml-auto" />}
                  </button>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs font-semibold text-slate-400">No students found</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
