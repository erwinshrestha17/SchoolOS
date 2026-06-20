export type AcademicCalendarYearSettings = {
  id: string;
  name: string;
  startsOnBs: string;
  endsOnBs: string;
  isCurrent: boolean;
};

export type SchoolCalendarDaySettings = {
  id: string;
  calendarDateBs: string;
  isWorkingDay: boolean;
  label: string | null;
  holidayType: string | null;
};

export type AcademicCalendarSettings = {
  timeZone: 'Asia/Kathmandu';
  academicYears: AcademicCalendarYearSettings[];
  selectedAcademicYearId: string | null;
  calendarDays: SchoolCalendarDaySettings[];
};

export type CreateAcademicCalendarYearPayload = {
  name: string;
  startsOnBs: string;
  endsOnBs: string;
  isCurrent?: boolean;
};

export type UpsertSchoolCalendarDayPayload = {
  calendarDateBs: string;
  isWorkingDay: boolean;
  label?: string | null;
  holidayType?: string | null;
};
