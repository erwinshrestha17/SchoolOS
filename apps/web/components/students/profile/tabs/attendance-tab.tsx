"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatBsDateTime,
  formatNepalTime,
  type StudentAttendanceMonthlyRegister,
  type StudentAttendanceMonthlyRegisterDay,
  type StudentProfileDetail,
} from "@schoolos/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/primitives/alert";
import { Badge } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/primitives/empty";
import { Progress } from "@/components/ui/primitives/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/primitives/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { Separator } from "@/components/ui/primitives/separator";
import { Skeleton } from "@/components/ui/primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/primitives/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/primitives/tooltip";

type AttendanceTabProps = { profile: StudentProfileDetail };

const ACADEMIC_YEAR_PARAM = "academicYearId";
const MONTH_PARAM = "month";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AttendanceTab({ profile }: AttendanceTabProps) {
  const studentId = profile.student.id;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAcademicYearId = searchParams.get(ACADEMIC_YEAR_PARAM);
  const requestedMonth = searchParams.get(MONTH_PARAM);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);

  const updateUrlState = useCallback(
    (
      updates: Record<string, string | null>,
      navigation: "push" | "replace" = "push",
    ) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", "attendance");
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router[navigation](`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const monthQuery = useQuery({
    queryKey: [
      "student-attendance-month",
      studentId,
      requestedAcademicYearId ?? "default",
      requestedMonth ?? "default",
    ],
    queryFn: () =>
      api.getStudentAttendanceMonthlyRegister(studentId, {
        academicYearId: requestedAcademicYearId,
        month: requestedMonth,
      }),
    staleTime: 30_000,
  });

  useEffect(() => {
    const data = monthQuery.data;
    if (!data?.selectedAcademicYear || !data.month) return;
    const updates: Record<string, string | null> = {};
    if (requestedAcademicYearId !== data.selectedAcademicYear.id) {
      updates[ACADEMIC_YEAR_PARAM] = data.selectedAcademicYear.id;
    }
    if (requestedMonth !== data.month.key)
      updates[MONTH_PARAM] = data.month.key;
    if (searchParams.get("tab") !== "attendance") updates.tab = "attendance";
    if (Object.keys(updates).length > 0) updateUrlState(updates, "replace");
  }, [
    monthQuery.data,
    requestedAcademicYearId,
    requestedMonth,
    searchParams,
    updateUrlState,
  ]);

  const selectAcademicYear = (academicYearId: string) => {
    setFocusedDate(null);
    updateUrlState({
      [ACADEMIC_YEAR_PARAM]: academicYearId,
      [MONTH_PARAM]: null,
    });
  };
  const selectMonth = (month: string) => {
    setFocusedDate(null);
    updateUrlState({ [MONTH_PARAM]: month });
  };

  if (monthQuery.isLoading) return <AttendanceLoading />;
  if (monthQuery.isError) {
    return (
      <AttendanceRequestError
        error={monthQuery.error}
        onRetry={() => void monthQuery.refetch()}
      />
    );
  }

  const data = monthQuery.data;
  if (
    !data ||
    data.calendarState === "UNAVAILABLE" ||
    !data.selectedAcademicYear
  ) {
    return <AcademicCalendarUnavailable />;
  }
  if (!data.month) return <MonthEmpty />;

  const currentAcademicYear = data.academicYears.find((year) => year.isCurrent);
  const returnToCurrentMonth = () => {
    if (!currentAcademicYear) return;
    if (currentAcademicYear.id === data.selectedAcademicYear?.id) {
      if (data.currentMonthKey) selectMonth(data.currentMonthKey);
      return;
    }
    selectAcademicYear(currentAcademicYear.id);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-1">
              <CardTitle>Attendance</CardTitle>
              <CardDescription>
                Monthly attendance record for the selected academic year
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label
                className="text-sm font-medium"
                htmlFor="attendance-academic-year"
              >
                Academic year
              </label>
              <Select
                value={data.selectedAcademicYear.id}
                onValueChange={selectAcademicYear}
              >
                <SelectTrigger
                  id="attendance-academic-year"
                  className="w-full sm:w-52"
                >
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {data.academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                        {year.isCurrent ? " · Current" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <MonthNavigator
            data={data}
            onSelectMonth={selectMonth}
            onCurrentMonth={returnToCurrentMonth}
            canReturnToCurrent={Boolean(currentAcademicYear)}
          />

          {data.dataState === "PARTIAL" ? (
            <Alert className="border-warning-100 bg-warning-50 text-warning-900">
              <AlertCircle />
              <AlertTitle>Partial attendance data</AlertTitle>
              <AlertDescription>
                Some past school days have a draft register or no submitted
                student record. Missing records are shown as Not marked, never
                as absent.
              </AlertDescription>
            </Alert>
          ) : null}

          <MonthlySummary data={data} />
          <Separator />
          <AttendanceCalendar
            data={data}
            focusedDate={focusedDate}
            onFocusDate={(date) => {
              setFocusedDate(date);
              const row = document.getElementById(registerRowId(date));
              row?.scrollIntoView({ behavior: "smooth", block: "center" });
              row?.focus({ preventScroll: true });
            }}
          />
          <AttendanceLegend />
          <Separator />
          <MonthlyRegister data={data} focusedDate={focusedDate} />
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function MonthNavigator({
  data,
  onSelectMonth,
  onCurrentMonth,
  canReturnToCurrent,
}: {
  data: StudentAttendanceMonthlyRegister;
  onSelectMonth: (month: string) => void;
  onCurrentMonth: () => void;
  canReturnToCurrent: boolean;
}) {
  if (!data.month) return null;
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center">
      <div className="flex items-center justify-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={!data.previousMonthKey}
              aria-label="Previous month"
              onClick={() =>
                data.previousMonthKey && onSelectMonth(data.previousMonthKey)
              }
            >
              <ChevronLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous month</TooltipContent>
        </Tooltip>

        <Select value={data.month.key} onValueChange={onSelectMonth}>
          <SelectTrigger
            className="min-w-48 justify-center font-semibold"
            aria-label="Attendance month"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {data.months.map((month) => (
                <SelectItem
                  key={month.key}
                  value={month.key}
                  disabled={!month.isAvailable}
                >
                  {month.label}
                  {month.isCurrent ? " · Current" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={!data.nextMonthKey}
              aria-label="Next month"
              onClick={() =>
                data.nextMonthKey && onSelectMonth(data.nextMonthKey)
              }
            >
              <ChevronRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next month</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center justify-center gap-2 md:justify-end">
        <MonthStateBadge state={data.month.state} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            !canReturnToCurrent || data.month.key === data.currentMonthKey
          }
          onClick={onCurrentMonth}
        >
          <CalendarDays />
          Current Month
        </Button>
      </div>
    </div>
  );
}

function MonthlySummary({ data }: { data: StudentAttendanceMonthlyRegister }) {
  const month = data.month;
  if (!month) return null;
  const summaryItems = [
    ["School Days", month.totalSchoolDays],
    ["Present", month.present],
    ["Absent", month.absent],
    ["Late", month.late],
    ...(data.leaveSupported ? [["Leave", month.leave] as const] : []),
  ];
  return (
    <section
      aria-labelledby="attendance-summary-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h3 id="attendance-summary-title" className="font-semibold">
            Monthly summary
          </h3>
          <p className="text-sm text-muted-foreground">
            Official backend-owned totals for {month.label}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock3 className="size-4" aria-hidden="true" />
          {data.lastUpdatedAt
            ? `Updated ${formatBsDateTime(data.lastUpdatedAt)}`
            : "No submitted update"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {summaryItems.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
        <div className="col-span-2 flex flex-col gap-2 rounded-lg border bg-card p-3 sm:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Attendance
            </p>
            <p className="font-semibold tabular-nums">
              {month.attendancePercentage === null
                ? "Not calculated"
                : `${month.attendancePercentage}%`}
            </p>
          </div>
          <Progress
            value={month.attendancePercentage ?? 0}
            aria-label="Attendance percentage"
          />
        </div>
      </div>
    </section>
  );
}

function AttendanceCalendar({
  data,
  focusedDate,
  onFocusDate,
}: {
  data: StudentAttendanceMonthlyRegister;
  focusedDate: string | null;
  onFocusDate: (date: string) => void;
}) {
  const leadingCells = data.days[0]?.weekday ?? 0;
  return (
    <section
      aria-labelledby="attendance-calendar-title"
      className="flex flex-col gap-3"
    >
      <div>
        <h3 id="attendance-calendar-title" className="font-semibold">
          Attendance calendar
        </h3>
        <p className="text-sm text-muted-foreground">
          Sunday–Saturday, using the school academic calendar
        </p>
      </div>
      <TooltipProvider>
        <ScrollArea className="w-full rounded-lg border">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-xs font-semibold text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: leadingCells }, (_, index) => (
                <div
                  key={`blank-${index}`}
                  aria-hidden="true"
                  className="min-h-24 border-b border-r bg-muted/20"
                />
              ))}
              {data.days.map((day) => (
                <CalendarDay
                  key={day.dateBs}
                  day={day}
                  selected={focusedDate === day.dateBs}
                  onSelect={() => onFocusDate(day.dateBs)}
                />
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TooltipProvider>
    </section>
  );
}

function CalendarDay({
  day,
  selected,
  onSelect,
}: {
  day: StudentAttendanceMonthlyRegisterDay;
  selected: boolean;
  onSelect: () => void;
}) {
  const visual = getDayVisual(day);
  const dayNumber = Number(day.dateBs.slice(-2));
  const tooltip = [
    `${day.dateLabel}, ${day.dayLabel}`,
    dayTypeLabel(day.dayType),
    visual.label,
    day.calendarLabel,
    day.arrivalAt ? `Arrival: ${formatNepalTime(day.arrivalAt)}` : null,
    day.remark,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={day.isFuture}
          aria-label={tooltip}
          aria-pressed={selected}
          onClick={onSelect}
          className={cn(
            "flex min-h-24 flex-col gap-2 border-b border-r p-2 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
            visual.className,
            day.isToday && "ring-1 ring-inset ring-primary bg-primary/5",
            selected && "z-10 ring-2 ring-inset ring-primary",
            day.isFuture && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="font-semibold tabular-nums">{dayNumber}</span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide">
            {visual.label}
          </span>
          <span className="line-clamp-1 text-[0.65rem] text-current/75">
            {dayTypeLabel(day.dayType)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function AttendanceLegend() {
  const items = [
    ["Present", "bg-success-500"],
    ["Absent", "bg-danger-500"],
    ["Late", "bg-warning-500"],
    ["Leave / excused", "bg-info-500"],
    ["Holiday / weekend", "bg-secondary"],
    ["Not marked", "bg-muted-foreground"],
  ];
  return (
    <div
      className="flex flex-wrap gap-3"
      aria-label="Attendance calendar legend"
    >
      {items.map(([label, className]) => (
        <span
          key={label}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            className={cn("size-2.5 rounded-full", className)}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function MonthlyRegister({
  data,
  focusedDate,
}: {
  data: StudentAttendanceMonthlyRegister;
  focusedDate: string | null;
}) {
  if (data.days.length === 0) return <MonthEmpty />;
  return (
    <section
      aria-labelledby="attendance-register-title"
      className="flex flex-col gap-3"
    >
      <div>
        <h3 id="attendance-register-title" className="font-semibold">
          Attendance register
        </h3>
        <p className="text-sm text-muted-foreground">
          Read-only daily detail for the selected month
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Academic day / session</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Arrival / check-in</TableHead>
              <TableHead>Remark / reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.days.map((day) => {
              const visual = getDayVisual(day);
              return (
                <TableRow
                  key={day.dateBs}
                  id={registerRowId(day.dateBs)}
                  tabIndex={-1}
                  className={cn(focusedDate === day.dateBs && "bg-primary/5")}
                >
                  <TableCell className="font-medium">{day.dateLabel}</TableCell>
                  <TableCell>{day.dayLabel}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{dayTypeLabel(day.dayType)}</span>
                      {day.calendarLabel ? (
                        <span className="text-xs text-muted-foreground">
                          {day.calendarLabel}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={visual.badgeVariant}>{visual.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {day.arrivalAt ? formatNepalTime(day.arrivalAt) : "—"}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {day.remark ?? day.holidayName ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

type DayVisual = {
  label: string;
  className: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

function getDayVisual(day: StudentAttendanceMonthlyRegisterDay): DayVisual {
  if (day.isFuture)
    return {
      label: "Future",
      className: "bg-muted/30 text-muted-foreground",
      badgeVariant: "secondary",
    };
  if (day.dayType === "HOLIDAY")
    return {
      label: "Holiday",
      className: "bg-secondary text-secondary-foreground",
      badgeVariant: "secondary",
    };
  if (day.dayType === "WEEKEND")
    return {
      label: "Weekend",
      className: "bg-secondary text-secondary-foreground",
      badgeVariant: "secondary",
    };
  if (day.attendanceStatus === "PRESENT")
    return {
      label: "Present",
      className: "bg-success-50 text-success-700",
      badgeVariant: "outline",
    };
  if (day.attendanceStatus === "ABSENT")
    return {
      label: "Absent",
      className: "bg-danger-50 text-danger-700",
      badgeVariant: "destructive",
    };
  if (day.attendanceStatus === "LATE")
    return {
      label: "Late",
      className: "bg-warning-50 text-warning-700",
      badgeVariant: "outline",
    };
  if (isLeaveStatus(day.attendanceStatus))
    return {
      label: "Leave",
      className: "bg-info-50 text-info-700",
      badgeVariant: "outline",
    };
  if (day.attendanceStatus === "HALF_DAY")
    return {
      label: "Half day",
      className: "bg-warning-50 text-warning-700",
      badgeVariant: "outline",
    };
  if (day.attendanceStatus === "NOT_MARKED")
    return {
      label: "Not marked",
      className: "bg-muted text-muted-foreground",
      badgeVariant: "outline",
    };
  if (day.dayType === "EXAM_DAY")
    return {
      label: "Exam day",
      className: "bg-info-50 text-info-700",
      badgeVariant: "outline",
    };
  return {
    label: "No record",
    className: "bg-muted/30 text-muted-foreground",
    badgeVariant: "outline",
  };
}

function isLeaveStatus(
  status: StudentAttendanceMonthlyRegisterDay["attendanceStatus"],
) {
  return (
    status === "LEAVE" ||
    status === "SICK_LEAVE" ||
    status === "EXCUSED_LEAVE" ||
    status === "UNEXCUSED_LEAVE" ||
    status === "ON_LEAVE"
  );
}

function dayTypeLabel(dayType: StudentAttendanceMonthlyRegisterDay["dayType"]) {
  if (dayType === "SCHOOL_DAY") return "School day";
  if (dayType === "EXAM_DAY") return "Exam day";
  if (dayType === "HOLIDAY") return "Holiday";
  return "Weekend / non-working";
}

function MonthStateBadge({
  state,
}: {
  state: NonNullable<StudentAttendanceMonthlyRegister["month"]>["state"];
}) {
  if (state === "CURRENT") return <Badge>Current month</Badge>;
  if (state === "PARTIAL") return <Badge variant="outline">Partial</Badge>;
  if (state === "NO_DATA") return <Badge variant="outline">No register</Badge>;
  if (state === "UPCOMING") return <Badge variant="secondary">Upcoming</Badge>;
  return <Badge variant="secondary">Completed</Badge>;
}

function AttendanceLoading() {
  return (
    <Card aria-busy="true" aria-label="Loading attendance month">
      <CardHeader className="border-b">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-[430px] w-full" />
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

function AttendanceRequestError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const apiError = error instanceof ApiRequestError ? error : null;
  const message = error.message.toLowerCase();
  if (apiError?.statusCode === 401) {
    return (
      <StateAlert
        icon={ShieldAlert}
        title="Session expired"
        description="Sign in again to view this student's attendance."
      />
    );
  }
  if (
    apiError?.statusCode === 403 &&
    (message.includes("module") || message.includes("entitlement"))
  ) {
    return (
      <StateAlert
        icon={ShieldAlert}
        title="Attendance module locked"
        description="Attendance is not enabled for this school."
      />
    );
  }
  if (apiError?.statusCode === 403) {
    return (
      <StateAlert
        icon={ShieldAlert}
        title="Permission denied"
        description="You do not have permission to view this student's attendance."
      />
    );
  }
  return (
    <Card>
      <CardContent>
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Selected month could not be loaded</AlertTitle>
          <AlertDescription className="gap-3">
            Attendance is temporarily unavailable. No previous-month data is
            being shown in its place.
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCcw />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function StateAlert({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldAlert;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent>
        <Alert>
          <Icon />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function AcademicCalendarUnavailable() {
  return (
    <Card>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>Academic calendar unavailable</EmptyTitle>
            <EmptyDescription>
              No enrolled academic year and calendar boundary is available for
              this student.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}

function MonthEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarDays />
        </EmptyMedia>
        <EmptyTitle>No attendance month available</EmptyTitle>
        <EmptyDescription>
          The backend returned no calendar days for this academic month.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function registerRowId(date: string) {
  return `attendance-register-${date}`;
}
