"use client";

import { useState } from "react";
import { SubstitutionSummaryPanel } from "../substitution-summary-panel";
import { SubstitutionsList } from "../substitutions-list";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  formatBsDate,
  getNepalSchoolDay,
  shiftGregorianDateOnly,
} from "@schoolos/core";

export function SubstitutionsTab() {
  const [date, setDate] = useState(
    () => getNepalSchoolDay().gregorianDate,
  );

  const nextDay = () => setDate((current) => shiftGregorianDateOnly(current, 1));
  const prevDay = () => setDate((current) => shiftGregorianDateOnly(current, -1));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
            Substitution Oversight
          </h3>
          <p className="text-sm font-medium text-slate-500">
            Monitoring coverage for {formatBsDate(date, { preset: "long" })}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <Tooltip content="Previous day">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevDay}
              aria-label="Previous day"
              className="rounded-xl h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Tooltip>

          <label className="flex h-10 w-[240px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-black uppercase tracking-tight text-slate-700">
            <CalendarIcon className="h-4 w-4 text-[var(--color-mod-homework-text)]" />
            <input
              aria-label="Substitution date"
              className="w-full bg-transparent text-xs font-black uppercase outline-none"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>

          <Tooltip content="Next day">
            <Button
              variant="ghost"
              size="icon"
              onClick={nextDay}
              aria-label="Next day"
              className="rounded-xl h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <SubstitutionSummaryPanel date={date} />

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <SubstitutionsList filters={{ date }} />
      </div>
    </div>
  );
}
