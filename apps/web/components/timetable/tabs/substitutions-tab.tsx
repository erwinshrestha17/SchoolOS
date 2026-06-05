'use client';

import { useState } from 'react';
import { SubstitutionSummaryPanel } from '../substitution-summary-panel';
import { SubstitutionsList } from '../substitutions-list';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export function SubstitutionsTab() {
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = toDateInputValue(date);

  const nextDay = () => setDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
  const prevDay = () => setDate(new Date(date.getTime() - 24 * 60 * 60 * 1000));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
            Substitution Oversight
          </h3>
          <p className="text-sm font-medium text-slate-500">
            Monitoring coverage for {formatDisplayDate(date)}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <Button variant="ghost" size="icon" onClick={prevDay} className="rounded-xl h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <label className="flex h-10 w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-black uppercase tracking-tight text-slate-700">
            <CalendarIcon className="h-4 w-4 text-[var(--color-mod-homework-text)]" />
            <input
              aria-label="Substitution date"
              className="w-full bg-transparent text-xs font-black uppercase outline-none"
              type="date"
              value={dateStr}
              onChange={(event) => setDate(fromDateInputValue(event.target.value))}
            />
          </label>

          <Button variant="ghost" size="icon" onClick={nextDay} className="rounded-xl h-10 w-10">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <SubstitutionSummaryPanel date={dateStr} />

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <SubstitutionsList filters={{ date: dateStr }} />
      </div>
    </div>
  );
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string) {
  const next = new Date(`${value}T00:00:00`);
  return Number.isNaN(next.getTime()) ? new Date() : next;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
