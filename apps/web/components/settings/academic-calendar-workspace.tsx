'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Plus, Save } from 'lucide-react';
import { BS_MONTH_NAMES_EN, daysInBsMonth, formatBsDateOnly, formatBsDateRange, parseBsDateInput, toGregorianDateFromBs, type AcademicCalendarYearSettings } from '@schoolos/core';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { PageHeader } from '../ui/page-header';
import { BsDateField } from '../ui/bs-date-field';
import { ApiRequestError } from '../../lib/api/client';
import { academicCalendarSettingsApi } from '../../lib/api/academic-calendar-settings';

type YearForm = { name: string; startsOnBs: string; endsOnBs: string; isCurrent: boolean };
type DayForm = { calendarDateBs: string; isWorkingDay: boolean; label: string; holidayType: string };
const initialYearForm: YearForm = { name: '', startsOnBs: '', endsOnBs: '', isCurrent: true };
const initialDayForm: DayForm = { calendarDateBs: '', isWorkingDay: false, label: '', holidayType: 'Public holiday' };

export function AcademicCalendarWorkspace() {
  const client = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<string | undefined>();
  const [yearForm, setYearForm] = useState<YearForm>(initialYearForm);
  const [dayForm, setDayForm] = useState<DayForm>(initialDayForm);
  const [yearError, setYearError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const calendarQuery = useQuery({ queryKey: ['school-settings', 'academic-calendar', selectedYearId ?? 'current'], queryFn: () => academicCalendarSettingsApi.getCalendar(selectedYearId) });
  const createYearMutation = useMutation({ mutationFn: academicCalendarSettingsApi.createAcademicYear, onSuccess: async (year: AcademicCalendarYearSettings) => { setSelectedYearId(year.id); setYearForm(initialYearForm); setYearError(null); setNotice(`Academic year ${year.name} was created.`); await client.invalidateQueries({ queryKey: ['school-settings', 'academic-calendar'] }); await client.invalidateQueries({ queryKey: ['school-settings', 'overview'] }); } });
  const setCurrentYearMutation = useMutation({ mutationFn: academicCalendarSettingsApi.setCurrentAcademicYear, onSuccess: async (year: AcademicCalendarYearSettings) => { setNotice(`${year.displayName ?? year.name} is now the current academic year.`); await client.invalidateQueries({ queryKey: ['school-settings', 'academic-calendar'] }); await client.invalidateQueries({ queryKey: ['school-settings', 'overview'] }); } });
  const upsertDayMutation = useMutation({ mutationFn: academicCalendarSettingsApi.upsertCalendarDay, onSuccess: async (day) => { setDayForm({ ...initialDayForm, calendarDateBs: day.calendarDateBs }); setDayError(null); setNotice(day.isWorkingDay ? 'School working day updated.' : 'Holiday saved in the school calendar.'); await client.invalidateQueries({ queryKey: ['school-settings', 'academic-calendar'] }); } });
  const activeYear = useMemo(() => calendarQuery.data?.academicYears.find((year) => year.id === calendarQuery.data?.selectedAcademicYearId), [calendarQuery.data]);
  const [visibleMonth, setVisibleMonth] = useState<{ year: number; month: number } | null>(null);

  if (calendarQuery.isLoading) return <div className="space-y-4 p-6"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-[620px] animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (calendarQuery.isError || !calendarQuery.data) { const denied = calendarQuery.error instanceof ApiRequestError && calendarQuery.error.statusCode === 403; return <ErrorState title={denied ? 'Permission denied' : 'Could not load Calendar, Academic Year & Holidays'} message={denied ? 'You do not have permission to manage the school academic calendar.' : undefined} error={calendarQuery.error} onRetry={denied ? undefined : () => void calendarQuery.refetch()} />; }

  const calendar = calendarQuery.data;
  const monthCursor = visibleMonth ?? (activeYear ? parseBsDateInput(activeYear.startsOnBs) : null);
  const calendarDaysByDate = new Map(calendar.calendarDays.map((day) => [day.calendarDateBs, day]));
  const monthCells = monthCursor ? Array.from({ length: daysInBsMonth(monthCursor.year, monthCursor.month) }, (_, index) => {
    const day = index + 1;
    const key = `${monthCursor.year}-${String(monthCursor.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { key, day, record: calendarDaysByDate.get(key) };
  }) : [];
  const submitYear = () => {
    try {
      const start = toGregorianDateFromBs(parseBsDateInput(yearForm.startsOnBs));
      const end = toGregorianDateFromBs(parseBsDateInput(yearForm.endsOnBs));
      if (Date.UTC(start.year, start.month - 1, start.day) >= Date.UTC(end.year, end.month - 1, end.day)) { setYearError('End date must be after the start date.'); return; }
      if (!yearForm.name.trim()) { setYearError('Enter an academic year name.'); return; }
      createYearMutation.mutate({ ...yearForm, name: yearForm.name.trim() });
    } catch (error) { setYearError(error instanceof Error ? error.message : 'Enter valid BS dates.'); }
  };
  const submitDay = () => {
    try {
      if (!activeYear) { setDayError('Choose an academic year before saving a calendar day.'); return; }
      parseBsDateInput(dayForm.calendarDateBs);
      if (!dayForm.isWorkingDay && !dayForm.label.trim()) { setDayError('Enter a holiday or event label.'); return; }
      upsertDayMutation.mutate({ academicYearId: activeYear.id, calendarDateBs: dayForm.calendarDateBs, isWorkingDay: dayForm.isWorkingDay, label: dayForm.label.trim() || null, holidayType: dayForm.isWorkingDay ? null : dayForm.holidayType.trim() || null });
    } catch (error) { setDayError(error instanceof Error ? error.message : 'Enter a valid BS date.'); }
  };

  return <div className="space-y-6 p-6 pb-20">
    <PageHeader title="Calendar, Academic Year & Holidays" description="Academic years and school days use Bikram Sambat. All date-only records are saved using Nepal school-day boundaries." actions={<Link href="/dashboard/settings/overview" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-950"><ChevronLeft className="h-4 w-4" /> Settings overview</Link>} />
    <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Nepal school calendar standard</p><p className="mt-1">Timezone: {calendar.timeZone}. Enter BS dates as YYYY-MM-DD with English numerals, for example 2083-01-01. The backend converts them to safe Nepal-midnight UTC storage.</p></div></div></section>
    {notice ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</div> : null}

    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><h2 className="font-bold text-slate-950">Academic years</h2><p className="mt-1 text-sm text-slate-600">Create a new academic year before enrolments, timetables, fee plans, or exams rely on it.</p></div><div className="divide-y divide-slate-100">{calendar.academicYears.length === 0 ? <EmptyState title="No academic year has been created" message="Add the first BS academic year for this school." /> : calendar.academicYears.map((year) => <div key={year.id} className={`flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50 ${year.id === calendar.selectedAcademicYearId ? 'bg-slate-50' : ''}`}><button type="button" onClick={() => { setSelectedYearId(year.id); setVisibleMonth(parseBsDateInput(year.startsOnBs)); }} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><p className="font-semibold text-slate-950">{year.displayName ?? year.name}</p>{year.isCurrent ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Current</span> : null}</div><p className="mt-1 text-sm text-slate-600">{formatBsDateRange(year.startsOnBs, year.endsOnBs)}</p></button>{year.isCurrent ? <span className="text-xs font-semibold text-slate-500">{year.id === calendar.selectedAcademicYearId ? 'Viewing' : 'Open'}</span> : <Button type="button" size="sm" variant="outline" disabled={setCurrentYearMutation.isPending} onClick={() => setCurrentYearMutation.mutate(year.id)}>Set current</Button>}</div>)}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-950">Create academic year</h2><p className="mt-1 text-sm text-slate-600">Dates cannot overlap an existing school academic year.</p><div className="mt-5 space-y-4"><TextField label="Academic year name" value={yearForm.name} onChange={(value) => setYearForm((current) => ({ ...current, name: value }))} placeholder="2083/84" /><BsDateField label="Start date (BS)" value={yearForm.startsOnBs} onChange={(value) => setYearForm((current) => ({ ...current, startsOnBs: value }))} /><BsDateField label="End date (BS)" value={yearForm.endsOnBs} onChange={(value) => setYearForm((current) => ({ ...current, endsOnBs: value }))} placeholder="2083-12-31" /><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={yearForm.isCurrent} onChange={(event) => setYearForm((current) => ({ ...current, isCurrent: event.target.checked }))} /> Set as current academic year</label>{yearError ? <p className="text-sm font-semibold text-rose-700" role="alert">{yearError}</p> : null}{createYearMutation.isError ? <p className="text-sm font-semibold text-rose-700" role="alert">Could not create the academic year. Review the dates and try again.</p> : null}<Button type="button" className="w-full" onClick={submitYear} disabled={createYearMutation.isPending}><Plus className="h-4 w-4" />{createYearMutation.isPending ? 'Creating…' : 'Create academic year'}</Button></div></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><h2 className="font-bold text-slate-950">School days & holidays</h2><p className="mt-1 text-sm text-slate-600">{activeYear ? `Managing ${activeYear.displayName ?? activeYear.name} · ${formatBsDateRange(activeYear.startsOnBs, activeYear.endsOnBs)}` : 'Choose or create an academic year to view calendar days.'}</p></div>{activeYear ? <><div className="border-b border-slate-100 p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-black text-slate-950">{monthCursor ? `${BS_MONTH_NAMES_EN[monthCursor.month - 1]} ${monthCursor.year}` : 'BS month'}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Working days, holidays, closures, and real school events configured for this month.</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => monthCursor && setVisibleMonth(previousBsMonth(monthCursor))}><ChevronLeft className="h-4 w-4" />Previous</Button><Button type="button" size="sm" variant="outline" onClick={() => monthCursor && setVisibleMonth(nextBsMonth(monthCursor))}>Next<ChevronRight className="h-4 w-4" /></Button></div></div><div className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 text-sm">{monthCells.map((cell) => <button key={cell.key} type="button" onClick={() => setDayForm((current) => ({ ...current, calendarDateBs: cell.key, label: cell.record?.label ?? current.label, holidayType: cell.record?.holidayType ?? current.holidayType, isWorkingDay: cell.record?.isWorkingDay ?? true }))} className={`min-h-20 border-r border-b border-slate-100 p-2 text-left last:border-r-0 ${cell.record?.isWorkingDay === false ? 'bg-amber-50' : cell.record ? 'bg-sky-50' : 'bg-white hover:bg-slate-50'}`}><span className="text-xs font-black text-slate-900">{cell.day}</span><span className="mt-1 block line-clamp-2 text-[0.68rem] font-semibold text-slate-600">{cell.record?.label ?? 'Working day'}</span>{cell.record ? <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-black ${cell.record.isWorkingDay ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{cell.record.category?.replace(/_/g, ' ') ?? (cell.record.isWorkingDay ? 'Working day' : 'Holiday')}</span> : null}</button>)}</div></div><div className="grid gap-4 border-b border-slate-100 p-6 md:grid-cols-2 xl:grid-cols-4"><BsDateField label="Calendar date (BS)" value={dayForm.calendarDateBs} onChange={(value) => setDayForm((current) => ({ ...current, calendarDateBs: value }))} placeholder="2083-04-01" /><TextField label="Holiday / event label" value={dayForm.label} onChange={(value) => setDayForm((current) => ({ ...current, label: value }))} placeholder="Dashain holiday" /><TextField label="Holiday type" value={dayForm.holidayType} onChange={(value) => setDayForm((current) => ({ ...current, holidayType: value }))} placeholder="Public holiday / closure / school event" disabled={dayForm.isWorkingDay} /><div><span className="text-sm font-semibold text-slate-700">School day status</span><div className="mt-2 flex gap-2"><Button type="button" size="sm" variant={dayForm.isWorkingDay ? 'default' : 'outline'} onClick={() => setDayForm((current) => ({ ...current, isWorkingDay: true }))}>Working day</Button><Button type="button" size="sm" variant={!dayForm.isWorkingDay ? 'default' : 'outline'} onClick={() => setDayForm((current) => ({ ...current, isWorkingDay: false }))}>Holiday / closed</Button></div></div></div><div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4"><div>{dayError ? <p className="text-sm font-semibold text-rose-700" role="alert">{dayError}</p> : <p className="text-sm text-slate-600">A working-day update can also clear a holiday or closure.</p>}</div><Button type="button" onClick={submitDay} disabled={upsertDayMutation.isPending}><Save className="h-4 w-4" />{upsertDayMutation.isPending ? 'Saving…' : 'Save calendar day'}</Button></div><div className="divide-y divide-slate-100">{calendar.calendarDays.length === 0 ? <EmptyState title="No calendar exceptions yet" message="School days follow the normal schedule until you add a holiday or a working-day exception." /> : calendar.calendarDays.map((day) => <div key={day.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="font-semibold text-slate-950">{formatBsDateOnly(day.calendarDateBs, { preset: 'long' })}</p><p className="mt-1 text-sm text-slate-600">{day.label ?? (day.isWorkingDay ? 'Working day' : 'School closed')}{day.holidayType ? ` · ${day.holidayType}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${day.isWorkingDay ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{day.category?.replace(/_/g, ' ') ?? (day.isWorkingDay ? 'Working day' : 'Holiday / closed')}</span></div>)}</div></> : <EmptyState title="Create an academic year first" message="Calendar days and holidays are shown within the selected academic year." />}</section>
  </div>;
}

function TextField({ label, value, onChange, placeholder, disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }) { return <label><span className="text-sm font-semibold text-slate-700">{label}</span><input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100" /></label>; }
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center"><CircleAlert className="h-6 w-6 text-slate-400" /><p className="mt-3 font-semibold text-slate-900">{title}</p><p className="mt-1 max-w-md text-sm text-slate-600">{message}</p></div>; }

function previousBsMonth(value: { year: number; month: number }) {
  return value.month === 1
    ? { year: value.year - 1, month: 12 }
    : { year: value.year, month: value.month - 1 };
}

function nextBsMonth(value: { year: number; month: number }) {
  return value.month === 12
    ? { year: value.year + 1, month: 1 }
    : { year: value.year, month: value.month + 1 };
}
