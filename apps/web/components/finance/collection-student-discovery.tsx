"use client";

import type { CollectionStudentSearchResult } from "@schoolos/core";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { SectionCard } from "@/components/ui/section-card";

const formatCurrency = (amount: string) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

export function CollectionStudentDiscovery({
  search,
  onSearchChange,
  students,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  students: CollectionStudentSearchResult[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (student: CollectionStudentSearchResult) => void;
}) {
  return (
    <SectionCard
      title="Find a student"
      description="Search active fee accounts by student name, student ID, invoice number, or guardian phone. Results include backend-owned outstanding balances only."
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <SearchInput
          label="Student, invoice, or guardian phone"
          placeholder="Search name, student ID, invoice number or guardian phone"
          value={search}
          debounceMs={250}
          onChange={onSearchChange}
        />

        {search.trim().length < 2 ? (
          <EmptyState
            title="Start with the student"
            description="Enter at least two characters. Only students with an outstanding invoice are returned."
            icon={<Search className="h-7 w-7" />}
            className="min-h-56"
          />
        ) : isError ? (
          <ErrorState
            title="Student search could not load"
            message="Your search was preserved and no payment was started. Retry when ready."
            onRetry={onRetry}
            className="min-h-56"
          />
        ) : isLoading ? (
          <div
            className="grid gap-3 md:grid-cols-2"
            aria-label="Searching fee accounts"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : students.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => onSelect(student)}
                className="min-h-28 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--color-mod-fees-border)] hover:bg-[var(--color-mod-fees-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-fees-accent)] focus-visible:ring-offset-2"
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {student.name}
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {student.studentSystemId} · {student.className}
                      {student.sectionName ? ` · ${student.sectionName}` : ""}
                    </span>
                    {student.guardianName || student.guardianPhone ? (
                      <span className="mt-2 block truncate text-xs text-slate-500">
                        {student.guardianName ?? "Guardian"}
                        {student.guardianPhone
                          ? ` · ${student.guardianPhone}`
                          : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-slate-950 tabular-nums">
                      {formatCurrency(student.totalOutstanding)}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {student.openInvoiceCount} open{" "}
                      {student.openInvoiceCount === 1 ? "invoice" : "invoices"}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No fee accounts match this search"
            description="Try another name, student ID, invoice number, or guardian phone. Students without an outstanding invoice are excluded."
            icon={<Users className="h-7 w-7" />}
            className="min-h-56"
          />
        )}
      </div>
    </SectionCard>
  );
}
