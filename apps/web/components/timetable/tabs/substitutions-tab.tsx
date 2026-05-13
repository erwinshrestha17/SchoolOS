'use client';

import { useState } from 'react';
import { SubstitutionSummaryPanel } from '../substitution-summary-panel';
import { SubstitutionsList } from '../substitutions-list';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SubstitutionsTab() {
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, 'yyyy-MM-dd');

  const nextDay = () => setDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
  const prevDay = () => setDate(new Date(date.getTime() - 24 * 60 * 60 * 1000));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex flex-col">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
            Substitution Oversight
          </h3>
          <p className="text-sm font-medium text-slate-500">
            Monitoring coverage for {format(date, 'EEEE, MMMM do, yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <Button variant="ghost" size="icon" onClick={prevDay} className="rounded-xl h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[240px] justify-start text-left font-black uppercase tracking-tight rounded-xl border-slate-200 h-10',
                  !date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
                {date ? format(date, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-[2rem] border-slate-200 shadow-2xl" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={nextDay} className="rounded-xl h-10 w-10">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <SubstitutionSummaryPanel date={dateStr} />

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <SubstitutionsList filters={{ date: dateStr }} />
      </div>
    </div>
  );
}
