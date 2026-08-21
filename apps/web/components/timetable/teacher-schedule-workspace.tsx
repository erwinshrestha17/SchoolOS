'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  getNepalSchoolDay,
  shiftGregorianDateOnly,
  toNepalLocalDateTime,
} from '@schoolos/core';
import {
  CalendarDays,
  Clock,
  MapPin,
  Printer,
  RefreshCcw,
  UserRoundCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ApiRequestError } from '@/lib/api/client';
import type { TeacherScheduleSlot } from '@/lib/api/teacher-workspace';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { WorkspaceTabs } from '@/components/ui/module-tabs';
import {
  formatLabelledSchoolDate,
  formatSchoolDate,
} from '@/lib/date-utils';
import { cn } from '@/lib/utils';

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function toMinutes(timeOfDay: string): number {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function slotStatusTone(status: TeacherScheduleSlot['status']) {
  return status === 'SUBSTITUTED' ? ('partial' as const) : ('info' as const);
}

/**
 * Teacher "My Schedule" (Teacher Persona spec 12.2, P0.5 / P1.2).
 *
 * Loads the caller's own published schedule with no class/teacher/room
 * selector at all — the backend resolves the staff identity, so there is
 * nothing here that could request another teacher's timetable. The current
 * academic year, the logged-in teacher, and today's date are implicit, so a
 * teacher never sees "Select a class" for a schedule the system already
 * knows.
 */
export function TeacherScheduleWorkspace() {
  const [view, setView] = useState<'today' | 'week'>('today');
  const currentInstant = useMemo(() => new Date(), []);
  const schoolNow = useMemo(
    () => toNepalLocalDateTime(currentInstant),
    [currentInstant],
  );
  const todayKey = useMemo(
    () => getNepalSchoolDay(currentInstant).gregorianDate,
    [currentInstant],
  );

  // The week always starts on Sunday, matching the Nepali school week and
  // TimetableSlot.dayOfWeek.
  const weekStart = useMemo(() => {
    const weekday = new Date(
      Date.UTC(schoolNow.year, schoolNow.month - 1, schoolNow.day),
    ).getUTCDay();
    return shiftGregorianDateOnly(todayKey, -weekday);
  }, [schoolNow.day, schoolNow.month, schoolNow.year, todayKey]);

  const scheduleQuery = useQuery({
    queryKey: ['teacher-schedule', view, view === 'today' ? todayKey : weekStart],
    queryFn: () =>
      view === 'today'
        ? api.getTeacherSchedule({ date: todayKey, days: 1 })
        : api.getTeacherSchedule({ weekStart, days: 7 }),
    staleTime: 60_000,
  });

  const nowMinutes = schoolNow.hour * 60 + schoolNow.minute;
  const noStaffProfile =
    scheduleQuery.error instanceof ApiRequestError &&
    scheduleQuery.error.statusCode === 403;

  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, TeacherScheduleSlot[]>();
    for (const slot of scheduleQuery.data?.items ?? []) {
      const key = slot.date.slice(0, 10);
      const bucket = grouped.get(key) ?? [];
      bucket.push(slot);
      grouped.set(key, bucket);
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [scheduleQuery.data]);

  const mySubstitutions = scheduleQuery.data?.substitutions ?? [];

  if (scheduleQuery.isLoading) {
    return <LoadingState variant="page" label="Loading your schedule..." />;
  }

  // A 403 here is a data condition, not an authorization defect: the schedule
  // resolves the caller's own Staff row and refuses when there isn't an
  // active one (new joiner not yet onboarded, or ended employment). Retrying
  // can never fix that, so it gets a plain explanation and a real next step
  // rather than an error with a Try again button.
  if (noStaffProfile) {
    return (
      <EmptyState
        title="Your staff profile is not linked yet"
        description="Your timetable is built from your staff record, and this account does not have an active one. Ask the school office to link your staff profile, then reload this page."
        icon={<CalendarDays size={28} aria-hidden="true" />}
      />
    );
  }

  if (scheduleQuery.isError) {
    return (
      <ErrorState
        title="Could not load your schedule"
        message="Your timetable could not be loaded just now. Please try again."
        onRetry={() => void scheduleQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WorkspaceTabs
          label="Schedule views"
          activeValue={view}
          onValueChange={(value) => setView(value as 'today' | 'week')}
          items={[
            { value: 'today', label: 'Today', icon: Clock },
            { value: 'week', label: 'This week', icon: CalendarDays },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void scheduleQuery.refetch()}
          >
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="rounded-xl print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      {mySubstitutions.length > 0 && (
        <SectionCard
          title="Schedule changes for you"
          description="Substitutions where you are covering, or where someone is covering for you."
        >
          <ul className="space-y-2">
            {mySubstitutions.map((substitution) => (
              <li
                key={substitution.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warning-100 bg-warning-50/60 px-3 py-2 text-sm"
              >
                <StatusBadge status={substitution.status} />
                <span className="font-bold text-slate-900">
                  {substitution.className}
                  {substitution.sectionName ? ` ${substitution.sectionName}` : ''} ·{' '}
                  {substitution.subjectName}
                </span>
                <span className="text-slate-600">
                  {formatSchoolDate(substitution.date)} · {substitution.startsAt}–
                  {substitution.endsAt}
                </span>
                <span className="text-slate-600">
                  {substitution.role === 'SUBSTITUTE'
                    ? `You are covering for ${substitution.absentTeacherName ?? 'a colleague'}`
                    : `${substitution.substituteTeacherName ?? 'A colleague'} is covering for you`}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {slotsByDay.length === 0 ? (
        <EmptyState
          title={view === 'today' ? 'No periods scheduled today' : 'No periods this week'}
          description="You have no published timetable periods for this range. If that looks wrong, report a timetable issue to the school office."
          icon={<CalendarDays size={28} aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-4">
          {slotsByDay.map(([dateKey, slots]) => {
            const isToday = dateKey === todayKey;
            return (
              <SectionCard
                key={dateKey}
                title={`${DAY_LABELS[slots[0]?.dayOfWeek ?? 0] ?? ''}${isToday ? ' · Today' : ''}`}
                // Labelled BS with the AD equivalent: a teacher cross-references this
                // against AD-dated school notices and exam schedules.
                description={formatLabelledSchoolDate(dateKey, { withGregorian: true })}
              >
                <ul className="space-y-2">
                  {slots.map((slot) => {
                    const isCurrent =
                      isToday &&
                      toMinutes(slot.startsAt) <= nowMinutes &&
                      nowMinutes <= toMinutes(slot.endsAt);
                    return (
                      <li
                        key={`${slot.id}:${dateKey}`}
                        aria-current={isCurrent ? 'time' : undefined}
                        className={cn(
                          'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5 text-sm',
                          isCurrent
                            ? 'border-primary-200 bg-primary-50'
                            : 'border-slate-100 bg-white',
                        )}
                      >
                        <span className="min-w-[7.5rem] font-bold tabular-nums text-slate-900">
                          {slot.startsAt}–{slot.endsAt}
                        </span>
                        <span className="font-bold text-slate-900">
                          {slot.className}
                          {slot.sectionName ? ` ${slot.sectionName}` : ''}
                        </span>
                        <span className="text-slate-600">{slot.subjectName}</span>
                        {slot.room && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {slot.room}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                            <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Now
                          </span>
                        )}
                        {slot.status !== 'SCHEDULED' && (
                          <StatusBadge
                            status={slot.status}
                            tone={slotStatusTone(slot.status)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
