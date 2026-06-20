import type {
  AcademicCalendarSettings,
  AcademicCalendarYearSettings,
  CreateAcademicCalendarYearPayload,
  SchoolCalendarDaySettings,
  UpsertSchoolCalendarDayPayload,
} from '@schoolos/core';
import { request } from './client';

const basePath = '/settings/workspaces/academic-calendar';

export const academicCalendarSettingsApi = {
  getCalendar: (academicYearId?: string) => request<AcademicCalendarSettings>(
    `${basePath}${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`,
  ),
  createAcademicYear: (body: CreateAcademicCalendarYearPayload) => request<AcademicCalendarYearSettings>(
    `${basePath}/academic-years`,
    { method: 'POST', json: body },
  ),
  setCurrentAcademicYear: (academicYearId: string) => request<AcademicCalendarYearSettings>(
    `${basePath}/academic-years/${encodeURIComponent(academicYearId)}/set-current`,
    { method: 'POST' },
  ),
  upsertCalendarDay: (body: UpsertSchoolCalendarDayPayload) => request<SchoolCalendarDaySettings>(
    `${basePath}/days`,
    { method: 'POST', json: body },
  ),
};
